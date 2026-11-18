<script lang="ts" generics="T extends Record<string, unknown>">
	import { ArrowDown, ArrowUp, ArrowUpDown } from '@lucide/svelte';
	import ColumnFilterMenu from './column-filter-menu.svelte';
	import { columnFilterHeaderCellClass } from './column-filter-menu.styles';
	import type {
		ColumnFilter,
		ColumnFiltersState,
		DataTableColumnDataType
	} from './data-table.constants';
	import type { SortState, TableColumn } from './table.constants';
	import { tableSortButtonClass } from './table.styles';

	type Props = {
		column: TableColumn<T>;
		sort?: SortState;
		onSort?: (key: string) => void;
		filteringEnabled?: boolean;
		filterConditionsEnabled?: boolean;
		filters?: ColumnFiltersState;
		filterValues?: Record<string, string[]>;
		onFilterChange?: (columnKey: string, filter: ColumnFilter | null) => void;
	};

	let {
		column,
		sort = null,
		onSort,
		filteringEnabled = false,
		filterConditionsEnabled = false,
		filters = {},
		filterValues = {},
		onFilterChange
	}: Props = $props();

	const showFilter = $derived(
		filteringEnabled &&
			Boolean(column.filterable) &&
			column.type !== 'actions' &&
			column.type !== 'multi-badge' &&
			column.type !== 'input' &&
			onFilterChange
	);

	const dataType = $derived(
		('dataType' in column ? (column.dataType as DataTableColumnDataType | undefined) : undefined) ??
			'string'
	);

	function columnHeaderLabel(entry: TableColumn<T>): string {
		if (!entry.headerHighlight) {
			return entry.header;
		}

		return `${entry.header} (${entry.headerHighlight.text})`;
	}
</script>

<div class={columnFilterHeaderCellClass}>
	{#if column.sortable && onSort}
		<button
			type="button"
			class={tableSortButtonClass}
			onclick={() => onSort(column.key)}
			aria-label="Sort by {columnHeaderLabel(column)}"
		>
			{column.header}{#if column.headerHighlight}
				(<span class={column.headerHighlight.class}>{column.headerHighlight.text}</span>)
			{/if}
			{#if sort?.key === column.key}
				{#if sort.direction === 'asc'}
					<ArrowUp class="size-4" aria-hidden="true" />
				{:else}
					<ArrowDown class="size-4" aria-hidden="true" />
				{/if}
			{:else}
				<ArrowUpDown class="size-4 text-muted-foreground" aria-hidden="true" />
			{/if}
		</button>
	{:else}
		<span>
			{column.header}{#if column.headerHighlight}
				(<span class={column.headerHighlight.class}>{column.headerHighlight.text}</span>)
			{/if}
		</span>
	{/if}

	{#if showFilter}
		<ColumnFilterMenu
			columnKey={column.key}
			columnLabel={columnHeaderLabel(column)}
			{dataType}
			uniqueValues={filterValues[column.key] ?? []}
			filter={filters[column.key]}
			conditionsEnabled={filterConditionsEnabled}
			onApply={(next) => onFilterChange?.(column.key, next)}
		/>
	{/if}
</div>
