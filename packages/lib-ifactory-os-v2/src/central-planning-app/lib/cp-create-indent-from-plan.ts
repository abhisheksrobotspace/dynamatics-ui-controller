import type { TreeTableNode } from '@ifactory/ui-v2';
import {
	loadAssignAndLockTree,
	type AssignLockTreeData,
	type SectionLengthGroup
} from '../../rm-indent-app/lib/assign-and-lock.tree.js';
import type { RaiseIndentRow } from '../../rm-indent-app/lib/indent-routes.js';
import { collectCpRaiseIndentSelection } from './cp-raise-indent.js';
import { loadFuturePlanningSheetTree } from './planning-sheet.load.js';
import { getPlanningSheetPlan } from './planning-sheet.store.js';
import type { PlanningSheetRowData } from './planning-sheet.types.js';

export type PlanMonthIndentRow = RaiseIndentRow & {
	projectId: string;
	projectLabel: string;
};

function projectLabelsFromTree(nodes: TreeTableNode<PlanningSheetRowData>[]): Map<string, string> {
	const labels = new Map<string, string>();
	for (const node of nodes) {
		if (node.data?.kind === 'project') {
			labels.set(node.data.projectId, node.label);
		}
	}
	return labels;
}

function groupsToRaiseRows(
	groups: SectionLengthGroup[],
	projectId: string,
	projectLabel: string
): PlanMonthIndentRow[] {
	return groups
		.filter((g) => g.requiredQty > 0)
		.map((g) => ({
			projectId,
			projectLabel,
			itemId: g.itemId,
			section: g.section,
			lengthMm: g.lengthMm,
			requiredQty: g.requiredQty,
			availableQty: g.availableQty,
			lockedQty: g.lockedQty,
			requiredWeightKg: g.requiredWeightKg,
			lockedWeightKg: g.lockedWeightKg
		}));
}

/** Load all section-length rows for a published plan + month across every project with qty. */
export async function loadPlanMonthIndentRows(
	planId: string,
	month: string,
	signal?: AbortSignal
): Promise<{
	rows: PlanMonthIndentRow[];
	deliveryScheduleIds: string[];
	bomIds: string[];
	mfgPlanRef: string;
}> {
	const plan = getPlanningSheetPlan(planId);
	if (!plan) {
		throw new Error('Select a plan.');
	}
	if (!plan.draft.months.includes(month)) {
		throw new Error('Selected month is not in this plan.');
	}

	const loaded = await loadFuturePlanningSheetTree(plan.plantId, signal);
	const selection = collectCpRaiseIndentSelection(loaded.nodes, plan.draft, month);
	if (selection.projectIds.length === 0) {
		return {
			rows: [],
			deliveryScheduleIds: selection.deliveryScheduleIds,
			bomIds: selection.bomIds,
			mfgPlanRef: planId
		};
	}

	const labels = projectLabelsFromTree(loaded.nodes);
	const rows: PlanMonthIndentRow[] = [];

	for (const projectId of selection.projectIds) {
		if (signal?.aborted) break;
		const scoped = collectCpRaiseIndentSelection(loaded.nodes, plan.draft, month, projectId);
		const { groups } = await loadAssignAndLockTree({
			projectId,
			month,
			centralPlanId: planId,
			deliveryScheduleIds: scoped.deliveryScheduleIds,
			bomIds: scoped.bomIds,
			signal
		});
		rows.push(...groupsToRaiseRows(groups, projectId, labels.get(projectId) ?? projectId));
	}

	return {
		rows,
		deliveryScheduleIds: selection.deliveryScheduleIds,
		bomIds: selection.bomIds,
		mfgPlanRef: planId
	};
}

export type PlanMonthAssignTree = {
	nodes: TreeTableNode<AssignLockTreeData & { projectId?: string; projectLabel?: string }>[];
	/** Flattened section-length groups with project context. */
	leafIndex: Map<
		string,
		{
			projectId: string;
			projectLabel: string;
			group: SectionLengthGroup;
			dsId: string;
			bomId: string;
		}
	>;
	deliveryScheduleIds: string[];
	bomIds: string[];
};

/** Project → DS → tower → BOM → section trees for a published plan + month. */
export async function loadPlanMonthAssignTree(
	planId: string,
	month: string,
	signal?: AbortSignal,
	projectIdFilter?: string
): Promise<PlanMonthAssignTree> {
	const plan = getPlanningSheetPlan(planId);
	if (!plan) {
		throw new Error('Select a plan.');
	}
	if (!plan.draft.months.includes(month)) {
		throw new Error('Selected month is not in this plan.');
	}

	const loaded = await loadFuturePlanningSheetTree(plan.plantId, signal);
	const selection = collectCpRaiseIndentSelection(loaded.nodes, plan.draft, month, projectIdFilter);
	const labels = projectLabelsFromTree(loaded.nodes);
	const nodes: PlanMonthAssignTree['nodes'] = [];
	const leafIndex: PlanMonthAssignTree['leafIndex'] = new Map();

	for (const projectId of selection.projectIds) {
		if (signal?.aborted) break;
		if (projectIdFilter && projectId !== projectIdFilter) continue;
		const scoped = collectCpRaiseIndentSelection(loaded.nodes, plan.draft, month, projectId);
		const { nodes: projectNodes } = await loadAssignAndLockTree({
			projectId,
			month,
			centralPlanId: planId,
			deliveryScheduleIds: scoped.deliveryScheduleIds,
			bomIds: scoped.bomIds,
			signal
		});
		const projectLabel = labels.get(projectId) ?? projectId;
		indexLeaves(projectNodes, projectId, projectLabel, leafIndex);
		nodes.push({
			id: `project:${projectId}`,
			label: projectLabel,
			defaultExpanded: true,
			selectable: false,
			data: {
				kind: 'schedule',
				requiredQty: projectNodes.reduce((sum, n) => sum + (n.data?.requiredQty ?? 0), 0),
				requiredWeightKg: null,
				projectId,
				projectLabel
			},
			children: projectNodes
		});
	}

	return {
		nodes,
		leafIndex,
		deliveryScheduleIds: selection.deliveryScheduleIds,
		bomIds: selection.bomIds
	};
}

function indexLeaves(
	nodes: TreeTableNode<AssignLockTreeData>[],
	projectId: string,
	projectLabel: string,
	leafIndex: PlanMonthAssignTree['leafIndex']
): void {
	for (const node of nodes) {
		const group = node.data?.group;
		if (node.data?.kind === 'section-length' && group) {
			const dsId = node.id.match(/^ds:([^|]+)/)?.[1] ?? '';
			const bomId = node.id.match(/\|bom:([^|]+)/)?.[1] ?? '';
			// Prefer DS leaf required (what's shown in the Required column). Lock-summary
			// `group.requiredQty` can be 0/mismatched and would zero out Remaining / To Procure.
			leafIndex.set(node.id, {
				projectId,
				projectLabel,
				group: {
					...group,
					requiredQty: node.data.requiredQty ?? group.requiredQty,
					requiredWeightKg: node.data.requiredWeightKg ?? group.requiredWeightKg
				},
				dsId,
				bomId
			});
		}
		if (node.children?.length) indexLeaves(node.children, projectId, projectLabel, leafIndex);
	}
}
