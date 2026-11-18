<script lang="ts" generics="T extends Record<string, unknown>">
	import { tick } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import { ChevronDown, ChevronRight } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { EmptyState } from '$lib/components/ui/empty-state';
	import { Input } from '$lib/components/ui/input';
	import { cn } from '$lib/utils/cn';
	import type {
		DataTableSearchConfig,
		DataTableToolbarButtonConfig,
		DataTableToolbarButtonsProp
	} from '../table/data-table.constants';
	import {
		dataTableSearchClass,
		dataTableStickyToolbarClass,
		dataTableToolbarActionsClass,
		dataTableToolbarClass
	} from '../table/data-table.styles';
	import { bindFillRemainingHeight, bindTheadRowStickyOffsets } from '../table/table-sticky-scroll';
	import {
		bindStickyColumnOffsets,
		DEFAULT_STICKY_LEADING_COLUMNS,
		isColumnSticky,
		resolveStickySide,
		stickyBodyCellClasses,
		stickyColumnInsetStyle,
		stickyHeaderCellClasses,
		stickySelectionSlot,
		tableHasStickyColumns,
		withStickyLeadingColumns,
		type StickyColumnOffsets,
		type StickyColumnProp,
		type StickyColumnSide
	} from '../table/table-sticky-columns';
	import {
		tableSelectionCellClass,
		tableSelectionHeaderCellClass,
		tableStickyHeaderClass,
		tableStickyColumnsTableClass
	} from '../table/table.styles';
	import { DEFAULT_SKELETON_ROW_COUNT } from '../table/table.constants';
	import TableSkeletonCell from '../table/table-skeleton-cell.svelte';
	import type { TableSkeletonCellKind } from '../table/table-skeleton-cell.svelte';
	import type {
		TreeTableButtonAction,
		TreeTableColumn,
		TreeTableColumnDef,
		TreeTableControlColumn,
		TreeTableEmptyStateConfig,
		TreeTableInputColumn,
		TreeTableNode,
		TreeTableSelectionConfig,
		TreeTableSerialColumn,
		TreeTableTextColumn
	} from './tree-table.constants';
	import {
		treeTableActionsInnerClass,
		treeTableBodyClass,
		treeTableCellClass,
		treeTableDetailCellClass,
		treeTableDetailItemClass,
		treeTableDetailListClass,
		treeTableDetailRowClass,
		treeTableElementClass,
		treeTableExpandButtonClass,
		treeTableExpandSpacerClass,
		treeTableFooterCellClass,
		treeTableFooterRowClass,
		treeTableGroupFooterCellClass,
		treeTableGroupFooterRowClass,
		treeTableGroupHeaderCellClass,
		treeTableGroupHeaderRowClass,
		treeTableHeaderCellClass,
		treeTableHeaderGroupCellClass,
		treeTableCompactColumnClass,
		treeTableSerialColumnClass,
		treeTableTreeColumnClass,
		treeTableIndentStyle,
		treeTableInputClass,
		treeTableInputInnerClass,
		treeTableLabelClass,
		treeTableParentLabelClass,
		treeTableTreeLabelRowClass,
		treeTableRowClass,
		treeTableShellClasses,
		treeTableScrollWrapClasses,
		treeTableTheadClass,
		treeTableTreeCellInnerClass
	} from './tree-table.styles';
	import {
		buildColumnHeaderRows,
		buildTreeSkeletonRows,
		collectDefaultExpandedIds,
		collectExpandableIds,
		collectTreeSelectableLeafIds,
		filterTreeNodes,
		flattenLeafColumns,
		flattenVisibleTreeRows,
		getTreeNodeCheckState,
		showsSelectionCheckbox,
		toggleTreeSelection
	} from './tree-table.utils';

	type Props = {
		nodes: TreeTableNode<T>[];
		columns: TreeTableColumnDef<T>[];
		expandedIds?: string[];
		defaultExpandAll?: boolean;
		/** Expand expandable nodes up to this tree depth (0 = root). Ignored when `defaultExpandAll` is true. */
		defaultExpandLevels?: number;
		/** @deprecated Prefer `search.value` / built-in toolbar search. */
		filterQuery?: string;
		filterMatch?: (node: TreeTableNode<T>, normalizedQuery: string) => boolean;
		search?: Omit<DataTableSearchConfig<T>, 'filter'>;
		toolbarButton?: DataTableToolbarButtonsProp;
		emptyState?: TreeTableEmptyStateConfig;
		loading?: boolean;
		skeletonRowCount?: number;
		selection?: TreeTableSelectionConfig;
		selectedIds?: string[];
		/** Grand-total footer label spanning all columns. */
		footer?: string;
		onExpandedChange?: (ids: string[]) => void;
		class?: string;
		shellClass?: string;
		toolbarClass?: string;
		searchClass?: string;
		toolbarButtonClass?: string;
		tableClass?: string;
		theadClass?: string;
		tbodyClass?: string;
		rowClass?: string | ((node: TreeTableNode<T>) => string);
		headerCellClass?: string;
		cellClass?: string;
		groupHeaderClass?: string;
		groupFooterClass?: string;
		detailClass?: string;
		footerClass?: string;
		stickyHeader?: boolean;
		maxHeight?: string;
		stickySelectionColumn?: boolean;
		/** Pin the first N leaf columns on the left. Default 2. Set `0` to disable. */
		stickyLeadingColumns?: number;
	} & HTMLAttributes<HTMLDivElement>;

	let {
		nodes,
		columns,
		expandedIds = $bindable<string[] | undefined>(undefined),
		defaultExpandAll = false,
		defaultExpandLevels,
		filterQuery = '',
		filterMatch,
		search = {},
		toolbarButton: toolbarButtonConfig,
		emptyState,
		loading = false,
		skeletonRowCount = DEFAULT_SKELETON_ROW_COUNT,
		selection = { enabled: false },
		selectedIds = $bindable<string[]>([]),
		footer,
		onExpandedChange,
		class: className = '',
		shellClass = '',
		toolbarClass = '',
		searchClass = '',
		toolbarButtonClass = '',
		tableClass = '',
		theadClass = '',
		tbodyClass = '',
		rowClass = '',
		headerCellClass = '',
		cellClass = '',
		groupHeaderClass = '',
		groupFooterClass = '',
		detailClass = '',
		footerClass = '',
		stickyHeader = true,
		maxHeight,
		stickySelectionColumn = true,
		stickyLeadingColumns = DEFAULT_STICKY_LEADING_COLUMNS,
		...rest
	}: Props = $props();

	const resolvedColumns = $derived(withStickyLeadingColumns(columns, stickyLeadingColumns));

	let tableEl = $state<HTMLTableElement | null>(null);
	let stickyColOffsets = $state<StickyColumnOffsets>({ left: {}, right: {} });
	/** Bumped when an edit is rejected so controlled inputs remount with the last accepted value. */
	let inputRemountKeys = $state<Record<string, number>>({});

	function commitInputValue(
		column: TreeTableInputColumn<T> | TreeTableControlColumn<T>,
		node: TreeTableNode<T>,
		rowKey: string,
		el: HTMLInputElement
	) {
		column.onValueChange?.(node, el.value);
		const accepted =
			typeof column.value === 'function' ? (column.value(node) ?? '') : (column.value ?? '');
		// Number inputs often emit "0" while controlled empty qty is ""; treat as equal.
		const same =
			el.value === accepted ||
			(Number(el.value || 0) === Number(accepted || 0) &&
				Number.isFinite(Number(el.value || 0)) &&
				Number.isFinite(Number(accepted || 0)));
		if (same) return;
		const cellKey = `${column.key}:${rowKey}`;
		inputRemountKeys = {
			...inputRemountKeys,
			[cellKey]: (inputRemountKeys[cellKey] ?? 0) + 1
		};
	}

	const stickyPageMode = $derived(stickyHeader && !maxHeight);
	const scrollWrapClass = $derived(
		treeTableScrollWrapClasses({ stickyHeader, maxHeight: maxHeight || undefined })
	);
	const scrollWrapStyle = $derived(maxHeight ? `max-height: ${maxHeight}` : undefined);

	let scrollWrapEl = $state<HTMLDivElement | null>(null);
	let theadEl = $state<HTMLTableSectionElement | null>(null);
	let headerRowOffsets = $state<number[]>([]);

	$effect(() => {
		if (!stickyPageMode || !scrollWrapEl) return;
		return bindFillRemainingHeight(scrollWrapEl);
	});

	$effect(() => {
		if (!stickyHeader || !theadEl) return;
		return bindTheadRowStickyOffsets(theadEl, (offsets) => {
			headerRowOffsets = offsets;
		});
	});

	function stickyHeaderStyle(rowIndex: number): string | undefined {
		if (!stickyHeader) return undefined;
		const top = headerRowOffsets[rowIndex] ?? 0;
		return `top: ${top}px`;
	}

	let internalExpandedIds = $state<string[]>([]);
	let internalSearch = $state('');
	/** Once the user toggles expand/collapse, keep their set instead of recomputing defaults. */
	let userHasExpanded = $state(false);
	let shellEl = $state<HTMLDivElement | null>(null);

	const searchEnabled = $derived(search.enabled ?? false);
	const searchAutofocus = $derived(search.autofocus ?? true);
	let searchInputEl = $state<HTMLInputElement | null>(null);
	const searchValue = $derived(search.value ?? internalSearch);
	const resolvedFilterQuery = $derived(searchEnabled ? searchValue : filterQuery);

	$effect(() => {
		if (!searchEnabled || !searchAutofocus || !searchInputEl) return;
		void tick().then(() => searchInputEl?.focus());
	});
	const toolbarButtons = $derived.by((): DataTableToolbarButtonConfig[] => {
		if (!toolbarButtonConfig) return [];
		const configs = Array.isArray(toolbarButtonConfig)
			? toolbarButtonConfig
			: [toolbarButtonConfig];
		return configs.filter((button) => button.enabled ?? false);
	});
	const toolbarButtonsEnabled = $derived(toolbarButtons.length > 0);
	const toolbarVisible = $derived(searchEnabled || toolbarButtonsEnabled);
	const selectionEnabled = $derived(selection.enabled);
	const selectionMode = $derived(selection.mode ?? 'multiple');
	const isSingleSelection = $derived(selectionMode === 'single');
	const hideSelectAll = $derived(isSingleSelection || (selection.hideSelectAll ?? false));

	function updateSearch(value: string) {
		if (search.value === undefined) {
			internalSearch = value;
		}
		search.onValueChange?.(value);
	}

	const defaultExpandOptions = $derived(
		defaultExpandAll
			? { expandAll: true }
			: defaultExpandLevels !== undefined
				? { expandLevels: defaultExpandLevels }
				: {}
	);

	const filteredNodes = $derived(filterTreeNodes(nodes, resolvedFilterQuery, filterMatch));

	const resolvedExpandedIds = $derived.by(() => {
		if (expandedIds !== undefined) {
			return expandedIds;
		}
		if (resolvedFilterQuery.trim()) {
			return collectExpandableIds(filteredNodes);
		}
		if (userHasExpanded) {
			return internalExpandedIds;
		}
		return collectDefaultExpandedIds(nodes, defaultExpandOptions);
	});

	const expandedSet = $derived(new Set(resolvedExpandedIds));
	const selectedSet = $derived(new Set(selectedIds));
	const selectableLeafIds = $derived(collectTreeSelectableLeafIds(filteredNodes));
	const selectedLeafCount = $derived(selectableLeafIds.filter((id) => selectedSet.has(id)).length);
	const allLeavesSelected = $derived(
		selectableLeafIds.length > 0 && selectedLeafCount === selectableLeafIds.length
	);
	const someLeavesSelected = $derived(
		selectedLeafCount > 0 && selectedLeafCount < selectableLeafIds.length
	);
	const visibleRows = $derived(flattenVisibleTreeRows(filteredNodes, expandedSet));
	const leafColumns = $derived(flattenLeafColumns(resolvedColumns));
	const hasStickyColumns = $derived(
		tableHasStickyColumns(leafColumns, { selectionEnabled, stickySelectionColumn })
	);

	$effect(() => {
		if (!hasStickyColumns || !tableEl) return;
		return bindStickyColumnOffsets(tableEl, (offsets) => {
			stickyColOffsets = offsets;
		});
	});

	function selectionColumnSticky(): boolean {
		return hasStickyColumns && stickySelectionColumn && selectionEnabled;
	}

	function dataColumnSticky(column: { sticky?: StickyColumnProp }): boolean {
		return hasStickyColumns && isColumnSticky(column.sticky);
	}

	function dataColumnStickySide(column: { sticky?: StickyColumnProp }): StickyColumnSide {
		return resolveStickySide(column.sticky) ?? 'left';
	}

	function combineCellStyle(...parts: Array<string | undefined>): string | undefined {
		const merged = parts.filter(Boolean).join('; ');
		return merged || undefined;
	}

	function stickyHeaderCellStyle(
		rowIndex: number,
		slot: string,
		columnSticky: boolean,
		side: StickyColumnSide = 'left'
	): string | undefined {
		return combineCellStyle(
			stickyHeader ? stickyHeaderStyle(rowIndex) : undefined,
			columnSticky ? stickyColumnInsetStyle(slot, side, stickyColOffsets) : undefined
		);
	}

	const headerRows = $derived(buildColumnHeaderRows(resolvedColumns));
	const columnCount = $derived(leafColumns.length + (selectionEnabled ? 1 : 0));
	const resolvedSkeletonRowCount = $derived(Math.max(1, skeletonRowCount));
	const skeletonRows = $derived(buildTreeSkeletonRows(resolvedSkeletonRowCount));

	function skeletonKindForColumn(column: TreeTableColumn<T>): TableSkeletonCellKind {
		if (isTextColumn(column) && column.tree) return 'tree';
		if (column.type === 'actions') return 'action-button';
		if (isInputColumn(column) || isControlColumn(column)) return 'input';
		if (isSerialColumn(column)) return 'serial';
		return 'text';
	}

	function isTextColumn(column: TreeTableColumn<T>): column is TreeTableTextColumn<T> {
		return column.type === undefined || column.type === 'text';
	}

	function isSerialColumn(column: TreeTableColumn<T>): column is TreeTableSerialColumn<T> {
		return column.type === 'serial';
	}

	function leafColumnLayoutClass(column: TreeTableColumn<T>): string {
		if (isTextColumn(column) && column.tree) return treeTableTreeColumnClass;
		if (isSerialColumn(column)) return treeTableSerialColumnClass;
		return treeTableCompactColumnClass;
	}

	function isInputColumn(column: TreeTableColumn<T>): column is TreeTableInputColumn<T> {
		return column.type === 'input';
	}

	function isControlColumn(column: TreeTableColumn<T>): column is TreeTableControlColumn<T> {
		return column.type === 'control';
	}

	function resolveRowClass(node: TreeTableNode<T>): string {
		return typeof rowClass === 'function' ? rowClass(node) : rowClass;
	}

	function resolveNodeFlag(
		value: boolean | ((node: TreeTableNode<T>) => boolean) | undefined,
		node: TreeTableNode<T>,
		fallback: boolean
	): boolean {
		if (value === undefined) return fallback;
		return typeof value === 'function' ? value(node) : value;
	}

	function resolveColumnClass(column: TreeTableColumn<T>, node?: TreeTableNode<T>): string {
		const value = column.class;
		if (typeof value === 'function') {
			return node ? value(node) : '';
		}
		return value ?? '';
	}

	function resolveValueClass(column: TreeTableTextColumn<T>, node: TreeTableNode<T>): string {
		const value = column.valueClass;
		if (typeof value === 'function') return value(node);
		return value ?? '';
	}

	function resolveTrailingClass(column: TreeTableTextColumn<T>, node: TreeTableNode<T>): string {
		const value = column.trailingClass;
		if (typeof value === 'function') return value(node);
		return value ?? '';
	}

	function resolveInputClass(
		column: TreeTableInputColumn<T> | TreeTableControlColumn<T>,
		node: TreeTableNode<T>
	): string {
		const value = column.inputClass;
		if (typeof value === 'function') return value(node);
		return value ?? '';
	}

	function resolveNodeString(
		value: string | ((node: TreeTableNode<T>) => string) | undefined,
		node: TreeTableNode<T>,
		fallback = ''
	): string {
		if (value === undefined) return fallback;
		return typeof value === 'function' ? value(node) : value;
	}

	function resolveNodeNumberAttr(
		value: string | number | ((node: TreeTableNode<T>) => string | number | undefined) | undefined,
		node: TreeTableNode<T>
	): string | number | undefined {
		if (value === undefined) return undefined;
		return typeof value === 'function' ? value(node) : value;
	}

	const autofocusCellKey = $derived.by(() => {
		for (const column of leafColumns) {
			if (!isInputColumn(column) || !column.autofocusFirst) continue;
			for (const row of visibleRows) {
				if (row.kind !== 'row' || row.hasChildren) continue;
				if (!resolveNodeFlag(column.visible, row.node, true)) continue;
				if (resolveNodeFlag(column.disabled, row.node, false)) continue;
				return `${column.key}:${row.rowKey}`;
			}
		}
		return null;
	});

	function focusNextColumnInput(columnKey: string, current: HTMLInputElement) {
		if (!shellEl) return;
		const inputs = Array.from(
			shellEl.querySelectorAll<HTMLInputElement>(
				`input[data-tree-table-input="${CSS.escape(columnKey)}"]:not([disabled])`
			)
		);
		const index = inputs.indexOf(current);
		if (index < 0) return;
		const next = inputs[index + 1];
		if (!next) return;
		next.focus();
		next.select();
	}

	function setExpandedIds(next: string[]) {
		userHasExpanded = true;
		if (expandedIds !== undefined) {
			expandedIds = next;
		} else {
			internalExpandedIds = next;
		}
		onExpandedChange?.(next);
	}

	function toggleNode(id: string) {
		const next = expandedSet.has(id)
			? resolvedExpandedIds.filter((key) => key !== id)
			: [...resolvedExpandedIds, id];
		setExpandedIds(next);
	}

	function handleRowClick(event: MouseEvent, id: string, hasChildren: boolean) {
		if (!hasChildren) return;
		const target = event.target;
		if (!(target instanceof Element)) return;
		if (target.closest('button, a, input, textarea, select, [role="checkbox"], [role="textbox"]')) {
			return;
		}
		toggleNode(id);
	}

	function handleNodeSelectionToggle(id: string) {
		const next = toggleTreeSelection({
			nodes,
			selectedIds,
			toggledId: id,
			mode: selectionMode
		});
		selectedIds = next;
		selection.onSelectionChange?.(next);
	}

	function handleSelectAllChange(checked: boolean) {
		if (isSingleSelection) return;

		if (checked) {
			const next = [...new Set([...selectedIds, ...selectableLeafIds])];
			selectedIds = next;
			selection.onSelectionChange?.(next);
			return;
		}

		const leafSet = new Set(selectableLeafIds);
		const next = selectedIds.filter((id) => !leafSet.has(id));
		selectedIds = next;
		selection.onSelectionChange?.(next);
	}

	function getTextValue(
		column: TreeTableTextColumn<T> | TreeTableSerialColumn<T>,
		node: TreeTableNode<T>
	): string {
		if (column.value) {
			return column.value(node);
		}
		if ('tree' in column && column.tree) {
			return node.label;
		}
		return '';
	}

	function resolveActionDisabled(
		action: TreeTableButtonAction<T>,
		node: TreeTableNode<T>
	): boolean {
		return typeof action.disabled === 'function' ? action.disabled(node) : Boolean(action.disabled);
	}

	function resolveActionHref(
		action: TreeTableButtonAction<T>,
		node: TreeTableNode<T>
	): string | undefined {
		if (action.href === undefined) return undefined;
		return typeof action.href === 'function' ? action.href(node) : action.href;
	}

	function handleInputKeydown(
		event: KeyboardEvent,
		column: TreeTableInputColumn<T> | TreeTableControlColumn<T>,
		node: TreeTableNode<T>
	) {
		if (event.key !== 'Enter') return;
		event.preventDefault();
		column.onEnter?.(node, event);
		if (column.enterNavigates === false) return;
		const current = event.currentTarget;
		if (!(current instanceof HTMLInputElement)) return;
		focusNextColumnInput(column.key, current);
	}
</script>

<div
	bind:this={shellEl}
	class={cn(
		treeTableShellClasses(className, stickyHeader),
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

			{#if toolbarButtonsEnabled}
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
				</div>
			{/if}
		</div>
	{/if}

	<div bind:this={scrollWrapEl} class={scrollWrapClass} style={scrollWrapStyle}>
		<table
			bind:this={tableEl}
			class={cn(
				treeTableElementClass,
				hasStickyColumns && tableStickyColumnsTableClass,
				tableClass
			)}
			aria-busy={loading}
		>
			<thead bind:this={theadEl} class={cn(treeTableTheadClass, theadClass)}>
				{#each headerRows as headerRow, headerRowIndex (headerRowIndex)}
					<tr>
						{#if selectionEnabled && headerRowIndex === 0}
							{@const selectionSticky = selectionColumnSticky()}
							<th
								scope="col"
								rowspan={headerRows.length > 1 ? headerRows.length : undefined}
								class={cn(
									tableSelectionHeaderCellClass,
									headerCellClass,
									stickyHeaderCellClasses(stickyHeader, selectionSticky, '', 'left'),
									stickyHeader && !selectionSticky && tableStickyHeaderClass
								)}
								style={stickyHeaderCellStyle(
									headerRowIndex,
									stickySelectionSlot(),
									selectionSticky,
									'left'
								)}
								data-sticky-col={selectionSticky ? stickySelectionSlot() : undefined}
								data-sticky-side={selectionSticky ? 'left' : undefined}
							>
								{#if !hideSelectAll && !loading}
									<Checkbox
										checked={allLeavesSelected}
										indeterminate={someLeavesSelected}
										onCheckedChange={handleSelectAllChange}
										aria-label="Select all rows"
									/>
								{/if}
							</th>
						{/if}
						{#each headerRow as cell (cell.key)}
							{@const columnSticky = isColumnSticky(cell.sticky)}
							{@const stickySide = resolveStickySide(cell.sticky) ?? 'left'}
							{@const slot = cell.columnKey ?? cell.key}
							<th
								scope={cell.isGroup ? 'colgroup' : 'col'}
								colspan={cell.colSpan > 1 ? cell.colSpan : undefined}
								rowspan={cell.rowSpan > 1 ? cell.rowSpan : undefined}
								class={cn(
									cell.isGroup ? treeTableHeaderGroupCellClass : treeTableHeaderCellClass,
									cell.rowSpan > 1 && 'align-bottom',
									!cell.isGroup &&
										(cell.isTree
											? treeTableTreeColumnClass
											: cell.isSerial
												? treeTableSerialColumnClass
												: treeTableCompactColumnClass),
									cell.headerClass,
									cell.columnClass,
									headerCellClass,
									stickyHeaderCellClasses(stickyHeader, columnSticky, '', stickySide),
									stickyHeader && !columnSticky && tableStickyHeaderClass
								)}
								style={stickyHeaderCellStyle(headerRowIndex, slot, columnSticky, stickySide)}
								data-sticky-col={columnSticky ? slot : undefined}
								data-sticky-side={columnSticky ? stickySide : undefined}
							>
								{cell.header}
							</th>
						{/each}
					</tr>
				{/each}
			</thead>
			<tbody class={cn(treeTableBodyClass, tbodyClass)}>
				{#if loading}
					{#each skeletonRows as row, rowIndex (`skeleton-${rowIndex}-${row.depth}`)}
						<tr class={treeTableRowClass} aria-hidden="true">
							{#if selectionEnabled}
								<td
									{...{
										class: stickyBodyCellClasses(
											selectionColumnSticky(),
											tableSelectionCellClass,
											'left'
										),
										style: selectionColumnSticky()
											? stickyColumnInsetStyle(stickySelectionSlot(), 'left', stickyColOffsets)
											: undefined,
										'data-sticky-col': selectionColumnSticky() ? stickySelectionSlot() : undefined,
										'data-sticky-side': selectionColumnSticky() ? 'left' : undefined
									}}
								>
									<TableSkeletonCell kind="selection" />
								</td>
							{/if}
							{#each leafColumns as column, columnIndex (column.key)}
								<td
									{...{
										class: stickyBodyCellClasses(
											dataColumnSticky(column),
											cn(
												treeTableCellClass,
												leafColumnLayoutClass(column),
												resolveColumnClass(column),
												cellClass
											),
											dataColumnStickySide(column)
										),
										style: dataColumnSticky(column)
											? stickyColumnInsetStyle(
													column.key,
													dataColumnStickySide(column),
													stickyColOffsets
												)
											: undefined,
										'data-sticky-col': dataColumnSticky(column) ? column.key : undefined,
										'data-sticky-side': dataColumnSticky(column)
											? dataColumnStickySide(column)
											: undefined
									}}
								>
									<TableSkeletonCell
										kind={skeletonKindForColumn(column)}
										{rowIndex}
										{columnIndex}
										depth={row.depth}
										hasChildren={row.hasChildren}
										showValue={!row.hasChildren}
										align={column.type === 'actions' ? (column.align ?? 'end') : undefined}
									/>
								</td>
							{/each}
						</tr>
					{/each}
				{:else if visibleRows.length === 0 && emptyState}
					<tr>
						<td colspan={columnCount} class="p-0">
							<EmptyState
								title={emptyState.title}
								description={emptyState.description}
								icon={emptyState.icon}
								iconClass={emptyState.iconClass}
								actionLabel={emptyState.actionLabel}
								actionIcon={emptyState.actionIcon}
								actionIconClass={emptyState.actionIconClass}
								onAction={emptyState.onAction}
								inCard={false}
								class={cn('py-12', emptyState.class)}
							/>
						</td>
					</tr>
				{:else}
					{#each visibleRows as row (row.rowKey)}
						{#if row.kind === 'group'}
							<tr class={cn(treeTableGroupHeaderRowClass, groupHeaderClass)}>
								<td colspan={columnCount} class={treeTableGroupHeaderCellClass}>
									{row.node.label}
								</td>
							</tr>
						{:else if row.kind === 'group-footer'}
							<tr class={cn(treeTableGroupFooterRowClass, groupFooterClass)}>
								<td colspan={columnCount} class={treeTableGroupFooterCellClass}>
									{row.node.label}
								</td>
							</tr>
						{:else if row.kind === 'detail'}
							<tr class={cn(treeTableDetailRowClass, detailClass)}>
								<td colspan={columnCount} class={treeTableDetailCellClass}>
									<ul class={treeTableDetailListClass}>
										{#each row.node.details ?? [] as detail, detailIndex (`${row.rowKey}-line-${detailIndex}`)}
											<li class={treeTableDetailItemClass}>{detail}</li>
										{/each}
									</ul>
								</td>
							</tr>
						{:else}
							<tr
								class={cn(
									treeTableRowClass,
									row.hasChildren && 'cursor-pointer',
									resolveRowClass(row.node)
								)}
								onclick={(event) => handleRowClick(event, row.node.id, row.hasChildren)}
							>
								{#if selectionEnabled}
									{@const checkState = getTreeNodeCheckState(row.node, selectedSet)}
									<td
										{...{
											class: stickyBodyCellClasses(
												selectionColumnSticky(),
												tableSelectionCellClass,
												'left'
											),
											style: selectionColumnSticky()
												? stickyColumnInsetStyle(stickySelectionSlot(), 'left', stickyColOffsets)
												: undefined,
											'data-sticky-col': selectionColumnSticky()
												? stickySelectionSlot()
												: undefined,
											'data-sticky-side': selectionColumnSticky() ? 'left' : undefined
										}}
									>
										{#if showsSelectionCheckbox(row.node)}
											<Checkbox
												checked={checkState === 'checked'}
												indeterminate={checkState === 'indeterminate'}
												onCheckedChange={() => handleNodeSelectionToggle(row.node.id)}
												aria-label={`Select ${row.node.label}`}
											/>
										{/if}
									</td>
								{/if}
								{#each leafColumns as column (column.key)}
									<td
										{...{
											class: stickyBodyCellClasses(
												dataColumnSticky(column),
												cn(
													treeTableCellClass,
													leafColumnLayoutClass(column),
													isTextColumn(column) && column.tree && 'overflow-hidden',
													resolveColumnClass(column, row.node),
													cellClass
												),
												dataColumnStickySide(column)
											),
											style: dataColumnSticky(column)
												? stickyColumnInsetStyle(
														column.key,
														dataColumnStickySide(column),
														stickyColOffsets
													)
												: undefined,
											'data-sticky-col': dataColumnSticky(column) ? column.key : undefined,
											'data-sticky-side': dataColumnSticky(column)
												? dataColumnStickySide(column)
												: undefined
										}}
									>
										{#if isTextColumn(column) && column.tree}
											{@const labelText = getTextValue(column, row.node)}
											{@const trailing = column.trailing?.(row.node)?.trim() ?? ''}
											{@const cellTitle = trailing ? `${labelText} ${trailing}` : labelText}
											<div
												class={cn(treeTableTreeCellInnerClass, 'max-w-full overflow-hidden')}
												style={treeTableIndentStyle(row.depth)}
												title={cellTitle}
											>
												<div class={treeTableTreeLabelRowClass}>
													{#if row.hasChildren}
														<button
															type="button"
															class={treeTableExpandButtonClass}
															aria-expanded={expandedSet.has(row.node.id)}
															aria-label={expandedSet.has(row.node.id)
																? `Collapse ${row.node.label}`
																: `Expand ${row.node.label}`}
															onclick={() => toggleNode(row.node.id)}
														>
															{#if expandedSet.has(row.node.id)}
																<ChevronDown class="size-4" aria-hidden="true" />
															{:else}
																<ChevronRight class="size-4" aria-hidden="true" />
															{/if}
														</button>
													{:else}
														<span class={treeTableExpandSpacerClass} aria-hidden="true"></span>
													{/if}
													<span
														class={row.hasChildren
															? treeTableParentLabelClass
															: treeTableLabelClass}
													>
														{labelText}
													</span>
												</div>
												{#if trailing}
													<span class={cn('shrink-0', resolveTrailingClass(column, row.node))}>
														{trailing}
													</span>
												{/if}
											</div>
										{:else if isInputColumn(column)}
											{#if resolveNodeFlag(column.visible, row.node, true)}
												{@const inputCellKey = `${column.key}:${row.rowKey}`}
												<div class={treeTableInputInnerClass(column.align)}>
													{#key inputRemountKeys[inputCellKey] ?? 0}
														<Input
															type={column.inputType ?? 'text'}
															size={column.size ?? 'sm'}
															value={column.value(row.node)}
															placeholder={resolveNodeString(column.placeholder, row.node)}
															disabled={resolveNodeFlag(column.disabled, row.node, false)}
															min={resolveNodeNumberAttr(column.min, row.node)}
															max={resolveNodeNumberAttr(column.max, row.node)}
															step={resolveNodeNumberAttr(column.step, row.node)}
															autofocus={autofocusCellKey === inputCellKey}
															aria-label={resolveNodeString(
																column.ariaLabel,
																row.node,
																`${column.header} for ${row.node.label}`
															)}
															data-tree-table-input={column.key}
															class={cn(treeTableInputClass, resolveInputClass(column, row.node))}
															oninput={(event) =>
																commitInputValue(column, row.node, row.rowKey, event.currentTarget)}
															onkeydown={(event) => handleInputKeydown(event, column, row.node)}
														/>
													{/key}
												</div>
											{:else}
												<div
													class={cn(
														treeTableInputInnerClass(column.align ?? 'center'),
														'tabular-nums'
													)}
												>
													{column.fallbackValue?.(row.node) ?? ''}
												</div>
											{/if}
										{:else if isControlColumn(column)}
											{@const controlMode = column.mode(row.node)}
											{#if controlMode === 'checkbox'}
												<div class={treeTableInputInnerClass(column.align ?? 'center')}>
													<Checkbox
														checked={column.checked?.(row.node) ?? false}
														indeterminate={column.indeterminate?.(row.node) ?? false}
														disabled={resolveNodeFlag(column.disabled, row.node, false)}
														aria-label={resolveNodeString(
															column.ariaLabel,
															row.node,
															`${column.header} for ${row.node.label}`
														)}
														onCheckedChange={(next) => column.onCheckedChange?.(row.node, next)}
													/>
												</div>
											{:else if controlMode === 'input'}
												{@const inputCellKey = `${column.key}:${row.rowKey}`}
												<div class={treeTableInputInnerClass(column.align)}>
													{#key inputRemountKeys[inputCellKey] ?? 0}
														<Input
															type={column.inputType ?? 'text'}
															size={column.size ?? 'sm'}
															value={column.value?.(row.node) ?? ''}
															placeholder={resolveNodeString(column.placeholder, row.node)}
															disabled={resolveNodeFlag(column.disabled, row.node, false)}
															min={resolveNodeNumberAttr(column.min, row.node)}
															max={resolveNodeNumberAttr(column.max, row.node)}
															step={resolveNodeNumberAttr(column.step, row.node)}
															aria-label={resolveNodeString(
																column.ariaLabel,
																row.node,
																`${column.header} for ${row.node.label}`
															)}
															data-tree-table-input={column.key}
															class={cn(treeTableInputClass, resolveInputClass(column, row.node))}
															oninput={(event) =>
																commitInputValue(column, row.node, row.rowKey, event.currentTarget)}
															onkeydown={(event) => handleInputKeydown(event, column, row.node)}
														/>
													{/key}
												</div>
											{/if}
										{:else if column.type === 'actions'}
											<div class={treeTableActionsInnerClass(column.align)}>
												{#each column.actions(row.node) as action, actionIndex (`${column.key}-${actionIndex}`)}
													<Button
														variant={action.variant ?? 'primary'}
														size={action.size ?? 'sm'}
														label={action.label}
														icon={action.icon}
														iconPosition={action.iconPosition}
														href={resolveActionHref(action, row.node)}
														disabled={resolveActionDisabled(action, row.node)}
														loading={action.loading ?? false}
														class={cn('rounded-none', action.class)}
														aria-label={action.ariaLabel ?? action.label}
														onclick={(event) => {
															event.stopPropagation();
															action.onClick?.(row.node, event);
														}}
													/>
												{/each}
											</div>
										{:else if isSerialColumn(column) || isTextColumn(column)}
											{#if isTextColumn(column) && column.valueClass}
												<span class={resolveValueClass(column, row.node)}
													>{getTextValue(column, row.node)}</span
												>
											{:else}
												{getTextValue(column, row.node)}
											{/if}
										{/if}
									</td>
								{/each}
							</tr>
						{/if}
					{/each}
				{/if}
			</tbody>
			{#if footer && !loading}
				<tfoot>
					<tr class={cn(treeTableFooterRowClass, footerClass)}>
						<td colspan={columnCount} class={treeTableFooterCellClass}>{footer}</td>
					</tr>
				</tfoot>
			{/if}
		</table>
	</div>
</div>
