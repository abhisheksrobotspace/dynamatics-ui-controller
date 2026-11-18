import type { TreeTableNode } from '@ifactory/ui-v2';
import { invListByIds } from './inv.api.js';
import { resolvePlantIdForAssign } from './assign-and-lock.detail.js';
import type { PlanLockSummaryRow } from './inv.types.js';
import { listPlanLockSummary, planLockRowsForCentralPlan } from './inv-views.api.js';

export type SectionLengthGroup = {
	groupKey: string;
	itemId: string;
	section: string;
	lengthMm: number;
	lengthLabel: string;
	requiredQty: number;
	availableQty: number;
	lockedQty: number;
	requiredWeightKg: number | null;
	freeWeightKg: number | null;
	lockedWeightKg: number | null;
	remainingQty: number;
	procureQty: number;
	procureWeightKg: number | null;
	unresolved: boolean;
	runsUnpinned: number;
	deliveryScheduleLineId: string;
	committed: boolean;
	planCount: number;
};

export type AssignLockTreeKind = 'schedule' | 'tower' | 'bom' | 'section-length';

export type AssignLockReplanContext = {
	bomId: string;
	structureId: string;
	structureKind: 'tower' | 'stub';
	sourceRunId?: string;
};

export type AssignLockTreeData = {
	kind: AssignLockTreeKind;
	requiredQty: number;
	requiredWeightKg: number | null;
	availableQty?: number;
	freeWeightKg?: number | null;
	lockedQty?: number;
	lockedWeightKg?: number | null;
	unresolved?: boolean;
	group?: SectionLengthGroup;
	replan?: AssignLockReplanContext;
	projectId?: string;
	centralPlanId?: string;
};

const NONE_STRUCTURE = '__none__';

function lengthLabel(lengthMm: number): string {
	return lengthMm > 0 ? lengthMm.toLocaleString('en-US') : '-';
}

function mapSummaryRow(row: PlanLockSummaryRow): SectionLengthGroup {
	return {
		groupKey: row.row_key,
		itemId: row.item_id ?? '',
		section: row.section,
		lengthMm: row.length_mm,
		lengthLabel: lengthLabel(row.length_mm),
		requiredQty: row.required_qty_base,
		availableQty: row.free_qty_base,
		lockedQty: row.locked_qty_base,
		requiredWeightKg: row.required_weight_kg,
		freeWeightKg: row.free_weight_kg,
		lockedWeightKg: row.locked_weight_kg,
		remainingQty: row.remaining_qty_base,
		procureQty: row.procure_qty_base,
		procureWeightKg: row.procure_weight_kg,
		unresolved: row.unresolved,
		runsUnpinned: row.runs_unpinned,
		deliveryScheduleLineId: row.delivery_schedule_line_id,
		committed: row.committed,
		planCount: row.plan_count
	};
}

function sortGroups(groups: SectionLengthGroup[]): SectionLengthGroup[] {
	return groups.slice().sort((a, b) => {
		if (a.unresolved !== b.unresolved) return a.unresolved ? 1 : -1;
		const aHasStock = a.availableQty > 0 ? 0 : 1;
		const bHasStock = b.availableQty > 0 ? 0 : 1;
		if (aHasStock !== bHasStock) return aHasStock - bHasStock;
		return a.section.localeCompare(b.section) || a.lengthMm - b.lengthMm;
	});
}

function sumRequired(nodes: TreeTableNode<AssignLockTreeData>[]): {
	requiredQty: number;
	requiredWeightKg: number | null;
} {
	let requiredQty = 0;
	let weightSum = 0;
	let weightComplete = true;
	for (const node of nodes) {
		requiredQty += node.data?.requiredQty ?? 0;
		const w = node.data?.requiredWeightKg;
		if (w == null) weightComplete = false;
		else weightSum += w;
	}
	return {
		requiredQty,
		requiredWeightKg: weightComplete ? weightSum : null
	};
}

function sortTreeNodes(
	nodes: TreeTableNode<AssignLockTreeData>[]
): TreeTableNode<AssignLockTreeData>[] {
	return nodes.slice().sort((a, b) => a.label.localeCompare(b.label));
}

export function buildAssignAndLockTree(input: {
	rows: PlanLockSummaryRow[];
	structureKinds?: Map<string, 'tower' | 'stub'>;
}): { nodes: TreeTableNode<AssignLockTreeData>[]; groups: SectionLengthGroup[] } {
	type LeafBucket = Map<string, PlanLockSummaryRow>;
	type BomBucket = Map<string, LeafBucket>;
	type TowerBucket = Map<string, BomBucket>;
	type ScheduleBucket = Map<string, TowerBucket>;

	const scheduleBuckets: ScheduleBucket = new Map();
	const scheduleLabels = new Map<string, string>();
	const structureLabels = new Map<string, string>();
	const bomLabels = new Map<string, string>();
	const groups: SectionLengthGroup[] = [];
	const seenKeys = new Set<string>();

	for (const row of input.rows) {
		const dsId = row.delivery_schedule_id || row.delivery_schedule_line_id || 'ds';
		const structureId = row.structure_id ?? NONE_STRUCTURE;
		const bomId = row.bom_id || 'bom';
		scheduleLabels.set(dsId, row.delivery_schedule_name || dsId);
		if (structureId !== NONE_STRUCTURE) {
			structureLabels.set(structureId, row.tower_label || structureId);
		}
		bomLabels.set(bomId, row.bom_name || bomId);

		let towerBucket = scheduleBuckets.get(dsId);
		if (!towerBucket) {
			towerBucket = new Map();
			scheduleBuckets.set(dsId, towerBucket);
		}
		let bomBucket = towerBucket.get(structureId);
		if (!bomBucket) {
			bomBucket = new Map();
			towerBucket.set(structureId, bomBucket);
		}
		let leafBucket = bomBucket.get(bomId);
		if (!leafBucket) {
			leafBucket = new Map();
			bomBucket.set(bomId, leafBucket);
		}
		leafBucket.set(row.row_key, row);
	}

	const nodes: TreeTableNode<AssignLockTreeData>[] = [];
	const scheduleIds = [...scheduleBuckets.keys()].sort((a, b) =>
		(scheduleLabels.get(a) ?? a).localeCompare(scheduleLabels.get(b) ?? b)
	);

	for (const dsId of scheduleIds) {
		const towerBucket = scheduleBuckets.get(dsId)!;
		const towerNodes: TreeTableNode<AssignLockTreeData>[] = [];
		const structureIds = [...towerBucket.keys()].sort((a, b) => {
			const aLabel = a === NONE_STRUCTURE ? 'Unassigned' : (structureLabels.get(a) ?? a);
			const bLabel = b === NONE_STRUCTURE ? 'Unassigned' : (structureLabels.get(b) ?? b);
			return aLabel.localeCompare(bLabel);
		});

		for (const structureId of structureIds) {
			const bomBucket = towerBucket.get(structureId)!;
			const bomNodes: TreeTableNode<AssignLockTreeData>[] = [];
			const bomIds = [...bomBucket.keys()].sort((a, b) =>
				(bomLabels.get(a) ?? a).localeCompare(bomLabels.get(b) ?? b)
			);

			for (const bomId of bomIds) {
				const leafBucket = bomBucket.get(bomId)!;
				const leafNodes: TreeTableNode<AssignLockTreeData>[] = [];
				const leafKeys = [...leafBucket.keys()].sort((a, b) => a.localeCompare(b));

				for (const leafKey of leafKeys) {
					const row = leafBucket.get(leafKey)!;
					const group = mapSummaryRow(row);
					if (!seenKeys.has(group.groupKey)) {
						seenKeys.add(group.groupKey);
						groups.push(group);
					}
					const replanContext: AssignLockReplanContext | undefined =
						structureId !== NONE_STRUCTURE
							? {
									bomId,
									structureId,
									structureKind: input.structureKinds?.get(structureId) ?? 'tower',
									...(row.run_id ? { sourceRunId: row.run_id } : {})
								}
							: undefined;

					leafNodes.push({
						id: row.row_key,
						label: group.section,
						selectable: true,
						data: {
							kind: 'section-length',
							requiredQty: group.requiredQty,
							requiredWeightKg: group.requiredWeightKg,
							availableQty: group.availableQty,
							freeWeightKg: group.freeWeightKg,
							lockedQty: group.lockedQty,
							lockedWeightKg: group.lockedWeightKg,
							unresolved: group.unresolved,
							group,
							replan: replanContext
						}
					});
				}

				leafNodes.sort((a, b) => {
					const aGroup = a.data?.group;
					const bGroup = b.data?.group;
					if (!aGroup || !bGroup) return a.label.localeCompare(b.label);
					if (aGroup.unresolved !== bGroup.unresolved) return aGroup.unresolved ? 1 : -1;
					const aHasStock = (aGroup.availableQty ?? 0) > 0 ? 0 : 1;
					const bHasStock = (bGroup.availableQty ?? 0) > 0 ? 0 : 1;
					if (aHasStock !== bHasStock) return aHasStock - bHasStock;
					return a.label.localeCompare(b.label);
				});

				const bomTotals = sumRequired(leafNodes);
				bomNodes.push({
					id: `ds:${dsId}|tower:${structureId}|bom:${bomId}`,
					label: bomLabels.get(bomId) ?? bomId,
					defaultExpanded: true,
					selectable: false,
					data: {
						kind: 'bom',
						requiredQty: bomTotals.requiredQty,
						requiredWeightKg: bomTotals.requiredWeightKg
					},
					children: leafNodes
				});
			}

			const towerTotals = sumRequired(bomNodes);
			towerNodes.push({
				id: `ds:${dsId}|tower:${structureId}`,
				label:
					structureId === NONE_STRUCTURE
						? 'Unassigned'
						: (structureLabels.get(structureId) ?? structureId),
				defaultExpanded: true,
				selectable: false,
				data: {
					kind: 'tower',
					requiredQty: towerTotals.requiredQty,
					requiredWeightKg: towerTotals.requiredWeightKg
				},
				children: sortTreeNodes(bomNodes)
			});
		}

		const scheduleTotals = sumRequired(towerNodes);
		nodes.push({
			id: `ds:${dsId}`,
			label: scheduleLabels.get(dsId) ?? dsId,
			defaultExpanded: true,
			selectable: false,
			data: {
				kind: 'schedule',
				requiredQty: scheduleTotals.requiredQty,
				requiredWeightKg: scheduleTotals.requiredWeightKg
			},
			children: sortTreeNodes(towerNodes)
		});
	}

	return { nodes, groups: sortGroups(groups) };
}

export function findAssignLockNodeById(
	nodes: TreeTableNode<AssignLockTreeData>[],
	id: string
): TreeTableNode<AssignLockTreeData> | undefined {
	for (const node of nodes) {
		if (node.id === id) return node;
		if (node.children?.length) {
			const found = findAssignLockNodeById(node.children, id);
			if (found) return found;
		}
	}
	return undefined;
}

export function selectedSectionLengthGroups(
	nodes: TreeTableNode<AssignLockTreeData>[],
	selectedIds: string[]
): SectionLengthGroup[] {
	const seen = new Set<string>();
	const selected: SectionLengthGroup[] = [];
	for (const id of selectedIds) {
		const node = findAssignLockNodeById(nodes, id);
		const group = node?.data?.group;
		if (!group || seen.has(group.groupKey)) continue;
		seen.add(group.groupKey);
		selected.push(group);
	}
	return selected;
}

export async function loadAssignAndLockTree(input: {
	projectId: string;
	month: string;
	centralPlanId?: string;
	deliveryScheduleIds?: string[];
	bomIds?: string[];
	signal?: AbortSignal;
}): Promise<{
	nodes: TreeTableNode<AssignLockTreeData>[];
	groups: SectionLengthGroup[];
	plantId: string;
}> {
	const scheduleFilter =
		Array.isArray(input.deliveryScheduleIds) && input.deliveryScheduleIds.length > 0
			? new Set(input.deliveryScheduleIds)
			: null;
	const bomFilter =
		Array.isArray(input.bomIds) && input.bomIds.length > 0 ? new Set(input.bomIds) : null;

	const [rows, plantId] = await Promise.all([
		listPlanLockSummary({
			projectId: input.projectId,
			month: input.month,
			signal: input.signal
		}),
		resolvePlantIdForAssign({ projectId: input.projectId, signal: input.signal }).catch(() => '')
	]);

	let scoped = planLockRowsForCentralPlan(rows, input.centralPlanId);
	if (scheduleFilter) {
		scoped = scoped.filter((row) => scheduleFilter.has(row.delivery_schedule_id));
	}
	if (bomFilter) {
		scoped = scoped.filter((row) => bomFilter.has(row.bom_id));
	}

	const structureIds = [
		...new Set(scoped.map((row) => row.structure_id).filter(Boolean) as string[])
	];
	const structures = await invListByIds<{
		structure_id: string;
		type: 'tower' | 'stub' | string;
	}>('proj_structures', 'structure_id', structureIds, 'structure_id,type', input.signal);
	const structureKinds = new Map<string, 'tower' | 'stub'>();
	for (const row of structures) {
		structureKinds.set(row.structure_id, row.type === 'stub' ? 'stub' : 'tower');
	}

	const { nodes, groups } = buildAssignAndLockTree({ rows: scoped, structureKinds });
	return { nodes, groups, plantId };
}
