<script lang="ts" generics="T extends Record<string, unknown>">
	import { tick } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Download } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import { DropdownMenu } from '$lib/components/ui/dropdown-menu';
	import { Input } from '$lib/components/ui/input';
	import { cn } from '$lib/utils/cn';
	import Table from './table.svelte';
	import {
		DEFAULT_PAGE_SIZE,
		DEFAULT_PAGE_SIZE_OPTIONS,
		type ColumnFilter,
		type ColumnFiltersState,
		type DataTableColumn,
		type DataTableEmptyStateConfig,
		type DataTableExportConfig,
		type DataTableFilteringConfig,
		type DataTablePaginationConfig,
		type DataTableSearchConfig,
		type DataTableSortingConfig,
		type DataTableToolbarButtonConfig,
		type DataTableToolbarButtonsProp
	} from './data-table.constants';
	import {
		DEFAULT_SKELETON_ROW_COUNT,
		type SortState,
		type TableRowVariant,
		type TableSelectionConfig
	} from './table.constants';
	import {
		dataTableFooterClass,
		dataTablePageInfoClass,
		dataTablePageSizeLabelClass,
		dataTablePageSizeMenuClass,
		dataTablePageSizeTriggerClass,
		dataTableSearchClass,
		dataTableShellClasses,
		dataTableStickyFooterClass,
		dataTableStickyToolbarClass,
		dataTableToolbarActionsClass,
		dataTableToolbarClass
	} from './data-table.styles';
	import {
		applyColumnFilters,
		collectUniqueColumnValues,
		upsertColumnFilter
	} from './data-table-filter.utils';
	import {
		defaultRowFilter,
		exportRowsToCsv,
		paginateRows,
		sortRows,
		toggleSortState
	} from './data-table.utils';

	type Props = {
		columns: DataTableColumn<T>[];
		rows: T[];
		rowKey: (row: T) => string;
		onRowClick?: (row: T) => void;
		emptyState?: DataTableEmptyStateConfig;
		loading?: boolean;
		skeletonRowCount?: number;
		search?: DataTableSearchConfig<T>;
		export?: DataTableExportConfig;
		toolbarButton?: DataTableToolbarButtonsProp;
		pagination?: DataTablePaginationConfig;
		sorting?: DataTableSortingConfig;
		filtering?: DataTableFilteringConfig;
		selection?: TableSelectionConfig;
		selectedRowKeys?: string[];
		class?: string;
		shellClass?: string;
		toolbarClass?: string;
		searchClass?: string;
		exportClass?: string;
		toolbarButtonClass?: string;
		footerClass?: string;
		tableClass?: string;
		theadClass?: string;
		tbodyClass?: string;
		rowClass?: string | ((row: T) => string);
		/**
		 * Alternating row background pattern.
		 * - `'default'` — all rows use `bg-surface` (or the semantic tone colour).
		 * - `'striped'` — odd rows stay `bg-surface`; even rows get `bg-surface-alt`.
		 */
		rowVariant?: TableRowVariant;
		headerCellClass?: string;
		cellClass?: string;
		/** Keep toolbar/search and column headers visible while scrolling rows. */
		stickyHeader?: boolean;
		maxHeight?: string;
		stickySelectionColumn?: boolean;
		/** Pin the first N columns on the left. Default 2. Set `0` to disable. */
		stickyLeadingColumns?: number;
	} & HTMLAttributes<HTMLDivElement>;

	let {
		columns,
		rows,
		rowKey,
		onRowClick,
		emptyState,
		loading = false,
		skeletonRowCount,
		search = {},
		export: exportConfig = {},
		toolbarButton: toolbarButtonConfig,
		pagination = {},
		sorting = {},
		filtering = {},
		selection = { enabled: false },
		selectedRowKeys = $bindable([]),
		class: className = '',
		shellClass = '',
		toolbarClass = '',
		searchClass = '',
		exportClass = '',
		toolbarButtonClass = '',
		footerClass = '',
		tableClass = '',
		theadClass = '',
		tbodyClass = '',
		rowClass = '',
		rowVariant = 'default' as TableRowVariant,
		headerCellClass = '',
		cellClass = '',
		stickyHeader = true,
		maxHeight,
		stickySelectionColumn = true,
		stickyLeadingColumns,
		...rest
	}: Props = $props();

	const searchEnabled = $derived(search.enabled ?? true);
	const searchAutofocus = $derived(search.autofocus ?? true);
	let searchInputEl = $state<HTMLInputElement | null>(null);
	const exportEnabled = $derived(exportConfig.enabled ?? false);
	const toolbarButtons = $derived.by((): DataTableToolbarButtonConfig[] => {
		if (!toolbarButtonConfig) return [];
		const configs = Array.isArray(toolbarButtonConfig)
			? toolbarButtonConfig
			: [toolbarButtonConfig];
		return configs.filter((button) => button.enabled ?? false);
	});
	const toolbarButtonsEnabled = $derived(toolbarButtons.length > 0);
	const toolbarVisible = $derived(searchEnabled || exportEnabled || toolbarButtonsEnabled);
	const paginationEnabled = $derived(pagination.enabled ?? true);
	const sortingEnabled = $derived(sorting.enabled ?? true);
	const filteringEnabled = $derived(
		filtering.enabled ?? columns.some((column) => Boolean(column.filterable))
	);
	const filterConditionsEnabled = $derived(filtering.conditions ?? false);
	const pageSizeOptions = $derived(pagination.pageSizeOptions ?? DEFAULT_PAGE_SIZE_OPTIONS);
	const manualPagination = $derived(pagination.manual ?? false);
	const minPageSizeOption = $derived(Math.min(...pageSizeOptions));

	let searchValue = $state('');
	let pageIndex = $state(0);
	let pageSize = $state(DEFAULT_PAGE_SIZE);
	let internalSort = $state<SortState>(null);
	let internalFilters = $state<ColumnFiltersState>({});
	let initialized = $state(false);

	// Controlled when parent passes state; otherwise local ownership.
	const sortState = $derived(sorting.state !== undefined ? sorting.state : internalSort);
	const filtersState = $derived(filtering.state !== undefined ? filtering.state : internalFilters);

	$effect(() => {
		if (initialized) {
			return;
		}

		searchValue = search.value ?? '';
		pageIndex = pagination.pageIndex ?? 0;
		pageSize = pagination.pageSize ?? DEFAULT_PAGE_SIZE;
		initialized = true;
	});

	$effect(() => {
		if (!searchEnabled || !searchAutofocus || !searchInputEl) return;
		void tick().then(() => searchInputEl?.focus());
	});

	$effect(() => {
		if (!initialized || search.value === undefined) {
			return;
		}

		if (search.value !== searchValue) {
			searchValue = search.value;
		}
	});

	$effect(() => {
		if (
			!initialized ||
			pagination.onPageChange === undefined ||
			pagination.pageIndex === undefined
		) {
			return;
		}

		if (pagination.pageIndex !== pageIndex) {
			pageIndex = pagination.pageIndex;
		}
	});

	$effect(() => {
		if (
			!initialized ||
			pagination.onPageChange === undefined ||
			pagination.pageSize === undefined
		) {
			return;
		}

		if (pagination.pageSize !== pageSize) {
			pageSize = pagination.pageSize;
		}
	});

	const searchedRows = $derived.by(() => {
		if (manualPagination || !searchEnabled) {
			return rows;
		}

		const query = searchValue.trim();
		if (!query) {
			return rows;
		}

		const filter = search.filter ?? ((row, value) => defaultRowFilter(row, value, columns));
		return rows.filter((row) => filter(row, query));
	});

	const filteredRows = $derived.by(() => {
		if (manualPagination || !filteringEnabled) {
			return searchedRows;
		}

		return applyColumnFilters(searchedRows, columns, filtersState);
	});

	const filterValues = $derived.by(() => {
		if (!filteringEnabled) {
			return {} as Record<string, string[]>;
		}

		const values: Record<string, string[]> = {};
		for (const column of columns) {
			if (
				!column.filterable ||
				column.type === 'actions' ||
				column.type === 'multi-badge' ||
				column.type === 'input'
			) {
				continue;
			}

			const otherFilters = { ...filtersState };
			delete otherFilters[column.key];
			const sourceRows = applyColumnFilters(searchedRows, columns, otherFilters);
			values[column.key] = collectUniqueColumnValues(sourceRows, column);
		}

		return values;
	});

	const sortedRows = $derived.by(() => {
		if (manualPagination || !sortingEnabled) {
			return filteredRows;
		}

		return sortRows(filteredRows, columns, sortState, sorting.rowSortPriority);
	});

	const totalRows = $derived(
		manualPagination ? (pagination.totalRows ?? rows.length) : sortedRows.length
	);

	const pageCount = $derived(Math.max(1, Math.ceil(totalRows / Math.max(pageSize, 1))));

	const showPaginationFooter = $derived(paginationEnabled && totalRows > minPageSizeOption);
	const paginateVisibleRows = $derived(paginationEnabled && totalRows > pageSize);

	const visibleRows = $derived.by(() => {
		if (manualPagination) {
			return sortedRows;
		}

		if (!paginateVisibleRows) {
			return sortedRows;
		}

		return paginateRows(sortedRows, pageIndex, pageSize);
	});

	const resolvedSkeletonRowCount = $derived(
		skeletonRowCount ??
			(manualPagination && pagination.totalRows != null
				? Math.min(pageSize, Math.max(1, pagination.totalRows))
				: Math.min(pageSize, DEFAULT_SKELETON_ROW_COUNT))
	);
	const canGoBack = $derived(pageIndex > 0);
	const canGoForward = $derived(pageIndex < pageCount - 1);

	const pageSizeGroups = $derived([
		pageSizeOptions.map((option) => ({
			label: String(option),
			value: String(option),
			onclick: () => updatePagination(0, option)
		}))
	]);

	$effect(() => {
		if (!initialized || manualPagination) {
			return;
		}

		const maxPageIndex = Math.max(pageCount - 1, 0);
		if (pageIndex > maxPageIndex) {
			pageIndex = maxPageIndex;
		}
	});

	function updateSearch(value: string) {
		searchValue = value;
		search.onValueChange?.(value);
		if (!manualPagination) {
			pageIndex = 0;
		}
	}

	function updatePagination(nextPageIndex: number, nextPageSize = pageSize) {
		const clampedIndex = Math.min(Math.max(nextPageIndex, 0), Math.max(pageCount - 1, 0));
		pageIndex = clampedIndex;
		pageSize = nextPageSize;
		pagination.onPageChange?.({ pageIndex: clampedIndex, pageSize: nextPageSize });
	}

	function handleSort(key: string) {
		if (!sortingEnabled) {
			return;
		}

		const nextSort = toggleSortState(sortState, key);
		if (sorting.state === undefined) {
			internalSort = nextSort;
		}
		sorting.onSortChange?.(nextSort);
	}

	function handleFilterChange(columnKey: string, filter: ColumnFilter | null) {
		if (!filteringEnabled) {
			return;
		}

		const next = upsertColumnFilter(filtersState, columnKey, filter);
		if (filtering.state === undefined) {
			internalFilters = next;
		}
		filtering.onFiltersChange?.(next);
		if (!manualPagination) {
			pageIndex = 0;
		}
	}

	function handleExport() {
		if (exportConfig.onClick) {
			exportConfig.onClick();
			return;
		}

		const fileName = exportConfig.fileName ?? 'export';
		exportRowsToCsv(sortedRows, columns, fileName);
	}
</script>

<div
	class={cn(
		dataTableShellClasses(className, stickyHeader),
		stickyHeader && 'min-h-0 flex-1',
		shellClass
	)}
	{...rest}
>
	{#if toolbarVisible}
		<div
			class={cn(dataTableToolbarClass, stickyHeader && dataTableStickyToolbarClass, toolbarClass)}
		>
			{#if searchEnabled}
				<Input
					bind:ref={searchInputEl}
					type="search"
					size="sm"
					placeholder={search.placeholder ?? 'Search...'}
					value={searchValue}
					oninput={(event) => updateSearch(event.currentTarget.value)}
					class={cn(dataTableSearchClass, search.class, searchClass)}
					aria-label="Search table"
					autofocus={searchAutofocus}
				/>
			{/if}

			{#if toolbarButtonsEnabled || exportEnabled}
				<div class={dataTableToolbarActionsClass}>
					{#each toolbarButtons as button, index (button.label + String(index))}
						<Button
							variant={button.variant ?? 'primary'}
							size={button.size ?? 'sm'}
							label={button.label}
							icon={button.icon}
							iconPosition={button.iconPosition ?? 'left'}
							disabled={button.disabled ?? false}
							loading={button.loading ?? loading}
							href={button.href}
							onclick={button.onClick}
							class={cn(button.class, toolbarButtonClass)}
						/>
					{/each}

					{#if exportEnabled}
						<Button
							variant="outline"
							size="sm"
							label={exportConfig.label ?? 'Export'}
							icon={Download}
							disabled={loading || (exportConfig.disabled ?? false)}
							onclick={handleExport}
							class={cn(exportConfig.class, exportClass)}
						/>
					{/if}
				</div>
			{/if}
		</div>
	{/if}

	<Table
		{columns}
		rows={visibleRows}
		{rowKey}
		{onRowClick}
		{emptyState}
		{loading}
		skeletonRowCount={resolvedSkeletonRowCount}
		{selection}
		bind:selectedRowKeys
		layout="content"
		sort={sortState}
		onSort={sortingEnabled ? handleSort : undefined}
		{filteringEnabled}
		{filterConditionsEnabled}
		filters={filtersState}
		{filterValues}
		onFilterChange={filteringEnabled ? handleFilterChange : undefined}
		{tableClass}
		{theadClass}
		{tbodyClass}
		{rowClass}
		{rowVariant}
		{headerCellClass}
		{cellClass}
		{stickyHeader}
		{maxHeight}
		{stickySelectionColumn}
		{stickyLeadingColumns}
	/>

	{#if showPaginationFooter}
		<div
			class={cn(
				dataTableFooterClass,
				stickyHeader && dataTableStickyFooterClass,
				pagination.class,
				footerClass
			)}
		>
			<div class="flex items-center gap-2">
				<span id="data-table-page-size-label" class={dataTablePageSizeLabelClass}
					>Rows per page</span
				>
				<DropdownMenu
					triggerLabel={String(pageSize)}
					showChevron
					side="top"
					align="start"
					groups={pageSizeGroups}
					selectedValue={String(pageSize)}
					maxHeight={pagination.pageSizeMenuMaxHeight}
					triggerClass={dataTablePageSizeTriggerClass}
					contentClass={dataTablePageSizeMenuClass}
					aria-labelledby="data-table-page-size-label"
					disabled={loading}
				/>
			</div>

			<div class={dataTablePageInfoClass}>Page {pageIndex + 1} of {pageCount}</div>

			<div class="flex items-center gap-2">
				<Button
					variant="outline"
					size="icon"
					icon={ChevronsLeft}
					disabled={loading || !canGoBack}
					onclick={() => updatePagination(0)}
					aria-label="Go to first page"
				/>
				<Button
					variant="outline"
					size="icon"
					icon={ChevronLeft}
					disabled={loading || !canGoBack}
					onclick={() => updatePagination(pageIndex - 1)}
					aria-label="Go to previous page"
				/>
				<Button
					variant="outline"
					size="icon"
					icon={ChevronRight}
					disabled={loading || !canGoForward}
					onclick={() => updatePagination(pageIndex + 1)}
					aria-label="Go to next page"
				/>
				<Button
					variant="outline"
					size="icon"
					icon={ChevronsRight}
					disabled={loading || !canGoForward}
					onclick={() => updatePagination(pageCount - 1)}
					aria-label="Go to last page"
				/>
			</div>
		</div>
	{/if}
</div>
