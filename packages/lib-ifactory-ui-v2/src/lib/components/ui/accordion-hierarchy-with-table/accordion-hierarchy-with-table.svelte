<script lang="ts" generics="T extends Record<string, unknown>">
	import type { HTMLAttributes } from 'svelte/elements';
	import { SvelteSet } from 'svelte/reactivity';
	import { ChevronDown, ChevronRight, ChevronUp } from '@lucide/svelte';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { DataTable } from '$lib/components/ui/table';
	import type { TableSelectionConfig } from '$lib/components/ui/table/table.constants';
	import type {
		DataTableColumn,
		DataTableFilteringConfig,
		DataTablePaginationConfig,
		DataTableSearchConfig,
		DataTableSortingConfig
	} from '$lib/components/ui/table/data-table.constants';
	import { cn } from '$lib/utils/cn';
	import type { AccordionType } from '../accordion/accordion.constants';
	import {
		accordionValueFromOpenValues,
		normalizeAccordionValue
	} from '../accordion/accordion.utils';
	import type {
		AccordionHierarchyGroup,
		AccordionHierarchyItem
	} from './accordion-hierarchy-with-table.constants';
	import {
		accordionHierarchyBadgeClass,
		accordionHierarchyContentInnerClass,
		accordionHierarchyContentWrapperClass,
		accordionHierarchyEmptyLabelClass,
		accordionHierarchyGroupBadgeClass,
		accordionHierarchyGroupItemClass,
		accordionHierarchyGroupListClass,
		accordionHierarchyGroupPanelClass,
		accordionHierarchyGroupTriggerClass,
		accordionHierarchyIconClass,
		accordionHierarchyItemClass,
		accordionHierarchyTableFooterClass,
		accordionHierarchyTableTitleClass,
		accordionHierarchyTriggerClass,
		accordionHierarchyTriggerHeadingClass,
		accordionHierarchyTriggerSubtitleClass,
		accordionHierarchyTriggerTitleClass,
		accordionHierarchyWithTableClass
	} from './accordion-hierarchy-with-table.styles';

	type Props = {
		items: AccordionHierarchyItem<T>[];
		columns: DataTableColumn<T>[];
		rowKey: (row: T) => string;
		type?: AccordionType;
		value?: string | string[];
		collapsible?: boolean;
		groupType?: AccordionType;
		openGroupValues?: Record<string, string[]>;
		groupSelection?: TableSelectionConfig;
		selectedGroupKeys?: string[];
		selection?: TableSelectionConfig;
		selectedRowKeys?: string[];
		search?: DataTableSearchConfig<T>;
		pagination?: DataTablePaginationConfig;
		sorting?: DataTableSortingConfig;
		filtering?: DataTableFilteringConfig;
		chevronPlacement?: 'start' | 'end';
		onValueChange?: (value: string | string[]) => void;
		onGroupValueChange?: (value: Record<string, string[]>) => void;
		onRowClick?: (
			row: T,
			group: AccordionHierarchyGroup<T>,
			item: AccordionHierarchyItem<T>
		) => void;
		class?: string;
		itemClass?: string;
		triggerClass?: string;
		triggerTitleClass?: string;
		iconClass?: string;
		groupClass?: string;
		groupTriggerClass?: string;
		shellClass?: string;
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
		type = 'multiple',
		value = $bindable<string | string[] | undefined>(undefined),
		collapsible = true,
		groupType = 'multiple',
		openGroupValues = $bindable<Record<string, string[]>>({}),
		groupSelection = { enabled: false },
		selectedGroupKeys = $bindable<string[]>([]),
		selection = { enabled: false },
		selectedRowKeys = $bindable<string[]>([]),
		search = { enabled: false },
		pagination = { enabled: false },
		sorting = { enabled: false },
		filtering = {},
		chevronPlacement = 'end',
		onValueChange,
		onGroupValueChange,
		onRowClick,
		class: className = '',
		itemClass = '',
		triggerClass = '',
		triggerTitleClass = '',
		iconClass = '',
		groupClass = '',
		groupTriggerClass = '',
		shellClass = '',
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

	const fallbackId = `accordion-hierarchy-with-table-${Math.random().toString(36).slice(2, 9)}`;
	const groupSelectionEnabled = $derived(groupSelection.enabled);
	const openValues = $derived(normalizeAccordionValue(value, type, items));

	// Mount item/group panels on first expand and keep them mounted afterward so
	// the CSS grid-rows collapse transition stays smooth (same as AccordionWithContent).
	const everOpenedItems = new SvelteSet<string>();
	const everOpenedGroups = new SvelteSet<string>();

	$effect(() => {
		for (const itemValue of openValues) {
			everOpenedItems.add(itemValue);
		}
	});

	$effect(() => {
		for (const [itemValue, groupValues] of Object.entries(openGroupValues)) {
			for (const groupValue of groupValues) {
				everOpenedGroups.add(groupMountKey(itemValue, groupValue));
			}
		}
	});

	function groupMountKey(itemValue: string, groupValue: string): string {
		return `${itemValue}::${groupValue}`;
	}

	function isItemOpen(itemValue: string): boolean {
		return openValues.includes(itemValue);
	}

	function setOpenValues(next: string[]) {
		const nextValue = accordionValueFromOpenValues(next, type);
		value = nextValue;
		onValueChange?.(nextValue);
	}

	function toggleItem(item: AccordionHierarchyItem<T>) {
		if (item.disabled) return;

		const open = isItemOpen(item.value);

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

	function getOpenGroups(itemValue: string): string[] {
		return openGroupValues[itemValue] ?? [];
	}

	function setOpenGroups(itemValue: string, next: string[]) {
		openGroupValues = { ...openGroupValues, [itemValue]: next };
		onGroupValueChange?.(openGroupValues);
	}

	function isGroupOpen(itemValue: string, groupValue: string): boolean {
		return getOpenGroups(itemValue).includes(groupValue);
	}

	function toggleGroup(item: AccordionHierarchyItem<T>, group: AccordionHierarchyGroup<T>) {
		if (group.disabled) return;

		const current = getOpenGroups(item.value);
		const open = current.includes(group.value);

		if (groupType === 'single') {
			setOpenGroups(item.value, open ? [] : [group.value]);
			return;
		}

		setOpenGroups(
			item.value,
			open ? current.filter((entry) => entry !== group.value) : [...current, group.value]
		);
	}

	function isGroupSelectable(group: AccordionHierarchyGroup<T>): boolean {
		return group.selectable !== false && !group.disabled;
	}

	function handleGroupSelection(group: AccordionHierarchyGroup<T>, checked: boolean) {
		if (!isGroupSelectable(group)) return;

		const next = checked
			? selectedGroupKeys.includes(group.value)
				? selectedGroupKeys
				: [...selectedGroupKeys, group.value]
			: selectedGroupKeys.filter((key) => key !== group.value);

		selectedGroupKeys = next;
		groupSelection.onSelectionChange?.(next);
	}

	function getBadgeClass(
		tone:
			AccordionHierarchyGroup<T>['badgeTone'] | AccordionHierarchyItem<T>['badgeTone'] = 'primary',
		badgeClass?: string
	): string {
		if (badgeClass) return badgeClass;
		if (tone === 'secondary') return accordionHierarchyGroupBadgeClass('secondary');
		if (tone === 'success') return accordionHierarchyGroupBadgeClass('success');
		return accordionHierarchyBadgeClass(tone ?? 'primary');
	}
</script>

<div class={cn(accordionHierarchyWithTableClass, className)} {...rest}>
	{#each items as item (item.value)}
		{@const itemExpanded = isItemOpen(item.value)}
		{@const itemTriggerId = `${fallbackId}-item-trigger-${item.value}`}
		{@const itemPanelId = `${fallbackId}-item-panel-${item.value}`}
		<div class={cn(accordionHierarchyItemClass, itemClass)}>
			<button
				type="button"
				id={itemTriggerId}
				class={cn(
					accordionHierarchyTriggerClass,
					itemExpanded && item.groups.length > 0 && 'border-b border-border',
					triggerClass
				)}
				aria-expanded={itemExpanded}
				aria-controls={itemPanelId}
				disabled={item.disabled}
				onclick={() => toggleItem(item)}
			>
				{#if chevronPlacement === 'start'}
					{#if itemExpanded}
						<ChevronDown class={cn(accordionHierarchyIconClass, iconClass)} aria-hidden="true" />
					{:else}
						<ChevronRight class={cn(accordionHierarchyIconClass, iconClass)} aria-hidden="true" />
					{/if}
				{/if}

				<div class={accordionHierarchyTriggerHeadingClass}>
					<div class={cn(accordionHierarchyTriggerTitleClass, triggerTitleClass)}>{item.label}</div>
					{#if item.description}
						<div class={accordionHierarchyTriggerSubtitleClass}>{item.description}</div>
					{/if}
				</div>

				{#if item.badge}
					<span class={getBadgeClass(item.badgeTone, item.badgeClass)}>
						{item.badge}
					</span>
				{/if}

				{#if chevronPlacement === 'end'}
					{#if itemExpanded}
						<ChevronUp class={cn(accordionHierarchyIconClass, iconClass)} aria-hidden="true" />
					{:else}
						<ChevronDown class={cn(accordionHierarchyIconClass, iconClass)} aria-hidden="true" />
					{/if}
				{/if}
			</button>

			<div
				id={itemPanelId}
				role="region"
				aria-labelledby={itemTriggerId}
				class={accordionHierarchyContentWrapperClass(itemExpanded)}
			>
				<div class={accordionHierarchyContentInnerClass}>
					{#if itemExpanded || everOpenedItems.has(item.value)}
						{#if item.groups.length === 0}
							<p class={accordionHierarchyEmptyLabelClass}>
								{item.emptyLabel ?? 'No items available'}
							</p>
						{:else}
							<div class={accordionHierarchyGroupListClass}>
								{#each item.groups as group (group.value)}
									{@const groupExpanded = isGroupOpen(item.value, group.value)}
									{@const groupKey = groupMountKey(item.value, group.value)}
									{@const groupTriggerId = `${fallbackId}-group-trigger-${item.value}-${group.value}`}
									{@const groupPanelId = `${fallbackId}-group-panel-${item.value}-${group.value}`}
									{@const groupSelected = selectedGroupKeys.includes(group.value)}
									<div
										class={cn(
											accordionHierarchyGroupItemClass,
											!isGroupSelectable(group) && 'opacity-50',
											groupClass
										)}
									>
										<div class={cn(accordionHierarchyGroupTriggerClass, groupTriggerClass)}>
											{#if groupSelectionEnabled}
												<Checkbox
													checked={groupSelected}
													disabled={!isGroupSelectable(group)}
													onCheckedChange={(checked) => handleGroupSelection(group, checked)}
													aria-label="Select {group.label}"
												/>
											{/if}

											<button
												type="button"
												id={groupTriggerId}
												class="flex min-w-0 flex-1 items-start justify-between gap-4 text-left"
												aria-expanded={groupExpanded}
												aria-controls={groupPanelId}
												disabled={group.disabled}
												onclick={() => toggleGroup(item, group)}
											>
												<div class="min-w-0 space-y-0.5">
													<p class="text-[15px] font-bold text-foreground">{group.label}</p>
													{#if group.description}
														<p class="text-[13px] text-muted-foreground">{group.description}</p>
													{/if}
												</div>

												<div class="flex shrink-0 items-center gap-3">
													{#if group.badge}
														<span class={getBadgeClass(group.badgeTone, group.badgeClass)}>
															{group.badge}
														</span>
													{/if}
													{#if groupExpanded}
														<ChevronUp
															class={cn(accordionHierarchyIconClass, iconClass)}
															aria-hidden="true"
														/>
													{:else}
														<ChevronDown
															class={cn(accordionHierarchyIconClass, iconClass)}
															aria-hidden="true"
														/>
													{/if}
												</div>
											</button>
										</div>

										<div
											id={groupPanelId}
											role="region"
											aria-labelledby={groupTriggerId}
											class={accordionHierarchyContentWrapperClass(groupExpanded)}
										>
											<div class={accordionHierarchyContentInnerClass}>
												{#if groupExpanded || everOpenedGroups.has(groupKey)}
													<div class={accordionHierarchyGroupPanelClass}>
														{#each group.tables as table, tableIndex (`${group.value}-table-${tableIndex}`)}
															{#if table.rows.length > 0}
																<div class="space-y-3">
																	{#if table.title}
																		<h4 class={accordionHierarchyTableTitleClass}>{table.title}</h4>
																	{/if}
																	<DataTable
																		{columns}
																		rows={table.rows}
																		{rowKey}
																		{search}
																		{pagination}
																		{sorting}
																		{filtering}
																		{selection}
																		bind:selectedRowKeys
																		onRowClick={(row) => onRowClick?.(row, group, item)}
																		{shellClass}
																		{tableClass}
																		{theadClass}
																		{tbodyClass}
																		{rowClass}
																		{headerCellClass}
																		{cellClass}
																		{stickyHeader}
																		{maxHeight}
																	/>
																</div>
															{/if}
														{/each}
														{#if group.footer}
															<p class={accordionHierarchyTableFooterClass}>{group.footer}</p>
														{/if}
													</div>
												{/if}
											</div>
										</div>
									</div>
								{/each}
							</div>
						{/if}
					{/if}
				</div>
			</div>
		</div>
	{/each}
</div>
