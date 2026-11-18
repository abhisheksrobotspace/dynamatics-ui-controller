import type { TreeTableNode } from '@ifactory/ui-v2';
import { bomMonthQty } from './planning-sheet.model.js';
import type { PlanningSheetDraft, PlanningSheetRowData } from './planning-sheet.types.js';

export type CpRaiseIndentSelection = {
	deliveryScheduleIds: string[];
	bomIds: string[];
	projectIds: string[];
};

/** BOMs with planned qty in `month` (optionally under one project) → DS + BOM + project scope. */
export function collectCpRaiseIndentSelection(
	nodes: TreeTableNode<PlanningSheetRowData>[],
	draft: PlanningSheetDraft,
	month: string,
	projectId?: string
): CpRaiseIndentSelection {
	const scheduleIds = new Set<string>();
	const bomIds = new Set<string>();
	const projectIds = new Set<string>();

	const walk = (list: TreeTableNode<PlanningSheetRowData>[]) => {
		for (const node of list) {
			const data = node.data;
			if (data?.kind === 'bom' && (!projectId || data.projectId === projectId)) {
				if (bomMonthQty(draft, node.id, month) > 0) {
					scheduleIds.add(data.scheduleId);
					bomIds.add(data.bomId);
					projectIds.add(data.projectId);
				}
			}
			if (node.children?.length) walk(node.children);
		}
	};
	walk(nodes);

	return {
		deliveryScheduleIds: [...scheduleIds],
		bomIds: [...bomIds],
		projectIds: [...projectIds]
	};
}
