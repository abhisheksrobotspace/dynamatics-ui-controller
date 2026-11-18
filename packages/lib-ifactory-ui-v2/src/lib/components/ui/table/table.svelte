<script lang="ts" generics="T extends Record<string, unknown>">
	import { tick } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { DropdownMenu } from '$lib/components/ui/dropdown-menu';
	import type { DropdownMenuItem } from '$lib/components/ui/dropdown-menu';
	import { DateInput, Input } from '$lib/components/ui/input';
	import { StatusBar } from '$lib/components/ui/status-bar';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { checkboxInputClass } from '$lib/components/ui/checkbox/checkbox.styles';
	import { EmptyState } from '$lib/components/ui/empty-state';
	import { cn } from '$lib/utils/cn';
	import type { ColumnFilter, ColumnFiltersState } from './data-table.constants';
	import TableColumnHeader from './table-column-header.svelte';
	import type {
		InputColumn,
		RowTone,
		SortState,
		TableAction,
		TableBadgeAction,
		TableButtonAction,
		TableColumn,
		TableDropdownAction,
		TableDropdownItem,
		TableLabelAction,
		TableLayout,
		TablePrimaryAction,
		TableRowVariant,
		TableShellVariant,
		TableTheadVariant,
		TableEmptyStateConfig,
		TableSelectionConfig
	} from './table.constants';
	import { DEFAULT_SKELETON_ROW_COUNT, isInputColumn, isSerialColumn } from './table.constants';
	import TableSkeletonCell from './table-skeleton-cell.svelte';
	import type { TableSkeletonCellKind } from './table-skeleton-cell.svelte';
	import { actionsSkeletonLayout } from './table-skeleton.utils';
	import { bindFillRemainingHeight } from './table-sticky-scroll';
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
	} from './table-sticky-columns';
	import {
		rowBgClasses,
		rowToneClasses,
		tableBodyClass,
		tableCellCardClass,
		tableCellClass,
		tableDescriptionClass,
		tableElementClass,
		tableHeaderBlockClass,
		tableHeaderCellCardClass,
		tableHeaderCellClass,
		tableMetricBarCellInnerClass,
		tableActionsCellInnerClass,
		tableInputClass,
		tableInputInnerClass,
		tableSelectionCellClass,
		tableSelectionHeaderCellClass,
		tableRowRadioClass,
		tableSerialColumnClass,
		tableRowClass,
		tableClickableRowClass,
		tableShellClasses,
		tableStickyHeaderClass,
		tableStickyHeaderTopClass,
		tableStickyColumnsTableClass,
		tableScrollWrapClasses,
		tableTheadClasses,
		tableTitleClass,
		tableToolbarClass
	} from './table.styles';

	type Props = {
		columns: TableColumn<T>[];
		rows: T[];
		rowKey: (row: T) => string;
		variant?: TableShellVariant;
		layout?: TableLayout;
		theadVariant?: TableTheadVariant;
		getRowTone?: (row: T) => RowTone | undefined;
		onRowClick?: (row: T) => void;
		sort?: SortState;
		onSort?: (key: string) => void;
		filteringEnabled?: boolean;
		filterConditionsEnabled?: boolean;
		filters?: ColumnFiltersState;
		filterValues?: Record<string, string[]>;
		onFilterChange?: (columnKey: string, filter: ColumnFilter | null) => void;
		emptyState?: TableEmptyStateConfig;
		/** When true, keep headers and render placeholder rows that match column shape. */
		loading?: boolean;
		skeletonRowCount?: number;
		selection?: TableSelectionConfig;
		selectedRowKeys?: string[];
		title?: string;
		description?: string;
		primaryAction?: TablePrimaryAction;
		class?: string;
		shellClass?: string;
		headerClass?: string;
		titleClass?: string;
		descriptionClass?: string;
		toolbarClass?: string;
		tableClass?: string;
		theadClass?: string;
		tbodyClass?: string;
		rowClass?: string | ((row: T) => string);
		/**
		 * Alternating row background pattern.
		 * - `'default'` — all rows use `bg-surface` (or the semantic tone colour).
		 * - `'striped'` — odd rows stay `bg-surface`; even rows get `bg-surface-alt`.
		 *   Semantic `getRowTone` still overrides per row when set.
		 */
		rowVariant?: TableRowVariant;
		headerCellClass?: string;
		cellClass?: string;
		/** Keep column headers visible while scrolling the table body. */
		stickyHeader?: boolean;
		/** Explicit max height for the scrollport (e.g. `16rem`). Omit to fill remaining viewport. */
		maxHeight?: string;
		/** Pin the selection column when any column uses `sticky`. Default true. */
		stickySelectionColumn?: boolean;
		/**
		 * Pin the first N columns on the left when they omit `sticky`.
		 * Default 2. Set `0` to disable. Explicit column `sticky` wins.
		 */
		stickyLeadingColumns?: number;
	} & HTMLAttributes<HTMLDivElement>;

	let {
		columns,
		rows,
		rowKey,
		variant = 'structured',
		layout = 'shell',
		theadVariant = 'structured',
		getRowTone,
		onRowClick,
		sort = null,
		onSort,
		filteringEnabled = false,
		filterConditionsEnabled = false,
		filters = {},
		filterValues = {},
		onFilterChange,
		emptyState,
		loading = false,
		skeletonRowCount = DEFAULT_SKELETON_ROW_COUNT,
		selection = { enabled: false },
		selectedRowKeys = $bindable([]),
		title,
		description,
		primaryAction,
		class: className = '',
		shellClass = '',
		headerClass = '',
		titleClass = '',
		descriptionClass = '',
		toolbarClass = '',
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
		stickyLeadingColumns = DEFAULT_STICKY_LEADING_COLUMNS,
		...rest
	}: Props = $props();

	const resolvedColumns = $derived(withStickyLeadingColumns(columns, stickyLeadingColumns));

	let tableEl = $state<HTMLTableElement | null>(null);
	let stickyColOffsets = $state<StickyColumnOffsets>({ left: {}, right: {} });
	let shellEl = $state<HTMLDivElement | null>(null);
	/** Bumped when an edit is rejected so controlled inputs remount with the last accepted value. */
	let inputRemountKeys = $state<Record<string, number>>({});

	function commitInputValue(column: InputColumn<T>, row: T, key: string, el: HTMLInputElement) {
		column.onValueChange?.(row, el.value);
	}

	function blurInputValue(column: InputColumn<T>, row: T, key: string, el: HTMLInputElement) {
		column.onBlur?.(row, el.value);
		const accepted = column.value(row);
		const same =
			el.value === accepted ||
			(Number(el.value || 0) === Number(accepted || 0) &&
				Number.isFinite(Number(el.value || 0)) &&
				Number.isFinite(Number(accepted || 0)));
		if (same) return;
		const cellKey = `${column.key}:${key}`;
		inputRemountKeys = {
			...inputRemountKeys,
			[cellKey]: (inputRemountKeys[cellKey] ?? 0) + 1
		};
	}

	function resolveRowFlag(
		value: boolean | ((row: T) => boolean) | undefined,
		row: T,
		fallback: boolean
	): boolean {
		if (value === undefined) return fallback;
		return typeof value === 'function' ? value(row) : value;
	}

	function resolveRowString(
		value: string | ((row: T) => string) | undefined,
		row: T,
		fallback = ''
	): string {
		if (value === undefined) return fallback;
		return typeof value === 'function' ? value(row) : value;
	}

	function resolveRowNumberAttr(
		value: string | number | ((row: T) => string | number | undefined) | undefined,
		row: T
	): string | number | undefined {
		if (value === undefined) return undefined;
		return typeof value === 'function' ? value(row) : value;
	}

	function resolveInputClass(column: InputColumn<T>, row: T): string {
		const value = column.inputClass;
		if (value === undefined) return '';
		return typeof value === 'function' ? value(row) : value;
	}

	function focusNextColumnInput(columnKey: string, current: HTMLInputElement) {
		const root = shellEl ?? scrollWrapEl;
		if (!root) return;
		const inputs = Array.from(
			root.querySelectorAll<HTMLInputElement>(
				`input[data-table-input="${CSS.escape(columnKey)}"]:not([disabled])`
			)
		);
		const index = inputs.indexOf(current);
		if (index < 0) return;
		const next = inputs[index + 1];
		if (!next) return;
		next.focus();
		next.select();
	}

	function handleInputKeydown(event: KeyboardEvent, column: InputColumn<T>, row: T) {
		if (event.key !== 'Enter') return;
		column.onEnter?.(row, event);
		if (column.enterNavigates === false) return;
		event.preventDefault();
		const current = event.currentTarget;
		if (!(current instanceof HTMLInputElement)) return;
		focusNextColumnInput(column.key, current);
	}

	const stickyPageMode = $derived(stickyHeader && !maxHeight);
	const scrollWrapClass = $derived(
		tableScrollWrapClasses({ stickyHeader, maxHeight: maxHeight || undefined })
	);
	const scrollWrapStyle = $derived(maxHeight ? `max-height: ${maxHeight}` : undefined);
	const stickyThClass = $derived(
		stickyHeader ? cn(tableStickyHeaderClass, tableStickyHeaderTopClass) : ''
	);
	const shellOverflow = $derived(stickyPageMode ? ('sticky-page' as const) : ('hidden' as const));

	let scrollWrapEl = $state<HTMLDivElement | null>(null);
	/** Captured on pointerdown before checkbox focus scrollIntoView runs. */
	let pointerScrollLock: { top: number; left: number } | null = null;

	function captureScrollPort() {
		if (!scrollWrapEl) return;
		pointerScrollLock = {
			top: scrollWrapEl.scrollTop,
			left: scrollWrapEl.scrollLeft
		};
	}

	/** Checkbox focus / disabled-input toggles scroll the port — pin it across the update. */
	function withPreservedScroll(run: () => void) {
		const el = scrollWrapEl;
		const top = pointerScrollLock?.top ?? el?.scrollTop ?? 0;
		const left = pointerScrollLock?.left ?? el?.scrollLeft ?? 0;
		pointerScrollLock = null;
		run();
		const restore = () => {
			if (!el) return;
			el.scrollTop = top;
			el.scrollLeft = left;
		};
		restore();
		requestAnimationFrame(() => {
			restore();
			requestAnimationFrame(restore);
		});
		void tick().then(restore);
	}

	$effect(() => {
		if (!stickyPageMode || !scrollWrapEl) return;
		return bindFillRemainingHeight(scrollWrapEl);
	});

	const hasHeader = $derived(Boolean(title || description || primaryAction));
	const isCardDensity = $derived(theadVariant === 'card');
	const headerCellBaseClass = $derived(
		isCardDensity ? tableHeaderCellCardClass : tableHeaderCellClass
	);
	const cellBaseClass = $derived(isCardDensity ? tableCellCardClass : tableCellClass);
	const selectionEnabled = $derived(selection.enabled);
	const hasStickyColumns = $derived(
		tableHasStickyColumns(resolvedColumns, { selectionEnabled, stickySelectionColumn })
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

	function stickyThPresentation(
		slot: string,
		columnSticky: boolean,
		baseClass: string,
		side: StickyColumnSide = 'left'
	) {
		const vertical = stickyHeader;
		return {
			class: cn(
				baseClass,
				vertical && !columnSticky && stickyThClass,
				stickyHeaderCellClasses(vertical, columnSticky, '', side)
			),
			style: columnSticky
				? stickyColumnInsetStyle(slot, side, stickyColOffsets, vertical ? 0 : undefined)
				: undefined,
			'data-sticky-col': columnSticky ? slot : undefined,
			'data-sticky-side': columnSticky ? side : undefined
		};
	}

	function stickyTdPresentation(
		slot: string,
		columnSticky: boolean,
		baseClass: string,
		side: StickyColumnSide = 'left'
	) {
		return {
			class: stickyBodyCellClasses(columnSticky, baseClass, side),
			style: columnSticky ? stickyColumnInsetStyle(slot, side, stickyColOffsets) : undefined,
			'data-sticky-col': columnSticky ? slot : undefined,
			'data-sticky-side': columnSticky ? side : undefined
		};
	}

	const selectionMode = $derived(selection.mode ?? 'multiple');
	const isSingleSelection = $derived(selectionMode === 'single');
	const hideSelectAll = $derived(isSingleSelection || (selection.hideSelectAll ?? false));
	const selectionRadioName = `table-select-${Math.random().toString(36).slice(2, 8)}`;
	const resolvedSkeletonRowCount = $derived(Math.max(1, skeletonRowCount));

	function skeletonKindForColumn(column: TableColumn<T>): TableSkeletonCellKind {
		return column.type ?? 'text';
	}

	const allCurrentKeys = $derived(rows.map(rowKey));
	const selectableCurrentKeys = $derived(
		allCurrentKeys.filter(
			(key) => !selection.disabled && (selection.isRowSelectable?.(key) ?? true)
		)
	);
	const selectedCount = $derived(
		selectableCurrentKeys.filter((key) => selectedRowKeys.includes(key)).length
	);
	const allSelected = $derived(
		selectableCurrentKeys.length > 0 && selectedCount === selectableCurrentKeys.length
	);
	const someSelected = $derived(selectedCount > 0 && selectedCount < selectableCurrentKeys.length);

	function isKeySelectable(key: string): boolean {
		if (selection.disabled) return false;
		return selection.isRowSelectable?.(key) ?? true;
	}

	function handleSelectAllChange(checked: boolean) {
		if (isSingleSelection) return;

		withPreservedScroll(() => {
			if (checked) {
				const nextKeys = [...selectedRowKeys];
				for (const key of selectableCurrentKeys) {
					if (!nextKeys.includes(key)) nextKeys.push(key);
				}
				selectedRowKeys = nextKeys;
				selection.onSelectionChange?.(nextKeys);
			} else {
				const nextKeys = selectedRowKeys.filter((k) => !selectableCurrentKeys.includes(k));
				selectedRowKeys = nextKeys;
				selection.onSelectionChange?.(nextKeys);
			}
		});
	}

	function handleRowSelectionChange(key: string, checked: boolean) {
		if (!isKeySelectable(key)) return;
		withPreservedScroll(() => {
			let nextKeys: string[];
			if (isSingleSelection) {
				nextKeys = checked ? [key] : [];
			} else if (checked) {
				nextKeys = [...selectedRowKeys, key];
			} else {
				nextKeys = selectedRowKeys.filter((k) => k !== key);
			}
			selectedRowKeys = nextKeys;
			selection.onSelectionChange?.(nextKeys);
		});
	}

	/** Clicking the selection cell (not just the control) toggles/selects the row. */
	function handleSelectionCellClick(event: MouseEvent, key: string) {
		event.stopPropagation();
		// Checkbox handles its own change — avoid toggling twice (and double scroll jumps).
		if (event.target instanceof HTMLInputElement) return;
		if (!isKeySelectable(key)) return;
		if (isSingleSelection) {
			handleRowSelectionChange(key, true);
			return;
		}
		handleRowSelectionChange(key, !selectedRowKeys.includes(key));
	}

	function resolveRowClass(row: T): string {
		return typeof rowClass === 'function' ? rowClass(row) : rowClass;
	}

	function resolveColumnCellClass(column: TableColumn<T>, row: T): string {
		const fromColumn = column.cellClass;
		if (typeof fromColumn === 'function') return fromColumn(row);
		return fromColumn ?? '';
	}

	function getTextValue(column: TableColumn<T>, row: T): string {
		if (
			column.type === 'badge' ||
			column.type === 'multi-badge' ||
			column.type === 'metric-bar' ||
			column.type === 'actions' ||
			column.type === 'input'
		) {
			return '';
		}

		if ('value' in column && typeof column.value === 'function') {
			return column.value(row);
		}

		const raw = row[column.key];
		return raw === null || raw === undefined ? '' : String(raw);
	}

	function getTextCellTitle(column: TableColumn<T>, row: T): string | undefined {
		if ('title' in column && typeof column.title === 'function') {
			const title = column.title(row);
			return title || undefined;
		}
		return undefined;
	}

	function isBadgeColumn(
		column: TableColumn<T>
	): column is Extract<TableColumn<T>, { type: 'badge' }> {
		return column.type === 'badge';
	}

	function isMultiBadgeColumn(
		column: TableColumn<T>
	): column is Extract<TableColumn<T>, { type: 'multi-badge' }> {
		return column.type === 'multi-badge';
	}

	function cellLoading(column: TableColumn<T>, row: T): boolean {
		return (column as { loading?: (row: T) => boolean }).loading?.(row) ?? false;
	}

	function isMetricBarColumn(
		column: TableColumn<T>
	): column is Extract<TableColumn<T>, { type: 'metric-bar' }> {
		return column.type === 'metric-bar';
	}

	function isActionsColumn(
		column: TableColumn<T>
	): column is Extract<TableColumn<T>, { type: 'actions' }> {
		return column.type === 'actions';
	}

	function isButtonAction(action: TableAction<T>): action is TableButtonAction<T> {
		return action.type !== 'dropdown' && action.type !== 'label' && action.type !== 'badge';
	}

	function isLabelAction(action: TableAction<T>): action is TableLabelAction {
		return action.type === 'label';
	}

	function isBadgeAction(action: TableAction<T>): action is TableBadgeAction {
		return action.type === 'badge';
	}

	function isDropdownAction(action: TableAction<T>): action is TableDropdownAction<T> {
		return action.type === 'dropdown';
	}

	function resolveActionDisabled(action: TableButtonAction<T>, row: T): boolean {
		return typeof action.disabled === 'function'
			? action.disabled(row)
			: (action.disabled ?? false);
	}

	function resolveActionHref(action: TableButtonAction<T>, row: T): string | undefined {
		return typeof action.href === 'function' ? action.href(row) : action.href;
	}

	function resolveDropdownDisabled(action: TableDropdownAction<T>, row: T): boolean {
		return typeof action.disabled === 'function'
			? action.disabled(row)
			: (action.disabled ?? false);
	}

	function resolveDropdownItemDisabled(item: TableDropdownItem<T>, row: T): boolean {
		return typeof item.disabled === 'function' ? item.disabled(row) : (item.disabled ?? false);
	}

	function resolveDropdownItemHref(item: TableDropdownItem<T>, row: T): string | undefined {
		return typeof item.href === 'function' ? item.href(row) : item.href;
	}

	function resolveDropdownItemSelected(item: TableDropdownItem<T>, row: T): boolean | undefined {
		if (item.selected === undefined) {
			return undefined;
		}

		return typeof item.selected === 'function' ? item.selected(row) : item.selected;
	}

	function resolveDropdownSelectedValue(
		action: TableDropdownAction<T>,
		row: T
	): string | undefined {
		if (action.selectedValue === undefined) {
			return undefined;
		}

		return typeof action.selectedValue === 'function'
			? action.selectedValue(row)
			: action.selectedValue;
	}

	function mapDropdownItems(items: TableDropdownItem<T>[], row: T): DropdownMenuItem[] {
		return items.map((item) => ({
			label: item.label,
			value: item.value,
			icon: item.icon,
			href: resolveDropdownItemHref(item, row),
			disabled: resolveDropdownItemDisabled(item, row),
			selected: resolveDropdownItemSelected(item, row),
			onclick: item.onClick ? () => item.onClick?.(row) : undefined
		}));
	}

	function resolveDropdownGroups(action: TableDropdownAction<T>, row: T): DropdownMenuItem[][] {
		const items = action.items(row);
		if (items.length === 0) {
			return [[]];
		}

		if (Array.isArray(items[0])) {
			return (items as TableDropdownItem<T>[][]).map((group) => mapDropdownItems(group, row));
		}

		return [mapDropdownItems(items as TableDropdownItem<T>[], row)];
	}

	function handleRowClick(row: T) {
		onRowClick?.(row);
	}

	function handleRowKeydown(event: KeyboardEvent, row: T) {
		if (!onRowClick) {
			return;
		}

		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			onRowClick(row);
		}
	}
</script>

{#snippet skeletonRows()}
	{#each { length: resolvedSkeletonRowCount }, rowIndex}
		{@const skeletonRowBg = rowBgClasses(undefined, rowVariant, rowIndex)}
		<tr class={cn(tableRowClass, skeletonRowBg)} aria-hidden="true">
			{#if selectionEnabled}
				<td
					{...stickyTdPresentation(
						stickySelectionSlot(),
						selectionColumnSticky(),
						cn(tableSelectionCellClass, skeletonRowBg)
					)}
				>
					<TableSkeletonCell kind="selection" />
				</td>
			{/if}
			{#each resolvedColumns as column, columnIndex (column.key)}
				{@const actionsLayout = actionsSkeletonLayout(column)}
				<td
					{...stickyTdPresentation(
						column.key,
						dataColumnSticky(column),
						cn(
							cellBaseClass,
							isSerialColumn(column) && tableSerialColumnClass,
							column.class,
							cellClass,
							'overflow-hidden',
							skeletonRowBg
						),
						dataColumnStickySide(column)
					)}
				>
					<TableSkeletonCell
						kind={skeletonKindForColumn(column)}
						{rowIndex}
						{columnIndex}
						align={actionsLayout.align}
						showLeading={actionsLayout.showLeading}
						labeledButtonCount={actionsLayout.labeledButtonCount}
						iconButtonCount={actionsLayout.iconButtonCount}
						showMenu={actionsLayout.showMenu}
						showBadgeLabel={column.type === 'multi-badge' && Boolean(column.label)}
						badgeCount={column.type === 'multi-badge' ? (column.maxBadges ?? 2) : 1}
					/>
				</td>
			{/each}
		</tr>
	{/each}
{/snippet}

{#snippet rowRadio(key: string)}
	{@const checked = selectedRowKeys.includes(key)}
	{@const disabled = !isKeySelectable(key)}
	<span class={tableRowRadioClass(checked, disabled)}>
		<input
			type="radio"
			name={selectionRadioName}
			class={checkboxInputClass}
			{checked}
			{disabled}
			aria-label="Select row"
			onchange={() => handleRowSelectionChange(key, true)}
		/>
	</span>
{/snippet}

{#if layout === 'content'}
	<div bind:this={scrollWrapEl} class={scrollWrapClass} style={scrollWrapStyle}>
		<table
			bind:this={tableEl}
			class={cn(tableElementClass, hasStickyColumns && tableStickyColumnsTableClass, tableClass)}
			aria-busy={loading}
		>
			<thead class={cn(tableTheadClasses(theadVariant), theadClass)}>
				<tr>
					{#if selectionEnabled}
						{@const selectionSticky = selectionColumnSticky()}
						<th
							scope="col"
							{...stickyThPresentation(
								stickySelectionSlot(),
								selectionSticky,
								tableSelectionHeaderCellClass
							)}
						>
							{#if !hideSelectAll && !loading}
								<Checkbox
									checked={allSelected}
									indeterminate={someSelected}
									onCheckedChange={handleSelectAllChange}
									aria-label="Select all rows"
								/>
							{/if}
						</th>
					{/if}
					{#each resolvedColumns as column (column.key)}
						{@const columnSticky = dataColumnSticky(column)}
						<th
							scope="col"
							{...stickyThPresentation(
								column.key,
								columnSticky,
								cn(
									headerCellBaseClass,
									isSerialColumn(column) && tableSerialColumnClass,
									column.headerClass,
									headerCellClass
								),
								dataColumnStickySide(column)
							)}
						>
							<TableColumnHeader
								{column}
								{sort}
								{onSort}
								{filteringEnabled}
								{filterConditionsEnabled}
								{filters}
								{filterValues}
								{onFilterChange}
							/>
						</th>
					{/each}
				</tr>
			</thead>
			<tbody class={cn(tableBodyClass, tbodyClass)}>
				{#if loading}
					{@render skeletonRows()}
				{:else if rows.length === 0 && emptyState}
					<tr>
						<td
							colspan={selectionEnabled ? resolvedColumns.length + 1 : resolvedColumns.length}
							class="p-0"
						>
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
								titleClass={emptyState.titleClass}
								descriptionClass={emptyState.descriptionClass}
							/>
						</td>
					</tr>
				{:else}
					{#each rows as row, rowIndex (rowKey(row))}
						{@const tone = getRowTone?.(row)}
						{@const rowBg = rowBgClasses(tone, rowVariant, rowIndex)}
						<tr
							class={cn(
								tableRowClass,
								rowBg,
								onRowClick && tableClickableRowClass,
								resolveRowClass(row)
							)}
							onclick={() => handleRowClick(row)}
							onkeydown={(event) => handleRowKeydown(event, row)}
							tabindex={onRowClick ? 0 : undefined}
						>
							{#if selectionEnabled}
								{@const key = rowKey(row)}
								<td
									{...stickyTdPresentation(
										stickySelectionSlot(),
										selectionColumnSticky(),
										cn(tableSelectionCellClass, rowBg)
									)}
									onpointerdown={captureScrollPort}
									onclick={(e) => handleSelectionCellClick(e, key)}
									onkeydown={(e) => e.stopPropagation()}
								>
									{#if isSingleSelection}
										{@render rowRadio(key)}
									{:else}
										<Checkbox
											checked={selectedRowKeys.includes(key)}
											disabled={!isKeySelectable(key)}
											onCheckedChange={(checked) => handleRowSelectionChange(key, checked)}
											aria-label="Select row"
										/>
									{/if}
								</td>
							{/if}
							{#each resolvedColumns as column (column.key)}
								<td
									{...stickyTdPresentation(
										column.key,
										dataColumnSticky(column),
										cn(
											cellBaseClass,
											isSerialColumn(column) && tableSerialColumnClass,
											column.class,
											resolveColumnCellClass(column, row),
											cellClass,
											rowBg
										),
										dataColumnStickySide(column)
									)}
								>
									{#if isBadgeColumn(column)}
										{@const badge = column.badge(row)}
										<Badge
											variant={badge.variant}
											label={badge.label}
											dot={badge.dot}
											class={cn('whitespace-nowrap', badge.class)}
										/>
									{:else if isMultiBadgeColumn(column)}
										{@const label = column.label?.(row)}
										{@const allBadges = column.badges(row)}
										{@const maxBadges = column.maxBadges ?? allBadges.length}
										{@const visibleBadges = allBadges.slice(0, maxBadges)}
										{@const remainingCount = allBadges.length - maxBadges}
										{#if visibleBadges.length > 0 || remainingCount > 0}
											<div class="flex flex-col gap-1.5">
												{#if label}
													<span class="text-sm">{label}</span>
												{/if}
												<div class="flex flex-wrap gap-1">
													{#each visibleBadges as badge, i (i)}
														<Badge
															variant={badge.variant}
															label={badge.label}
															dot={badge.dot}
															class={cn('whitespace-nowrap', badge.class)}
														/>
													{/each}
													{#if remainingCount > 0}
														<Badge
															variant="outline"
															label={`+${remainingCount}`}
															class="whitespace-nowrap text-muted-foreground"
														/>
													{/if}
												</div>
											</div>
										{:else if label}
											<span class="text-sm">{label}</span>
										{/if}
									{:else if isMetricBarColumn(column) && cellLoading(column, row)}
										<Skeleton class="h-4 w-24" />
									{:else if isMetricBarColumn(column)}
										<div class={tableMetricBarCellInnerClass}>
											<span class="shrink-0 whitespace-nowrap">{column.label(row)}</span>
											<StatusBar segments={column.segments(row)} size="compact" class="shrink-0" />
										</div>
									{:else if isInputColumn(column)}
										{#if resolveRowFlag(column.visible, row, true)}
											{@const inputCellKey = `${column.key}:${rowKey(row)}`}
											<div
												class={tableInputInnerClass(column.align)}
												role="presentation"
												onclick={(event) => event.stopPropagation()}
												onkeydown={(event) => event.stopPropagation()}
											>
												{#key inputRemountKeys[inputCellKey] ?? 0}
													{#if column.datePicker}
														<DateInput
															size={column.size ?? 'sm'}
															value={column.value(row)}
															placeholder={resolveRowString(column.placeholder, row, 'dd/mm/yyyy')}
															disabled={resolveRowFlag(column.disabled, row, false)}
															isDateDisabled={column.isDateDisabled}
															calendarMonth={column.calendarMonth ?? null}
															class={cn(tableInputClass, resolveInputClass(column, row))}
															onValueChange={(next) => column.onValueChange?.(row, next)}
														/>
													{:else}
														<Input
															type={column.inputType ?? 'text'}
															size={column.size ?? 'sm'}
															value={column.value(row)}
															placeholder={resolveRowString(column.placeholder, row)}
															disabled={resolveRowFlag(column.disabled, row, false)}
															min={resolveRowNumberAttr(column.min, row)}
															max={resolveRowNumberAttr(column.max, row)}
															step={resolveRowNumberAttr(column.step, row)}
															aria-label={resolveRowString(column.ariaLabel, row, column.header)}
															data-table-input={column.key}
															class={cn(tableInputClass, resolveInputClass(column, row))}
															oninput={(event) =>
																commitInputValue(column, row, rowKey(row), event.currentTarget)}
															onblur={(event) =>
																blurInputValue(column, row, rowKey(row), event.currentTarget)}
															onkeydown={(event) => handleInputKeydown(event, column, row)}
														/>
													{/if}
												{/key}
											</div>
										{:else}
											{column.fallbackValue?.(row) ?? ''}
										{/if}
									{:else if isActionsColumn(column)}
										<!-- Shrink-wrapped; empty cell padding reaches row onClick -->
										<div class={tableActionsCellInnerClass(column.align)}>
											{#if column.leading}
												{@const leading = column.leading(row)}
												{#if leading}
													<span
														title={leading.title}
														class="block w-[6.5rem] shrink-0 truncate text-sm text-foreground"
													>
														{leading.label}
													</span>
												{/if}
											{/if}
											{#each column.actions(row) as action, actionIndex (`${column.key}-${actionIndex}-${action.label ?? ''}-${isButtonAction(action) && action.loading ? 'loading' : 'idle'}`)}
												{#if isLabelAction(action)}
													<span
														title={action.title}
														class={cn('max-w-[8rem] truncate text-sm', action.class)}
													>
														{action.label}
													</span>
												{:else if isBadgeAction(action)}
													<Badge
														variant={action.variant ?? 'offline'}
														label={action.label}
														dot={action.dot}
														title={action.title}
														class={action.class}
													/>
												{:else if isButtonAction(action)}
													<Button
														variant={action.variant ?? 'outline'}
														size={action.size ?? 'sm'}
														label={action.label}
														icon={action.icon}
														iconPosition={action.iconPosition}
														href={resolveActionHref(action, row)}
														disabled={resolveActionDisabled(action, row)}
														loading={action.loading ?? false}
														title={action.title}
														class={cn('h-6 px-2 py-0 text-xs', action.class)}
														aria-label={action.ariaLabel ?? action.label}
														onclick={(event) => {
															event.stopPropagation();
															action.onClick?.(row, event);
														}}
													/>
												{:else if isDropdownAction(action)}
													<div
														role="presentation"
														onclick={(event) => event.stopPropagation()}
														onkeydown={(event) => event.stopPropagation()}
													>
														<DropdownMenu
															triggerLabel={action.label}
															triggerIcon={action.icon}
															showChevron={action.showChevron}
															side={action.side ?? 'bottom'}
															align={action.align ?? 'end'}
															groups={resolveDropdownGroups(action, row)}
															selectedValue={resolveDropdownSelectedValue(action, row)}
															maxHeight={action.maxHeight}
															matchTriggerWidth={action.matchTriggerWidth ?? false}
															disabled={resolveDropdownDisabled(action, row)}
															triggerClass={cn(
																action.icon && !action.label && 'size-6 border border-border',
																action.triggerClass
															)}
															contentClass={action.contentClass}
															triggerAriaLabel={action.ariaLabel ?? action.label ?? 'Open menu'}
														/>
													</div>
												{/if}
											{/each}
										</div>
									{:else if cellLoading(column, row)}
										<Skeleton class="h-4 w-20" />
									{:else}
										{@const text = getTextValue(column, row)}
										{@const cellTitle = getTextCellTitle(column, row)}
										{#if cellTitle}
											<span title={cellTitle} class="block max-w-full truncate">{text}</span>
										{:else}
											{text}
										{/if}
									{/if}
								</td>
							{/each}
						</tr>
					{/each}
				{/if}
			</tbody>
		</table>
	</div>
{:else}
	<div
		bind:this={shellEl}
		class={cn(tableShellClasses(variant, className, shellOverflow), shellClass)}
		{...rest}
	>
		{#if hasHeader}
			<div class={cn(tableHeaderBlockClass, headerClass)}>
				<div class="sm:flex-auto">
					{#if title}
						<h1 class={cn(tableTitleClass, titleClass)}>{title}</h1>
					{/if}
					{#if description}
						<p class={cn(tableDescriptionClass, descriptionClass)}>{description}</p>
					{/if}
				</div>
				{#if primaryAction}
					<div class={cn(tableToolbarClass, toolbarClass)}>
						{#if primaryAction.href}
							<Button
								variant="primary"
								size="sm"
								label={primaryAction.label}
								href={primaryAction.href}
								class={primaryAction.class}
							/>
						{:else}
							<Button
								variant="primary"
								size="sm"
								label={primaryAction.label}
								onclick={primaryAction.onClick}
								class={primaryAction.class}
							/>
						{/if}
					</div>
				{/if}
			</div>
		{/if}

		<div bind:this={scrollWrapEl} class={scrollWrapClass} style={scrollWrapStyle}>
			<table
				bind:this={tableEl}
				class={cn(tableElementClass, hasStickyColumns && tableStickyColumnsTableClass, tableClass)}
				aria-busy={loading}
			>
				<thead class={cn(tableTheadClasses(theadVariant), theadClass)}>
					<tr>
						{#if selectionEnabled}
							{@const selectionSticky = selectionColumnSticky()}
							<th
								scope="col"
								{...stickyThPresentation(
									stickySelectionSlot(),
									selectionSticky,
									tableSelectionHeaderCellClass
								)}
							>
								{#if !hideSelectAll && !loading}
									<Checkbox
										checked={allSelected}
										indeterminate={someSelected}
										onCheckedChange={handleSelectAllChange}
										aria-label="Select all rows"
									/>
								{/if}
							</th>
						{/if}
						{#each resolvedColumns as column (column.key)}
							{@const columnSticky = dataColumnSticky(column)}
							<th
								scope="col"
								{...stickyThPresentation(
									column.key,
									columnSticky,
									cn(
										headerCellBaseClass,
										isSerialColumn(column) && tableSerialColumnClass,
										column.headerClass,
										headerCellClass
									),
									dataColumnStickySide(column)
								)}
							>
								<TableColumnHeader
									{column}
									{sort}
									{onSort}
									{filteringEnabled}
									{filterConditionsEnabled}
									{filters}
									{filterValues}
									{onFilterChange}
								/>
							</th>
						{/each}
					</tr>
				</thead>
				<tbody class={cn(tableBodyClass, tbodyClass)}>
					{#if loading}
						{@render skeletonRows()}
					{:else if rows.length === 0 && emptyState}
						<tr>
							<td
								colspan={selectionEnabled ? resolvedColumns.length + 1 : resolvedColumns.length}
								class="p-0"
							>
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
									titleClass={emptyState.titleClass}
									descriptionClass={emptyState.descriptionClass}
								/>
							</td>
						</tr>
					{:else}
						{#each rows as row, rowIndex (rowKey(row))}
							{@const tone = getRowTone?.(row)}
							{@const rowBg = rowBgClasses(tone, rowVariant, rowIndex)}
							<tr
								class={cn(
									tableRowClass,
									rowBg,
									onRowClick && tableClickableRowClass,
									resolveRowClass(row)
								)}
								onclick={() => handleRowClick(row)}
								onkeydown={(event) => handleRowKeydown(event, row)}
								tabindex={onRowClick ? 0 : undefined}
							>
								{#if selectionEnabled}
									{@const key = rowKey(row)}
									<td
										{...stickyTdPresentation(
											stickySelectionSlot(),
											selectionColumnSticky(),
											cn(tableSelectionCellClass, rowBg)
										)}
										onpointerdown={captureScrollPort}
										onclick={(e) => handleSelectionCellClick(e, key)}
										onkeydown={(e) => e.stopPropagation()}
									>
										{#if isSingleSelection}
											{@render rowRadio(key)}
										{:else}
											<Checkbox
												checked={selectedRowKeys.includes(key)}
												disabled={!isKeySelectable(key)}
												onCheckedChange={(checked) => handleRowSelectionChange(key, checked)}
												aria-label="Select row"
											/>
										{/if}
									</td>
								{/if}
								{#each resolvedColumns as column (column.key)}
									<td
										{...stickyTdPresentation(
											column.key,
											dataColumnSticky(column),
											cn(
												cellBaseClass,
												isSerialColumn(column) && tableSerialColumnClass,
												column.class,
												resolveColumnCellClass(column, row),
												cellClass,
												rowBg
											),
											dataColumnStickySide(column)
										)}
									>
										{#if isBadgeColumn(column)}
											{@const badge = column.badge(row)}
											<Badge
												variant={badge.variant}
												label={badge.label}
												dot={badge.dot}
												class={cn('whitespace-nowrap', badge.class)}
											/>
										{:else if isMultiBadgeColumn(column)}
											{@const label = column.label?.(row)}
											{@const allBadges = column.badges(row)}
											{@const maxBadges = column.maxBadges ?? allBadges.length}
											{@const visibleBadges = allBadges.slice(0, maxBadges)}
											{@const remainingCount = allBadges.length - maxBadges}
											{#if visibleBadges.length > 0 || remainingCount > 0}
												<div class="flex flex-col gap-1.5">
													{#if label}
														<span class="text-sm">{label}</span>
													{/if}
													<div class="flex flex-wrap gap-1">
														{#each visibleBadges as badge, i (i)}
															<Badge
																variant={badge.variant}
																label={badge.label}
																dot={badge.dot}
																class={cn('whitespace-nowrap', badge.class)}
															/>
														{/each}
														{#if remainingCount > 0}
															<Badge
																variant="outline"
																label={`+${remainingCount}`}
																class="whitespace-nowrap text-muted-foreground"
															/>
														{/if}
													</div>
												</div>
											{:else if label}
												<span class="text-sm">{label}</span>
											{/if}
										{:else if isMetricBarColumn(column) && cellLoading(column, row)}
											<Skeleton class="h-4 w-24" />
										{:else if isMetricBarColumn(column)}
											<div class={tableMetricBarCellInnerClass}>
												<span class="shrink-0 whitespace-nowrap">{column.label(row)}</span>
												<StatusBar
													segments={column.segments(row)}
													size="compact"
													class="shrink-0"
												/>
											</div>
										{:else if isInputColumn(column)}
											{#if resolveRowFlag(column.visible, row, true)}
												{@const inputCellKey = `${column.key}:${rowKey(row)}`}
												<div
													class={tableInputInnerClass(column.align)}
													role="presentation"
													onclick={(event) => event.stopPropagation()}
													onkeydown={(event) => event.stopPropagation()}
												>
													{#key inputRemountKeys[inputCellKey] ?? 0}
														{#if column.datePicker}
															<DateInput
																size={column.size ?? 'sm'}
																value={column.value(row)}
																placeholder={resolveRowString(
																	column.placeholder,
																	row,
																	'dd/mm/yyyy'
																)}
																disabled={resolveRowFlag(column.disabled, row, false)}
																isDateDisabled={column.isDateDisabled}
																calendarMonth={column.calendarMonth ?? null}
																class={cn(tableInputClass, resolveInputClass(column, row))}
																onValueChange={(next) => column.onValueChange?.(row, next)}
															/>
														{:else}
															<Input
																type={column.inputType ?? 'text'}
																size={column.size ?? 'sm'}
																value={column.value(row)}
																placeholder={resolveRowString(column.placeholder, row)}
																disabled={resolveRowFlag(column.disabled, row, false)}
																min={resolveRowNumberAttr(column.min, row)}
																max={resolveRowNumberAttr(column.max, row)}
																step={resolveRowNumberAttr(column.step, row)}
																aria-label={resolveRowString(column.ariaLabel, row, column.header)}
																data-table-input={column.key}
																class={cn(tableInputClass, resolveInputClass(column, row))}
																oninput={(event) =>
																	commitInputValue(column, row, rowKey(row), event.currentTarget)}
																onblur={(event) =>
																	blurInputValue(column, row, rowKey(row), event.currentTarget)}
																onkeydown={(event) => handleInputKeydown(event, column, row)}
															/>
														{/if}
													{/key}
												</div>
											{:else}
												{column.fallbackValue?.(row) ?? ''}
											{/if}
										{:else if isActionsColumn(column)}
											<!-- Shrink-wrapped; empty cell padding reaches row onClick -->
											<div class={tableActionsCellInnerClass(column.align)}>
												{#if column.leading}
													{@const leading = column.leading(row)}
													{#if leading}
														<span
															title={leading.title}
															class="block w-[6.5rem] shrink-0 truncate text-sm text-foreground"
														>
															{leading.label}
														</span>
													{/if}
												{/if}
												{#each column.actions(row) as action, actionIndex (`${column.key}-${actionIndex}-${action.label ?? ''}-${isButtonAction(action) && action.loading ? 'loading' : 'idle'}`)}
													{#if isLabelAction(action)}
														<span
															title={action.title}
															class={cn('max-w-[8rem] truncate text-sm', action.class)}
														>
															{action.label}
														</span>
													{:else if isBadgeAction(action)}
														<Badge
															variant={action.variant ?? 'offline'}
															label={action.label}
															dot={action.dot}
															title={action.title}
															class={action.class}
														/>
													{:else if isButtonAction(action)}
														<Button
															variant={action.variant ?? 'outline'}
															size={action.size ?? 'sm'}
															label={action.label}
															icon={action.icon}
															iconPosition={action.iconPosition}
															href={resolveActionHref(action, row)}
															disabled={resolveActionDisabled(action, row)}
															loading={action.loading ?? false}
															title={action.title}
															class={cn('h-6 px-2 py-0 text-xs', action.class)}
															aria-label={action.ariaLabel ?? action.label}
															onclick={(event) => {
																event.stopPropagation();
																action.onClick?.(row, event);
															}}
														/>
													{:else if isDropdownAction(action)}
														<div
															role="presentation"
															onclick={(event) => event.stopPropagation()}
															onkeydown={(event) => event.stopPropagation()}
														>
															<DropdownMenu
																triggerLabel={action.label}
																triggerIcon={action.icon}
																showChevron={action.showChevron}
																side={action.side ?? 'bottom'}
																align={action.align ?? 'end'}
																groups={resolveDropdownGroups(action, row)}
																selectedValue={resolveDropdownSelectedValue(action, row)}
																maxHeight={action.maxHeight}
																matchTriggerWidth={action.matchTriggerWidth ?? false}
																disabled={resolveDropdownDisabled(action, row)}
																triggerClass={cn(
																	action.icon && !action.label && 'size-6 border border-border',
																	action.triggerClass
																)}
																contentClass={action.contentClass}
																triggerAriaLabel={action.ariaLabel ?? action.label ?? 'Open menu'}
															/>
														</div>
													{/if}
												{/each}
											</div>
										{:else if cellLoading(column, row)}
											<Skeleton class="h-4 w-20" />
										{:else}
											{@const text = getTextValue(column, row)}
											{@const cellTitle = getTextCellTitle(column, row)}
											{#if cellTitle}
												<span title={cellTitle} class="block max-w-full truncate">{text}</span>
											{:else}
												{text}
											{/if}
										{/if}
									</td>
								{/each}
							</tr>
						{/each}
					{/if}
				</tbody>
			</table>
		</div>
	</div>
{/if}
