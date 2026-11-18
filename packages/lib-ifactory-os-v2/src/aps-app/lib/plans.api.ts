import { apiClient } from '../../lib/api/api-client.js';
import { rowsFromEnvelope, type ApiEnvelope } from '../../lib/api/types.js';
import type { CreatePlanDeliveryScheduleInput } from './create-plan-ds.types.js';

export type ApsProductionPlanLinkRow = {
	aps_production_plan_id: string;
	plan_id: string;
	project_id: string;
	production_plan_id: string;
	due_date?: string | null;
};

/** @deprecated Use {@link ApsProductionPlanLinkRow}. */
export type ApsPlanReleaseLinkRow = ApsProductionPlanLinkRow;

export type ApsManufacturingPlanRow = {
	plan_id: string;
	name?: string | null;
	month?: string | null;
	due_date?: string | null;
	priority?: number | null;
	status: string;
	summary?: Record<string, unknown>;
	plant_id?: string | null;
	latest_run_id?: string | null;
	created_by_user_id?: string | null;
	metadata?: Record<string, unknown>;
	created_at?: string;
	updated_at?: string | null;
};

export type PlanSummaryPayload = {
	production_plans: number;
	projects: number;
	work_orders: string[];
	structures: number;
	sets: number;
	batch_weight_mt: number;
	plants: string;
	zinc_req_mt: number;
};

export type CreatePlanProductionPlanInput = {
	projectId: string;
	productionPlanId: string;
	selectedLines: Record<string, number>;
	dueDate?: string | null;
};

/** @deprecated Use {@link CreatePlanProductionPlanInput}. */
export type CreatePlanReleaseInput = CreatePlanProductionPlanInput;

export type UpdateManufacturingPlanFieldsInput = {
	dueDate?: string | null;
	priority?: number | null;
};

export type CreateManufacturingPlanInput = {
	planId: string;
	name: string;
	month: string;
	/** First calendar day of `month` (`YYYY-MM-DD`). */
	periodStart: string;
	/** Last calendar day of `month` (`YYYY-MM-DD`). */
	periodEnd: string;
	dueDate?: string | null;
	priority?: number | null;
	summary: PlanSummaryPayload;
	plantId?: string | null;
};

const PLAN_LINK_SELECT = 'aps_production_plan_id,plan_id,project_id,production_plan_id,due_date';
const DS_LINK_SELECT =
	'aps_delivery_schedule_id,plan_id,project_id,delivery_schedule_id,plant_id,selected_lines';
const PLAN_ID_SELECT = 'plan_id';

export async function listPlanProductionPlanLinks(
	signal?: AbortSignal
): Promise<ApsProductionPlanLinkRow[]> {
	const envelope = await apiClient.get<ApiEnvelope<ApsProductionPlanLinkRow[]>>(
		apiClient.datahub(`aps_production_plans?select=${PLAN_LINK_SELECT}&limit=5000`),
		{ signal }
	);
	return rowsFromEnvelope<ApsProductionPlanLinkRow>(envelope.data);
}

/** @deprecated Use {@link listPlanProductionPlanLinks}. */
export const listPlanReleaseLinks = listPlanProductionPlanLinks;

export async function listPlanIds(signal?: AbortSignal): Promise<string[]> {
	const envelope = await apiClient.get<ApiEnvelope<Array<{ plan_id: string }>>>(
		apiClient.datahub(`aps_manufacturing_plans?select=${PLAN_ID_SELECT}&limit=5000`),
		{ signal }
	);
	return rowsFromEnvelope<{ plan_id: string }>(envelope.data).map((row) => row.plan_id);
}

const PLAN_LIST_SELECT = [
	'plan_id',
	'name',
	'month',
	'due_date',
	'priority',
	'status',
	'summary',
	'plant_id',
	'created_at'
].join(',');

export async function listManufacturingPlans(
	signal?: AbortSignal
): Promise<ApsManufacturingPlanRow[]> {
	const envelope = await apiClient.get<ApiEnvelope<ApsManufacturingPlanRow[]>>(
		apiClient.datahub(
			`aps_manufacturing_plans?orderBy=created_at:desc&select=${PLAN_LIST_SELECT}&limit=5000`
		),
		{ signal }
	);
	return rowsFromEnvelope<ApsManufacturingPlanRow>(envelope.data);
}

export async function getManufacturingPlan(
	planId: string,
	signal?: AbortSignal
): Promise<ApsManufacturingPlanRow | null> {
	const envelope = await apiClient.get<ApiEnvelope<ApsManufacturingPlanRow[]>>(
		apiClient.datahub(
			`aps_manufacturing_plans?plan_id=${encodeURIComponent(planId)}&select=${PLAN_LIST_SELECT}&limit=1`
		),
		{ signal }
	);
	return rowsFromEnvelope<ApsManufacturingPlanRow>(envelope.data)[0] ?? null;
}

export async function listPlanProductionPlanLinksForPlan(
	planId: string,
	signal?: AbortSignal
): Promise<ApsProductionPlanLinkRow[]> {
	const envelope = await apiClient.get<ApiEnvelope<ApsProductionPlanLinkRow[]>>(
		apiClient.datahub(
			`aps_production_plans?plan_id=${encodeURIComponent(planId)}&select=${PLAN_LINK_SELECT}&limit=5000`
		),
		{ signal }
	);
	return rowsFromEnvelope<ApsProductionPlanLinkRow>(envelope.data);
}

/** @deprecated Use {@link listPlanProductionPlanLinksForPlan}. */
export const listPlanReleaseLinksForPlan = listPlanProductionPlanLinksForPlan;

export type ApsDeliveryScheduleLinkRow = {
	aps_delivery_schedule_id: string;
	plan_id: string;
	project_id: string;
	delivery_schedule_id: string;
	plant_id: string;
	selected_lines?: Record<string, number> | null;
};

export async function listPlanDeliveryScheduleLinks(
	signal?: AbortSignal
): Promise<ApsDeliveryScheduleLinkRow[]> {
	const envelope = await apiClient.get<ApiEnvelope<ApsDeliveryScheduleLinkRow[]>>(
		apiClient.datahub(`aps_delivery_schedules?select=${DS_LINK_SELECT}&limit=5000`),
		{ signal }
	);
	return rowsFromEnvelope<ApsDeliveryScheduleLinkRow>(envelope.data);
}

export async function listPlanDeliveryScheduleLinksForPlan(
	planId: string,
	signal?: AbortSignal
): Promise<ApsDeliveryScheduleLinkRow[]> {
	const envelope = await apiClient.get<ApiEnvelope<ApsDeliveryScheduleLinkRow[]>>(
		apiClient.datahub(
			`aps_delivery_schedules?plan_id=${encodeURIComponent(planId)}&select=${DS_LINK_SELECT}&limit=5000`
		),
		{ signal }
	);
	return rowsFromEnvelope<ApsDeliveryScheduleLinkRow>(envelope.data);
}

export async function updateManufacturingPlanPlant(
	planId: string,
	plantId: string,
	signal?: AbortSignal
): Promise<void> {
	await apiClient.patch(
		apiClient.datahub(`aps_manufacturing_plans/${encodeURIComponent(planId)}`),
		{ plant_id: plantId },
		{ signal }
	);
}

export async function ensureDeliverySchedulePlants(
	scheduleIds: string[],
	plantId: string,
	signal?: AbortSignal
): Promise<void> {
	const uniqueIds = [...new Set(scheduleIds.filter(Boolean))];
	if (uniqueIds.length === 0) return;

	const envelope = await apiClient.get<
		ApiEnvelope<Array<{ delivery_schedule_id: string; plant_id?: string | null }>>
	>(
		apiClient.datahub(
			`proj_delivery_schedules?delivery_schedule_id__in=${uniqueIds.map((id) => encodeURIComponent(id)).join(',')}&select=delivery_schedule_id,plant_id&limit=5000`
		),
		{ signal }
	);

	const rows = rowsFromEnvelope<{ delivery_schedule_id: string; plant_id?: string | null }>(
		envelope.data
	);

	await Promise.all(
		rows
			.filter((row) => !(row.plant_id ?? '').trim())
			.map((row) =>
				apiClient.patch(
					apiClient.datahub(
						`proj_delivery_schedules/${encodeURIComponent(row.delivery_schedule_id)}`
					),
					{ plant_id: plantId },
					{ signal }
				)
			)
	);
}

export async function addPlanDeliverySchedule(
	planId: string,
	deliverySchedule: CreatePlanDeliveryScheduleInput,
	signal?: AbortSignal
): Promise<void> {
	await apiClient.post(
		apiClient.datahub('aps_delivery_schedules'),
		{
			plan_id: planId,
			project_id: deliverySchedule.projectId,
			delivery_schedule_id: deliverySchedule.deliveryScheduleId,
			plant_id: deliverySchedule.plantId,
			selected_lines: deliverySchedule.selectedLines,
			metadata: {}
		},
		{ signal }
	);
}

export async function updatePlanDeliverySchedule(
	apsDeliveryScheduleId: string,
	fields: { selectedLines?: Record<string, number> },
	signal?: AbortSignal
): Promise<void> {
	const body: Record<string, unknown> = {};
	if (fields.selectedLines !== undefined) body.selected_lines = fields.selectedLines;
	if (Object.keys(body).length === 0) return;
	await apiClient.patch(
		apiClient.datahub(`aps_delivery_schedules/${encodeURIComponent(apsDeliveryScheduleId)}`),
		body,
		{ signal }
	);
}

export async function deletePlanDeliverySchedule(
	apsDeliveryScheduleId: string,
	signal?: AbortSignal
): Promise<void> {
	await apiClient.delete(
		apiClient.datahub(`aps_delivery_schedules/${encodeURIComponent(apsDeliveryScheduleId)}`),
		{ signal }
	);
}

export async function syncPlanDeliverySchedules(
	planId: string,
	input: {
		initialLinks: ApsDeliveryScheduleLinkRow[];
		deliverySchedules: CreatePlanDeliveryScheduleInput[];
		summary: PlanSummaryPayload;
		plantId: string;
	},
	signal?: AbortSignal
): Promise<void> {
	await updateManufacturingPlanPlant(planId, input.plantId, signal);

	const scheduleIds = input.deliverySchedules.map((row) => row.deliveryScheduleId);
	await ensureDeliverySchedulePlants(scheduleIds, input.plantId, signal);

	const initialByScheduleId = new Map(
		input.initialLinks.map((link) => [link.delivery_schedule_id, link])
	);
	const nextScheduleIds = new Set(input.deliverySchedules.map((row) => row.deliveryScheduleId));

	const toRemove = input.initialLinks.filter(
		(link) => !nextScheduleIds.has(link.delivery_schedule_id)
	);
	const toAdd = input.deliverySchedules.filter(
		(row) => !initialByScheduleId.has(row.deliveryScheduleId)
	);
	const toUpdate = input.deliverySchedules.filter((row) =>
		initialByScheduleId.has(row.deliveryScheduleId)
	);

	await Promise.all([
		...toRemove.map((link) => deletePlanDeliverySchedule(link.aps_delivery_schedule_id, signal)),
		...toAdd.map((row) => addPlanDeliverySchedule(planId, row, signal)),
		...toUpdate.map((row) => {
			const link = initialByScheduleId.get(row.deliveryScheduleId)!;
			return updatePlanDeliverySchedule(
				link.aps_delivery_schedule_id,
				{ selectedLines: row.selectedLines },
				signal
			);
		}),
		updateManufacturingPlanSummary(planId, input.summary, signal)
	]);
}

export async function deleteManufacturingPlan(planId: string, signal?: AbortSignal): Promise<void> {
	await apiClient.delete(
		apiClient.datahub(`aps_manufacturing_plans/${encodeURIComponent(planId)}`),
		{ signal }
	);
}

export async function createManufacturingPlan(
	input: CreateManufacturingPlanInput,
	signal?: AbortSignal
): Promise<ApsManufacturingPlanRow> {
	const body: Record<string, unknown> = {
		plan_id: input.planId,
		name: input.name.trim(),
		month: input.month,
		period_start: input.periodStart,
		period_end: input.periodEnd,
		due_date: input.dueDate ?? null,
		priority: input.priority ?? null,
		status: 'draft',
		summary: input.summary,
		metadata: {}
	};
	if (input.plantId?.trim()) body.plant_id = input.plantId.trim();

	const planEnvelope = await apiClient.post<ApiEnvelope<ApsManufacturingPlanRow>>(
		apiClient.datahub('aps_manufacturing_plans'),
		body,
		{ signal }
	);
	const plan = rowsFromEnvelope<ApsManufacturingPlanRow>(planEnvelope.data)[0];
	if (!plan) throw new Error('Create manufacturing plan returned no data');
	return plan;
}

export async function updateManufacturingPlanSummary(
	planId: string,
	summary: PlanSummaryPayload,
	signal?: AbortSignal
): Promise<void> {
	await apiClient.patch(
		apiClient.datahub(`aps_manufacturing_plans/${encodeURIComponent(planId)}`),
		{ summary },
		{ signal }
	);
}

/** Lock a draft plan for scheduling (UI: Save / Send to Scheduler). */
export async function finalizeManufacturingPlanForScheduling(
	planId: string,
	signal?: AbortSignal
): Promise<void> {
	await updateManufacturingPlanStatus(planId, 'scheduling_input', signal);
}

export async function updateManufacturingPlanStatus(
	planId: string,
	status: string,
	signal?: AbortSignal
): Promise<void> {
	await apiClient.patch(
		apiClient.datahub(`aps_manufacturing_plans/${encodeURIComponent(planId)}`),
		{ status },
		{ signal }
	);
}

export async function updateManufacturingPlanFields(
	planId: string,
	fields: UpdateManufacturingPlanFieldsInput,
	signal?: AbortSignal
): Promise<void> {
	const body: Record<string, unknown> = {};
	if (fields.dueDate !== undefined) body.due_date = fields.dueDate;
	if (fields.priority !== undefined) body.priority = fields.priority;
	if (Object.keys(body).length === 0) return;
	await apiClient.patch(
		apiClient.datahub(`aps_manufacturing_plans/${encodeURIComponent(planId)}`),
		body,
		{ signal }
	);
}

export async function addPlanProductionPlan(
	planId: string,
	productionPlan: CreatePlanProductionPlanInput,
	signal?: AbortSignal
): Promise<void> {
	await apiClient.post(
		apiClient.datahub('aps_production_plans'),
		{
			plan_id: planId,
			project_id: productionPlan.projectId,
			production_plan_id: productionPlan.productionPlanId,
			selected_lines: productionPlan.selectedLines,
			due_date: productionPlan.dueDate ?? null,
			metadata: {}
		},
		{ signal }
	);
}

/** @deprecated Use {@link addPlanProductionPlan}. */
export const addPlanRelease = addPlanProductionPlan;

export async function updatePlanProductionPlan(
	apsProductionPlanId: string,
	fields: { dueDate?: string | null; selectedLines?: Record<string, number> },
	signal?: AbortSignal
): Promise<void> {
	const body: Record<string, unknown> = {};
	if (fields.dueDate !== undefined) body.due_date = fields.dueDate;
	if (fields.selectedLines !== undefined) body.selected_lines = fields.selectedLines;
	if (Object.keys(body).length === 0) return;
	await apiClient.patch(
		apiClient.datahub(`aps_production_plans/${encodeURIComponent(apsProductionPlanId)}`),
		body,
		{ signal }
	);
}

/** @deprecated Use {@link updatePlanProductionPlan}. */
export const updatePlanRelease = updatePlanProductionPlan;

export async function deletePlanProductionPlan(
	apsProductionPlanId: string,
	signal?: AbortSignal
): Promise<void> {
	await apiClient.delete(
		apiClient.datahub(`aps_production_plans/${encodeURIComponent(apsProductionPlanId)}`),
		{ signal }
	);
}

/** @deprecated Use {@link deletePlanProductionPlan}. */
export const deletePlanRelease = deletePlanProductionPlan;

export async function syncPlanProductionPlans(
	planId: string,
	input: {
		initialLinks: ApsProductionPlanLinkRow[];
		productionPlans: CreatePlanProductionPlanInput[];
		summary: PlanSummaryPayload;
	},
	signal?: AbortSignal
): Promise<void> {
	const initialByProductionPlanId = new Map(
		input.initialLinks.map((link) => [link.production_plan_id, link])
	);
	const nextProductionPlanIds = new Set(input.productionPlans.map((pp) => pp.productionPlanId));

	const toRemove = input.initialLinks.filter(
		(link) => !nextProductionPlanIds.has(link.production_plan_id)
	);
	const toAdd = input.productionPlans.filter(
		(pp) => !initialByProductionPlanId.has(pp.productionPlanId)
	);
	const toUpdate = input.productionPlans.filter((pp) =>
		initialByProductionPlanId.has(pp.productionPlanId)
	);

	await Promise.all([
		...toRemove.map((link) => deletePlanProductionPlan(link.aps_production_plan_id, signal)),
		...toAdd.map((pp) => addPlanProductionPlan(planId, pp, signal)),
		...toUpdate.map((pp) => {
			const link = initialByProductionPlanId.get(pp.productionPlanId)!;
			return updatePlanProductionPlan(
				link.aps_production_plan_id,
				{ dueDate: pp.dueDate ?? null },
				signal
			);
		}),
		updateManufacturingPlanSummary(planId, input.summary, signal)
	]);
}

/** @deprecated Use {@link syncPlanProductionPlans}. */
export async function syncPlanReleases(
	planId: string,
	input: {
		initialLinks: ApsProductionPlanLinkRow[];
		releases: CreatePlanProductionPlanInput[];
		summary: PlanSummaryPayload;
	},
	signal?: AbortSignal
): Promise<void> {
	return syncPlanProductionPlans(
		planId,
		{
			initialLinks: input.initialLinks,
			productionPlans: input.releases.map((row) => ({
				projectId: row.projectId,
				productionPlanId: row.productionPlanId,
				selectedLines: row.selectedLines,
				dueDate: row.dueDate
			})),
			summary: input.summary
		},
		signal
	);
}
