import type { TreeTableNode } from '@ifactory/ui-v2';
import type { MfgDsProjectGroup, MfgDsTreeRowData } from './create-plan-ds.types.js';
import { formatWeightMtCell } from './create-plan-ds.utils.js';

export function buildMfgDsTreeNodes(
	projects: MfgDsProjectGroup[]
): TreeTableNode<MfgDsTreeRowData>[] {
	return projects.map((project) => ({
		id: project.id,
		label: project.title,
		defaultExpanded: true,
		data: {
			level: 'project',
			projectId: project.projectId,
			weightMt: project.weightMt
		},
		children: project.schedules.map((schedule) => ({
			id: schedule.id,
			label: schedule.label,
			defaultExpanded: true,
			data: {
				level: 'schedule',
				projectId: schedule.projectId,
				scheduleId: schedule.scheduleId,
				weightMt: schedule.weightMt
			},
			children: schedule.structures.map((structure) => ({
				id: structure.id,
				label: structure.name,
				collapsible: structure.boms.length > 0,
				defaultExpanded: true,
				data: {
					level: 'structure',
					projectId: schedule.projectId,
					scheduleId: schedule.scheduleId,
					structureId: structure.structureId,
					weightMt: structure.weightMt
				},
				children: structure.boms.map((bom) => ({
					id: bom.id,
					label: bom.bomName,
					data: {
						level: 'bom',
						projectId: bom.projectId,
						scheduleId: bom.scheduleId,
						structureId: bom.structureId,
						bomId: bom.bomId,
						unit: bom.unit,
						qty: bom.qty > 0 ? String(bom.qty) : '',
						weightMt: bom.weightMt
					}
				}))
			}))
		}))
	}));
}

export function mfgDsTreeFilterMatch(
	node: TreeTableNode<MfgDsTreeRowData>,
	normalizedQuery: string
): boolean {
	const label = node.label.toLowerCase();
	if (label.includes(normalizedQuery)) return true;
	const data = node.data;
	if (!data) return false;
	return (
		(data.bomId?.toLowerCase().includes(normalizedQuery) ?? false) ||
		(data.scheduleId?.toLowerCase().includes(normalizedQuery) ?? false) ||
		(data.projectId?.toLowerCase().includes(normalizedQuery) ?? false)
	);
}

export function mfgDsWeightCell(node: TreeTableNode<MfgDsTreeRowData>): string {
	return formatWeightMtCell(node.data?.weightMt);
}
