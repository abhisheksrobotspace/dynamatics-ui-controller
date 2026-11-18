import { validateIndentLineEdits, type IndentLineEditDraft } from './indent-line-edit.js';
import { setIndentLabel } from './indent-routes.js';
import { invCreate, invCreateMany, invList, invTxn, isInvTxnUnavailable } from './inv.api.js';
import { datahubQuery, leftJoin, pickAlias, pickAliasString } from '../../lib/api/datahub-query.js';
import { buildIndent, reviseIndent } from './inv.jobs.js';
import { num, numOrNull } from './inv.num.js';
import type { BuildIndentLine, BuildIndentResult, InvStockLockRow } from './inv.types.js';
import { toPlanMonthDate } from './plan-month.js';
import {
	ensurePlanningSheetPlanLabel,
	getPlanningSheetPlanLabel
} from '../../central-planning-app/lib/planning-sheet.store.js';
import { shortNameFromMetadata } from '../../project-management-app/lib/projects/types.js';

/** Stored on `inv_indents.metadata` when created from a CP sheet plan + month. */
export const INDENT_SHEET_MONTH_META_KEY = 'sheet_month';

export type IndentListRow = {
	id: string;
	indent_no: number;
	revision: number;
	revision_label: string;
	batch: string;
	/** Display label for plan · month (was mfg_plan_ref). */
	plan_label: string;
	central_plan_id: string | null;
	plan_month: string | null;
	/** @deprecated alias of plan_label for older list columns. */
	mfg_plan_ref: string;
	/** `YYYY-MM` from plan_month or legacy metadata. */
	sheet_month: string | null;
	ht_mt: number;
	ms_mt: number;
	total_mt: number;
	created_at: string;
	created_label: string;
	status: string;
	project_id: string;
	plant_id: string;
};

export function sheetMonthFromMetadata(
	metadata: Record<string, unknown> | undefined | null
): string | null {
	const value = metadata?.[INDENT_SHEET_MONTH_META_KEY];
	return typeof value === 'string' && /^\d{4}-\d{2}$/.test(value) ? value : null;
}

export type IndentShortfallSource = {
	run_id: string;
	label: string;
	short_bars: number;
	project_id: string;
	plant_id: string;
	locked_at?: string | null;
};

export type IndentMatrixLine = BuildIndentLine & {
	procure_edit: number;
};

function formatCreated(iso: string): string {
	if (!iso) return '-';
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return '-';
	const dd = String(d.getDate()).padStart(2, '0');
	const mm = String(d.getMonth() + 1).padStart(2, '0');
	const yyyy = d.getFullYear();
	return `${dd}/${mm}/${yyyy}`;
}

function categoryFromCode(code: string): 'HT' | 'MS' | 'OTHER' {
	const upper = code.trim().toUpperCase();
	if (upper.startsWith('HT') || upper.includes(' HT ')) return 'HT';
	if (upper.startsWith('MS') || upper.includes(' MS ')) return 'MS';
	return 'OTHER';
}

/** Active shortfall CP runs for a project (sources for Generate Indent). */
export async function listIndentShortfallSources(
	projectId: string,
	signal?: AbortSignal
): Promise<IndentShortfallSource[]> {
	const locks = await invList<InvStockLockRow & Record<string, unknown>>(
		'inv_stock_locks',
		{
			project_id: projectId,
			owner_type: 'cutting_plan',
			status: 'active',
			select: 'lock_id,owner_id,owner_ref,short_base,plant_id,project_id,locked_at,status'
		},
		signal
	);

	const byRun = new Map<string, IndentShortfallSource>();
	for (const lock of locks) {
		const short = num(lock.short_base);
		if (short <= 0 || !lock.owner_id) continue;
		const runId = String(lock.owner_id);
		const existing = byRun.get(runId);
		if (existing) {
			existing.short_bars += short;
			continue;
		}
		byRun.set(runId, {
			run_id: runId,
			label: lock.owner_ref?.trim() || runId,
			short_bars: short,
			project_id: String(lock.project_id || projectId),
			plant_id: lock.plant_id,
			locked_at: lock.locked_at ?? null
		});
	}

	const runIds = [...byRun.keys()];
	if (runIds.length === 0) return [];

	const runRows = await datahubQuery<Record<string, unknown>>(
		'cp_plan_runs',
		{
			run_id__in: runIds.join(','),
			select: 'run_id,bom_id,version,b.bom_name,b.structure_id,s.name',
			joins: [
				leftJoin('proj_boms', 'b', 'bom_id', 'b.bom_id'),
				{
					entity: 'proj_structures',
					alias: 's',
					type: 'left',
					on: [{ leftField: 'b.structure_id', op: 'eq', rightField: 's.structure_id' }]
				}
			]
		},
		signal
	);

	for (const run of runRows) {
		const source = byRun.get(String(run.run_id ?? ''));
		if (!source) continue;
		const version = num(run.version);
		const versionLabel = Number.isFinite(version) ? `v${version}` : 'v-';
		const towerLabel = pickAliasString(run, 's', 'name').trim() || '-';
		const bomLabel = pickAliasString(run, 'b', 'bom_name').trim() || '-';
		source.label = `${versionLabel} - ${towerLabel} - ${bomLabel}`;
	}

	return [...byRun.values()].sort((a, b) => a.label.localeCompare(b.label));
}

function planMonthKeyFromRow(
	row: Record<string, unknown>,
	metadata: Record<string, unknown>
): string | null {
	const planMonth = typeof row.plan_month === 'string' ? row.plan_month.slice(0, 7) : null;
	if (planMonth && /^\d{4}-\d{2}$/.test(planMonth)) return planMonth;
	return sheetMonthFromMetadata(metadata);
}

function planLabelFromRow(
	row: Record<string, unknown>,
	sheetMonth: string | null,
	planName?: string | null
): string {
	const planId = typeof row.central_plan_id === 'string' ? row.central_plan_id : '';
	const name = planName?.trim() || planId;
	if (name && sheetMonth) return `${name} · ${sheetMonth}`;
	if (sheetMonth) return sheetMonth;
	if (name) return name;
	return '-';
}

async function resolveCentralPlanNames(
	planIds: Array<string | null | undefined>,
	signal?: AbortSignal
): Promise<Map<string, string>> {
	const unique = [...new Set(planIds.filter((id): id is string => Boolean(id && id.trim())))];
	await Promise.all(unique.map((id) => ensurePlanningSheetPlanLabel(id, signal)));
	return new Map(unique.map((id) => [id, getPlanningSheetPlanLabel(id)]));
}

export async function getIndents(
	signal?: AbortSignal,
	filter?: { projectId?: string; centralPlanId?: string; planMonth?: string }
): Promise<IndentListRow[]> {
	const rows = await invList<Record<string, unknown>>(
		'inv_indents',
		{
			select:
				'indent_id,indent_no,revision,batch_name,central_plan_id,plan_month,status,project_id,plant_id,metadata,created_at',
			orderBy: 'indent_no:desc',
			...(filter?.projectId ? { project_id: filter.projectId } : {}),
			...(filter?.centralPlanId ? { central_plan_id: filter.centralPlanId } : {}),
			...(filter?.planMonth ? { plan_month: filter.planMonth } : {})
		},
		signal
	);

	const planNames = await resolveCentralPlanNames(
		rows.map((row) => (typeof row.central_plan_id === 'string' ? row.central_plan_id : null)),
		signal
	);

	return rows
		.map((row) => {
			const metadata = (row.metadata ?? {}) as Record<string, unknown>;
			const ht = num(metadata.ht_mt);
			const ms = num(metadata.ms_mt);
			const total = num(metadata.total_mt) || ht + ms;
			const indentNo = num(row.indent_no);
			const revision = num(row.revision);
			const id = String(row.indent_id);
			const batch = typeof row.batch_name === 'string' ? row.batch_name : '-';
			const sheetMonth = planMonthKeyFromRow(row, metadata);
			const planId =
				typeof row.central_plan_id === 'string' && row.central_plan_id ? row.central_plan_id : '';
			const planLabel = planLabelFromRow(row, sheetMonth, planNames.get(planId));
			setIndentLabel(id, `#${indentNo} - R${revision}`);
			return {
				id,
				indent_no: indentNo,
				revision,
				revision_label: `R${revision}`,
				batch,
				plan_label: planLabel,
				central_plan_id: planId || null,
				plan_month: typeof row.plan_month === 'string' ? row.plan_month : null,
				mfg_plan_ref: planLabel,
				sheet_month: sheetMonth,
				ht_mt: ht,
				ms_mt: ms,
				total_mt: total,
				created_at: typeof row.created_at === 'string' ? row.created_at : '',
				created_label: formatCreated(typeof row.created_at === 'string' ? row.created_at : ''),
				status: typeof row.status === 'string' ? row.status : 'draft',
				project_id: typeof row.project_id === 'string' ? row.project_id : '',
				plant_id: typeof row.plant_id === 'string' ? row.plant_id : ''
			};
		})
		.sort((a, b) => b.indent_no - a.indent_no || b.revision - a.revision);
}

/** True when any indent already exists for this central plan + month. */
export async function planMonthAlreadyIndented(
	planId: string,
	month: string,
	signal?: AbortSignal
): Promise<boolean> {
	const rows = await getIndents(signal, {
		centralPlanId: planId,
		planMonth: toPlanMonthDate(month)
	});
	return rows.length > 0;
}

export async function assembleIndentDraft(input: {
	projectId: string;
	month: string;
	rows: string[];
	centralPlanId?: string;
	plantId?: string;
	batchName: string;
	excessPct: number;
	createdBy?: string;
	signal?: AbortSignal;
}): Promise<BuildIndentResult> {
	const plantId = input.plantId?.trim();
	return buildIndent(
		{
			project_id: input.projectId,
			month: input.month,
			rows: input.rows,
			...(input.centralPlanId ? { central_plan_id: input.centralPlanId } : {}),
			...(plantId ? { plant_id: plantId } : {}),
			batch_name: input.batchName,
			excess_pct: input.excessPct,
			created_by: input.createdBy ?? 'ui'
		},
		{ signal: input.signal }
	);
}

/** Scale line weight when procure_edit differs from draft procure_qty_base. */
function procureWeightKgForLine(line: IndentMatrixLine): number | null {
	const draftProcure = num(line.procure_qty_base);
	const draftKg = numOrNull(line.procure_weight_kg);
	if (draftKg == null) return null;
	if (draftProcure <= 0) return line.procure_edit > 0 ? null : 0;
	return (draftKg * line.procure_edit) / draftProcure;
}

function mtTotalsFromLines(lines: IndentMatrixLine[]): {
	ht_mt: number;
	ms_mt: number;
	total_mt: number;
} {
	let ht = 0;
	let ms = 0;
	let other = 0;
	for (const line of lines) {
		const kg = procureWeightKgForLine(line);
		if (kg == null) continue;
		const mt = kg / 1000;
		const cat = categoryFromCode(line.section || line.item_code || '');
		if (cat === 'HT') ht += mt;
		else if (cat === 'MS') ms += mt;
		else other += mt;
	}
	return { ht_mt: ht, ms_mt: ms, total_mt: ht + ms + other };
}

const MAX_TXN_OPS = 500;

export async function saveIndentDocument(input: {
	draft: BuildIndentResult;
	matrixLines: IndentMatrixLine[];
	createdBy?: string;
	/** Merged into header metadata (e.g. CP `sheet_month`). */
	metadataExtra?: Record<string, unknown>;
	signal?: AbortSignal;
}): Promise<{ indent_id: string; indent_no: number; revision: number }> {
	const indentId = crypto.randomUUID();
	const totals = mtTotalsFromLines(input.matrixLines);
	const draftHeader = input.draft.indent;
	const header = {
		indent_id: indentId,
		plant_id: String(draftHeader.plant_id ?? ''),
		central_plan_id: draftHeader.central_plan_id ?? undefined,
		plan_month: draftHeader.plan_month ?? undefined,
		project_id: String(draftHeader.project_id ?? ''),
		batch_name: String(draftHeader.batch_name ?? ''),
		excess_pct: num(draftHeader.excess_pct),
		status: 'draft',
		revision: 0,
		created_by: input.createdBy ?? 'ui',
		metadata: { ...totals, ...(input.metadataExtra ?? {}) }
	};

	const sources = input.draft.sources.map((source) => ({
		indent_source_id: crypto.randomUUID(),
		indent_id: indentId,
		source_type: source.source_type,
		source_id: source.source_id,
		source_ref: source.source_ref,
		label: source.label,
		sort_order: source.sort_order ?? 0
	}));

	const lineRows = input.matrixLines.map((line, index) => {
		const indentLineId = crypto.randomUUID();
		const requiredWeightKg = numOrNull(line.required_weight_kg);
		const procureWeightKg = procureWeightKgForLine(line);
		return {
			indent_line_id: indentLineId,
			indent_id: indentId,
			item_id: line.item_id,
			sort_order: line.sort_order ?? index,
			base_uom: line.base_uom || 'PCS',
			variant_key: line.variant_key || '',
			required_qty_base: num(line.required_qty_base),
			allowance_pct: num(line.allowance_pct),
			stock_qty_base: num(line.stock_qty_base),
			locked_qty_base: num(line.locked_qty_base),
			carried_shortfall_base: 0,
			cp_recommended_length_mm: line.cp_recommended_length_mm ?? null,
			procure_qty_base: num(line.procure_edit),
			required_weight_kg: requiredWeightKg,
			procure_weight_kg: procureWeightKg,
			scheme_snapshot: line.scheme_snapshot ?? [],
			components: (line.components ?? []).map((component, order) => {
				const dsLine =
					typeof component.delivery_schedule_line_id === 'string'
						? component.delivery_schedule_line_id.trim()
						: '';
				const lengthMm = numOrNull(component.length_mm as string | number | null | undefined);
				return {
					component_id: crypto.randomUUID(),
					indent_line_id: indentLineId,
					source_type: component.source_type,
					source_id: component.source_id,
					...(dsLine ? { delivery_schedule_line_id: dsLine } : {}),
					...(lengthMm != null && lengthMm > 0 ? { length_mm: lengthMm } : {}),
					label: String(component.label ?? ''),
					multiplier: component.multiplier,
					qty_base: component.qty_base,
					sort_order: component.sort_order ?? order
				};
			})
		};
	});

	const lineCreates = lineRows.map((row) => {
		const { components, ...line } = row;
		void components;
		return line;
	});
	const componentCreates = lineRows.flatMap((line) => line.components);

	const ops = [
		{ op: 'create' as const, entity: 'inv_indents', data: header },
		...sources.map((data) => ({ op: 'create' as const, entity: 'inv_indent_sources', data })),
		...lineCreates.map((data) => ({ op: 'create' as const, entity: 'inv_indent_lines', data }))
	];

	try {
		if (ops.length + componentCreates.length <= MAX_TXN_OPS) {
			await invTxn(
				[
					...ops,
					...componentCreates.map((data) => ({
						op: 'create' as const,
						entity: 'inv_indent_line_components',
						data
					}))
				],
				input.signal
			);
		} else {
			await invTxn(ops, input.signal);
			if (componentCreates.length > 0) {
				await invCreateMany(
					'inv_indent_line_components',
					componentCreates as unknown as Record<string, unknown>[],
					input.signal
				);
			}
		}
	} catch (error) {
		// ponytail: gateway may lack /txn - sequential creates
		if (!isInvTxnUnavailable(error)) throw error;
		await invCreate('inv_indents', header, input.signal);
		if (sources.length) {
			await invCreateMany(
				'inv_indent_sources',
				sources as unknown as Record<string, unknown>[],
				input.signal
			);
		}
		if (lineCreates.length) {
			await invCreateMany(
				'inv_indent_lines',
				lineCreates as unknown as Record<string, unknown>[],
				input.signal
			);
		}
		if (componentCreates.length) {
			await invCreateMany(
				'inv_indent_line_components',
				componentCreates as unknown as Record<string, unknown>[],
				input.signal
			);
		}
	}

	const created = await invList<Record<string, unknown>>(
		'inv_indents',
		{ indent_id: indentId, select: 'indent_id,indent_no,revision', limit: 1 },
		input.signal
	);
	const row = created[0];
	const indentNo = num(row?.indent_no);
	const revision = num(row?.revision);
	setIndentLabel(indentId, `#${indentNo} - R${revision}`);
	return { indent_id: indentId, indent_no: indentNo, revision };
}

export type IndentDetailRecord = {
	indent: IndentListRow & {
		excess_pct: number;
		notes?: string | null;
		/** `work_order_no - short_name|name` from joined `proj_projects`. */
		project_label: string;
	};
	sources: Array<Record<string, unknown>>;
	lines: Array<
		Record<string, unknown> & {
			item_code?: string;
			section?: string;
			scheme_label?: string;
		}
	>;
};

function projectLabelFromJoinedRow(
	row: Record<string, unknown>,
	fallbackProjectId: string
): string {
	const name = pickAliasString(row, 'p', 'name').trim();
	const metaRaw = pickAlias(row, 'p', 'metadata');
	const metadata =
		metaRaw && typeof metaRaw === 'object' && !Array.isArray(metaRaw)
			? (metaRaw as Record<string, unknown>)
			: undefined;
	const short = shortNameFromMetadata(metadata);
	const wo = typeof metadata?.work_order_no === 'string' ? metadata.work_order_no.trim() : '';
	const displayName = short || name || fallbackProjectId || '-';
	return wo ? `${wo} - ${displayName}` : displayName;
}

export async function getIndentDetailLive(
	indentId: string,
	signal?: AbortSignal
): Promise<IndentDetailRecord | null> {
	const headers = await datahubQuery<Record<string, unknown>>(
		'inv_indents',
		{
			indent_id: indentId,
			limit: 1,
			select: [
				'indent_id',
				'indent_no',
				'revision',
				'revision_of_indent_id',
				'batch_name',
				'central_plan_id',
				'plan_month',
				'excess_pct',
				'status',
				'project_id',
				'plant_id',
				'metadata',
				'created_at',
				'notes',
				'p.name',
				'p.metadata'
			].join(','),
			joins: [leftJoin('proj_projects', 'p', 'project_id', 'p.project_id')]
		},
		signal
	);
	const header = headers[0];
	if (!header) return null;

	const indentNo = num(header.indent_no);
	const projectId = typeof header.project_id === 'string' ? header.project_id : '';
	const projectLabel = projectLabelFromJoinedRow(header, projectId);

	const [sources, lines] = await Promise.all([
		invList<Record<string, unknown>>(
			'inv_indent_sources',
			{ indent_id: indentId, orderBy: 'sort_order:asc' },
			signal
		),
		datahubQuery<Record<string, unknown>>(
			'inv_indent_lines',
			{
				indent_id: indentId,
				orderBy: 'sort_order:asc',
				select: [
					'indent_line_id',
					'indent_id',
					'item_id',
					'sort_order',
					'base_uom',
					'display_uom',
					'required_qty_base',
					'allowance_pct',
					'stock_qty_base',
					'locked_qty_base',
					'carried_shortfall_base',
					'procure_qty_base',
					'procure_length_mm',
					'overridden_length_mm',
					'cp_recommended_length_mm',
					'required_weight_kg',
					'procure_weight_kg',
					'variant_key',
					'scheme_snapshot',
					'notes',
					'metadata',
					'i.item_code',
					'i.name',
					'i.material_grade'
				].join(','),
				joins: [leftJoin('inv_items', 'i', 'item_id', 'i.item_id')]
			},
			signal
		)
	]);

	const metadata = (header.metadata ?? {}) as Record<string, unknown>;
	const revision = num(header.revision);
	const sheetMonth = planMonthKeyFromRow(header, metadata);
	const headerPlanId =
		typeof header.central_plan_id === 'string' && header.central_plan_id
			? header.central_plan_id
			: '';
	const planNames = await resolveCentralPlanNames([headerPlanId || null], signal);
	const planLabel = planLabelFromRow(header, sheetMonth, planNames.get(headerPlanId));
	const listRow: IndentListRow = {
		id: String(header.indent_id),
		indent_no: indentNo,
		revision,
		revision_label: `R${revision}`,
		batch: typeof header.batch_name === 'string' ? header.batch_name : '-',
		plan_label: planLabel,
		central_plan_id: headerPlanId || null,
		plan_month: typeof header.plan_month === 'string' ? header.plan_month : null,
		mfg_plan_ref: planLabel,
		sheet_month: sheetMonth,
		ht_mt: num(metadata.ht_mt),
		ms_mt: num(metadata.ms_mt),
		total_mt: num(metadata.total_mt),
		created_at: typeof header.created_at === 'string' ? header.created_at : '',
		created_label: formatCreated(typeof header.created_at === 'string' ? header.created_at : ''),
		status: typeof header.status === 'string' ? header.status : 'draft',
		project_id: projectId,
		plant_id: typeof header.plant_id === 'string' ? header.plant_id : ''
	};

	setIndentLabel(listRow.id, `#${listRow.indent_no} - ${listRow.revision_label}`);

	return {
		indent: {
			...listRow,
			excess_pct: num(header.excess_pct),
			notes: typeof header.notes === 'string' ? header.notes : null,
			project_label: projectLabel
		},
		sources,
		lines: lines.map((line) => {
			const itemCode = pickAliasString(line, 'i', 'item_code').trim() || '-';
			const itemName = pickAliasString(line, 'i', 'name').trim();
			const scheme = Array.isArray(line.scheme_snapshot) ? line.scheme_snapshot : [];
			const first = scheme[0] as { scheme?: string; count?: number } | undefined;
			return {
				...line,
				item_code: itemCode,
				section: itemName || itemCode,
				scheme_label: first?.scheme
					? `${first.scheme}${first.count != null ? ` x ${first.count}` : ''}`
					: '-'
			};
		})
	};
}

export function toMatrixLines(draft: BuildIndentResult): IndentMatrixLine[] {
	return draft.lines.map((line) => ({
		...line,
		procure_edit: num(line.procure_qty_base)
	}));
}

/** Persist Indent Detail edits via revise_indent (do not PATCH length/qty). */
export async function saveIndentLineEdits(input: {
	indentId: string;
	edits: IndentLineEditDraft[];
	signal?: AbortSignal;
}): Promise<void> {
	const error = validateIndentLineEdits(input.edits);
	if (error) throw new Error(error);

	await reviseIndent(
		{
			indent_id: input.indentId,
			lines: input.edits.map((edit) => {
				const recommended = Math.round(edit.cp_recommended_length_mm);
				const procureLength = Math.round(edit.procure_length_mm);
				const lengthChanged = procureLength !== recommended;
				return {
					indent_line_id: edit.indent_line_id,
					...(lengthChanged
						? { overridden_length_mm: procureLength }
						: edit.had_override
							? { overridden_length_mm: null }
							: {}),
					procure_qty_base: Math.max(0, edit.procure_qty_base)
				};
			})
		},
		{ signal: input.signal }
	);
}
