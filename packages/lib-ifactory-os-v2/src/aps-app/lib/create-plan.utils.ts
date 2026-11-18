import type { PlanProject, PlanRelease, PlanSummary } from './create-plan.types.js';
import type { PlanSummaryPayload } from './plans.api.js';
import { DEFAULT_APS_PLANT_LABEL } from './aps-plant.constants.js';

export function formatMtNumber(value: number): string {
	if (!Number.isFinite(value) || value === 0) return '0.00';
	return value.toLocaleString('en-IN', {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2
	});
}

export function formatMt(value: number): string {
	return `${formatMtNumber(value)} MT`;
}

export function computePlanSummary(
	projects: PlanProject[],
	selectedReleaseIds: Set<string>
): PlanSummary {
	const selectedReleases: PlanRelease[] = [];
	const projectIds = new Set<string>();
	const workOrders = new Set<string>();
	const plants = new Set<string>();
	let structures = 0;

	for (const project of projects) {
		for (const release of project.releases) {
			if (!selectedReleaseIds.has(release.id)) continue;
			selectedReleases.push(release);
			projectIds.add(project.id);
			if (release.workOrderCode) workOrders.add(release.workOrderCode);
			structures += release.structureCount;
			if (release.plants && release.plants !== '-') {
				release.plants.split(/\s*\+\s*/).forEach((plant) => plants.add(plant.trim()));
			}
		}
	}

	const sets = selectedReleases.reduce((sum, release) => sum + release.sets, 0);
	const batchWeightMt = selectedReleases.reduce((sum, release) => sum + release.batchWeightMt, 0);
	const zincReqMt = selectedReleases.reduce((sum, release) => sum + release.zincReqMt, 0);

	const plantList = [...plants];
	const plantsLabel =
		plantList.length === 0
			? DEFAULT_APS_PLANT_LABEL
			: plantList.length > 1
				? plantList.join(' + ')
				: plantList[0];

	return {
		releases: selectedReleases.length,
		projects: projectIds.size,
		workOrders: workOrders.size > 0 ? [...workOrders].join(', ') : '-',
		sets,
		batchWeightMt,
		plants: plantsLabel,
		zincReqMt,
		structures
	};
}

export function planSummaryToPayload(summary: PlanSummary): PlanSummaryPayload {
	const workOrders =
		summary.workOrders === '-'
			? []
			: summary.workOrders
					.split(',')
					.map((part) => part.trim())
					.filter(Boolean);

	return {
		production_plans: summary.releases,
		projects: summary.projects,
		work_orders: workOrders,
		structures: summary.structures,
		sets: summary.sets,
		batch_weight_mt: summary.batchWeightMt,
		plants: summary.plants,
		zinc_req_mt: summary.zincReqMt
	};
}

export function emptyPlanSummaryPayload(): PlanSummaryPayload {
	return {
		production_plans: 0,
		projects: 0,
		work_orders: [],
		structures: 0,
		sets: 0,
		batch_weight_mt: 0,
		plants: DEFAULT_APS_PLANT_LABEL,
		zinc_req_mt: 0
	};
}

export function availableReleaseCount(project: PlanProject): number {
	return project.releases.filter((release) => release.selectable).length;
}

/** Map production_plan_id → manufacturing plan_id for already-bundled production plans. */
export function planIdByProductionPlanId(
	links: Array<{ production_plan_id: string; plan_id: string }>
): Map<string, string> {
	const map = new Map<string, string>();
	for (const link of links) {
		if (!map.has(link.production_plan_id)) map.set(link.production_plan_id, link.plan_id);
	}
	return map;
}

/** @deprecated Use {@link planIdByProductionPlanId}. */
export function planIdByReleaseId(
	links: Array<{ production_plan_id: string; plan_id: string }>
): Map<string, string> {
	return planIdByProductionPlanId(links);
}
