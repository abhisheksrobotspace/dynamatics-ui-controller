import type { Component } from 'svelte';
import type { HTMLInputAttributes } from 'svelte/elements';
import type { InputSize } from '../input/input.styles';

export type TreeTableNodeKind = 'row' | 'group' | 'group-footer';

export type TreeTableSelectionMode = 'single' | 'multiple';

export type TreeTableSelectionConfig = {
	enabled: boolean;
	/** Defaults to `multiple`. */
	mode?: TreeTableSelectionMode;
	/** Hide the header “select all” control (e.g. accordion item tables). */
	hideSelectAll?: boolean;
	onSelectionChange?: (ids: string[]) => void;
};

export type TreeTableNode<T extends Record<string, unknown> = Record<string, unknown>> = {
	id: string;
	label: string;
	children?: TreeTableNode<T>[];
	/** Optional payload for column value / action resolvers. */
	data?: T;
	defaultExpanded?: boolean;
	/**
	 * `group` — full-width section banner (children always visible).
	 * `group-footer` — section subtotal row.
	 * Default `row` — normal data row.
	 */
	kind?: TreeTableNodeKind;
	/** Pre-formatted detail lines under the row when expanded. Consumers own the display text. */
	details?: string[];
	/** When false, children are always shown under an expanded parent and no expand control is rendered. */
	collapsible?: boolean;
	/** When false, node is excluded from checkbox selection. Default true when undefined. */
	selectable?: boolean;
};

export type TreeTableEmptyStateConfig = {
	title?: string;
	description?: string;
	icon?: Component<{ class?: string }>;
	iconClass?: string;
	actionLabel?: string;
	actionIcon?: Component<{ class?: string }>;
	actionIconClass?: string;
	onAction?: () => void;
	class?: string;
};

export type TreeTableActionVariant = 'primary' | 'secondary' | 'outline' | 'ghost';
export type TreeTableActionSize = 'sm' | 'md' | 'lg' | 'icon';
export type TreeTableColumnAlign = 'start' | 'center' | 'end';

export type TreeTableButtonAction<T extends Record<string, unknown>> = {
	label?: string;
	icon?: Component;
	iconPosition?: 'left' | 'right';
	variant?: TreeTableActionVariant;
	size?: TreeTableActionSize;
	disabled?: boolean | ((node: TreeTableNode<T>) => boolean);
	loading?: boolean;
	href?: string | ((node: TreeTableNode<T>) => string);
	onClick?: (node: TreeTableNode<T>, event: MouseEvent) => void;
	class?: string;
	ariaLabel?: string;
};

type ColumnBase<T extends Record<string, unknown> = Record<string, unknown>> = {
	key: string;
	header: string;
	class?: string | ((node: TreeTableNode<T>) => string);
	headerClass?: string;
	/**
	 * Pin this column during horizontal scroll.
	 * `true` / `'left'` stick to the left; `'right'` sticks to the right.
	 */
	sticky?: boolean | 'left' | 'right';
};

export type TreeTableTextColumn<T extends Record<string, unknown>> = ColumnBase<T> & {
	type?: 'text';
	/**
	 * Renders expand/collapse in this column.
	 * Cell text uses `value(node)` when provided, otherwise `node.label`.
	 */
	tree?: boolean;
	value?: (node: TreeTableNode<T>) => string;
	/** Optional class on a wrapper around the cell text (wins over cell `text-foreground`). */
	valueClass?: string | ((node: TreeTableNode<T>) => string);
	/** Optional text rendered after the label (e.g. status). Empty/undefined = hidden. */
	trailing?: (node: TreeTableNode<T>) => string | undefined | null;
	/** Class on the trailing span. */
	trailingClass?: string | ((node: TreeTableNode<T>) => string);
	/**
	 * Optional min content width hint (e.g. `16rem`). Prefer sizing the column via
	 * `class` (`w-*` / `max-w-*` + `overflow-hidden`); tree cells always clip and
	 * truncate the label so trailing status cannot spill into the next column.
	 */
	treeContentWidth?: string;
};

export type TreeTableSerialColumn<T extends Record<string, unknown>> = ColumnBase<T> & {
	type: 'serial';
	value?: (node: TreeTableNode<T>) => string;
};

export type TreeTableInputColumn<T extends Record<string, unknown>> = ColumnBase<T> & {
	type: 'input';
	align?: TreeTableColumnAlign;
	/** Current cell value (controlled by the consumer). */
	value: (node: TreeTableNode<T>) => string;
	onValueChange?: (node: TreeTableNode<T>, value: string) => void;
	/**
	 * When false, no input is rendered for that node.
	 * Use `fallbackValue` for static text in those cells (default empty).
	 */
	visible?: boolean | ((node: TreeTableNode<T>) => boolean);
	disabled?: boolean | ((node: TreeTableNode<T>) => boolean);
	placeholder?: string | ((node: TreeTableNode<T>) => string);
	/** HTML input type. Defaults to `text`. */
	inputType?: HTMLInputAttributes['type'];
	size?: InputSize;
	min?: string | number | ((node: TreeTableNode<T>) => string | number | undefined);
	max?: string | number | ((node: TreeTableNode<T>) => string | number | undefined);
	step?: string | number | ((node: TreeTableNode<T>) => string | number | undefined);
	fallbackValue?: (node: TreeTableNode<T>) => string;
	inputClass?: string | ((node: TreeTableNode<T>) => string);
	ariaLabel?: string | ((node: TreeTableNode<T>) => string);
	/**
	 * When true (default), Enter moves focus to the next visible input in this column.
	 * Set false to keep focus / handle navigation yourself via `onEnter`.
	 */
	enterNavigates?: boolean;
	onEnter?: (node: TreeTableNode<T>, event: KeyboardEvent) => void;
	/** Focus the first visible, enabled input in this column once after the table renders. */
	autofocusFirst?: boolean;
};

/**
 * Per-row control: checkbox (include/exclude), numeric/text input, or empty.
 * Used for month columns that mix parent checkboxes with leaf inputs.
 */
export type TreeTableControlColumn<T extends Record<string, unknown>> = ColumnBase<T> & {
	type: 'control';
	align?: TreeTableColumnAlign;
	mode: (node: TreeTableNode<T>) => 'checkbox' | 'input' | 'empty';
	checked?: (node: TreeTableNode<T>) => boolean;
	indeterminate?: (node: TreeTableNode<T>) => boolean;
	onCheckedChange?: (node: TreeTableNode<T>, checked: boolean) => void;
	value?: (node: TreeTableNode<T>) => string;
	onValueChange?: (node: TreeTableNode<T>, value: string) => void;
	disabled?: boolean | ((node: TreeTableNode<T>) => boolean);
	placeholder?: string | ((node: TreeTableNode<T>) => string);
	inputType?: HTMLInputAttributes['type'];
	size?: InputSize;
	min?: string | number | ((node: TreeTableNode<T>) => string | number | undefined);
	max?: string | number | ((node: TreeTableNode<T>) => string | number | undefined);
	step?: string | number | ((node: TreeTableNode<T>) => string | number | undefined);
	inputClass?: string | ((node: TreeTableNode<T>) => string);
	ariaLabel?: string | ((node: TreeTableNode<T>) => string);
	enterNavigates?: boolean;
	onEnter?: (node: TreeTableNode<T>, event: KeyboardEvent) => void;
};

export type TreeTableActionsColumn<T extends Record<string, unknown>> = ColumnBase<T> & {
	type: 'actions';
	align?: TreeTableColumnAlign;
	actions: (node: TreeTableNode<T>) => TreeTableButtonAction<T>[];
};

export type TreeTableColumn<T extends Record<string, unknown>> =
	| TreeTableTextColumn<T>
	| TreeTableSerialColumn<T>
	| TreeTableInputColumn<T>
	| TreeTableControlColumn<T>
	| TreeTableActionsColumn<T>;

/**
 * Groups leaf columns (or nested groups) under one parent header.
 * Example: FY → quarter → date → Qty / Weight.
 */
export type TreeTableColumnGroup<T extends Record<string, unknown>> = ColumnBase<T> & {
	columns: TreeTableColumnDef<T>[];
};

/** Leaf column or a nested column group. Existing `TreeTableColumn` arrays still type-check. */
export type TreeTableColumnDef<T extends Record<string, unknown>> =
	TreeTableColumn<T> | TreeTableColumnGroup<T>;

export type TreeTableHeaderCell = {
	key: string;
	header: string;
	headerClass?: string;
	colSpan: number;
	rowSpan: number;
	isGroup: boolean;
	/** True when this leaf header is the tree/description column. */
	isTree?: boolean;
	/** True when this leaf header is a fixed-width serial (S.No) column. */
	isSerial?: boolean;
	/** Leaf column key — used for horizontal sticky pinning. */
	columnKey?: string;
	/** Leaf column class (e.g. min-width) applied to nested sticky group headers too. */
	columnClass?: string;
	sticky?: boolean | 'left' | 'right';
};

export type FlatTreeRowKind = 'row' | 'group' | 'group-footer' | 'detail';

export type FlatTreeRow<T extends Record<string, unknown>> = {
	node: TreeTableNode<T>;
	depth: number;
	hasChildren: boolean;
	kind: FlatTreeRowKind;
	/** Stable unique key for `{#each}` — path-based so duplicate `node.id` values cannot collide. */
	rowKey: string;
};
