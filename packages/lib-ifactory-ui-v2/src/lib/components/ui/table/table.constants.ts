import type { Component } from 'svelte';
import type { HTMLInputAttributes } from 'svelte/elements';
import type { InputSize } from '$lib/components/ui/input/input.styles';
import type { StatusBarSegment } from '$lib/components/ui/status-bar/status-bar.constants';

export type TableEmptyStateConfig = {
	title?: string;
	description?: string;
	icon?: Component<{ class?: string }>;
	iconClass?: string;
	actionLabel?: string;
	actionIcon?: Component<{ class?: string }>;
	actionIconClass?: string;
	onAction?: () => void;
	class?: string;
	titleClass?: string;
	descriptionClass?: string;
};

export type TableSelectionMode = 'single' | 'multiple';

export type TableSelectionConfig = {
	enabled: boolean;
	/** Defaults to `multiple`. `single` allows at most one selected row and hides select-all. */
	mode?: TableSelectionMode;
	hideSelectAll?: boolean;
	/** When true, all selection checkboxes are disabled (shown but not interactive). */
	disabled?: boolean;
	/** When false, the row checkbox is disabled and excluded from select-all. Defaults to true. */
	isRowSelectable?: (rowKey: string) => boolean;
	onSelectionChange?: (keys: string[]) => void;
};

export type RowTone = 'online' | 'offline' | 'loading' | 'error';

/** Controls alternating row backgrounds in the table body. */
export type TableRowVariant = 'default' | 'striped';

export type TableShellVariant = 'plain' | 'structured' | 'card';

export type TableLayout = 'shell' | 'content';

/** Placeholder rows while `loading` is true. Matches the default page size. */
export const DEFAULT_SKELETON_ROW_COUNT = 5;

export type TableTheadVariant = 'structured' | 'card';

export type BadgeVariant =
	'default' | 'secondary' | 'outline' | 'online' | 'error' | 'loading' | 'offline';

export type BadgeCell = {
	variant: BadgeVariant | RowTone;
	label: string;
	dot?: boolean;
	class?: string;
};

export type SortState = {
	key: string;
	direction: 'asc' | 'desc';
} | null;

export type TablePrimaryAction = {
	label: string;
	onClick?: () => void;
	href?: string;
	class?: string;
};

type ColumnBase<T = unknown> = {
	key: string;
	header: string;
	/** Renders `header (` + text + `)` with optional class on text only. */
	headerHighlight?: {
		text: string;
		class?: string;
	};
	class?: string;
	/**
	 * Extra class on each body cell for this column.
	 * Function form is evaluated per row (e.g. highlight a changed field).
	 */
	cellClass?: string | ((row: T) => string);
	headerClass?: string;
	sortable?: boolean;
	filterable?: boolean;
	/**
	 * Pin this column during horizontal scroll.
	 * `true` / `'left'` stick to the left; `'right'` sticks to the right.
	 */
	sticky?: boolean | 'left' | 'right';
};

export type TextColumn<T> = ColumnBase<T> & {
	type?: 'text';
	/** True while this cell's value is still loading; shows a skeleton instead. */
	loading?: (row: T) => boolean;
	value?: (row: T) => string;
	title?: (row: T) => string | undefined;
};

export type SerialColumn<T> = ColumnBase<T> & {
	type: 'serial';
	value?: (row: T) => string;
	title?: (row: T) => string | undefined;
};

export type BadgeColumn<T> = ColumnBase<T> & {
	type: 'badge';
	badge: (row: T) => BadgeCell;
};

export type MultiBadgeColumn<T> = ColumnBase<T> & {
	type: 'multi-badge';
	label?: (row: T) => string | undefined;
	badges: (row: T) => BadgeCell[];
	maxBadges?: number;
};

export type MetricBarColumn<T> = ColumnBase<T> & {
	type: 'metric-bar';
	/** True while this cell's value is still loading; shows a skeleton instead. */
	loading?: (row: T) => boolean;
	label: (row: T) => string;
	segments: (row: T) => StatusBarSegment[];
};

export type TableActionVariant = 'primary' | 'secondary' | 'outline' | 'ghost';
export type TableActionSize = 'sm' | 'md' | 'lg' | 'icon';

export type TableButtonAction<T> = {
	type?: 'button';
	label?: string;
	icon?: Component;
	iconPosition?: 'left' | 'right';
	variant?: TableActionVariant;
	size?: TableActionSize;
	disabled?: boolean | ((row: T) => boolean);
	loading?: boolean;
	href?: string | ((row: T) => string);
	onClick?: (row: T, event: MouseEvent) => void;
	title?: string;
	class?: string;
	ariaLabel?: string;
};

export type TableLabelAction = {
	type: 'label';
	label: string;
	title?: string;
	class?: string;
};

export type TableBadgeAction = {
	type: 'badge';
	label: string;
	variant?: BadgeVariant;
	dot?: boolean;
	title?: string;
	class?: string;
};

export type TableDropdownItem<T> = {
	label: string;
	value?: string;
	icon?: Component;
	disabled?: boolean | ((row: T) => boolean);
	href?: string | ((row: T) => string);
	selected?: boolean | ((row: T) => boolean);
	onClick?: (row: T) => void;
};

export type TableDropdownAction<T> = {
	type: 'dropdown';
	label?: string;
	icon?: Component;
	showChevron?: boolean;
	side?: 'top' | 'bottom';
	align?: 'start' | 'end';
	triggerClass?: string;
	contentClass?: string;
	matchTriggerWidth?: boolean;
	maxHeight?: string;
	selectedValue?: string | ((row: T) => string);
	disabled?: boolean | ((row: T) => boolean);
	items: (row: T) => TableDropdownItem<T>[] | TableDropdownItem<T>[][];
	ariaLabel?: string;
};

export type TableAction<T> =
	TableButtonAction<T> | TableLabelAction | TableBadgeAction | TableDropdownAction<T>;

export type TableColumnAlign = 'start' | 'center' | 'end';

export type ActionsColumn<T> = ColumnBase<T> & {
	type: 'actions';
	align?: TableColumnAlign;
	leading?: (row: T) => { label: string; title?: string } | null;
	actions: (row: T) => TableAction<T>[];
};

export type InputColumn<T> = ColumnBase<T> & {
	type: 'input';
	align?: TableColumnAlign;
	/** Current cell value (controlled by the consumer). */
	value: (row: T) => string;
	onValueChange?: (row: T, value: string) => void;
	/** Fired on blur — prefer validation / clamps here, not in `onValueChange`. */
	onBlur?: (row: T, value: string) => void;
	/**
	 * When false, no input is rendered for that row.
	 * Use `fallbackValue` for static text in those cells (default empty).
	 */
	visible?: boolean | ((row: T) => boolean);
	disabled?: boolean | ((row: T) => boolean);
	placeholder?: string | ((row: T) => string);
	/** HTML input type. Defaults to `text`. Ignored when `datePicker` is true. */
	inputType?: HTMLInputAttributes['type'];
	/**
	 * When true, render the shared `DateInput` (dd/mm/yyyy + calendar) instead of a plain Input.
	 * `value` / `onValueChange` still use the dd/mm/yyyy string.
	 */
	datePicker?: boolean;
	/** When `datePicker` is true, disable matching days in the calendar popover. */
	isDateDisabled?: (date: Date) => boolean;
	/**
	 * When `datePicker` is true and the cell value is empty, open the calendar on this month
	 * (e.g. plan schedule start) instead of today.
	 */
	calendarMonth?: Date | null;
	size?: InputSize;
	min?: string | number | ((row: T) => string | number | undefined);
	max?: string | number | ((row: T) => string | number | undefined);
	step?: string | number | ((row: T) => string | number | undefined);
	fallbackValue?: (row: T) => string;
	inputClass?: string | ((row: T) => string);
	ariaLabel?: string | ((row: T) => string);
	/**
	 * When true (default), Enter moves focus to the next visible input in this column.
	 * Set false to keep focus / handle navigation yourself via `onEnter`.
	 */
	enterNavigates?: boolean;
	onEnter?: (row: T, event: KeyboardEvent) => void;
};

export type TableColumn<T> =
	| TextColumn<T>
	| SerialColumn<T>
	| BadgeColumn<T>
	| MultiBadgeColumn<T>
	| MetricBarColumn<T>
	| ActionsColumn<T>
	| InputColumn<T>;

export function isSerialColumn<T>(column: TableColumn<T>): column is SerialColumn<T> {
	return column.type === 'serial';
}

export function isInputColumn<T>(column: TableColumn<T>): column is InputColumn<T> {
	return column.type === 'input';
}
