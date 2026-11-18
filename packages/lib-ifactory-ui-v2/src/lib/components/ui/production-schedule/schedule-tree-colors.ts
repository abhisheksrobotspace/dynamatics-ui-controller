import type { ScheduleTreeNode } from './production-schedule.constants';

/**
 * Distinct hues for schedule tree levels / Gantt bars.
 * Intentionally excludes red and black (and near-black greys).
 */
export const SCHEDULE_TREE_PALETTE = [
	'#3B82F6', // blue
	'#8B5CF6', // violet
	'#14B8A6', // teal
	'#F59E0B', // amber
	'#6366F1', // indigo
	'#10B981', // emerald
	'#EC4899', // pink
	'#06B6D4', // cyan
	'#A855F7', // purple
	'#84CC16', // lime
	'#0EA5E9', // sky
	'#D946EF', // fuchsia
	'#22C55E', // green
	'#F97316', // orange
	'#7C3AED' // deep violet
] as const;

export type ScheduleTreeColorState = {
	/** Color for nodes at the active expansion level (and inherited by descendants). */
	colorByNodeId: Record<string, string>;
	/** Mark leaf id → color for Gantt bars. */
	colorByMarkId: Record<string, string>;
	/**
	 * Mark ids that stay fully visible on the Gantt.
	 * `null` = no dimming (focus is All orders).
	 */
	highlightedMarkIds: string[] | null;
	/** Sidebar nodes outside the focused branch. */
	dimmedNodeIds: Set<string>;
	focusParentId: string;
};

function paletteColor(index: number): string {
	return SCHEDULE_TREE_PALETTE[index % SCHEDULE_TREE_PALETTE.length]!;
}

function findNode(nodes: ScheduleTreeNode[], id: string): ScheduleTreeNode | null {
	for (const node of nodes) {
		if (node.id === id) return node;
		if (node.children?.length) {
			const found = findNode(node.children, id);
			if (found) return found;
		}
	}
	return null;
}

function findPath(nodes: ScheduleTreeNode[], id: string): ScheduleTreeNode[] | null {
	for (const node of nodes) {
		if (node.id === id) return [node];
		if (node.children?.length) {
			const childPath = findPath(node.children, id);
			if (childPath) return [node, ...childPath];
		}
	}
	return null;
}

function collectLeafIds(node: ScheduleTreeNode): string[] {
	if (!node.children?.length) return [node.id];
	return node.children.flatMap(collectLeafIds);
}

function collectAllNodeIds(node: ScheduleTreeNode, out: Set<string> = new Set()): Set<string> {
	out.add(node.id);
	for (const child of node.children ?? []) collectAllNodeIds(child, out);
	return out;
}

/**
 * Deepest expanded ancestor whose children should receive distinct colors.
 * Walks the selection path when possible so one branch stays in focus.
 */
function resolveFocusParent(
	tree: ScheduleTreeNode[],
	expanded: Record<string, boolean>,
	selectedNodeId: string
): ScheduleTreeNode {
	const root = tree.find((n) => n.id === 'all') ?? tree[0];
	if (!root) {
		return { id: 'all', label: 'All orders', children: [] };
	}

	const path = selectedNodeId && selectedNodeId !== 'all' ? findPath(tree, selectedNodeId) : [root];

	let focus = root;
	if (path?.length) {
		for (const node of path) {
			if (expanded[node.id] && (node.children?.length ?? 0) > 0) {
				focus = node;
			}
		}
	}

	// Continue into a single expanded child branch when selection is still at an ancestor.
	let guard = 0;
	while (guard++ < 20) {
		const kids = focus.children ?? [];
		const expandedParents = kids.filter((c) => expanded[c.id] && (c.children?.length ?? 0) > 0);
		if (expandedParents.length === 1) {
			focus = expandedParents[0]!;
			continue;
		}
		break;
	}

	return focus;
}

/**
 * Assign level colors from the orders tree based on which dropdown is open,
 * and grey Gantt/sidebar items outside the **selected** branch.
 *
 * Colors (expansion):
 * - Only All orders open → each project a color
 * - Project open → each tower a color
 * - Tower open → each BOM a color
 * - BOM open → each section a color
 * - Section open → each mark a color
 *
 * Greying (selection):
 * - All orders selected → nothing greyed
 * - Project / tower / BOM / section / mark selected → only that subtree stays highlighted
 */
export function computeScheduleTreeColors(
	tree: ScheduleTreeNode[],
	expanded: Record<string, boolean>,
	selectedNodeId = 'all'
): ScheduleTreeColorState {
	const focusParent = resolveFocusParent(tree, expanded, selectedNodeId);
	const coloredChildren = focusParent.children ?? [];
	const colorByNodeId: Record<string, string> = {};
	const colorByMarkId: Record<string, string> = {};

	coloredChildren.forEach((child, index) => {
		const color = paletteColor(index);
		colorByNodeId[child.id] = color;
		for (const leafId of collectLeafIds(child)) {
			colorByMarkId[leafId] = color;
			colorByNodeId[leafId] = color;
		}
		// Tag intermediate descendants so the sidebar can tint them.
		const walk = (n: ScheduleTreeNode) => {
			colorByNodeId[n.id] = color;
			for (const c of n.children ?? []) walk(c);
		};
		walk(child);
	});

	// Selection drives greying: only marks under the selected node stay fully visible.
	const selectedNode =
		!selectedNodeId || selectedNodeId === 'all' ? null : findNode(tree, selectedNodeId);
	const highlightedMarkIds = selectedNode ? collectLeafIds(selectedNode) : null;

	const dimmedNodeIds = new Set<string>();
	const root = tree.find((n) => n.id === 'all') ?? tree[0];
	if (root && selectedNode) {
		const keepIds = collectAllNodeIds(selectedNode);
		for (const id of collectAllNodeIds(root)) {
			if (!keepIds.has(id) && id !== 'all') dimmedNodeIds.add(id);
		}
		// Keep ancestors of the selection visible (not dimmed).
		const path = findPath(tree, selectedNode.id) ?? [];
		for (const node of path) dimmedNodeIds.delete(node.id);
	}

	return {
		colorByNodeId,
		colorByMarkId,
		highlightedMarkIds,
		dimmedNodeIds,
		focusParentId: focusParent.id
	};
}

export function findTreeNodeById(tree: ScheduleTreeNode[], id: string): ScheduleTreeNode | null {
	return findNode(tree, id);
}
