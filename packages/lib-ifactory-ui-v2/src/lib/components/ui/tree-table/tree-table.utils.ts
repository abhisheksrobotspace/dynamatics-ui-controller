import { isColumnSticky, type StickyColumnProp } from '../table/table-sticky-columns';
import type {
	FlatTreeRow,
	TreeTableColumn,
	TreeTableColumnDef,
	TreeTableColumnGroup,
	TreeTableHeaderCell,
	TreeTableNode,
	TreeTableSelectionMode
} from './tree-table.constants';

export function isColumnGroup<T extends Record<string, unknown>>(
	column: TreeTableColumnDef<T>
): column is TreeTableColumnGroup<T> {
	return 'columns' in column && Array.isArray(column.columns);
}

export function flattenLeafColumns<T extends Record<string, unknown>>(
	columns: TreeTableColumnDef<T>[]
): TreeTableColumn<T>[] {
	return columns.flatMap((column) =>
		isColumnGroup(column) ? flattenLeafColumns(column.columns) : [column]
	);
}

export function hasColumnGroups<T extends Record<string, unknown>>(
	columns: TreeTableColumnDef<T>[]
): boolean {
	return columns.some(
		(column) => isColumnGroup(column) && flattenLeafColumns(column.columns).length > 0
	);
}

export function columnHeaderDepth<T extends Record<string, unknown>>(
	columns: TreeTableColumnDef<T>[]
): number {
	let max = 1;
	for (const column of columns) {
		if (!isColumnGroup(column) || column.columns.length === 0) continue;
		max = Math.max(max, 1 + columnHeaderDepth(column.columns));
	}
	return max;
}

function isTreeLeafColumn<T extends Record<string, unknown>>(
	column: TreeTableColumnDef<T>
): boolean {
	return !isColumnGroup(column) && 'tree' in column && column.tree === true;
}

function isSerialLeafColumn<T extends Record<string, unknown>>(
	column: TreeTableColumnDef<T>
): boolean {
	return !isColumnGroup(column) && column.type === 'serial';
}

function leafCount<T extends Record<string, unknown>>(column: TreeTableColumnDef<T>): number {
	return isColumnGroup(column) ? flattenLeafColumns(column.columns).length : 1;
}

function stickyLeafColumnMeta<T extends Record<string, unknown>>(
	column: TreeTableColumnDef<T>
): { key: string; class?: string; sticky: StickyColumnProp } | undefined {
	if (isColumnGroup(column)) {
		const leaf = flattenLeafColumns(column.columns).find((item) => isColumnSticky(item.sticky));
		return leaf && isColumnSticky(leaf.sticky)
			? {
					key: leaf.key,
					class: 'class' in leaf ? leaf.class : undefined,
					sticky: leaf.sticky
				}
			: undefined;
	}
	return isColumnSticky(column.sticky)
		? {
				key: column.key,
				class: 'class' in column ? column.class : undefined,
				sticky: column.sticky
			}
		: undefined;
}

function headerCellsAtRow<T extends Record<string, unknown>>(
	columns: TreeTableColumnDef<T>[],
	targetRow: number,
	currentRow: number,
	maxDepth: number,
	path: string
): TreeTableHeaderCell[] {
	const cells: TreeTableHeaderCell[] = [];

	for (let index = 0; index < columns.length; index++) {
		const column = columns[index];
		const count = leafCount(column);
		if (count === 0) continue;

		const key = `${path}/${index}:${column.key}`;
		if (currentRow === targetRow) {
			const group = isColumnGroup(column);
			const leafColumn = group ? undefined : column;
			const stickyMeta = stickyLeafColumnMeta(column);
			cells.push({
				key,
				header: column.header,
				headerClass: column.headerClass,
				colSpan: count,
				rowSpan: group ? 1 : maxDepth - currentRow,
				isGroup: group,
				isTree: !group && isTreeLeafColumn(column),
				isSerial: !group && isSerialLeafColumn(column),
				columnKey: stickyMeta?.key ?? leafColumn?.key,
				columnClass: stickyMeta?.class,
				sticky: stickyMeta?.sticky ?? false
			});
			continue;
		}

		if (isColumnGroup(column)) {
			cells.push(...headerCellsAtRow(column.columns, targetRow, currentRow + 1, maxDepth, key));
		}
	}

	return cells;
}

/** Header rows for nested column groups. Ungrouped columns get a single row. */
export function buildColumnHeaderRows<T extends Record<string, unknown>>(
	columns: TreeTableColumnDef<T>[]
): TreeTableHeaderCell[][] {
	const maxDepth = columnHeaderDepth(columns);
	const rows: TreeTableHeaderCell[][] = [];
	for (let row = 0; row < maxDepth; row++) {
		rows.push(headerCellsAtRow(columns, row, 0, maxDepth, 'h'));
	}
	return rows;
}

export function getNodeKind<T extends Record<string, unknown>>(
	node: TreeTableNode<T>
): NonNullable<TreeTableNode<T>['kind']> {
	return node.kind ?? 'row';
}

export function nodeHasBranchContent<T extends Record<string, unknown>>(
	node: TreeTableNode<T>
): boolean {
	const kind = getNodeKind(node);
	if (kind === 'group' || kind === 'group-footer') return false;
	return Boolean(node.details?.length || node.children?.length);
}

export function isNodeExpandable<T extends Record<string, unknown>>(
	node: TreeTableNode<T>
): boolean {
	if (node.collapsible === false) return false;
	return nodeHasBranchContent(node);
}

function nodeShowsBranch<T extends Record<string, unknown>>(
	node: TreeTableNode<T>,
	expandedIds: ReadonlySet<string>
): boolean {
	if (!nodeHasBranchContent(node)) return false;
	if (node.collapsible === false) return true;
	return expandedIds.has(node.id);
}

export type CollectDefaultExpandedOptions = {
	expandAll?: boolean;
	expandLevels?: number;
};

export function collectDefaultExpandedIds<T extends Record<string, unknown>>(
	nodes: TreeTableNode<T>[],
	options: boolean | CollectDefaultExpandedOptions = false
): string[] {
	const { expandAll = false, expandLevels } =
		typeof options === 'boolean' ? { expandAll: options } : options;

	if (expandLevels !== undefined) {
		return collectDefaultExpandedIdsByLevel(nodes, expandLevels);
	}

	const ids: string[] = [];

	function walk(list: TreeTableNode<T>[]) {
		for (const node of list) {
			if (isNodeExpandable(node) && (expandAll || node.defaultExpanded)) {
				ids.push(node.id);
			}
			if (node.children?.length) {
				walk(node.children);
			}
		}
	}

	walk(nodes);
	return ids;
}

function collectDefaultExpandedIdsByLevel<T extends Record<string, unknown>>(
	nodes: TreeTableNode<T>[],
	maxLevel: number,
	depth = 0
): string[] {
	const ids: string[] = [];

	for (const node of nodes) {
		const kind = getNodeKind(node);

		// Group banners are always open — traverse children at the same depth.
		if (kind === 'group') {
			if (node.children?.length) {
				ids.push(...collectDefaultExpandedIdsByLevel(node.children, maxLevel, depth));
			}
			continue;
		}

		if (kind === 'group-footer') {
			continue;
		}

		const expandable = isNodeExpandable(node);
		const shouldExpand = expandable && depth < maxLevel;

		if (shouldExpand) {
			ids.push(node.id);
		}

		if (node.children?.length && (shouldExpand || node.collapsible === false)) {
			ids.push(...collectDefaultExpandedIdsByLevel(node.children, maxLevel, depth + 1));
		}
	}

	return ids;
}

export function flattenVisibleTreeRows<T extends Record<string, unknown>>(
	nodes: TreeTableNode<T>[],
	expandedIds: ReadonlySet<string>,
	depth = 0,
	path = 'r'
): FlatTreeRow<T>[] {
	const rows: FlatTreeRow<T>[] = [];

	for (let index = 0; index < nodes.length; index++) {
		const node = nodes[index];
		const rowKey = `${path}/${index}:${node.id}`;
		const kind = getNodeKind(node);
		const expandable = isNodeExpandable(node);

		if (kind === 'group') {
			rows.push({ node, depth, hasChildren: false, kind: 'group', rowKey });
			if (node.children?.length) {
				rows.push(...flattenVisibleTreeRows(node.children, expandedIds, depth, rowKey));
			}
			continue;
		}

		if (kind === 'group-footer') {
			rows.push({ node, depth, hasChildren: false, kind: 'group-footer', rowKey });
			continue;
		}

		rows.push({ node, depth, hasChildren: expandable, kind: 'row', rowKey });

		if (!nodeShowsBranch(node, expandedIds)) {
			continue;
		}

		if (node.details?.length) {
			rows.push({
				node,
				depth,
				hasChildren: false,
				kind: 'detail',
				rowKey: `${rowKey}:detail`
			});
		}

		if (node.children?.length) {
			rows.push(...flattenVisibleTreeRows(node.children, expandedIds, depth + 1, rowKey));
		}
	}

	return rows;
}

/** Keeps matching nodes and their ancestors so the tree path stays visible. */
export function filterTreeNodes<T extends Record<string, unknown>>(
	nodes: TreeTableNode<T>[],
	query: string,
	match?: (node: TreeTableNode<T>, normalizedQuery: string) => boolean
): TreeTableNode<T>[] {
	const normalized = query.trim().toLowerCase();
	if (!normalized) return nodes;

	const matches =
		match ??
		((node, q) => {
			if (node.label.toLowerCase().includes(q)) return true;
			if (node.details?.some((detail) => detail.toLowerCase().includes(q))) {
				return true;
			}
			if (!node.data) return false;
			return Object.values(node.data).some(
				(value) => typeof value === 'string' && value.toLowerCase().includes(q)
			);
		});

	function filterList(list: TreeTableNode<T>[]): TreeTableNode<T>[] {
		const next: TreeTableNode<T>[] = [];

		for (const node of list) {
			const kind = getNodeKind(node);
			const filteredChildren = node.children?.length ? filterList(node.children) : [];
			const selfMatch = matches(node, normalized);

			if (kind === 'group-footer') {
				// Keep footer only when sibling/content matched via parent — parent decides.
				continue;
			}

			if (selfMatch || filteredChildren.length > 0) {
				const children =
					filteredChildren.length > 0 ? filteredChildren : selfMatch ? node.children : undefined;

				// Preserve trailing group-footer from original children when keeping the group.
				let nextChildren = children;
				if (kind === 'group' && node.children?.length) {
					const footer = node.children.find((child) => getNodeKind(child) === 'group-footer');
					if (footer && nextChildren && !nextChildren.some((child) => child.id === footer.id)) {
						nextChildren = [...nextChildren, footer];
					} else if (footer && !nextChildren) {
						nextChildren = [footer];
					}
				}

				next.push({
					...node,
					children: nextChildren,
					defaultExpanded: true
				});
			}
		}

		return next;
	}

	return filterList(nodes);
}

export function collectExpandableIds<T extends Record<string, unknown>>(
	nodes: TreeTableNode<T>[]
): string[] {
	const ids: string[] = [];

	function walk(list: TreeTableNode<T>[]) {
		for (const node of list) {
			if (isNodeExpandable(node)) {
				ids.push(node.id);
			}
			if (node.children?.length) {
				walk(node.children);
			}
		}
	}

	walk(nodes);
	return ids;
}

export type TreeSkeletonRow = {
	depth: number;
	hasChildren: boolean;
};

/** Repeating expanded-tree shape: root → section → leaves. */
const TREE_SKELETON_PATTERN: TreeSkeletonRow[] = [
	{ depth: 0, hasChildren: true },
	{ depth: 1, hasChildren: true },
	{ depth: 2, hasChildren: false },
	{ depth: 2, hasChildren: false },
	{ depth: 2, hasChildren: false },
	{ depth: 1, hasChildren: true },
	{ depth: 2, hasChildren: false },
	{ depth: 2, hasChildren: false }
];

export function buildTreeSkeletonRows(count: number): TreeSkeletonRow[] {
	const safeCount = Math.max(0, Math.trunc(count));
	return Array.from(
		{ length: safeCount },
		(_, index) => TREE_SKELETON_PATTERN[index % TREE_SKELETON_PATTERN.length]
	);
}

export function isNodeSelectable<T extends Record<string, unknown>>(
	node: TreeTableNode<T>
): boolean {
	return node.selectable !== false && getNodeKind(node) === 'row';
}

/** Show a checkbox (leaf or cascade parent). Excludes group / group-footer rows. */
export function showsSelectionCheckbox<T extends Record<string, unknown>>(
	node: TreeTableNode<T>
): boolean {
	const kind = getNodeKind(node);
	if (kind === 'group' || kind === 'group-footer') return false;
	if (isNodeSelectable(node)) return true;
	return collectSelectableLeafIds(node).length > 0;
}

/** Every selectable leaf id in the tree (deduped). */
export function collectTreeSelectableLeafIds<T extends Record<string, unknown>>(
	nodes: TreeTableNode<T>[]
): string[] {
	const set = new Set<string>();
	for (const node of nodes) {
		for (const id of collectSelectableLeafIds(node)) {
			set.add(id);
		}
	}
	return [...set];
}

/** All selectable node ids in the subtree, including `node` when selectable. */
export function collectSelectableDescendantIds<T extends Record<string, unknown>>(
	node: TreeTableNode<T>
): string[] {
	const ids: string[] = [];

	function walk(current: TreeTableNode<T>) {
		if (isNodeSelectable(current)) {
			ids.push(current.id);
		}
		if (current.children?.length) {
			for (const child of current.children) {
				walk(child);
			}
		}
	}

	walk(node);
	return ids;
}

/**
 * Selectable leaf ids under `node` (no children in the tree).
 * Branch check state and “all selected” use these so parents show checked when
 * only leaf ids are in `selectedIds` (e.g. programmatic select-all).
 */
export function collectSelectableLeafIds<T extends Record<string, unknown>>(
	node: TreeTableNode<T>
): string[] {
	const ids: string[] = [];

	function walk(current: TreeTableNode<T>) {
		const children = current.children ?? [];
		if (children.length === 0) {
			if (isNodeSelectable(current)) ids.push(current.id);
			return;
		}
		for (const child of children) {
			walk(child);
		}
	}

	walk(node);
	if (ids.length === 0 && isNodeSelectable(node)) return [node.id];
	return ids;
}

function findTreeNodeById<T extends Record<string, unknown>>(
	nodes: TreeTableNode<T>[],
	id: string
): TreeTableNode<T> | undefined {
	for (const node of nodes) {
		if (node.id === id) return node;
		if (node.children?.length) {
			const found = findTreeNodeById(node.children, id);
			if (found) return found;
		}
	}
	return undefined;
}

export type ToggleTreeSelectionArgs<T extends Record<string, unknown>> = {
	nodes: TreeTableNode<T>[];
	selectedIds: string[];
	toggledId: string;
	mode?: TreeTableSelectionMode;
};

/**
 * Returns the next `selectedIds` after toggling `toggledId`.
 * - `multiple`: selecting a parent adds all selectable descendants; deselecting removes them.
 * - `single`: only that id, or empty when deselecting.
 */
export function toggleTreeSelection<T extends Record<string, unknown>>({
	nodes,
	selectedIds,
	toggledId,
	mode = 'multiple'
}: ToggleTreeSelectionArgs<T>): string[] {
	const node = findTreeNodeById(nodes, toggledId);
	if (!node) return selectedIds;

	const selectedSet = new Set(selectedIds);

	if (mode === 'single') {
		if (!isNodeSelectable(node)) return selectedIds;
		return selectedSet.has(toggledId) ? [] : [toggledId];
	}

	const descendantIds = collectSelectableDescendantIds(node);
	if (descendantIds.length === 0) return selectedIds;

	const leafIds = collectSelectableLeafIds(node);
	const allSelected = leafIds.length > 0 && leafIds.every((id) => selectedSet.has(id));
	if (allSelected) {
		const remove = new Set(descendantIds);
		return selectedIds.filter((id) => !remove.has(id));
	}

	const next = new Set(selectedIds);
	for (const id of descendantIds) {
		next.add(id);
	}
	return [...next];
}

export type TreeNodeCheckState = 'checked' | 'unchecked' | 'indeterminate';

export function getTreeNodeCheckState<T extends Record<string, unknown>>(
	node: TreeTableNode<T>,
	selectedSet: ReadonlySet<string>
): TreeNodeCheckState {
	const leafIds = collectSelectableLeafIds(node);
	if (leafIds.length === 0) return 'unchecked';

	let selectedCount = 0;
	for (const id of leafIds) {
		if (selectedSet.has(id)) selectedCount += 1;
	}

	if (selectedCount === 0) return 'unchecked';
	if (selectedCount === leafIds.length) return 'checked';
	return 'indeterminate';
}
