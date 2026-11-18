/**
 * Data-loading helpers for the RM-indent Home screen:
 * Manufacturing Plan → Projects → Delivery Schedules hierarchy.
 */

import {
	listManufacturingPlans,
	listPlanDeliveryScheduleLinksForPlan,
	type ApsManufacturingPlanRow
} from '../../aps-app/lib/plans.api.js';
import { apiClient } from '../../lib/api/api-client.js';
import { rowsFromEnvelope, type ApiEnvelope } from '../../lib/api/types.js';
import { listProjectDeliveryScheduleLinesForProject } from '../../project-management-app/lib/projects/delivery-schedules.api.js';
import type {
	ProjDeliveryScheduleLineRow,
	ProjDeliveryScheduleRow
} from '../../project-management-app/lib/projects/types.js';
import { listDsRequirementRollup } from './inv-views.api.js';
import type { DsRequirementRollupRow } from './inv.types.js';

export type { ApsManufacturingPlanRow };

export type RmiProjectRow = {
	project_id: string;
	project_label: string;
	plan_id: string;
	/** cp_run_ids derived from delivery schedule lines */
	run_ids: string[];
	/** BOM finished weight × sets (commercial "MT of towers"). */
	marking_weight_mt: number | null;
	/** RM bar steel weight including scrap. */
	required_weight_mt: number | null;
	/** When set, required MT is incomplete — show this instead of a lowballed total. */
	weight_missing_label: string | null;
	/** @deprecated Prefer marking_weight_mt */
	total_weight_mt: number | null;
	delivery_schedules: RmiDeliveryScheduleDisplay[];
};

export type RmiDeliveryScheduleDisplay = {
	delivery_schedule_id: string;
	delivery_date: string;
	status: string;
	qty: number;
	run_ids: string[];
	marking_weight_mt: number | null;
	required_weight_mt: number | null;
	weight_missing_label: string | null;
	/** @deprecated Prefer marking_weight_mt */
	weight_mt: number | null;
};

type ProjectRow = Record<string, unknown> & {
	project_id: string;
	name: string;
	metadata?: Record<string, unknown>;
};

function workOrderNo(metadata: Record<string, unknown> | undefined): string {
	const value = metadata?.work_order_no;
	return typeof value === 'string' ? value.trim() : '';
}

function projectLabel(project: ProjectRow): string {
	const wo = workOrderNo(project.metadata);
	const name = project.name?.trim() || project.project_id;
	return wo ? `${wo} - ${name}` : name;
}

function idListParam(ids: string[]): string {
	return ids.map((id) => encodeURIComponent(id)).join(',');
}

async function fetchProjectsByIds(
	projectIds: string[],
	signal?: AbortSignal
): Promise<Map<string, ProjectRow>> {
	const unique = [...new Set(projectIds.filter(Boolean))];
	if (unique.length === 0) return new Map();
	const envelope = await apiClient.get<ApiEnvelope<ProjectRow[]>>(
		apiClient.datahub(
			`proj_projects?project_id__in=${idListParam(unique)}&select=project_id,name,metadata&limit=5000`
		),
		{ signal }
	);
	const rows = rowsFromEnvelope<ProjectRow>(envelope.data);
	return new Map(rows.map((row) => [row.project_id, row]));
}

type CpPlanRunRow = Record<string, unknown> & {
	run_id: string;
	bom_id: string;
};

/** Fetch all published cp_plan_run IDs for a set of bom_ids, grouped by bom_id. */
async function fetchRunIdsByBomIds(
	bomIds: string[],
	signal?: AbortSignal
): Promise<Map<string, string[]>> {
	const unique = [...new Set(bomIds.filter(Boolean))];
	if (unique.length === 0) return new Map();
	const envelope = await apiClient.get<ApiEnvelope<CpPlanRunRow[]>>(
		apiClient.datahub(
			`cp_plan_runs?bom_id__in=${idListParam(unique)}&select=run_id,bom_id&limit=50000`
		),
		{ signal }
	);
	const rows = rowsFromEnvelope<CpPlanRunRow>(envelope.data);
	const map = new Map<string, string[]>();
	for (const row of rows) {
		const bid = String(row.bom_id ?? '');
		if (!bid) continue;
		const bucket = map.get(bid) ?? [];
		bucket.push(row.run_id);
		map.set(bid, bucket);
	}
	return map;
}

function kgToMt(kg: number | null): number | null {
	if (kg == null || !Number.isFinite(kg)) return null;
	return Math.round((kg / 1000) * 1000) / 1000;
}

function aggregateRollupWeights(rows: DsRequirementRollupRow[]): {
	marking_weight_mt: number | null;
	required_weight_mt: number | null;
	weight_missing_label: string | null;
} {
	if (rows.length === 0) {
		return { marking_weight_mt: null, required_weight_mt: null, weight_missing_label: null };
	}

	const missing = rows.reduce((sum, row) => sum + row.lines_without_weight, 0);
	const weight_missing_label =
		missing > 0 ? `${missing} section${missing === 1 ? '' : 's'} missing unit weight` : null;

	let markingSum = 0;
	let markingOk = true;
	let requiredSum = 0;
	let requiredOk = true;
	for (const row of rows) {
		if (row.marking_weight_kg == null) markingOk = false;
		else markingSum += row.marking_weight_kg;
		if (row.required_weight_kg == null || row.lines_without_weight > 0) requiredOk = false;
		else requiredSum += row.required_weight_kg;
	}

	return {
		marking_weight_mt: markingOk ? kgToMt(markingSum) : null,
		required_weight_mt: weight_missing_label || !requiredOk ? null : kgToMt(requiredSum),
		weight_missing_label
	};
}

/**
 * Returns all published manufacturing plans (sorted newest first).
 */
export async function listRmiManufacturingPlans(
	signal?: AbortSignal
): Promise<ApsManufacturingPlanRow[]> {
	return listManufacturingPlans(signal);
}

/**
 * For a given manufacturing plan, returns enriched project rows including
 * delivery schedules and tonnage from inv_ds_requirement_rollup.
 */
export async function loadProjectsForPlan(
	planId: string,
	signal?: AbortSignal
): Promise<RmiProjectRow[]> {
	const links = await listPlanDeliveryScheduleLinksForPlan(planId, signal);
	const projectIds = [...new Set(links.map((l) => l.project_id).filter(Boolean))];
	const linkedScheduleIds = new Set(links.map((l) => l.delivery_schedule_id).filter(Boolean));
	if (projectIds.length === 0) return [];

	const [projectMap, schedulesByProject, rollupRows] = await Promise.all([
		fetchProjectsByIds(projectIds, signal),
		Promise.all(
			projectIds.map(async (projectId) => ({
				projectId,
				data: await listProjectDeliveryScheduleLinesForProject(projectId, signal)
			}))
		),
		listDsRequirementRollup({ centralPlanId: planId, signal })
	]);

	const rollupBySchedule = new Map<string, DsRequirementRollupRow[]>();
	const rollupByProject = new Map<string, DsRequirementRollupRow[]>();
	for (const row of rollupRows) {
		const schedBucket = rollupBySchedule.get(row.delivery_schedule_id) ?? [];
		schedBucket.push(row);
		rollupBySchedule.set(row.delivery_schedule_id, schedBucket);

		const projBucket = rollupByProject.get(row.project_id) ?? [];
		projBucket.push(row);
		rollupByProject.set(row.project_id, projBucket);
	}

	const allBomIds: string[] = [];
	const scheduleDataByProject = new Map(
		schedulesByProject.map(({ projectId, data }) => {
			const linked = data.filter((entry) =>
				linkedScheduleIds.has(entry.schedule.delivery_schedule_id)
			);
			const bomIds = linked.flatMap((entry) =>
				entry.lines.map((line) => line.bom_id).filter(Boolean)
			);
			allBomIds.push(...bomIds);
			return [projectId, { data: linked, bomIds }];
		})
	);

	const runIdsByBomId = await fetchRunIdsByBomIds([...new Set(allBomIds)], signal);

	return projectIds.map((projectId): RmiProjectRow => {
		const project = projectMap.get(projectId);
		const { data: scheduleEntries, bomIds: projectBomIds } = scheduleDataByProject.get(
			projectId
		) ?? {
			data: [] as {
				schedule: ProjDeliveryScheduleRow;
				lines: ProjDeliveryScheduleLineRow[];
			}[],
			bomIds: [] as string[]
		};

		const projectRunIds = [
			...new Set(projectBomIds.flatMap((bid) => runIdsByBomId.get(bid) ?? []))
		];
		const projectWeights = aggregateRollupWeights(rollupByProject.get(projectId) ?? []);

		const deliverySchedules: RmiDeliveryScheduleDisplay[] = scheduleEntries.map((entry) => {
			const schedBomIds = [...new Set(entry.lines.map((l) => l.bom_id).filter(Boolean))];
			const schedRunIds = [...new Set(schedBomIds.flatMap((bid) => runIdsByBomId.get(bid) ?? []))];
			const qty = entry.lines.reduce((sum, l) => sum + (l.quantity ?? 0), 0);
			const schedId = entry.schedule.delivery_schedule_id;
			const weights = aggregateRollupWeights(rollupBySchedule.get(schedId) ?? []);
			return {
				delivery_schedule_id: schedId,
				delivery_date: entry.schedule.delivery_date,
				status: entry.schedule.status,
				qty,
				run_ids: schedRunIds,
				marking_weight_mt: weights.marking_weight_mt,
				required_weight_mt: weights.required_weight_mt,
				weight_missing_label: weights.weight_missing_label,
				weight_mt: weights.marking_weight_mt
			};
		});

		return {
			project_id: projectId,
			project_label: project ? projectLabel(project) : projectId,
			plan_id: planId,
			run_ids: projectRunIds,
			marking_weight_mt: projectWeights.marking_weight_mt,
			required_weight_mt: projectWeights.required_weight_mt,
			weight_missing_label: projectWeights.weight_missing_label,
			total_weight_mt: projectWeights.marking_weight_mt,
			delivery_schedules: deliverySchedules
		};
	});
}
