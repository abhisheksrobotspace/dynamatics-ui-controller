import type { Component } from 'svelte';
import type { SortState, TableColumn } from './table.constants';

export type DataTableColumnDataType = 'string' | 'number' | 'date';

export type DataTableColumn<T> = TableColumn<T> & {
	dataType?: DataTableColumnDataType;
	exportable?: boolean;
};

export type DataTableEmptyStateConfig = {
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

export type DataTablePaginationState = {
	pageIndex: number;
	pageSize: number;
};

export type DataTableSearchConfig<T> = {
	enabled?: boolean;
	placeholder?: string;
	value?: string;
	onValueChange?: (value: string) => void;
	filter?: (row: T, query: string) => boolean;
	class?: string;
	/** Focus the search field when the table mounts. Default: true. */
	autofocus?: boolean;
};

export type DataTableExportConfig = {
	enabled?: boolean;
	disabled?: boolean;
	label?: string;
	fileName?: string;
	onClick?: () => void;
	class?: string;
};

export type DataTableToolbarButtonConfig = {
	enabled?: boolean;
	disabled?: boolean;
	loading?: boolean;
	label: string;
	icon?: Component;
	iconPosition?: 'left' | 'right';
	variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
	size?: 'sm' | 'md' | 'lg' | 'icon';
	href?: string;
	onClick?: () => void;
	class?: string;
};

/** One button, or several rendered left-to-right before Export. */
export type DataTableToolbarButtonsProp =
	DataTableToolbarButtonConfig | DataTableToolbarButtonConfig[];

export type DataTablePaginationConfig = {
	enabled?: boolean;
	pageSize?: number;
	pageSizeOptions?: number[];
	pageSizeMenuMaxHeight?: string;
	pageIndex?: number;
	onPageChange?: (state: DataTablePaginationState) => void;
	manual?: boolean;
	totalRows?: number;
	class?: string;
};

export type DataTableSortingConfig<T = Record<string, unknown>> = {
	enabled?: boolean;
	state?: SortState;
	onSortChange?: (state: SortState) => void;
	/** Lower values sort first; applied before the active column sort. */
	rowSortPriority?: (row: T) => number;
};

export type ColumnFilterConditionOperator =
	| 'contains'
	| 'not_contains'
	| 'equals'
	| 'not_equals'
	| 'starts_with'
	| 'ends_with'
	| 'is_empty'
	| 'is_not_empty'
	| 'greater_than'
	| 'greater_than_or_equal'
	| 'less_than'
	| 'less_than_or_equal';

export type ColumnFilterCondition = {
	operator: ColumnFilterConditionOperator;
	value: string;
};

export type ColumnFilter = {
	/** When set, only rows whose display value is in this list are kept. */
	selectedValues?: string[];
	condition?: ColumnFilterCondition;
};

export type ColumnFiltersState = Record<string, ColumnFilter>;

export type DataTableFilteringConfig = {
	enabled?: boolean;
	/** When true, shows "Filter by condition" in the column filter menu. Default: false. */
	conditions?: boolean;
	state?: ColumnFiltersState;
	onFiltersChange?: (state: ColumnFiltersState) => void;
};

export const COLUMN_FILTER_BLANK_VALUE = '';
export const COLUMN_FILTER_BLANK_LABEL = '(Blanks)';

export const DEFAULT_PAGE_SIZE = 50;
export const DEFAULT_PAGE_SIZE_OPTIONS = [5, 10, 20, 50];
