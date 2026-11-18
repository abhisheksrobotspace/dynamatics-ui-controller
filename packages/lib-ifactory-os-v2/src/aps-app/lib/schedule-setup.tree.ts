import type { TreeTableNode } from '@ifactory/ui-v2';
import type { ScheduleSetupBomRow } from './schedule-setup.api.js';
import { formatWeightMtCell, sumWeightMtNullAware } from './create-plan-ds.utils.js';

export type ScheduleSetupTreeLevel = 'project' | 'schedule' | 'structure' | 'bom';

export type ScheduleSetupTreeRowData = {
	level: ScheduleSetupTreeLevel;
	qty?: string;
	weightMt?: number | null;
};

export function projectLabel(
	row: Pick<ScheduleSetupBomRow, 'workOrderCode' | 'projectName'>
): string {
	return row.workOrderCode ? `${row.workOrderCode} ${row.projectName}` : row.projectName;
}

/** Project → delivery schedule → structure → BOM, matching manufacturing-plan creation. */
export function buildScheduleSetupTree(
	boms: ScheduleSetupBomRow[]
): TreeTableNode<ScheduleSetupTreeRowData>[] {
	const projects = new Map<
		string,
		{
			label: string;
			schedules: Map<
				string,
				{
					label: string;
					structures: Map<string, { label: string; boms: ScheduleSetupBomRow[] }>;
				}
			>;
		}
	>();

	for (const bom of boms) {
		let project = projects.get(bom.projectId);
		if (!project) {
			project = { label: projectLabel(bom), schedules: new Map() };
			projects.set(bom.projectId, project);
		}

		let schedule = project.schedules.get(bom.scheduleId);
		if (!schedule) {
			schedule = { label: bom.scheduleLabel, structures: new Map() };
			project.schedules.set(bom.scheduleId, schedule);
		}

		const structureKey = bom.structureId || bom.structureName;
		let structure = schedule.structures.get(structureKey);
		if (!structure) {
			structure = { label: bom.structureName, boms: [] };
			schedule.structures.set(structureKey, structure);
		}
		structure.boms.push(bom);
	}

	return [...projects.entries()].map(([projectId, project]) => {
		const scheduleNodes = [...project.schedules.entries()].map(([scheduleId, schedule]) => {
			const structureNodes = [...schedule.structures.entries()].map(([structureKey, structure]) => {
				const bomNodes = structure.boms.map((bom) => ({
					id: bom.id,
					label: bom.bomName,
					data: {
						level: 'bom' as const,
						qty: bom.qty > 0 ? String(bom.qty) : '',
						weightMt: bom.weightMt
					}
				}));
				return {
					id: `structure:${scheduleId}:${structureKey}`,
					label: structure.label,
					collapsible: structure.boms.length > 0,
					defaultExpanded: true,
					data: {
						level: 'structure' as const,
						weightMt: sumWeightMtNullAware(structure.boms.map((bom) => bom.weightMt))
					},
					children: bomNodes
				};
			});
			return {
				id: `schedule:${projectId}:${scheduleId}`,
				label: schedule.label,
				defaultExpanded: true,
				data: {
					level: 'schedule' as const,
					weightMt: sumWeightMtNullAware(structureNodes.map((node) => node.data.weightMt))
				},
				children: structureNodes
			};
		});
		return {
			id: `project:${projectId}`,
			label: project.label,
			defaultExpanded: true,
			data: {
				level: 'project' as const,
				weightMt: sumWeightMtNullAware(scheduleNodes.map((node) => node.data.weightMt))
			},
			children: scheduleNodes
		};
	});
}

export function scheduleSetupTreeFilterMatch(
	node: TreeTableNode<ScheduleSetupTreeRowData>,
	normalizedQuery: string
): boolean {
	if (node.label.toLowerCase().includes(normalizedQuery)) return true;
	const data = node.data;
	if (!data) return false;
	return (
		(data.qty?.toLowerCase().includes(normalizedQuery) ?? false) ||
		(data.weightMt != null &&
			formatWeightMtCell(data.weightMt).toLowerCase().includes(normalizedQuery))
	);
}
