/**
 * Schedule requests (`aps_schedule_requests`) — plant × horizon.
 * Do not use `aps_manufacturing_plans` / `aps_plan_runs`.
 * @see ifactoryai-core/docs/APS_SCHEDULING_UI_INTEGRATION.md
 */
import { invCreate, invCreateMany, invDelete, invList } from '../../rm-indent-app/lib/inv.api.js';
import { formatMonthLabel } from '../../central-planning-app/lib/planning-sheet.load.js';
import {
	getShopfloorPlan,
	listShopfloorPlans,
	type PlnShopfloorPlanRow
} from '../../central-planning-app/lib/pln.api.js';
import { monthRangeFromPlanMonth } from './create-plan-ds.utils.js';

export type ApsCadence = 'monthly' | 'weekly' | 'daily';

export type ApsScheduleRequestRow = {
	request_id: string;
	plant_id: string;
	name?: string | null;
	cadence: ApsCadence | string;
	horizon_start: string;
	horizon_end: string;
	status: string;
	notes?: string | null;
	created_at?: string;
};

export type ApsRequestSourceRow = {
	request_source_id: string;
	request_id: string;
	shopfloor_plan_id: string;
	created_at?: string;
};

const REQUEST_SELECT =
	'request_id,plant_id,name,cadence,horizon_start,horizon_end,status,notes,created_at';
const SOURCE_SELECT = 'request_source_id,request_id,shopfloor_plan_id,created_at';

const requestLabelById = new Map<string, string>();

export function getScheduleRequestLabel(requestId: string): string {
	return requestLabelById.get(requestId) ?? requestId;
}

export function rememberScheduleRequestLabel(requestId: string, name: string): void {
	const trimmed = name.trim();
	if (trimmed) requestLabelById.set(requestId, trimmed);
	else requestLabelById.delete(requestId);
}

export function scheduleRequestLabel(
	row: Pick<ApsScheduleRequestRow, 'name' | 'horizon_start' | 'plant_id'>
): string {
	const named = row.name?.trim();
	if (named) return named;
	const month = formatMonthLabel(row.horizon_start?.slice(0, 7) ?? '');
	return month ? `${row.plant_id} · ${month}` : row.plant_id;
}

export async function listScheduleRequests(
	plantId?: string,
	signal?: AbortSignal
): Promise<ApsScheduleRequestRow[]> {
	return invList<ApsScheduleRequestRow>(
		'aps_schedule_requests',
		{
			...(plantId ? { plant_id: plantId } : {}),
			select: REQUEST_SELECT,
			orderBy: 'created_at:desc',
			limit: 500
		},
		signal
	);
}

export async function getScheduleRequest(
	requestId: string,
	signal?: AbortSignal
): Promise<ApsScheduleRequestRow | null> {
	const rows = await invList<ApsScheduleRequestRow>(
		'aps_schedule_requests',
		{ request_id: requestId, select: REQUEST_SELECT, limit: 1 },
		signal
	);
	return rows[0] ?? null;
}

export async function ensureScheduleRequestLabel(
	requestId: string,
	signal?: AbortSignal
): Promise<string> {
	if (requestLabelById.has(requestId)) return getScheduleRequestLabel(requestId);
	const row = await getScheduleRequest(requestId, signal);
	if (row) rememberScheduleRequestLabel(row.request_id, scheduleRequestLabel(row));
	return getScheduleRequestLabel(requestId);
}

export async function createScheduleRequest(
	input: {
		plantId: string;
		horizonStart: string;
		horizonEnd: string;
		cadence?: ApsCadence;
		name?: string;
	},
	signal?: AbortSignal
): Promise<ApsScheduleRequestRow> {
	return invCreate<ApsScheduleRequestRow>(
		'aps_schedule_requests',
		{
			plant_id: input.plantId,
			horizon_start: input.horizonStart,
			horizon_end: input.horizonEnd,
			cadence: input.cadence ?? 'monthly',
			...(input.name?.trim() ? { name: input.name.trim() } : {})
		},
		signal
	);
}

export async function listRequestSources(
	requestId: string,
	signal?: AbortSignal
): Promise<ApsRequestSourceRow[]> {
	return invList<ApsRequestSourceRow>(
		'aps_request_sources',
		{ request_id: requestId, select: SOURCE_SELECT, limit: 500 },
		signal
	);
}

/** Replace source months. Empty list is valid (job will 422 `aps.no_scope`). */
export async function setRequestSources(
	requestId: string,
	shopfloorPlanIds: string[],
	signal?: AbortSignal
): Promise<void> {
	const existing = await listRequestSources(requestId, signal);
	const want = new Set(shopfloorPlanIds.filter(Boolean));
	const have = new Set(existing.map((row) => row.shopfloor_plan_id));
	await Promise.all(
		existing
			.filter((row) => !want.has(row.shopfloor_plan_id))
			.map((row) => invDelete('aps_request_sources', row.request_source_id, signal))
	);
	const toCreate = shopfloorPlanIds
		.filter((id) => id && !have.has(id))
		.map((shopfloor_plan_id) => ({ request_id: requestId, shopfloor_plan_id }));
	if (toCreate.length > 0) {
		await invCreateMany('aps_request_sources', toCreate, signal);
	}
}

export type RequestSourceMonth = PlnShopfloorPlanRow & { selected: boolean };

/** Draft months may be scheduled; they cannot be published (§6). */
export function requestHasDraftSources(
	months: Array<{ status: string; selected?: boolean }>
): boolean {
	return months.some((row) => (row.selected ?? true) && row.status !== 'frozen');
}

export async function loadRequestSourceMonths(
	request: ApsScheduleRequestRow,
	signal?: AbortSignal
): Promise<RequestSourceMonth[]> {
	const [plans, sources] = await Promise.all([
		listShopfloorPlans(request.plant_id, signal),
		listRequestSources(request.request_id, signal)
	]);
	const selected = new Set(sources.map((row) => row.shopfloor_plan_id));
	return plans.map((plan) => ({ ...plan, selected: selected.has(plan.shopfloor_plan_id) }));
}

/**
 * Open an APS request for this shop-floor month, or create one.
 *
 * Reuse only when a linked request already has the **same display name** as the
 * current shop-floor plan (e.g. resending "Demo 8th Sep"). If the SF plan was
 * renamed / replaced (e.g. was "p-1", now "Demo 8th Sep"), create a **new**
 * request named after the plan — do not rename the old row.
 */
export async function openOrCreateRequestForShopfloor(
	shopfloorPlanId: string,
	signal?: AbortSignal
): Promise<ApsScheduleRequestRow> {
	const shopfloor = await getShopfloorPlan(shopfloorPlanId, signal);
	if (!shopfloor) throw new Error('Shop-floor plan not found');
	const range = monthRangeFromPlanMonth(shopfloor.month);
	if (!range) throw new Error('Shop-floor month is not a valid date');

	const desiredName =
		shopfloor.name?.trim() || `Shop Floor · ${formatMonthLabel(shopfloor.month.slice(0, 7))}`;

	const sources = await invList<ApsRequestSourceRow>(
		'aps_request_sources',
		{
			shopfloor_plan_id: shopfloorPlanId,
			select: SOURCE_SELECT,
			orderBy: 'created_at:desc',
			limit: 50
		},
		signal
	);

	for (const source of sources) {
		const existing = await getScheduleRequest(source.request_id, signal);
		if (!existing) continue;
		if (existing.name?.trim() === desiredName) {
			rememberScheduleRequestLabel(existing.request_id, scheduleRequestLabel(existing));
			return existing;
		}
	}

	const created = await createScheduleRequest(
		{
			plantId: shopfloor.plant_id,
			horizonStart: range.startDate,
			horizonEnd: range.endDate,
			cadence: 'monthly',
			name: desiredName
		},
		signal
	);
	await setRequestSources(created.request_id, [shopfloorPlanId], signal);
	rememberScheduleRequestLabel(created.request_id, scheduleRequestLabel(created));
	return created;
}
