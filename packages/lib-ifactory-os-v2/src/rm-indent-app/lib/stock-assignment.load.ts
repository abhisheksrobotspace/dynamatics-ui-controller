import type { TreeTableNode } from '@ifactory/ui-v2';
import { loadPlanningSheetTreeForMonth } from '../../central-planning-app/lib/planning-sheet.load.js';
import type { PlanningSheetRowData } from '../../central-planning-app/lib/planning-sheet.types.js';

export type StockAssignmentBomMeta = {
	projectId: string;
	projectLabel: string;
	scheduleId: string;
	bomId: string;
};

const bomMetaByNodeId: Record<string, StockAssignmentBomMeta> = {};

export function getStockAssignmentBomMeta(bomNodeId: string): StockAssignmentBomMeta | undefined {
	return bomMetaByNodeId[bomNodeId];
}

/** Calendar month key used for Stock Assignment home (`YYYY-MM`). */
export function currentStockAssignmentMonthKey(now = new Date()): string {
	return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Project → DS → structure → subtype for delivery schedules in the given
 * calendar month. Qty/weight come from DS lines + BOM metadata — not from
 * central or shop-floor plans.
 */
export async function loadStockAssignmentHomeTree(
	month: string,
	signal?: AbortSignal
): Promise<TreeTableNode<PlanningSheetRowData>[]> {
	const m = month.slice(0, 7);
	for (const key of Object.keys(bomMetaByNodeId)) delete bomMetaByNodeId[key];

	const loaded = await loadPlanningSheetTreeForMonth(m, signal);
	const projectLabelById = new Map<string, string>();

	const registerLeaves = (nodes: TreeTableNode<PlanningSheetRowData>[], projectLabel: string) => {
		for (const node of nodes) {
			if (node.data?.kind === 'project') {
				projectLabelById.set(node.data.projectId, node.label);
			}
			if (node.data?.kind === 'bom') {
				const { projectId, scheduleId, bomId } = node.data;
				bomMetaByNodeId[node.id] = {
					projectId,
					projectLabel: projectLabelById.get(projectId) ?? (projectLabel || projectId),
					scheduleId,
					bomId
				};
			}
			if (node.children?.length) {
				registerLeaves(node.children, node.data?.kind === 'project' ? node.label : projectLabel);
			}
		}
	};
	registerLeaves(loaded.nodes, '');

	return loaded.nodes;
}

/** Expand parent selection to BOM leaf metas for Assign handoff. */
export function collectStockAssignmentBomMetas(
	selectedIds: string[],
	nodes: TreeTableNode<PlanningSheetRowData>[]
): StockAssignmentBomMeta[] {
	const selected = new Set(selectedIds);
	const out: StockAssignmentBomMeta[] = [];
	const seen = new Set<string>();

	const walk = (list: TreeTableNode<PlanningSheetRowData>[], ancestorSelected: boolean) => {
		for (const node of list) {
			const sel = ancestorSelected || selected.has(node.id);
			if (node.data?.kind === 'bom') {
				if (sel) {
					const meta = bomMetaByNodeId[node.id];
					if (meta && !seen.has(node.id)) {
						seen.add(node.id);
						out.push(meta);
					}
				}
				continue;
			}
			if (node.children?.length) walk(node.children, sel);
		}
	};
	walk(nodes, false);
	return out;
}

export function totalTonnageMt(nodes: TreeTableNode<PlanningSheetRowData>[]): number {
	return nodes.reduce((sum, node) => {
		const mt = node.data?.qtyMt;
		return sum + (mt != null && Number.isFinite(mt) ? mt : 0);
	}, 0);
}
