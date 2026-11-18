import { DEFAULT_APS_PLANT_LABEL } from './aps-plant.constants.js';
import type { CreatePlanDeliveryScheduleInput, MfgDsProjectGroup } from './create-plan-ds.types.js';
import type { PlanSummaryPayload } from './plans.api.js';

export type { CreatePlanDeliveryScheduleInput };

export type SavedDeliveryScheduleLink = {
	delivery_schedule_id: string;
	selected_lines?: Record<string, number> | null;
};

/** Build APS junction rows from checked BOM leaves. */
export function buildPlanDeliveryScheduleInputs(
	projects: MfgDsProjectGroup[],
	selectedLeafIds: ReadonlySet<string>,
	plantId: string
): CreatePlanDeliveryScheduleInput[] {
	const byScheduleId = new Map<string, CreatePlanDeliveryScheduleInput>();

	for (const project of projects) {
		for (const schedule of project.schedules) {
			for (const structure of schedule.structures) {
				for (const bom of structure.boms) {
					if (!selectedLeafIds.has(bom.id) || !bom.scheduleLineId) continue;

					let entry = byScheduleId.get(schedule.scheduleId);
					if (!entry) {
						entry = {
							projectId: project.projectId,
							deliveryScheduleId: schedule.scheduleId,
							plantId,
							selectedLines: {}
						};
						byScheduleId.set(schedule.scheduleId, entry);
					}
					entry.selectedLines[bom.scheduleLineId] = bom.qty;
				}
			}
		}
	}

	return [...byScheduleId.values()];
}

/** Map saved APS `selected_lines` back to tree leaf ids. */
export function selectedLeafIdsFromSavedLinks(
	projects: MfgDsProjectGroup[],
	links: SavedDeliveryScheduleLink[]
): string[] {
	const leafByLineId = new Map<string, string>();
	for (const project of projects) {
		for (const schedule of project.schedules) {
			for (const structure of schedule.structures) {
				for (const bom of structure.boms) {
					if (bom.scheduleLineId) leafByLineId.set(bom.scheduleLineId, bom.id);
				}
			}
		}
	}

	const ids: string[] = [];
	for (const link of links) {
		for (const lineId of Object.keys(link.selected_lines ?? {})) {
			const leafId = leafByLineId.get(lineId);
			if (leafId) ids.push(leafId);
		}
	}
	return ids;
}

/** Keep only schedules saved on the plan (read-only view after scheduling). */
export function filterProjectsToSavedSchedules(
	projects: MfgDsProjectGroup[],
	links: ReadonlyArray<{ delivery_schedule_id: string }>
): MfgDsProjectGroup[] {
	const ids = new Set(links.map((link) => link.delivery_schedule_id));
	return projects.flatMap((project) => {
		const schedules = project.schedules.filter((schedule) => ids.has(schedule.scheduleId));
		if (schedules.length === 0) return [];
		return [
			{
				...project,
				schedules,
				weightMt: schedules.reduce((sum, schedule) => sum + schedule.weightMt, 0)
			}
		];
	});
}

/** Roll up checked BOMs into the manufacturing plan `summary` jsonb. */
export function computeDsPlanSummary(
	projects: MfgDsProjectGroup[],
	selectedLeafIds: ReadonlySet<string>,
	workOrderCodes: string[] = []
): PlanSummaryPayload {
	const projectIds = new Set<string>();
	const scheduleIds = new Set<string>();
	const structureIds = new Set<string>();
	let sets = 0;
	let batchWeightMt = 0;

	for (const project of projects) {
		for (const schedule of project.schedules) {
			let scheduleSelected = false;
			for (const structure of schedule.structures) {
				for (const bom of structure.boms) {
					if (!selectedLeafIds.has(bom.id)) continue;
					scheduleSelected = true;
					projectIds.add(project.projectId);
					structureIds.add(structure.structureId);
					sets += bom.qty;
					if (bom.weightMt != null && Number.isFinite(bom.weightMt)) {
						batchWeightMt += bom.weightMt;
					}
				}
			}
			if (scheduleSelected) scheduleIds.add(schedule.scheduleId);
		}
	}

	return {
		production_plans: scheduleIds.size,
		projects: projectIds.size,
		work_orders: workOrderCodes,
		structures: structureIds.size,
		sets,
		batch_weight_mt: batchWeightMt,
		plants: DEFAULT_APS_PLANT_LABEL,
		zinc_req_mt: 0
	};
}

export function workOrdersForSelection(
	projects: MfgDsProjectGroup[],
	selectedLeafIds: ReadonlySet<string>
): string[] {
	const codes = new Set<string>();
	for (const project of projects) {
		let selected = false;
		for (const schedule of project.schedules) {
			for (const structure of schedule.structures) {
				for (const bom of structure.boms) {
					if (selectedLeafIds.has(bom.id)) selected = true;
				}
			}
		}
		if (selected && project.workOrderCode) codes.add(project.workOrderCode);
	}
	return [...codes];
}
