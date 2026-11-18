<script lang="ts" generics="T extends Record<string, unknown>">
	import type { HTMLAttributes } from 'svelte/elements';
	import { ChevronDown, ChevronRight, ChevronUp } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { ProgressMeter } from '$lib/components/ui/progress-meter';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { DataTable } from '$lib/components/ui/table';
	import type { TableSelectionConfig } from '$lib/components/ui/table/table.constants';
	import type {
		DataTableColumn,
		DataTableExportConfig,
		DataTableFilteringConfig,
		DataTablePaginationConfig,
		DataTableSearchConfig,
		DataTableSortingConfig,
		DataTableToolbarButtonsProp
	} from '$lib/components/ui/table/data-table.constants';
	import { cn } from '$lib/utils/cn';
	import type { AccordionType } from '../accordion/accordion.constants';
	import {
		accordionValueFromOpenValues,
		normalizeAccordionValue
	} from '../accordion/accordion.utils';
	import type {
		AccordionWithTableHeadings,
		AccordionWithTableItem
	} from './accordion-with-table.constants';
	import {
		accordionWithTableClass,
		accordionWithTableClassWithHeadings,
		accordionWithTableBadgeClass,
		accordionWithTableContentInnerClass,
		accordionWithTableContentWrapperClass,
		accordionWithTableHeaderCellClass,
		accordionWithTableHeaderRowClass,
		accordionWithTableHeaderSectionClass,
		accordionWithTableIconClass,
		accordionWithTableItemClass,
		accordionWithTableItemExcludedClass,
		accordionWithTableItemFlushClass,
		accordionWithTableTriggerActionsClass,
		accordionWithTableTriggerClass,
		accordionWithTableTriggerHeadingClass,
		accordionWithTableTriggerProgressClass,
		accordionWithTableTriggerStatBlockClass,
		accordionWithTableTriggerStatLabelClass,
		accordionWithTableTriggerStatsClass,
		accordionWithTableTriggerStatSublabelClass,
		accordionWithTableTriggerStatValueClass,
		accordionWithTableTriggerSubtitleClass,
		accordionWithTableTriggerSummaryClass,
		accordionWithTableTriggerTitleClass
	} from './accordion-with-table.styles';

	type Props = {
		items: AccordionWithTableItem<T>[];
		columns: DataTableColumn<T>[];
		rowKey: (row: T) => string;
		/** Shared column headings above items; caller-provided. Hides per-item labels when set. */
		headings?: AccordionWithTableHeadings;
		type?: AccordionType;
		value?: string | string[];
		collapsible?: boolean;
		maxVisibleRows?: number;
		search?: DataTableSearchConfig<T>;
		export?: DataTableExportConfig;
		toolbarButton?: DataTableToolbarButtonsProp;
		pagination?: DataTablePaginationConfig;
		sorting?: DataTableSortingConfig;
		filtering?: DataTableFilteringConfig;
		selection?: TableSelectionConfig;
		selectedRowKeys?: string[];
		selectionPlacement?: 'start' | 'end';
		itemSelection?: { enabled: boolean };
		selectedItemKeys?: string[];
		chevronPlacement?: 'start' | 'end';
		/** When true, shows skeleton accordion shells instead of real items. */
		loading?: boolean;
		/** Number of skeleton accordion items while loading. */
		skeletonItemCount?: number;
		/** Number of placeholder stat blocks on each skeleton trigger. */
		skeletonStatCount?: number;
		onItemAction?: (itemValue: string) => void;
		onRowClick?: (row: T) => void;
		onValueChange?: (value: string | string[]) => void;
		class?: string;
		shellClass?: string;
		toolbarClass?: string;
		searchClass?: string;
		exportClass?: string;
		toolbarButtonClass?: string;
		footerClass?: string;
		itemClass?: string;
		triggerClass?: string;
		triggerTitleClass?: string;
		iconClass?: string;
		tableClass?: string;
		theadClass?: string;
		tbodyClass?: string;
		rowClass?: string | ((row: T) => string);
		headerCellClass?: string;
		cellClass?: string;
		stickyHeader?: boolean;
		maxHeight?: string;
	} & HTMLAttributes<HTMLDivElement>;

	let {
		items,
		columns,
		rowKey,
		headings,
		type = 'multiple',
		value = $bindable<string | string[] | undefined>(undefined),
		collapsible = true,
		maxVisibleRows,
		search = { enabled: false },
		export: exportConfig = { enabled: false },
		toolbarButton,
		pagination = { enabled: false },
		sorting = {},
		filtering = {},
		selection = { enabled: false },
		selectedRowKeys = $bindable([]),
		selectionPlacement = 'start',
		itemSelection = { enabled: false },
		selectedItemKeys = $bindable([]),
		chevronPlacement = 'start',
		loading = false,
		skeletonItemCount = 5,
		skeletonStatCount = 2,
		onItemAction,
		onRowClick,
		onValueChange,
		class: className = '',
		shellClass = '',
		toolbarClass = '',
		searchClass = '',
		exportClass = '',
		toolbarButtonClass = '',
		footerClass = '',
		itemClass = '',
		triggerClass = '',
		triggerTitleClass = '',
		iconClass = '',
		tableClass = '',
		theadClass = '',
		tbodyClass = '',
		rowClass = '',
		headerCellClass = '',
		cellClass = '',
		stickyHeader = false,
		maxHeight,
		...rest
	}: Props = $props();

	const fallbackId = `accordion-with-table-${Math.random().toString(36).slice(2, 9)}`;

	/** Group "select all" checkbox; hidden in single mode, where it would select several rows. */
	const groupSelectionEnabled = $derived(selection.enabled && selection.mode !== 'single');
	const itemSelectionEnabled = $derived(itemSelection.enabled);
	const openValues = $derived(normalizeAccordionValue(value, type, items));
	const hasSharedHeadings = $derived(
		Boolean(
			headings?.section || (headings?.stats && headings.stats.length > 0) || headings?.progress
		)
	);
	const showPerItemLabels = $derived(!hasSharedHeadings);
	/** Reserve progress column width when any row (or shared heading) uses it. */
	const reservesProgressColumn = $derived(
		Boolean(headings?.progress || items.some((entry) => entry.progress))
	);
	const resolvedSkeletonItemCount = $derived(Math.max(1, skeletonItemCount));
	const resolvedSkeletonStatCount = $derived(Math.max(0, skeletonStatCount));
	const skeletonTitleWidths = ['w-36', 'w-44', 'w-32', 'w-40', 'w-48'] as const;

	function isOpen(itemValue: string): boolean {
		return openValues.includes(itemValue);
	}

	function setOpenValues(next: string[]) {
		const nextValue = accordionValueFromOpenValues(next, type);
		value = nextValue;
		onValueChange?.(nextValue);
	}

	function toggleItem(item: AccordionWithTableItem<T>) {
		if (item.disabled) {
			return;
		}

		const open = isOpen(item.value);

		if (type === 'single') {
			if (open && collapsible) {
				setOpenValues([]);
				return;
			}

			if (!open) {
				setOpenValues([item.value]);
			}

			return;
		}

		setOpenValues(
			open ? openValues.filter((entry) => entry !== item.value) : [...openValues, item.value]
		);
	}

	function getRowCount(item: AccordionWithTableItem<T>): number {
		return item.rowCount ?? item.rows.length;
	}

	function getVisibleRows(item: AccordionWithTableItem<T>): T[] {
		if (maxVisibleRows === undefined) {
			return item.rows;
		}

		return item.rows.slice(0, maxVisibleRows);
	}

	function formatTitle(item: AccordionWithTableItem<T>): string {
		const label = item.rowLabel ?? 'rows';
		return `${item.label} (${getRowCount(item)} ${label})`;
	}

	function handleRowSelection(item: AccordionWithTableItem<T>, checked: boolean) {
		if (selection.disabled) return;
		const itemKeys = item.rows.map(rowKey);
		if (checked) {
			const nextKeys = [...selectedRowKeys];
			for (const key of itemKeys) {
				if (!nextKeys.includes(key)) nextKeys.push(key);
			}
			selectedRowKeys = nextKeys;
			selection.onSelectionChange?.(nextKeys);
		} else {
			const nextKeys = selectedRowKeys.filter((k) => !itemKeys.includes(k));
			selectedRowKeys = nextKeys;
			selection.onSelectionChange?.(nextKeys);
		}
	}

	function handleAccordionItemSelection(itemValue: string, checked: boolean) {
		if (checked) {
			if (!selectedItemKeys.includes(itemValue)) {
				selectedItemKeys = [...selectedItemKeys, itemValue];
			}
			return;
		}

		selectedItemKeys = selectedItemKeys.filter((key) => key !== itemValue);
	}

	function usesRichTrigger(item: AccordionWithTableItem<T>): boolean {
		return Boolean(item.description || (item.stats && item.stats.length > 0) || item.progress);
	}

	function usesResultTrigger(item: AccordionWithTableItem<T>): boolean {
		return Boolean(item.badge || item.summary);
	}
</script>

<div
	class={cn(
		hasSharedHeadings ? accordionWithTableClassWithHeadings : accordionWithTableClass,
		className
	)}
	{...rest}
	aria-busy={loading ? true : undefined}
	role={loading ? 'status' : undefined}
>
	{#if loading}
		<span class="sr-only">Loading accordion items</span>
	{/if}
	{#if hasSharedHeadings}
		<div class={accordionWithTableHeaderRowClass} role="row">
			{#if chevronPlacement === 'start'}
				<span class={accordionWithTableIconClass} aria-hidden="true"></span>
			{/if}
			{#if itemSelectionEnabled}
				<span class="size-4 shrink-0" aria-hidden="true"></span>
			{/if}
			{#if groupSelectionEnabled && selectionPlacement === 'start'}
				<span class="size-4 shrink-0" aria-hidden="true"></span>
			{/if}
			<div class={accordionWithTableHeaderSectionClass}>{headings?.section ?? ''}</div>
			{#if (headings?.stats && headings.stats.length > 0) || headings?.progress}
				<div class={accordionWithTableTriggerStatsClass}>
					{#if headings?.stats}
						{#each headings.stats as statHeading, headingIndex (headingIndex)}
							<div class={accordionWithTableTriggerStatBlockClass}>
								<div class={accordionWithTableHeaderCellClass}>{statHeading}</div>
							</div>
						{/each}
					{/if}
					{#if headings?.progress}
						<div class={accordionWithTableTriggerProgressClass}>
							<div class={accordionWithTableHeaderCellClass}>{headings.progress}</div>
						</div>
					{/if}
				</div>
			{/if}
			{#if groupSelectionEnabled && selectionPlacement === 'end'}
				<span class="size-4 shrink-0" aria-hidden="true"></span>
			{/if}
			{#if chevronPlacement === 'end'}
				<span class={accordionWithTableIconClass} aria-hidden="true"></span>
			{/if}
		</div>
	{/if}
	{#if loading}
		{#each { length: resolvedSkeletonItemCount }, skeletonIndex}
			{@const titleWidth = skeletonTitleWidths[skeletonIndex % skeletonTitleWidths.length]}
			<div
				class={cn(
					accordionWithTableItemClass,
					hasSharedHeadings && accordionWithTableItemFlushClass,
					itemClass
				)}
			>
				<div class={cn(accordionWithTableTriggerClass, triggerClass)}>
					{#if chevronPlacement === 'start'}
						<Skeleton class="size-4 shrink-0" />
					{/if}
					<div class={accordionWithTableTriggerHeadingClass}>
						<Skeleton class={cn('h-5', titleWidth)} />
						<Skeleton class="mt-1 h-3 w-28" />
					</div>
					{#if resolvedSkeletonStatCount > 0}
						<div class={accordionWithTableTriggerStatsClass}>
							{#each { length: resolvedSkeletonStatCount }, statIndex (statIndex)}
								<div class={accordionWithTableTriggerStatBlockClass}>
									<Skeleton class="ml-auto h-3 w-14" />
									<Skeleton class="mt-1 ml-auto h-4 w-10" />
								</div>
							{/each}
						</div>
					{/if}
					{#if chevronPlacement === 'end'}
						<Skeleton class="size-4 shrink-0" />
					{/if}
				</div>
			</div>
		{/each}
	{:else}
		{#each items as item (item.value)}
			{@const expanded = isOpen(item.value)}
			{@const triggerId = `${fallbackId}-trigger-${item.value}`}
			{@const panelId = `${fallbackId}-panel-${item.value}`}
			{@const visibleRows = getVisibleRows(item)}
			{@const itemKeys = item.rows.map(rowKey)}
			{@const selectedCount = itemKeys.filter((key) => selectedRowKeys.includes(key)).length}
			{@const allSelected = item.rows.length > 0 && selectedCount === item.rows.length}
			{@const someSelected = selectedCount > 0 && selectedCount < item.rows.length}
			{@const richTrigger = usesRichTrigger(item)}
			{@const resultTrigger = usesResultTrigger(item)}
			{@const accordionItemSelected = selectedItemKeys.includes(item.value)}
			<div
				class={cn(
					accordionWithTableItemClass,
					hasSharedHeadings && accordionWithTableItemFlushClass,
					item.inactive && accordionWithTableItemExcludedClass,
					itemClass
				)}
			>
				<button
					type="button"
					id={triggerId}
					class={cn(
						accordionWithTableTriggerClass,
						expanded && 'border-b border-border',
						triggerClass
					)}
					aria-expanded={expanded}
					aria-controls={panelId}
					disabled={item.disabled}
					onclick={() => toggleItem(item)}
				>
					{#if itemSelectionEnabled}
						<div
							role="presentation"
							onclick={(event) => event.stopPropagation()}
							onkeydown={(event) => event.stopPropagation()}
						>
							<Checkbox
								checked={accordionItemSelected}
								onCheckedChange={(checked) => handleAccordionItemSelection(item.value, checked)}
								aria-label="Select {item.label} for replan"
							/>
						</div>
					{/if}
					{#if groupSelectionEnabled && selectionPlacement === 'start'}
						<div
							role="presentation"
							onclick={(event) => event.stopPropagation()}
							onkeydown={(event) => event.stopPropagation()}
						>
							<Checkbox
								checked={allSelected}
								indeterminate={someSelected}
								disabled={selection.disabled}
								onCheckedChange={(checked) => handleRowSelection(item, checked)}
								aria-label="Include {item.label}"
							/>
						</div>
					{/if}
					{#if chevronPlacement === 'start'}
						{#if expanded}
							<ChevronDown class={cn(accordionWithTableIconClass, iconClass)} aria-hidden="true" />
						{:else}
							<ChevronRight class={cn(accordionWithTableIconClass, iconClass)} aria-hidden="true" />
						{/if}
					{/if}
					{#if resultTrigger}
						<div class="flex min-w-0 flex-1 items-center gap-3">
							<span class={cn('shrink-0 font-semibold text-foreground', triggerTitleClass)}>
								{item.label}
							</span>
							{#if item.badge}
								<span class={accordionWithTableBadgeClass(item.badgeTone ?? 'primary')}>
									{item.badge}
								</span>
							{/if}
							{#if item.summary}
								<span class={accordionWithTableTriggerSummaryClass}>{item.summary}</span>
							{/if}
						</div>
					{:else if richTrigger}
						<div class={accordionWithTableTriggerHeadingClass}>
							<div class={cn(accordionWithTableTriggerTitleClass, triggerTitleClass)}>
								{item.label}{#if item.statusLabel}<span
										class="ml-2 font-normal text-muted-foreground">{item.statusLabel}</span
									>{/if}
							</div>
							{#if item.description}
								<div class={accordionWithTableTriggerSubtitleClass}>{item.description}</div>
							{/if}
						</div>
						{#if (item.stats && item.stats.length > 0) || item.progress || reservesProgressColumn}
							<div class={accordionWithTableTriggerStatsClass}>
								{#if item.stats}
									{#each item.stats as stat, statIndex (statIndex)}
										<div class={accordionWithTableTriggerStatBlockClass}>
											{#if showPerItemLabels}
												<div class={accordionWithTableTriggerStatLabelClass}>{stat.label}</div>
											{/if}
											{#if stat.badgeVariant}
												<div
													class={cn(
														'flex flex-col items-end gap-0.5',
														showPerItemLabels && 'mt-0.5'
													)}
												>
													<Badge
														variant={stat.badgeVariant}
														label={stat.value}
														dot={false}
														class="rounded-none"
													/>
													{#if stat.sublabel}
														<span class={accordionWithTableTriggerStatSublabelClass}>
															{stat.sublabel}
														</span>
													{/if}
												</div>
											{:else}
												<div class={accordionWithTableTriggerStatValueClass}>{stat.value}</div>
												{#if stat.sublabel}
													<div class={accordionWithTableTriggerStatSublabelClass}>
														{stat.sublabel}
													</div>
												{/if}
											{/if}
										</div>
									{/each}
								{/if}
								{#if item.progress}
									<div class={accordionWithTableTriggerProgressClass}>
										{#if showPerItemLabels}
											<div class={accordionWithTableTriggerStatLabelClass}>
												{item.progress.label}
											</div>
										{/if}
										<ProgressMeter
											value={item.progress.value}
											valueLabel={item.progress.valueLabel}
											fillTone={item.progress.fillTone}
											remainderTone={item.progress.remainderTone}
											fillClass={item.progress.fillClass}
											remainderClass={item.progress.remainderClass}
											ariaLabel={item.progress.valueLabel ?? item.progress.label}
											class={showPerItemLabels ? 'mt-1' : undefined}
										/>
									</div>
								{:else if reservesProgressColumn}
									<div class={accordionWithTableTriggerProgressClass} aria-hidden="true"></div>
								{/if}
							</div>
						{/if}
					{:else}
						<span class={cn(accordionWithTableTriggerTitleClass, triggerTitleClass)}
							>{formatTitle(item)}</span
						>
					{/if}
					{#if groupSelectionEnabled && selectionPlacement === 'end'}
						<div
							role="presentation"
							onclick={(event) => event.stopPropagation()}
							onkeydown={(event) => event.stopPropagation()}
						>
							<Checkbox
								checked={allSelected}
								indeterminate={someSelected}
								disabled={selection.disabled}
								onCheckedChange={(checked) => handleRowSelection(item, checked)}
								aria-label="Include {item.label}"
							/>
						</div>
					{/if}
					{#if item.actionLabel && onItemAction}
						<div class={accordionWithTableTriggerActionsClass}>
							<Button
								variant="outline"
								size="sm"
								class="rounded-none"
								label={item.actionLabel}
								onclick={(event) => {
									event.stopPropagation();
									onItemAction(item.value);
								}}
							/>
						</div>
					{/if}
					{#if chevronPlacement === 'end'}
						{#if expanded}
							<ChevronUp class={cn(accordionWithTableIconClass, iconClass)} aria-hidden="true" />
						{:else}
							<ChevronDown class={cn(accordionWithTableIconClass, iconClass)} aria-hidden="true" />
						{/if}
					{/if}
				</button>

				<div
					id={panelId}
					role="region"
					aria-labelledby={triggerId}
					class={accordionWithTableContentWrapperClass(expanded)}
				>
					<div class={accordionWithTableContentInnerClass}>
						{#if expanded}
							<DataTable
								{columns}
								rows={visibleRows}
								{rowKey}
								{onRowClick}
								{search}
								export={exportConfig}
								{toolbarButton}
								{pagination}
								{sorting}
								{filtering}
								selection={{ ...selection, hideSelectAll: true }}
								bind:selectedRowKeys
								{shellClass}
								{toolbarClass}
								{searchClass}
								{exportClass}
								{toolbarButtonClass}
								{footerClass}
								{tableClass}
								{theadClass}
								{tbodyClass}
								{rowClass}
								{headerCellClass}
								{cellClass}
								{stickyHeader}
								{maxHeight}
							/>
						{/if}
					</div>
				</div>
			</div>
		{/each}
	{/if}
</div>
