import { apiClient } from '../../lib/api/api-client.js';
import { datahubQuery, leftJoin, pickAlias, pickAliasString } from '../../lib/api/datahub-query.js';
import { rowsFromEnvelope, type ApiEnvelope } from '../../lib/api/types.js';
import { formatMonthLabel } from '../../central-planning-app/lib/planning-sheet.load.js';
import {
	listShopfloorPlanLinesForPlans,
	monthKey,
	type PlnShopfloorPlanLineRow,
	type PlnShopfloorPlanRow
} from '../../central-planning-app/lib/pln.api.js';
import {
	formatDeliveryScheduleLabel,
	formatIsoDateDdMmYyyy,
	weightMtFromRollupKg
} from './create-plan-ds.utils.js';
import { bomScheduleBlockReasons, type BomScheduleGateRow } from './schedule-readiness.api.js';
import {
	getScheduleRequest,
	listRequestSources,
	rememberScheduleRequestLabel,
	scheduleRequestLabel,
	type ApsRequestSourceRow,
	type ApsScheduleRequestRow
} from './schedule-requests.api.js';

export type ScheduleSetupBomIssue = {
	code?: string;
	message: string;
};

export type ScheduleSetupBomRow = {
	id: string;
	bomId: string;
	bomName: string;
	projectId: string;
	projectName: string;
	workOrderCode: string;
	scheduleId: string;
	scheduleLabel: string;
	structureId: string;
	structureName: string;
	qty: number;
	unit: string;
	weightMt: number | null;
	ocrStatus: string;
	cpStatus: string;
	hasPublishedCp: boolean;
	issues: ScheduleSetupBomIssue[];
};

export type ScheduleSetupDetail = {
	planId: string;
	planName: string;
	errorMessage: string | null;
	errorCode: string | null;
	boms: ScheduleSetupBomRow[];
};

type DsRequirementRollupRow = {
	delivery_schedule_line_id: string;
	sets: number;
	required_weight_kg?: string | number | null;
	lines_without_weight?: number | null;
};

type ProjectRow = {
	project_id: string;
	name: string;
	metadata?: Record<string, unknown>;
};

type StructureRow = {
	structure_id: string;
	name: string;
};

type BomRow = BomScheduleGateRow & {
	structure_id?: string | null;
	bom_name?: string | null;
};

type PublishedCpRunRow = {
	bom_id: string;
};

type PlanRunRow = {
	run_id: string;
	status: string;
	error?: string | null;
	summary?: Record<string, unknown> | null;
	metadata?: { error_code?: string; [key: string]: unknown } | null;
	created_at?: string | null;
};

function idListParam(ids: string[]): string {
	return ids.map((id) => encodeURIComponent(id)).join(',');
}

function workOrderCode(metadata: Record<string, unknown> | undefined): string {
	const value = metadata?.work_order_no;
	return typeof value === 'string' ? value.trim() : '';
}

function issuesFromValidation(validation: unknown, bomId: string): ScheduleSetupBomIssue[] {
	if (!Array.isArray(validation)) return [];
	const issues: ScheduleSetupBomIssue[] = [];
	for (const entry of validation) {
		if (!entry || typeof entry !== 'object') continue;
		const row = entry as Record<string, unknown>;
		const entryBomId =
			typeof row.bom_id === 'string' ? row.bom_id : typeof row.bomId === 'string' ? row.bomId : '';
		if (entryBomId && entryBomId !== bomId) continue;
		const message =
			typeof row.message === 'string'
				? row.message
				: typeof row.reason === 'string'
					? row.reason
					: null;
		if (!message) continue;
		if (entryBomId || !bomId) {
			issues.push({
				code: typeof row.code === 'string' ? row.code : undefined,
				message
			});
		}
	}
	return issues;
}

function parseKg(value: unknown): number | null {
	if (value === null || value === undefined || value === '') return null;
	if (typeof value === 'number' && Number.isFinite(value)) return value;
	if (typeof value === 'string' && value.trim() !== '') {
		const parsed = Number(value);
		if (Number.isFinite(parsed)) return parsed;
	}
	return null;
}

async function loadLatestFailedRun(
	requestId: string,
	signal?: AbortSignal
): Promise<PlanRunRow | null> {
	// One round-trip: newest failed + completed, then keep failed only if still latest.
	const envelope = await apiClient.get<ApiEnvelope<PlanRunRow[]>>(
		apiClient.datahub(
			`aps_schedule_runs?request_id=${encodeURIComponent(requestId)}&status__in=failed,completed&orderBy=created_at:desc&select=run_id,status,error,summary,metadata,created_at&limit=20`
		),
		{ signal }
	);
	const rows = rowsFromEnvelope<PlanRunRow>(envelope.data);
	let failed: PlanRunRow | null = null;
	let completed: PlanRunRow | null = null;
	for (const row of rows) {
		if (!failed && row.status === 'failed') failed = row;
		if (!completed && row.status === 'completed') completed = row;
		if (failed && completed) break;
	}
	if (!failed) return null;
	if (completed) {
		const completedAt = Date.parse(completed.created_at ?? '');
		const failedAt = Date.parse(failed.created_at ?? '');
		if (Number.isFinite(completedAt) && Number.isFinite(failedAt) && completedAt >= failedAt) {
			return null;
		}
	}
	return failed;
}

/** Request header ⟕ sources — avoids a second aps_request_sources round-trip. */
async function loadScheduleRequestWithSources(
	requestId: string,
	signal?: AbortSignal
): Promise<{ request: ApsScheduleRequestRow; sources: ApsRequestSourceRow[] } | null> {
	const rows = await datahubQuery<Record<string, unknown>>(
		'aps_schedule_requests',
		{
			request_id: requestId,
			limit: 500,
			select: [
				'request_id',
				'plant_id',
				'name',
				'cadence',
				'horizon_start',
				'horizon_end',
				'status',
				'notes',
				'created_at',
				's.request_source_id',
				's.request_id',
				's.shopfloor_plan_id',
				's.created_at'
			].join(','),
			joins: [leftJoin('aps_request_sources', 's', 'request_id', 's.request_id')]
		},
		signal
	);
	if (rows.length === 0) return null;
	const first = rows[0];
	const request: ApsScheduleRequestRow = {
		request_id: String(first.request_id ?? requestId),
		plant_id: String(first.plant_id ?? ''),
		name: typeof first.name === 'string' ? first.name : null,
		cadence: String(first.cadence ?? 'monthly'),
		horizon_start: String(first.horizon_start ?? ''),
		horizon_end: String(first.horizon_end ?? ''),
		status: String(first.status ?? ''),
		notes: typeof first.notes === 'string' ? first.notes : null,
		created_at: typeof first.created_at === 'string' ? first.created_at : undefined
	};
	const seen = new Set<string>();
	const sources: ApsRequestSourceRow[] = [];
	for (const row of rows) {
		const sourceId = pickAliasString(row, 's', 'request_source_id');
		if (!sourceId || seen.has(sourceId)) continue;
		seen.add(sourceId);
		sources.push({
			request_source_id: sourceId,
			request_id: pickAliasString(row, 's', 'request_id') || request.request_id,
			shopfloor_plan_id: pickAliasString(row, 's', 'shopfloor_plan_id') || '',
			created_at: pickAliasString(row, 's', 'created_at') || undefined
		});
	}
	rememberScheduleRequestLabel(request.request_id, scheduleRequestLabel(request));
	return { request, sources: sources.filter((s) => s.shopfloor_plan_id) };
}

/** Shopfloor header ⟕ lines in one round-trip. */
async function loadShopfloorPlanWithLines(
	shopfloorPlanId: string,
	signal?: AbortSignal
): Promise<{ shopfloor: PlnShopfloorPlanRow; lines: PlnShopfloorPlanLineRow[] } | null> {
	const rows = await datahubQuery<Record<string, unknown>>(
		'pln_shopfloor_plans',
		{
			shopfloor_plan_id: shopfloorPlanId,
			limit: 5000,
			select: [
				'shopfloor_plan_id',
				'plant_id',
				'month',
				'name',
				'status',
				'source_central_plan_id',
				'sent_at',
				'sent_by',
				'edited_at',
				'frozen_at',
				'frozen_by',
				'created_at',
				'updated_at',
				'l.shopfloor_plan_line_id',
				'l.shopfloor_plan_id',
				'l.delivery_schedule_line_id',
				'l.quantity',
				'l.project_id',
				'l.project_name',
				'l.delivery_schedule_id',
				'l.delivery_schedule_name',
				'l.delivery_date',
				'l.structure_id',
				'l.tower_label',
				'l.bom_id',
				'l.bom_name',
				'l.carry_forward_qty',
				'l.carry_forward_to_month'
			].join(','),
			joins: [leftJoin('pln_shopfloor_plan_lines', 'l', 'shopfloor_plan_id', 'l.shopfloor_plan_id')]
		},
		signal
	);
	if (rows.length === 0) return null;
	const first = rows[0]!;
	const shopfloor: PlnShopfloorPlanRow = {
		shopfloor_plan_id: String(first.shopfloor_plan_id ?? shopfloorPlanId),
		plant_id: String(first.plant_id ?? ''),
		month: String(first.month ?? ''),
		name: typeof first.name === 'string' ? first.name : null,
		status: String(first.status ?? 'draft'),
		source_central_plan_id:
			typeof first.source_central_plan_id === 'string' ? first.source_central_plan_id : null,
		sent_at: typeof first.sent_at === 'string' ? first.sent_at : null,
		sent_by: typeof first.sent_by === 'string' ? first.sent_by : null,
		edited_at: typeof first.edited_at === 'string' ? first.edited_at : null,
		frozen_at: typeof first.frozen_at === 'string' ? first.frozen_at : null,
		frozen_by: typeof first.frozen_by === 'string' ? first.frozen_by : null,
		created_at: typeof first.created_at === 'string' ? first.created_at : undefined,
		updated_at: typeof first.updated_at === 'string' ? first.updated_at : null
	};
	const seen = new Set<string>();
	const lines: PlnShopfloorPlanLineRow[] = [];
	for (const row of rows) {
		const lineId = pickAliasString(row, 'l', 'shopfloor_plan_line_id');
		if (!lineId || seen.has(lineId)) continue;
		seen.add(lineId);
		lines.push({
			shopfloor_plan_line_id: lineId,
			shopfloor_plan_id:
				pickAliasString(row, 'l', 'shopfloor_plan_id') || shopfloor.shopfloor_plan_id,
			delivery_schedule_line_id: pickAliasString(row, 'l', 'delivery_schedule_line_id') || null,
			quantity: Number(pickAlias(row, 'l', 'quantity') ?? 0),
			project_id: pickAliasString(row, 'l', 'project_id') || null,
			project_name: pickAliasString(row, 'l', 'project_name') || null,
			delivery_schedule_id: pickAliasString(row, 'l', 'delivery_schedule_id') || null,
			delivery_schedule_name: pickAliasString(row, 'l', 'delivery_schedule_name') || null,
			delivery_date: pickAliasString(row, 'l', 'delivery_date') || null,
			structure_id: pickAliasString(row, 'l', 'structure_id') || null,
			tower_label: pickAliasString(row, 'l', 'tower_label') || null,
			bom_id: pickAliasString(row, 'l', 'bom_id') || null,
			bom_name: pickAliasString(row, 'l', 'bom_name') || null,
			carry_forward_qty: (() => {
				const v = pickAlias(row, 'l', 'carry_forward_qty');
				return v == null || v === '' ? null : Number(v);
			})(),
			carry_forward_to_month: pickAliasString(row, 'l', 'carry_forward_to_month') || null
		});
	}
	return { shopfloor, lines };
}

/** BOMs ⟕ structures ⟕ projects — OCR/CP gates + WO metadata in one round-trip. */
async function loadBomGateContext(
	bomIds: string[],
	signal?: AbortSignal
): Promise<{
	boms: BomRow[];
	projects: ProjectRow[];
	structures: StructureRow[];
}> {
	if (bomIds.length === 0) return { boms: [], projects: [], structures: [] };
	const rows = await datahubQuery<Record<string, unknown>>(
		'proj_boms',
		{
			bom_id__in: bomIds.join(','),
			limit: 5000,
			select: [
				'bom_id',
				'bom_name',
				'structure_id',
				'ocr_status',
				'cp_status',
				's.structure_id',
				's.name',
				's.project_id',
				'p.project_id',
				'p.name',
				'p.metadata'
			].join(','),
			joins: [
				leftJoin('proj_structures', 's', 'structure_id', 's.structure_id'),
				{
					entity: 'proj_projects',
					alias: 'p',
					type: 'left',
					on: [{ leftField: 's.project_id', op: 'eq', rightField: 'p.project_id' }]
				}
			]
		},
		signal
	);

	const bomById = new Map<string, BomRow>();
	const structureById = new Map<string, StructureRow>();
	const projectById = new Map<string, ProjectRow>();
	for (const row of rows) {
		const bomId = String(row.bom_id ?? '');
		if (bomId && !bomById.has(bomId)) {
			bomById.set(bomId, {
				bom_id: bomId,
				bom_name: typeof row.bom_name === 'string' ? row.bom_name : null,
				structure_id: typeof row.structure_id === 'string' ? row.structure_id : null,
				ocr_status: String(row.ocr_status ?? 'not_verified'),
				cp_status: String(row.cp_status ?? 'none')
			});
		}
		const structureId = pickAliasString(row, 's', 'structure_id');
		if (structureId && !structureById.has(structureId)) {
			structureById.set(structureId, {
				structure_id: structureId,
				name: pickAliasString(row, 's', 'name')
			});
		}
		const projectId = pickAliasString(row, 'p', 'project_id');
		if (projectId && !projectById.has(projectId)) {
			const metaRaw = pickAlias(row, 'p', 'metadata');
			projectById.set(projectId, {
				project_id: projectId,
				name: pickAliasString(row, 'p', 'name'),
				metadata:
					metaRaw && typeof metaRaw === 'object' && !Array.isArray(metaRaw)
						? (metaRaw as Record<string, unknown>)
						: undefined
			});
		}
	}
	return {
		boms: [...bomById.values()],
		structures: [...structureById.values()],
		projects: [...projectById.values()]
	};
}

/** Selected DS BOMs with OCR/CP readiness for the schedule-setup screen. */
export async function loadScheduleSetupDetail(
	planId: string,
	signal?: AbortSignal
): Promise<ScheduleSetupDetail | null> {
	try {
		const joinedRequest = await loadScheduleRequestWithSources(planId, signal);
		if (joinedRequest) {
			return loadScheduleSetupFromRequest(joinedRequest.request, joinedRequest.sources, signal);
		}
	} catch {
		// Join not granted / malformed — fall back to separate GETs.
		const request = await getScheduleRequest(planId, signal).catch(() => null);
		if (request) {
			rememberScheduleRequestLabel(request.request_id, scheduleRequestLabel(request));
			const sources = await listRequestSources(request.request_id, signal);
			return loadScheduleSetupFromRequest(request, sources, signal);
		}
	}

	const joined = await loadShopfloorPlanWithLines(planId, signal).catch(() => null);
	if (joined) {
		return loadScheduleSetupFromShopfloor(joined.shopfloor, joined.lines, signal);
	}
	return null;
}

async function loadScheduleSetupFromRequest(
	request: ApsScheduleRequestRow,
	sources: ApsRequestSourceRow[],
	signal?: AbortSignal
): Promise<ScheduleSetupDetail | null> {
	const requestId = request.request_id;
	if (sources.length === 0) {
		return {
			planId: requestId,
			planName: scheduleRequestLabel(request),
			errorMessage: 'This request has no shop-floor months. Add a source month before scheduling.',
			errorCode: 'aps.no_scope',
			boms: []
		};
	}

	const lines = await listShopfloorPlanLinesForPlans(
		sources.map((s) => s.shopfloor_plan_id),
		signal
	);

	return buildScheduleSetupFromShopfloorLines({
		planId: requestId,
		planName: scheduleRequestLabel(request),
		lines,
		signal,
		failedRunRequestId: requestId
	});
}

async function loadScheduleSetupFromShopfloor(
	shopfloor: PlnShopfloorPlanRow,
	lines: PlnShopfloorPlanLineRow[],
	signal?: AbortSignal
): Promise<ScheduleSetupDetail> {
	const planId = shopfloor.shopfloor_plan_id;
	const monthLabelKey = monthKey(String(shopfloor.month ?? ''));
	const planName =
		shopfloor.name?.trim() ||
		(monthLabelKey ? `Shop Floor · ${formatMonthLabel(monthLabelKey)}` : planId);

	return buildScheduleSetupFromShopfloorLines({
		planId,
		planName,
		lines,
		signal
	});
}

/**
 * Build Review Input from shop-floor line snapshots (qty + tree labels).
 * Live proj_* joins are only for OCR/CP gates, weight rollup, and work-order metadata.
 */
async function buildScheduleSetupFromShopfloorLines(input: {
	planId: string;
	planName: string;
	lines: PlnShopfloorPlanLineRow[];
	signal?: AbortSignal;
	failedRunRequestId?: string;
}): Promise<ScheduleSetupDetail> {
	const { planId, planName, signal, failedRunRequestId } = input;

	const scoped = input.lines.filter(
		(line) =>
			Boolean(line.bom_id?.trim()) &&
			Boolean(line.delivery_schedule_line_id?.trim() || line.delivery_schedule_id?.trim()) &&
			(Number(line.quantity) || 0) > 0
	);
	if (scoped.length === 0) {
		return {
			planId,
			planName,
			errorMessage: 'No delivery schedule lines are in scope for this request.',
			errorCode: 'aps.no_scope',
			boms: []
		};
	}

	type Agg = {
		bomId: string;
		bomName: string;
		projectId: string;
		projectName: string;
		scheduleId: string;
		scheduleName: string | null;
		deliveryDate: string | null;
		scheduleLineId: string;
		structureId: string;
		structureName: string;
		qty: number;
	};

	const byKey = new Map<string, Agg>();
	for (const line of scoped) {
		const bomId = line.bom_id!.trim();
		const scheduleId =
			line.delivery_schedule_id?.trim() ||
			`line:${line.delivery_schedule_line_id?.trim() || line.shopfloor_plan_line_id}`;
		const scheduleLineId = line.delivery_schedule_line_id?.trim() || line.shopfloor_plan_line_id;
		const key = `${scheduleId}|${bomId}`;
		const qty = Number(line.quantity) || 0;
		const prev = byKey.get(key);
		if (prev) {
			prev.qty += qty;
			continue;
		}
		byKey.set(key, {
			bomId,
			bomName: line.bom_name?.trim() || bomId,
			projectId: line.project_id?.trim() || '',
			projectName: line.project_name?.trim() || '',
			scheduleId,
			scheduleName: line.delivery_schedule_name?.trim() || null,
			deliveryDate: line.delivery_date?.trim() || null,
			scheduleLineId,
			structureId: line.structure_id?.trim() || '',
			structureName: line.tower_label?.trim() || '',
			qty
		});
	}

	const aggs = [...byKey.values()];
	const bomIds = [...new Set(aggs.map((row) => row.bomId))];
	const scheduleIds = [
		...new Set(aggs.map((row) => row.scheduleId).filter((id) => !id.startsWith('line:')))
	];
	const scheduleLineIds = [...new Set(aggs.map((row) => row.scheduleLineId).filter(Boolean))];

	const [failedRun, gateCtx, publishedRows, rollupRows] = await Promise.all([
		failedRunRequestId
			? loadLatestFailedRun(failedRunRequestId, signal)
			: Promise.resolve(null as PlanRunRow | null),
		loadBomGateContext(bomIds, signal),
		bomIds.length === 0
			? Promise.resolve([] as PublishedCpRunRow[])
			: apiClient
					.get<ApiEnvelope<PublishedCpRunRow[]>>(
						apiClient.datahub(
							`cp_plan_runs?status=published&bom_id__in=${idListParam(bomIds)}&select=bom_id&limit=5000`
						),
						{ signal }
					)
					.then((envelope) => rowsFromEnvelope<PublishedCpRunRow>(envelope.data)),
		scheduleLineIds.length === 0
			? Promise.resolve([] as DsRequirementRollupRow[])
			: apiClient
					.get<ApiEnvelope<DsRequirementRollupRow[]>>(
						apiClient.datahub(
							`inv_ds_requirement_rollup?delivery_schedule_line_id__in=${idListParam(scheduleLineIds)}&select=delivery_schedule_line_id,sets,required_weight_kg,lines_without_weight&limit=5000`
						),
						{ signal }
					)
					.then((envelope) => rowsFromEnvelope<DsRequirementRollupRow>(envelope.data))
					.catch(() =>
						scheduleIds.length === 0
							? []
							: apiClient
									.get<ApiEnvelope<DsRequirementRollupRow[]>>(
										apiClient.datahub(
											`inv_ds_requirement_rollup?delivery_schedule_id__in=${idListParam(scheduleIds)}&select=delivery_schedule_line_id,sets,required_weight_kg,lines_without_weight&limit=5000`
										),
										{ signal }
									)
									.then((envelope) => rowsFromEnvelope<DsRequirementRollupRow>(envelope.data))
					)
	]);

	const failedErrorCode =
		typeof failedRun?.metadata?.error_code === 'string' ? failedRun.metadata.error_code : null;

	const { boms, projects, structures } = gateCtx;

	const publishedCpBomIds = new Set(publishedRows.map((row) => row.bom_id));
	const bomById = new Map(boms.map((bom) => [bom.bom_id, bom]));
	const projectById = new Map(projects.map((project) => [project.project_id, project]));
	const structureById = new Map(structures.map((structure) => [structure.structure_id, structure]));
	const rollupByLineId = new Map(
		rollupRows.map((row) => [
			row.delivery_schedule_line_id,
			{
				sets: Number.isFinite(row.sets) ? row.sets : 0,
				requiredWeightKg:
					(row.lines_without_weight ?? 0) > 0 ? null : parseKg(row.required_weight_kg)
			}
		])
	);
	const validation = failedRun?.summary?.validation;

	const rows: ScheduleSetupBomRow[] = [];
	for (const agg of aggs) {
		const bom = bomById.get(agg.bomId);
		const project = agg.projectId ? projectById.get(agg.projectId) : undefined;
		const structureId = bom?.structure_id ?? agg.structureId;
		const structure = structureId ? structureById.get(structureId) : undefined;
		const gateRow: BomScheduleGateRow = {
			bom_id: agg.bomId,
			ocr_status: bom?.ocr_status ?? 'not_verified',
			cp_status: bom?.cp_status ?? 'none'
		};
		const gateIssues = bomScheduleBlockReasons(gateRow, publishedCpBomIds).map((message) => ({
			message
		}));
		const runIssues = issuesFromValidation(validation, agg.bomId);
		const rollup = rollupByLineId.get(agg.scheduleLineId);
		const weightMt = weightMtFromRollupKg(
			rollup?.requiredWeightKg ?? null,
			rollup?.sets ?? agg.qty,
			agg.qty
		);
		const scheduleLabel = formatDeliveryScheduleLabel(
			agg.scheduleName,
			agg.deliveryDate ? formatIsoDateDdMmYyyy(agg.deliveryDate.slice(0, 10)) : ''
		);

		rows.push({
			id: `${agg.scheduleId}-${agg.bomId}`,
			bomId: agg.bomId,
			bomName: bom?.bom_name?.trim() || agg.bomName,
			projectId: agg.projectId || project?.project_id || 'unknown',
			projectName: project?.name ?? (agg.projectName || 'Unknown project'),
			workOrderCode: workOrderCode(project?.metadata),
			scheduleId: agg.scheduleId,
			scheduleLabel: scheduleLabel || agg.scheduleId,
			structureId: structureId || '',
			structureName: structure?.name ?? (agg.structureName || '-'),
			qty: agg.qty,
			unit: 'Set',
			weightMt,
			ocrStatus: bom?.ocr_status ?? 'not_verified',
			cpStatus: bom?.cp_status ?? 'none',
			hasPublishedCp: publishedCpBomIds.has(agg.bomId),
			issues: runIssues.length > 0 ? runIssues : gateIssues
		});
	}

	rows.sort((a, b) => {
		const byProject = a.projectName.localeCompare(b.projectName);
		if (byProject !== 0) return byProject;
		const bySchedule = a.scheduleLabel.localeCompare(b.scheduleLabel);
		if (bySchedule !== 0) return bySchedule;
		return a.bomName.localeCompare(b.bomName);
	});

	const currentScopeReady = rows.length > 0 && rows.every((row) => row.issues.length === 0);
	// Stale failed runs on a reused request (e.g. prior months' BOMs) must not block
	// Review Input when the current shop-floor scope is already OCR/CP-ready.
	const hardFailure =
		!currentScopeReady &&
		failedRun !== null &&
		failedErrorCode !== 'aps.validation' &&
		Boolean(failedRun.error?.trim());
	const errorCode =
		(hardFailure ? (failedErrorCode ?? 'aps.run_failed') : null) ??
		(rows.some((row) => row.issues.length > 0) ? 'aps.validation' : null);
	const errorMessage =
		(hardFailure ? failedRun?.error?.trim() : null) ||
		(errorCode === 'aps.validation'
			? 'Some BOMs in this plan are not ready for scheduling. Fix the items below and try again.'
			: null);

	return {
		planId,
		planName,
		errorMessage,
		errorCode,
		boms: rows
	};
}
