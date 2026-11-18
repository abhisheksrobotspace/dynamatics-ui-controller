import type { TreeTableNode } from '@ifactory/ui-v2';
import type { PlanningSheetDraft, PlanningSheetRowData } from './planning-sheet.types.js';

function collectDescendantIds(node: TreeTableNode<PlanningSheetRowData>): string[] {
	const ids = [node.id];
	for (const child of node.children ?? []) {
		ids.push(...collectDescendantIds(child));
	}
	return ids;
}

function findNode(
	nodes: TreeTableNode<PlanningSheetRowData>[],
	id: string
): TreeTableNode<PlanningSheetRowData> | undefined {
	for (const node of nodes) {
		if (node.id === id) return node;
		const found = findNode(node.children ?? [], id);
		if (found) return found;
	}
	return undefined;
}

export function setMonthIncluded(
	draft: PlanningSheetDraft,
	nodes: TreeTableNode<PlanningSheetRowData>[],
	nodeId: string,
	month: string,
	included: boolean
): PlanningSheetDraft {
	const node = findNode(nodes, nodeId);
	if (!node) return draft;
	const nextIncluded = { ...draft.included };
	for (const id of collectDescendantIds(node)) {
		nextIncluded[id] = { ...(nextIncluded[id] ?? {}), [month]: included };
	}

	const monthQtyByBomId = { ...draft.monthQtyByBomId };
	if (!included) {
		for (const id of collectDescendantIds(node)) {
			if (!id.startsWith('dsl:')) continue;
			const prev = { ...(monthQtyByBomId[id] ?? {}) };
			delete prev[month];
			if (Object.keys(prev).length === 0) delete monthQtyByBomId[id];
			else monthQtyByBomId[id] = prev;
		}
	}

	return { ...draft, included: nextIncluded, monthQtyByBomId };
}

export function isMonthIncluded(draft: PlanningSheetDraft, nodeId: string, month: string): boolean {
	return draft.included[nodeId]?.[month] !== false;
}

/** Partial selection among descendants (for indeterminate checkbox). */
export function isMonthIndeterminate(
	draft: PlanningSheetDraft,
	nodes: TreeTableNode<PlanningSheetRowData>[],
	nodeId: string,
	month: string
): boolean {
	const node = findNode(nodes, nodeId);
	if (!node?.children?.length) return false;
	const ids = collectDescendantIds(node).filter((id) => id !== nodeId);
	if (ids.length === 0) return false;
	const flags = ids.map((id) => isMonthIncluded(draft, id, month));
	const anyOn = flags.some(Boolean);
	const anyOff = flags.some((f) => !f);
	return anyOn && anyOff;
}

export function setBomMonthQty(
	draft: PlanningSheetDraft,
	bomNodeId: string,
	month: string,
	raw: string,
	availableSets: number
): PlanningSheetDraft {
	const parsed = raw.trim() === '' ? 0 : Number(raw);
	const uncapped = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
	const cap = Math.max(0, availableSets);
	const qty = Math.min(uncapped, cap);
	const prev = draft.monthQtyByBomId[bomNodeId] ?? {};
	const nextMonths = { ...prev };
	if (qty <= 0) delete nextMonths[month];
	else nextMonths[month] = qty;
	const monthQtyByBomId = { ...draft.monthQtyByBomId };
	if (Object.keys(nextMonths).length === 0) delete monthQtyByBomId[bomNodeId];
	else monthQtyByBomId[bomNodeId] = nextMonths;
	return { ...draft, monthQtyByBomId };
}

/**
 * Max sets allowed in this month’s input: BOM qty minus plans in other included months.
 * (Current month’s value is excluded so the field can keep or reduce its own amount.)
 */
export function maxBomMonthQty(
	draft: PlanningSheetDraft,
	bomNodeId: string,
	month: string,
	qtySets: number
): number {
	const otherPlanned = draft.months.reduce((sum, m) => {
		if (m === month) return sum;
		return sum + bomMonthQty(draft, bomNodeId, m);
	}, 0);
	return Math.max(0, qtySets - otherPlanned);
}

export function bomMonthQty(draft: PlanningSheetDraft, bomNodeId: string, month: string): number {
	if (!isMonthIncluded(draft, bomNodeId, month)) return 0;
	return draft.monthQtyByBomId[bomNodeId]?.[month] ?? 0;
}

/** Planned sets for a node in one month (BOM input or sum of children). */
export function plannedSetsForMonth(
	draft: PlanningSheetDraft,
	node: TreeTableNode<PlanningSheetRowData>,
	month: string
): number {
	if (!isMonthIncluded(draft, node.id, month)) return 0;
	if (node.data?.kind === 'bom') return bomMonthQty(draft, node.id, month);
	return (node.children ?? []).reduce(
		(sum, child) => sum + plannedSetsForMonth(draft, child, month),
		0
	);
}

/** Remaining sets = qty − Σ included month plans (rolled up). */
export function balanceSets(
	draft: PlanningSheetDraft,
	node: TreeTableNode<PlanningSheetRowData>
): number {
	const qty = node.data?.qtySets ?? 0;
	const planned = draft.months.reduce(
		(sum, month) => sum + plannedSetsForMonth(draft, node, month),
		0
	);
	return qty - planned;
}

export function formatSets(value: number): string {
	if (!Number.isFinite(value)) return '-';
	return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '');
}

export function formatQtyMt(value: number | null | undefined): string {
	if (value == null || !Number.isFinite(value)) return '-';
	return value.toFixed(3);
}

/**
 * BOM is delayed when any planned sets sit in a month after its DS delivery month
 * (e.g. DS in September, qty in October).
 */
export function isBomAllocationDelayed(
	draft: PlanningSheetDraft,
	node: TreeTableNode<PlanningSheetRowData>
): boolean {
	if (node.data?.kind !== 'bom') return false;
	const deliveryMonth = node.data.deliveryMonth;
	if (!deliveryMonth) return false;
	const byMonth = draft.monthQtyByBomId[node.id] ?? {};
	for (const [month, qty] of Object.entries(byMonth)) {
		if (qty > 0 && month > deliveryMonth) return true;
	}
	return false;
}

function collectBomNodes(
	node: TreeTableNode<PlanningSheetRowData>
): TreeTableNode<PlanningSheetRowData>[] {
	if (node.data?.kind === 'bom') return [node];
	return (node.children ?? []).flatMap(collectBomNodes);
}

export type PlanningDelayStatus = 'delayed' | 'partially-delayed' | null;

/**
 * BOM → delayed | null.
 * Schedule / tower → delayed if every descendant BOM is delayed;
 * partially-delayed if only some are; otherwise null.
 */
export function planningNodeDelayStatus(
	draft: PlanningSheetDraft,
	node: TreeTableNode<PlanningSheetRowData>
): PlanningDelayStatus {
	const kind = node.data?.kind;
	if (kind === 'bom') return isBomAllocationDelayed(draft, node) ? 'delayed' : null;
	if (kind !== 'schedule' && kind !== 'tower') return null;

	const boms = collectBomNodes(node);
	if (boms.length === 0) return null;
	const delayedCount = boms.filter((bom) => isBomAllocationDelayed(draft, bom)).length;
	if (delayedCount === 0) return null;
	if (delayedCount === boms.length) return 'delayed';
	return 'partially-delayed';
}

/** Bracketed label for the tree trailing status. */
export function planningNodeDelayLabel(
	draft: PlanningSheetDraft,
	node: TreeTableNode<PlanningSheetRowData>
): string {
	const status = planningNodeDelayStatus(draft, node);
	if (status === 'delayed') return '(Delayed)';
	if (status === 'partially-delayed') return '(Partial)';
	return '';
}
