import type { TreeTableNode } from '@ifactory/ui-v2';
import type {
	AssignLockTreeData,
	SectionLengthGroup
} from '../../rm-indent-app/lib/assign-and-lock.tree.js';
import { listPublishedCpByBomIds } from '../../cutting-plan-app/lib/cutting-plan/cp-publish.api.js';
import {
	corePlanResponse,
	getCorePlanRun
} from '../../cutting-plan-app/lib/cutting-plan/cp-plan.api.js';
import {
	aggregateStockLengthRows,
	stockLengthWeightKg
} from '../../cutting-plan-app/lib/cutting-plan/planner-results.js';
import {
	loadUnitWeightBySection,
	resolveSectionUnitWeight
} from '../../cutting-plan-app/lib/cutting-plan/plan-section-weights.js';
import { bomMonthQty } from './planning-sheet.model.js';
import { loadFuturePlanningSheetTree } from './planning-sheet.load.js';
import { getPlanningSheetPlan } from './planning-sheet.store.js';
import type { PlanningSheetDraft, PlanningSheetRowData } from './planning-sheet.types.js';
import type { PlanMonthAssignTree } from './cp-create-indent-from-plan.js';

type ProjectScopedBom = {
	projectId: string;
	projectLabel: string;
	scheduleId: string;
	scheduleLabel: string;
	structureId: string;
	structureLabel: string;
	bomId: string;
	bomLabel: string;
	bomNodeId: string;
	sets: number;
};

type PublishedSectionLength = {
	section: string;
	lengthMm: number;
	/** Bars required per BOM set from the published cutting plan. */
	qtyPerSet: number;
	/** kg for one bar at this length (from BOM unit weight). */
	weightKgPerBar: number | null;
};

export type UiPlanMonthAssignTree = PlanMonthAssignTree & {
	/** BOM labels that had CP month qty but no published cutting plan. */
	missingPublishedCp: string[];
};

/**
 * Build Select Sections from CP plan month allocations × published Cutting Plan
 * section×length bars (qty = planned sets × per-set bars). Create Indent stays UI-only.
 */
export async function loadUiPlanMonthAssignTree(
	planId: string,
	month: string,
	signal?: AbortSignal,
	projectIdFilter?: string
): Promise<UiPlanMonthAssignTree> {
	const plan = getPlanningSheetPlan(planId);
	if (!plan) throw new Error('Select a plan.');
	if (!plan.draft.months.includes(month)) {
		throw new Error('Selected month is not in this plan.');
	}

	const loaded = await loadFuturePlanningSheetTree(plan.plantId, signal);
	if (signal?.aborted) {
		return {
			nodes: [],
			leafIndex: new Map(),
			deliveryScheduleIds: [],
			bomIds: [],
			missingPublishedCp: []
		};
	}

	const boms = collectAllocatedBoms(loaded.nodes, plan.draft, month, projectIdFilter);
	const uniqueBomIds = [...new Set(boms.map((b) => b.bomId))];
	const publishedByBom = await listPublishedCpByBomIds(uniqueBomIds, signal);
	if (signal?.aborted) {
		return {
			nodes: [],
			leafIndex: new Map(),
			deliveryScheduleIds: [],
			bomIds: [],
			missingPublishedCp: []
		};
	}

	const sectionCache = new Map<string, PublishedSectionLength[]>();
	const missingPublishedCp: string[] = [];
	const missingSeen: Record<string, true> = {};

	await Promise.all(
		uniqueBomIds.map(async (bomId) => {
			const published = publishedByBom.get(bomId);
			if (!published) {
				sectionCache.set(bomId, []);
				return;
			}
			try {
				const sections = await loadPublishedSectionLengths(bomId, published.runId, signal);
				sectionCache.set(bomId, sections);
			} catch {
				sectionCache.set(bomId, []);
			}
		})
	);
	if (signal?.aborted) {
		return {
			nodes: [],
			leafIndex: new Map(),
			deliveryScheduleIds: [],
			bomIds: [],
			missingPublishedCp: []
		};
	}

	for (const bom of boms) {
		const sections = sectionCache.get(bom.bomId) ?? [];
		if (sections.length > 0) continue;
		if (missingSeen[bom.bomId]) continue;
		missingSeen[bom.bomId] = true;
		missingPublishedCp.push(bom.bomLabel);
	}

	const byProject = new Map<string, ProjectScopedBom[]>();
	for (const bom of boms) {
		const list = byProject.get(bom.projectId) ?? [];
		list.push(bom);
		byProject.set(bom.projectId, list);
	}

	const nodes: PlanMonthAssignTree['nodes'] = [];
	const leafIndex: PlanMonthAssignTree['leafIndex'] = new Map();
	const deliveryScheduleIds = new Set<string>();
	const bomIds = new Set<string>();

	for (const [projectId, projectBoms] of byProject) {
		const projectLabel = projectBoms[0]?.projectLabel ?? projectId;
		const projectChildren = buildProjectChildren(
			projectBoms,
			projectId,
			projectLabel,
			sectionCache,
			leafIndex
		);
		for (const bom of projectBoms) {
			deliveryScheduleIds.add(bom.scheduleId);
			bomIds.add(bom.bomId);
		}
		if (projectChildren.length === 0) continue;
		nodes.push({
			id: `project:${projectId}`,
			label: projectLabel,
			defaultExpanded: true,
			selectable: false,
			data: {
				kind: 'schedule',
				requiredQty: projectChildren.reduce((sum, n) => sum + (n.data?.requiredQty ?? 0), 0),
				requiredWeightKg: null,
				projectId,
				projectLabel
			},
			children: projectChildren
		});
	}

	return {
		nodes,
		leafIndex,
		deliveryScheduleIds: [...deliveryScheduleIds],
		bomIds: [...bomIds],
		missingPublishedCp
	};
}

async function loadPublishedSectionLengths(
	bomId: string,
	runId: string,
	signal?: AbortSignal
): Promise<PublishedSectionLength[]> {
	const [row, unitWeightBySection] = await Promise.all([
		getCorePlanRun(bomId, runId, signal),
		loadUnitWeightBySection(bomId).catch(() => ({}) as Record<string, number>)
	]);
	if (!row) return [];
	const plan = await corePlanResponse(row);
	const out: PublishedSectionLength[] = [];
	for (const [section, sectionData] of Object.entries(plan.output ?? {})) {
		const unitWeight = resolveSectionUnitWeight(section, unitWeightBySection) ?? null;
		for (const stock of aggregateStockLengthRows(sectionData.plan ?? [])) {
			if (stock.quantity <= 0) continue;
			const lengthMm = Math.round(stock.lengthMm);
			out.push({
				section,
				lengthMm,
				qtyPerSet: stock.quantity,
				weightKgPerBar: stockLengthWeightKg(lengthMm, 1, unitWeight)
			});
		}
	}
	return out;
}

function collectAllocatedBoms(
	nodes: TreeTableNode<PlanningSheetRowData>[],
	draft: PlanningSheetDraft,
	month: string,
	projectIdFilter?: string
): ProjectScopedBom[] {
	const out: ProjectScopedBom[] = [];

	const walk = (
		list: TreeTableNode<PlanningSheetRowData>[],
		ctx: {
			projectId?: string;
			projectLabel?: string;
			scheduleId?: string;
			scheduleLabel?: string;
			structureId?: string;
			structureLabel?: string;
		}
	) => {
		for (const node of list) {
			const data = node.data;
			if (data?.kind === 'project') {
				walk(node.children ?? [], {
					projectId: data.projectId,
					projectLabel: node.label
				});
				continue;
			}
			if (data?.kind === 'schedule') {
				walk(node.children ?? [], {
					...ctx,
					scheduleId: data.scheduleId,
					scheduleLabel: node.label
				});
				continue;
			}
			if (data?.kind === 'tower') {
				walk(node.children ?? [], {
					...ctx,
					structureId: data.structureId,
					structureLabel: node.label
				});
				continue;
			}
			if (data?.kind === 'bom') {
				if (projectIdFilter && data.projectId !== projectIdFilter) continue;
				const sets = bomMonthQty(draft, node.id, month);
				if (sets <= 0) continue;
				out.push({
					projectId: data.projectId,
					projectLabel: ctx.projectLabel ?? data.projectId,
					scheduleId: data.scheduleId,
					scheduleLabel: ctx.scheduleLabel ?? data.scheduleId,
					structureId: data.structureId,
					structureLabel: ctx.structureLabel ?? data.structureId,
					bomId: data.bomId,
					bomLabel: node.label,
					bomNodeId: node.id,
					sets
				});
			}
		}
	};

	walk(nodes, {});
	return out;
}

function lengthLabel(lengthMm: number): string {
	return lengthMm > 0 ? lengthMm.toLocaleString('en-US') : '-';
}

function buildProjectChildren(
	projectBoms: ProjectScopedBom[],
	projectId: string,
	projectLabel: string,
	sectionCache: Map<string, PublishedSectionLength[]>,
	leafIndex: PlanMonthAssignTree['leafIndex']
): TreeTableNode<AssignLockTreeData>[] {
	const bySchedule = new Map<string, ProjectScopedBom[]>();
	for (const bom of projectBoms) {
		const list = bySchedule.get(bom.scheduleId) ?? [];
		list.push(bom);
		bySchedule.set(bom.scheduleId, list);
	}

	const scheduleNodes: TreeTableNode<AssignLockTreeData>[] = [];
	for (const [scheduleId, scheduleBoms] of bySchedule) {
		const scheduleLabel = scheduleBoms[0]?.scheduleLabel ?? scheduleId;
		const byTower = new Map<string, ProjectScopedBom[]>();
		for (const bom of scheduleBoms) {
			const list = byTower.get(bom.structureId) ?? [];
			list.push(bom);
			byTower.set(bom.structureId, list);
		}

		const towerNodes: TreeTableNode<AssignLockTreeData>[] = [];
		for (const [structureId, towerBoms] of byTower) {
			const structureLabel = towerBoms[0]?.structureLabel ?? structureId;
			const bomNodes: TreeTableNode<AssignLockTreeData>[] = [];

			for (const bom of towerBoms) {
				const published = sectionCache.get(bom.bomId) ?? [];
				const leafNodes: TreeTableNode<AssignLockTreeData>[] = [];
				let bomRequired = 0;

				for (const stock of published) {
					const requiredQty = Math.max(0, Math.round(bom.sets * stock.qtyPerSet));
					if (requiredQty <= 0) continue;
					bomRequired += requiredQty;
					const requiredWeightKg =
						stock.weightKgPerBar != null ? stock.weightKgPerBar * requiredQty : null;
					const group: SectionLengthGroup = {
						groupKey: `${bom.bomId}|${stock.section}|${stock.lengthMm}`,
						itemId: '',
						section: stock.section,
						lengthMm: stock.lengthMm,
						lengthLabel: lengthLabel(stock.lengthMm),
						requiredQty,
						availableQty: 0,
						lockedQty: 0,
						requiredWeightKg,
						freeWeightKg: null,
						lockedWeightKg: null,
						unresolved: true,
						runsUnpinned: 0
					};
					const leafId = `ds:${scheduleId}|tower:${structureId}|bom:${bom.bomId}|${stock.section}|${stock.lengthMm}`;
					leafIndex.set(leafId, {
						projectId,
						projectLabel,
						group,
						dsId: scheduleId,
						bomId: bom.bomId
					});
					leafNodes.push({
						id: leafId,
						label: stock.section,
						selectable: true,
						data: {
							kind: 'section-length',
							requiredQty,
							requiredWeightKg,
							availableQty: 0,
							lockedQty: 0,
							unresolved: true,
							group
						}
					});
				}

				if (leafNodes.length === 0) continue;

				leafNodes.sort(
					(a, b) =>
						a.label.localeCompare(b.label) ||
						(a.data?.group?.lengthMm ?? 0) - (b.data?.group?.lengthMm ?? 0)
				);

				bomNodes.push({
					id: `ds:${scheduleId}|tower:${structureId}|bom:${bom.bomId}`,
					label: bom.bomLabel,
					defaultExpanded: true,
					selectable: false,
					data: {
						kind: 'bom',
						requiredQty: bomRequired,
						requiredWeightKg: null
					},
					children: leafNodes
				});
			}

			if (bomNodes.length === 0) continue;
			towerNodes.push({
				id: `ds:${scheduleId}|tower:${structureId}`,
				label: structureLabel,
				defaultExpanded: true,
				selectable: false,
				data: {
					kind: 'tower',
					requiredQty: bomNodes.reduce((sum, n) => sum + (n.data?.requiredQty ?? 0), 0),
					requiredWeightKg: null
				},
				children: bomNodes
			});
		}

		if (towerNodes.length === 0) continue;
		scheduleNodes.push({
			id: `ds:${scheduleId}`,
			label: scheduleLabel,
			defaultExpanded: true,
			selectable: false,
			data: {
				kind: 'schedule',
				requiredQty: towerNodes.reduce((sum, n) => sum + (n.data?.requiredQty ?? 0), 0),
				requiredWeightKg: null
			},
			children: towerNodes
		});
	}

	return scheduleNodes;
}
