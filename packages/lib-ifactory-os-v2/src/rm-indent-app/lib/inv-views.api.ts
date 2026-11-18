import { invList } from './inv.api.js';
import { num, numOrNull } from './inv.num.js';
import { toPlanMonthDate } from './plan-month.js';
import type {
	DsRequirementRow,
	DsRequirementRollupRow,
	PlanLockSummaryRow,
	StockAvailableLengthRow
} from './inv.types.js';

function parseBool(value: unknown): boolean {
	return value === true || value === 'true' || value === 1 || value === '1';
}

export function parsePlanLockSummaryRow(row: Record<string, unknown>): PlanLockSummaryRow {
	const itemRaw = row.item_id;
	const itemId =
		itemRaw === null || itemRaw === undefined || itemRaw === '' ? null : String(itemRaw);
	const unresolved = parseBool(row.unresolved) || itemId === null;
	const structureRaw = row.structure_id;
	const structureId =
		structureRaw === null || structureRaw === undefined || structureRaw === ''
			? null
			: String(structureRaw);
	const runRaw = row.run_id;
	return {
		row_key: String(row.row_key ?? `${itemId ?? 'unresolved'}|${row.length_mm ?? ''}`),
		central_plan_id:
			typeof row.central_plan_id === 'string' && row.central_plan_id ? row.central_plan_id : null,
		month: typeof row.month === 'string' ? row.month : null,
		project_id: String(row.project_id ?? ''),
		project_name: String(row.project_name ?? ''),
		delivery_schedule_id: String(row.delivery_schedule_id ?? ''),
		delivery_schedule_name: String(row.delivery_schedule_name ?? ''),
		delivery_schedule_line_id: String(row.delivery_schedule_line_id ?? ''),
		structure_id: structureId,
		tower_label: String(row.tower_label ?? ''),
		bom_id: String(row.bom_id ?? ''),
		bom_name: String(row.bom_name ?? ''),
		item_id: itemId,
		item_code: String(row.item_code ?? ''),
		section: String(row.section ?? ''),
		length_mm: Math.round(num(row.length_mm as string | number | null | undefined)),
		variant_key: String(row.variant_key ?? ''),
		required_qty_base: num(row.required_qty_base as string | number | null | undefined),
		remaining_qty_base: num(row.remaining_qty_base as string | number | null | undefined),
		indented_qty_base: num(row.indented_qty_base as string | number | null | undefined),
		procure_qty_base: num(row.procure_qty_base as string | number | null | undefined),
		free_qty_base: num(row.free_qty_base as string | number | null | undefined),
		locked_qty_base: num(row.locked_qty_base as string | number | null | undefined),
		unit_weight_kg_m: numOrNull(row.unit_weight_kg_m as string | number | null | undefined),
		required_weight_kg: numOrNull(row.required_weight_kg as string | number | null | undefined),
		procure_weight_kg: numOrNull(row.procure_weight_kg as string | number | null | undefined),
		free_weight_kg: numOrNull(row.free_weight_kg as string | number | null | undefined),
		locked_weight_kg: numOrNull(row.locked_weight_kg as string | number | null | undefined),
		unresolved,
		runs_unpinned: Math.max(
			0,
			Math.floor(num(row.runs_unpinned as string | number | null | undefined))
		),
		committed: parseBool(row.committed),
		plan_count: Math.max(
			1,
			Math.floor(num(row.plan_count as string | number | null | undefined) || 1)
		),
		run_id: runRaw === null || runRaw === undefined || runRaw === '' ? null : String(runRaw)
	};
}

export async function listPlanLockSummary(input: {
	projectId?: string;
	month?: string;
	signal?: AbortSignal;
}): Promise<PlanLockSummaryRow[]> {
	const rows = await invList<Record<string, unknown>>(
		'inv_plan_lock_summary',
		{
			project_id: input.projectId,
			month: input.month ? toPlanMonthDate(input.month) : undefined,
			limit: 5000
		},
		input.signal
	);
	return rows.map(parsePlanLockSummaryRow);
}

/**
 * Same rule as `scopeToPlan` in build-indent: never GET-filter by central_plan_id.
 * Keep rows that name this plan, or committed shop-floor rows (central_plan_id is null).
 * Uncommitted + null = two central plans share the cell (`plan_count > 1`) — leave them out.
 */
export function planLockRowsForCentralPlan(
	rows: PlanLockSummaryRow[],
	centralPlanId?: string
): PlanLockSummaryRow[] {
	if (!centralPlanId) return rows;
	return rows.filter(
		(row) =>
			row.central_plan_id === centralPlanId || (row.committed && row.central_plan_id === null)
	);
}

/** @deprecated Use listPlanLockSummary. */
export function listMpLockSummary(input: {
	projectId: string;
	mfgPlanRef?: string;
	month?: string;
	signal?: AbortSignal;
}): Promise<PlanLockSummaryRow[]> {
	return listPlanLockSummary({
		projectId: input.projectId,
		month: input.month,
		signal: input.signal
	});
}

export async function listStockAvailableLengths(input: {
	projectId: string;
	itemId: string;
	signal?: AbortSignal;
}): Promise<StockAvailableLengthRow[]> {
	const rows = await invList<Record<string, unknown>>(
		'inv_stock_available_lengths',
		{
			project_id: input.projectId,
			item_id: input.itemId,
			limit: 5000
		},
		input.signal
	);
	return rows.map((row) => ({
		item_id: String(row.item_id ?? input.itemId),
		length_mm: Math.round(num(row.length_mm as string | number | null | undefined)),
		bundles: Math.max(0, Math.floor(num(row.bundles as string | number | null | undefined))),
		free_qty_base: num(row.free_qty_base as string | number | null | undefined)
	}));
}

function parseDsRequirementRow(row: Record<string, unknown>): DsRequirementRow {
	const itemRaw = row.item_id;
	const itemId =
		itemRaw === null || itemRaw === undefined || itemRaw === '' ? null : String(itemRaw);
	return {
		row_key: String(row.row_key ?? ''),
		delivery_schedule_line_id: String(row.delivery_schedule_line_id ?? ''),
		delivery_schedule_id: String(row.delivery_schedule_id ?? ''),
		project_id: String(row.project_id ?? ''),
		structure_id:
			row.structure_id === null || row.structure_id === undefined || row.structure_id === ''
				? null
				: String(row.structure_id),
		bom_id: String(row.bom_id ?? ''),
		run_id:
			row.run_id === null || row.run_id === undefined || row.run_id === ''
				? null
				: String(row.run_id),
		run_version: numOrNull(row.run_version as string | number | null | undefined),
		run_pinned: parseBool(row.run_pinned),
		plan_section: String(row.plan_section ?? ''),
		base_section:
			row.base_section === null || row.base_section === undefined || row.base_section === ''
				? null
				: String(row.base_section),
		item_id: itemId,
		item_code:
			row.item_code === null || row.item_code === undefined || row.item_code === ''
				? null
				: String(row.item_code),
		length_mm: Math.round(num(row.length_mm as string | number | null | undefined)),
		variant_key: String(row.variant_key ?? ''),
		sets: Math.max(0, Math.floor(num(row.sets as string | number | null | undefined))),
		per_set_qty_base: num(row.per_set_qty_base as string | number | null | undefined),
		required_qty_base: num(row.required_qty_base as string | number | null | undefined),
		unit_weight_kg_m: numOrNull(row.unit_weight_kg_m as string | number | null | undefined),
		required_weight_kg: numOrNull(row.required_weight_kg as string | number | null | undefined)
	};
}

export async function listDsRequirements(input: {
	projectId: string;
	signal?: AbortSignal;
}): Promise<DsRequirementRow[]> {
	const rows = await invList<Record<string, unknown>>(
		'inv_ds_requirements',
		{
			project_id: input.projectId,
			limit: 5000
		},
		input.signal
	);
	return rows.map(parseDsRequirementRow);
}

function parseDsRequirementRollupRow(row: Record<string, unknown>): DsRequirementRollupRow {
	const centralPlanId =
		typeof row.central_plan_id === 'string' && row.central_plan_id
			? row.central_plan_id
			: typeof row.mfg_plan_ref === 'string'
				? row.mfg_plan_ref
				: '';
	return {
		central_plan_id: centralPlanId,
		mfg_plan_ref: centralPlanId,
		month: typeof row.month === 'string' ? row.month : null,
		delivery_schedule_id: String(row.delivery_schedule_id ?? ''),
		delivery_schedule_line_id: String(row.delivery_schedule_line_id ?? ''),
		project_id: String(row.project_id ?? ''),
		structure_id:
			row.structure_id === null || row.structure_id === undefined || row.structure_id === ''
				? null
				: String(row.structure_id),
		bom_id:
			row.bom_id === null || row.bom_id === undefined || row.bom_id === ''
				? null
				: String(row.bom_id),
		run_id:
			row.run_id === null || row.run_id === undefined || row.run_id === ''
				? null
				: String(row.run_id),
		sets: Math.max(0, Math.floor(num(row.sets as string | number | null | undefined))),
		required_qty_base: num(row.required_qty_base as string | number | null | undefined),
		required_weight_kg: numOrNull(row.required_weight_kg as string | number | null | undefined),
		marking_weight_kg: numOrNull(row.marking_weight_kg as string | number | null | undefined),
		lines_without_weight: Math.max(
			0,
			Math.floor(num(row.lines_without_weight as string | number | null | undefined))
		),
		unresolved_sections: Math.max(
			0,
			Math.floor(num(row.unresolved_sections as string | number | null | undefined))
		)
	};
}

export async function listDsRequirementRollup(input: {
	centralPlanId?: string;
	/** @deprecated use centralPlanId */
	mfgPlanRef?: string;
	projectId?: string;
	signal?: AbortSignal;
}): Promise<DsRequirementRollupRow[]> {
	const centralPlanId = input.centralPlanId ?? input.mfgPlanRef;
	const rows = await invList<Record<string, unknown>>(
		'inv_ds_requirement_rollup',
		{
			...(centralPlanId ? { central_plan_id: centralPlanId } : {}),
			project_id: input.projectId,
			limit: 5000
		},
		input.signal
	);
	return rows.map(parseDsRequirementRollupRow);
}

/** Format kg as MT; null → em dash. */
export function formatWeightMt(kg: number | null | undefined, digits = 3): string {
	if (kg == null || !Number.isFinite(kg)) return '-';
	return (kg / 1000).toFixed(digits);
}
