/**
 * Datahub + planning jobs for Central / Shop-Floor Planning (`pln_*`).
 * @see ifactoryai-core/docs/CENTRAL_SHOPFLOOR_PLANNING.md
 */
import {
	invCreate,
	invDelete,
	invList,
	invListByIds,
	invTxn,
	invUpdate,
	isInvTxnUnavailable
} from '../../rm-indent-app/lib/inv.api.js';
import { datahubQuery, leftJoin, pickAlias, pickAliasString } from '../../lib/api/datahub-query.js';
import { apiErrorFromJob } from '../../lib/api/api-error.js';
import { triggerJob, waitForJob, type AsyncJobRow } from '../../lib/api/jobs.js';
import { getPlanningActor } from './planning-actor.js';

export type PlnCentralPlanRow = {
	central_plan_id: string;
	name: string;
	plant_id: string;
	notes?: string | null;
	created_by?: string | null;
	updated_by?: string | null;
	created_at: string;
	updated_at?: string | null;
};

export type PlnCentralPlanLineRow = {
	central_plan_line_id: string;
	central_plan_id: string;
	delivery_schedule_line_id: string;
	month: string;
	quantity: number;
	carried_from_month?: string | null;
};

export type PlnShopfloorPlanRow = {
	shopfloor_plan_id: string;
	plant_id: string;
	month: string;
	name?: string | null;
	status: 'draft' | 'frozen' | string;
	source_central_plan_id?: string | null;
	sent_at?: string | null;
	sent_by?: string | null;
	edited_at?: string | null;
	frozen_at?: string | null;
	frozen_by?: string | null;
	created_at?: string;
	updated_at?: string | null;
};

export type PlnShopfloorPlanLineRow = {
	shopfloor_plan_line_id: string;
	shopfloor_plan_id: string;
	delivery_schedule_line_id?: string | null;
	quantity: number;
	project_id?: string | null;
	project_name?: string | null;
	delivery_schedule_id?: string | null;
	delivery_schedule_name?: string | null;
	delivery_date?: string | null;
	structure_id?: string | null;
	tower_label?: string | null;
	bom_id?: string | null;
	bom_name?: string | null;
	carry_forward_qty?: number | null;
	carry_forward_to_month?: string | null;
};

/** Normalize any month input to first-of-month `YYYY-MM-01` (and UI key `YYYY-MM`). */
export function monthKey(input: string): string {
	const raw = input.trim();
	if (/^\d{4}-\d{2}$/.test(raw)) return raw;
	if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 7);
	return raw.slice(0, 7);
}

export function monthDate(input: string): string {
	const key = monthKey(input);
	return `${key}-01`;
}

export function bomNodeIdForDsLine(deliveryScheduleLineId: string): string {
	return `dsl:${deliveryScheduleLineId}`;
}

export function dsLineIdFromBomNodeId(bomNodeId: string): string | null {
	if (!bomNodeId.startsWith('dsl:')) return null;
	return bomNodeId.slice(4);
}

const PLAN_SELECT =
	'central_plan_id,name,plant_id,notes,created_by,updated_by,created_at,updated_at';
const LINE_SELECT =
	'central_plan_line_id,central_plan_id,delivery_schedule_line_id,month,quantity,carried_from_month';
const SF_PLAN_SELECT =
	'shopfloor_plan_id,plant_id,month,name,status,source_central_plan_id,sent_at,sent_by,edited_at,frozen_at,frozen_by,created_at,updated_at';
const SF_LINE_SELECT =
	'shopfloor_plan_line_id,shopfloor_plan_id,delivery_schedule_line_id,quantity,project_id,project_name,delivery_schedule_id,delivery_schedule_name,delivery_date,structure_id,tower_label,bom_id,bom_name,carry_forward_qty,carry_forward_to_month';

export async function listCentralPlans(
	plantId: string,
	signal?: AbortSignal
): Promise<PlnCentralPlanRow[]> {
	return invList<PlnCentralPlanRow>(
		'pln_central_plans',
		{
			plant_id: plantId,
			select: PLAN_SELECT,
			orderBy: 'updated_at:desc'
		},
		signal
	);
}

export async function listAllCentralPlans(signal?: AbortSignal): Promise<PlnCentralPlanRow[]> {
	return invList<PlnCentralPlanRow>(
		'pln_central_plans',
		{ select: PLAN_SELECT, orderBy: 'updated_at:desc' },
		signal
	);
}

const centralPlanInflight = new Map<string, Promise<PlnCentralPlanRow | null>>();
/** Header rows reused within the SPA session (breadcrumb + sheet open). */
const centralPlanById = new Map<string, PlnCentralPlanRow>();

export async function getCentralPlan(
	centralPlanId: string,
	signal?: AbortSignal
): Promise<PlnCentralPlanRow | null> {
	const id = centralPlanId.trim();
	if (!id) return null;

	const cached = centralPlanById.get(id);
	if (cached) return cached;

	const existing = centralPlanInflight.get(id);
	if (existing) return existing;

	const promise = invList<PlnCentralPlanRow>(
		'pln_central_plans',
		{ central_plan_id: id, select: PLAN_SELECT, limit: 1 },
		signal
	)
		.then((rows) => {
			const row = rows[0] ?? null;
			if (row) centralPlanById.set(id, row);
			return row;
		})
		.finally(() => {
			if (centralPlanInflight.get(id) === promise) centralPlanInflight.delete(id);
		});

	centralPlanInflight.set(id, promise);
	return promise;
}

export async function createCentralPlan(
	input: { name: string; plantId: string; notes?: string },
	signal?: AbortSignal
): Promise<PlnCentralPlanRow> {
	const actor = getPlanningActor();
	return invCreate<PlnCentralPlanRow>(
		'pln_central_plans',
		{
			name: input.name.trim(),
			plant_id: input.plantId,
			notes: input.notes ?? null,
			created_by: actor,
			updated_by: actor
		},
		signal
	);
}

export async function updateCentralPlanMeta(
	centralPlanId: string,
	data: { name?: string; updatedBy?: string },
	signal?: AbortSignal
): Promise<PlnCentralPlanRow> {
	const patch: Record<string, unknown> = {
		updated_by: data.updatedBy ?? getPlanningActor()
	};
	if (data.name != null) patch.name = data.name.trim();
	const row = await invUpdate<PlnCentralPlanRow>('pln_central_plans', centralPlanId, patch, signal);
	centralPlanById.set(centralPlanId, row);
	return row;
}

export async function deleteCentralPlan(
	centralPlanId: string,
	signal?: AbortSignal
): Promise<void> {
	const frozenSources = await invList<PlnShopfloorPlanRow>(
		'pln_shopfloor_plans',
		{
			source_central_plan_id: centralPlanId,
			status: 'frozen',
			select: SF_PLAN_SELECT,
			limit: 500
		},
		signal
	);
	if (frozenSources.length > 0) {
		const months = [
			...new Set(frozenSources.map((row) => monthKey(String(row.month))).filter(Boolean))
		].sort();
		const monthList = months.join(', ');
		const err = new Error(
			months.length === 1
				? `Shop-floor plan for ${monthList} is frozen. Unfreeze it before deleting this central plan.`
				: `Shop-floor plans for ${monthList} are frozen. Unfreeze them before deleting this central plan.`
		) as Error & { code?: string };
		err.code = 'pln.month_frozen';
		throw err;
	}
	await invDelete('pln_central_plans', centralPlanId, signal);
	centralPlanById.delete(centralPlanId);
}

export async function listCentralPlanLines(
	centralPlanId: string,
	signal?: AbortSignal
): Promise<PlnCentralPlanLineRow[]> {
	return invList<PlnCentralPlanLineRow>(
		'pln_central_plan_lines',
		{ central_plan_id: centralPlanId, select: LINE_SELECT, limit: 5000 },
		signal
	);
}

export type DesiredCentralLine = {
	deliveryScheduleLineId: string;
	month: string;
	quantity: number;
};

/**
 * Diff desired sparse allocations against existing rows; batch create/update/delete.
 * Skips months in `frozenMonthKeys` (YYYY-MM) — those are server-owned.
 */
export async function saveCentralPlanLines(
	centralPlanId: string,
	desired: DesiredCentralLine[],
	frozenMonthKeys: ReadonlySet<string>,
	signal?: AbortSignal
): Promise<void> {
	const existing = await listCentralPlanLines(centralPlanId, signal);
	const existingByKey = new Map<string, PlnCentralPlanLineRow>();
	for (const row of existing) {
		const m = monthKey(String(row.month));
		existingByKey.set(`${row.delivery_schedule_line_id}|${m}`, row);
	}

	const desiredByKey = new Map<string, DesiredCentralLine>();
	for (const line of desired) {
		const m = monthKey(line.month);
		if (frozenMonthKeys.has(m)) continue;
		const qty = Math.max(0, Math.round(line.quantity));
		if (qty <= 0) continue;
		desiredByKey.set(`${line.deliveryScheduleLineId}|${m}`, {
			deliveryScheduleLineId: line.deliveryScheduleLineId,
			month: m,
			quantity: qty
		});
	}

	type Op = {
		op: 'create' | 'update' | 'delete';
		entity: string;
		id?: string;
		data?: Record<string, unknown>;
	};
	const ops: Op[] = [];

	for (const [key, want] of desiredByKey) {
		const prev = existingByKey.get(key);
		if (!prev) {
			ops.push({
				op: 'create',
				entity: 'pln_central_plan_lines',
				data: {
					central_plan_id: centralPlanId,
					delivery_schedule_line_id: want.deliveryScheduleLineId,
					month: monthDate(want.month),
					quantity: want.quantity
				}
			});
		} else if (Number(prev.quantity) !== want.quantity) {
			ops.push({
				op: 'update',
				entity: 'pln_central_plan_lines',
				id: prev.central_plan_line_id,
				data: { quantity: want.quantity }
			});
		}
	}

	for (const [key, prev] of existingByKey) {
		const m = monthKey(String(prev.month));
		if (frozenMonthKeys.has(m)) continue;
		if (desiredByKey.has(key)) continue;
		ops.push({
			op: 'delete',
			entity: 'pln_central_plan_lines',
			id: prev.central_plan_line_id
		});
	}

	if (ops.length === 0) return;

	const chunks: Op[][] = [];
	for (let i = 0; i < ops.length; i += 50) chunks.push(ops.slice(i, i + 50));

	for (const chunk of chunks) {
		try {
			await invTxn(chunk, signal);
		} catch (error) {
			if (!isInvTxnUnavailable(error)) throw error;
			for (const op of chunk) {
				if (op.op === 'create' && op.data) {
					await invCreate('pln_central_plan_lines', op.data, signal);
				} else if (op.op === 'update' && op.id && op.data) {
					await invUpdate('pln_central_plan_lines', op.id, op.data, signal);
				} else if (op.op === 'delete' && op.id) {
					await invDelete('pln_central_plan_lines', op.id, signal);
				}
			}
		}
	}

	await invUpdate('pln_central_plans', centralPlanId, { updated_by: getPlanningActor() }, signal);
}

export async function duplicateCentralPlan(
	sourcePlanId: string,
	name: string,
	signal?: AbortSignal
): Promise<PlnCentralPlanRow> {
	const source = await getCentralPlan(sourcePlanId, signal);
	if (!source) throw new Error('Plan not found.');
	const created = await createCentralPlan({ name, plantId: source.plant_id }, signal);
	const lines = await listCentralPlanLines(sourcePlanId, signal);
	const desired: DesiredCentralLine[] = lines
		.filter((l) => Number(l.quantity) > 0)
		.map((l) => ({
			deliveryScheduleLineId: l.delivery_schedule_line_id,
			month: monthKey(String(l.month)),
			quantity: Number(l.quantity)
		}));
	await saveCentralPlanLines(created.central_plan_id, desired, new Set(), signal);
	return created;
}

export async function listShopfloorPlans(
	plantId: string,
	signal?: AbortSignal
): Promise<PlnShopfloorPlanRow[]> {
	return invList<PlnShopfloorPlanRow>(
		'pln_shopfloor_plans',
		{
			plant_id: plantId,
			select: SF_PLAN_SELECT,
			orderBy: 'month:desc'
		},
		signal
	);
}

export async function listFrozenShopfloorPlans(
	plantId: string,
	signal?: AbortSignal
): Promise<PlnShopfloorPlanRow[]> {
	return invList<PlnShopfloorPlanRow>(
		'pln_shopfloor_plans',
		{
			plant_id: plantId,
			status: 'frozen',
			select: SF_PLAN_SELECT,
			limit: 500
		},
		signal
	);
}

export async function getShopfloorPlan(
	shopfloorPlanId: string,
	signal?: AbortSignal
): Promise<PlnShopfloorPlanRow | null> {
	const rows = await invList<PlnShopfloorPlanRow>(
		'pln_shopfloor_plans',
		{ shopfloor_plan_id: shopfloorPlanId, select: SF_PLAN_SELECT, limit: 1 },
		signal
	);
	return rows[0] ?? null;
}

/**
 * Deletes the shop-floor header; lines + carry-forwards cascade.
 * Frozen plans must be unfrozen first — except orphans whose central plan was already
 * deleted (source_central_plan_id null): those cannot be opened for a normal unfreeze,
 * so we reopen them here then delete.
 */
export async function deleteShopfloorPlan(
	shopfloorPlanId: string,
	signal?: AbortSignal
): Promise<void> {
	const existing = await getShopfloorPlan(shopfloorPlanId, signal);
	if (!existing) return;
	if (existing.status === 'frozen') {
		const orphaned = !existing.source_central_plan_id;
		if (!orphaned) {
			const err = new Error(
				'This month is frozen on the shop floor. Unfreeze it before deleting.'
			) as Error & { code?: string };
			err.code = 'pln.month_frozen';
			throw err;
		}
		// Triggers block line DELETE while frozen; unfreeze first so cascade can run.
		await unfreezeShopfloorMonth(shopfloorPlanId, signal);
	}
	await invDelete('pln_shopfloor_plans', shopfloorPlanId, signal);
}

export async function listShopfloorPlanLines(
	shopfloorPlanId: string,
	signal?: AbortSignal
): Promise<PlnShopfloorPlanLineRow[]> {
	return invList<PlnShopfloorPlanLineRow>(
		'pln_shopfloor_plan_lines',
		{ shopfloor_plan_id: shopfloorPlanId, select: SF_LINE_SELECT, limit: 5000 },
		signal
	);
}

/** Batch lines for many shopfloor plans (avoids N+1 frozen hydrate). */
export async function listShopfloorPlanLinesForPlans(
	shopfloorPlanIds: string[],
	signal?: AbortSignal
): Promise<PlnShopfloorPlanLineRow[]> {
	return invListByIds<PlnShopfloorPlanLineRow>(
		'pln_shopfloor_plan_lines',
		'shopfloor_plan_id',
		shopfloorPlanIds,
		SF_LINE_SELECT,
		signal
	);
}

export type ShopFloorMonthJoined = {
	central: PlnCentralPlanRow;
	shopfloor: PlnShopfloorPlanRow;
	lines: PlnShopfloorPlanLineRow[];
};

/**
 * One round-trip for SFP month sheet: SF header ⟕ lines ⟕ central plan.
 * Filter: source_central_plan_id + month (first-of-month date).
 */
export async function fetchShopFloorMonthJoined(
	centralPlanId: string,
	month: string,
	signal?: AbortSignal
): Promise<ShopFloorMonthJoined | null> {
	const rows = await datahubQuery<Record<string, unknown>>(
		'pln_shopfloor_plans',
		{
			source_central_plan_id: centralPlanId,
			month: monthDate(month),
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
				'c.central_plan_id',
				'c.name',
				'c.plant_id',
				'c.notes',
				'c.created_by',
				'c.updated_by',
				'c.created_at',
				'c.updated_at',
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
			joins: [
				leftJoin('pln_central_plans', 'c', 'source_central_plan_id', 'c.central_plan_id'),
				leftJoin('pln_shopfloor_plan_lines', 'l', 'shopfloor_plan_id', 'l.shopfloor_plan_id')
			]
		},
		signal
	);
	if (rows.length === 0) return null;

	const first = rows[0]!;
	const centralId = pickAliasString(first, 'c', 'central_plan_id') || centralPlanId;
	const central: PlnCentralPlanRow = {
		central_plan_id: centralId,
		name: pickAliasString(first, 'c', 'name') || String(first.name ?? ''),
		plant_id: pickAliasString(first, 'c', 'plant_id') || String(first.plant_id ?? ''),
		notes: (() => {
			const n = pickAlias(first, 'c', 'notes');
			return typeof n === 'string' ? n : null;
		})(),
		created_by: pickAliasString(first, 'c', 'created_by') || null,
		updated_by: pickAliasString(first, 'c', 'updated_by') || null,
		created_at: pickAliasString(first, 'c', 'created_at') || String(first.created_at ?? ''),
		updated_at: pickAliasString(first, 'c', 'updated_at') || null
	};
	centralPlanById.set(central.central_plan_id, central);

	const shopfloor: PlnShopfloorPlanRow = {
		shopfloor_plan_id: String(first.shopfloor_plan_id ?? ''),
		plant_id: String(first.plant_id ?? central.plant_id),
		month: String(first.month ?? monthDate(month)),
		name: typeof first.name === 'string' ? first.name : null,
		status: String(first.status ?? 'draft'),
		source_central_plan_id: String(first.source_central_plan_id ?? centralPlanId),
		sent_at: typeof first.sent_at === 'string' ? first.sent_at : null,
		sent_by: typeof first.sent_by === 'string' ? first.sent_by : null,
		edited_at: typeof first.edited_at === 'string' ? first.edited_at : null,
		frozen_at: typeof first.frozen_at === 'string' ? first.frozen_at : null,
		frozen_by: typeof first.frozen_by === 'string' ? first.frozen_by : null,
		created_at: typeof first.created_at === 'string' ? first.created_at : undefined,
		updated_at: typeof first.updated_at === 'string' ? first.updated_at : null
	};
	if (!shopfloor.shopfloor_plan_id) return null;

	const seenLine = new Set<string>();
	const lines: PlnShopfloorPlanLineRow[] = [];
	for (const row of rows) {
		const lineId = pickAliasString(row, 'l', 'shopfloor_plan_line_id');
		if (!lineId || seenLine.has(lineId)) continue;
		seenLine.add(lineId);
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

	return { central, shopfloor, lines };
}

export async function updateShopfloorPlanLineQty(
	shopfloorPlanLineId: string,
	quantity: number,
	signal?: AbortSignal
): Promise<PlnShopfloorPlanLineRow> {
	return invUpdate<PlnShopfloorPlanLineRow>(
		'pln_shopfloor_plan_lines',
		shopfloorPlanLineId,
		{ quantity: Math.max(0, Math.round(quantity)) },
		signal
	);
}

async function runPlanningJob(
	request: Record<string, unknown>,
	signal?: AbortSignal
): Promise<AsyncJobRow> {
	const started = await triggerJob('planning', request, signal);
	const done = await waitForJob(started.job_id, {
		intervalMsSchedule: [500, 1000, 2000],
		timeoutMs: 120_000,
		signal
	});
	if (done.status === 'failed') throw apiErrorFromJob(done);
	return done;
}

export type SendToShopfloorResult = {
	shopfloor_plan_id: string;
	plant_id: string;
	month: string;
	lines_sent?: number;
	lines_removed?: number;
};

export async function sendToShopfloor(
	centralPlanId: string,
	month: string,
	signal?: AbortSignal
): Promise<SendToShopfloorResult> {
	const job = await runPlanningJob(
		{ op: 'send_to_shopfloor', central_plan_id: centralPlanId, month: monthDate(month) },
		signal
	);
	const ref = (job.result_ref ?? {}) as SendToShopfloorResult;
	return ref;
}

export type FreezeMonthResult = {
	month?: string;
	lines_frozen?: number;
	lines_with_carry?: number;
	carry_total?: number;
	central_plans_settled?: number;
	allocations_dropped?: number;
	allocations_carried?: number;
	already_frozen?: boolean;
};

export async function freezeShopfloorMonth(
	shopfloorPlanId: string,
	signal?: AbortSignal
): Promise<FreezeMonthResult> {
	const job = await runPlanningJob(
		{ op: 'freeze_month', shopfloor_plan_id: shopfloorPlanId },
		signal
	);
	return (job.result_ref ?? {}) as FreezeMonthResult;
}

export async function unfreezeShopfloorMonth(
	shopfloorPlanId: string,
	signal?: AbortSignal
): Promise<void> {
	await runPlanningJob({ op: 'unfreeze_month', shopfloor_plan_id: shopfloorPlanId }, signal);
}

/** Catalog-ish copy when job only stamps `metadata.error_code`. */
export const PLN_JOB_MESSAGES: Record<string, string> = {
	'pln.default': 'Planning could not complete this action. Please try again.',
	'pln.bad_request': 'That planning request is missing something we need.',
	'pln.plan_not_found': 'That plan could not be found.',
	'pln.month_invalid': 'Please choose a valid month.',
	'pln.month_frozen':
		'This month is frozen on the shop floor and can no longer be changed. Unfreeze it first.',
	'pln.month_empty':
		'This plan has no quantities for the selected month, so there is nothing to send.',
	'pln.already_frozen': 'This month is already frozen.',
	'pln.not_frozen': 'This month has not been frozen yet.',
	'pln.plan_empty': 'This shop-floor plan has no lines to freeze.',
	'pln.carry_target_unavailable':
		'The leftover quantity has nowhere to go — every later month is already frozen.'
};
