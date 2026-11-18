<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { SvelteMap } from 'svelte/reactivity';
	import { ChevronDown, ChevronRight, Search } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Input } from '$lib/components/ui/input';
	import { cn } from '$lib/utils/cn';
	import type { AccordionType } from '../accordion/accordion.constants';
	import {
		accordionValueFromOpenValues,
		normalizeAccordionValue
	} from '../accordion/accordion.utils';
	import type {
		AccordionWithContentCheckboxOption,
		AccordionWithContentItem
	} from './accordion-with-content.constants';
	import {
		accordionWithContentBadgeClass,
		accordionWithContentCheckboxClass,
		accordionWithContentCheckboxGridClass,
		accordionWithContentCheckboxLabelClass,
		accordionWithContentClass,
		accordionWithContentContentInnerClass,
		accordionWithContentContentWrapperClass,
		accordionWithContentDescriptionClass,
		accordionWithContentIconClass,
		accordionWithContentItemClass,
		accordionWithContentSearchClass,
		accordionWithContentSummaryClass,
		accordionWithContentTextClass,
		accordionWithContentToolbarClass,
		accordionWithContentTriggerClass,
		accordionWithContentTriggerMetaClass,
		accordionWithContentTriggerTitleClass,
		accordionWithContentTriggerTitleRowClass
	} from './accordion-with-content.styles';

	type Props = {
		items: AccordionWithContentItem[];
		type?: AccordionType;
		value?: string | string[];
		collapsible?: boolean;
		onValueChange?: (value: string | string[]) => void;
		onCheckboxChange?: (itemValue: string, optionValue: number, checked: boolean) => void;
		onCheckboxSelectAll?: (itemValue: string) => void;
		onCheckboxDeselectAll?: (itemValue: string) => void;
		onSectionCheckboxChange?: (itemValue: string, checked: boolean) => void;
		/** Button shown at the top of each expanded item. Needs `onItemAction` too. */
		itemActionLabel?: string;
		/** Called with the item value when the item action button is clicked. */
		onItemAction?: (itemValue: string) => void;
		/** Shows a search box above each item's checkboxes that filters them by label. */
		searchable?: boolean;
		searchPlaceholder?: string;
		class?: string;
		itemClass?: string;
		triggerClass?: string;
		contentClass?: string;
	} & HTMLAttributes<HTMLDivElement>;

	let {
		items,
		type = 'multiple',
		value = $bindable<string | string[] | undefined>(undefined),
		collapsible = true,
		onValueChange,
		onCheckboxChange,
		onCheckboxSelectAll,
		onCheckboxDeselectAll,
		onSectionCheckboxChange,
		itemActionLabel,
		onItemAction,
		searchable = false,
		searchPlaceholder = 'Search…',
		class: className = '',
		itemClass = '',
		triggerClass = '',
		contentClass = '',
		...rest
	}: Props = $props();

	/** Per-item search text; keyed by item value so each accordion keeps its own query. */
	const searchQueries = new SvelteMap<string, string>();

	const fallbackId = `accordion-with-content-${Math.random().toString(36).slice(2, 9)}`;
	const openValues = $derived(normalizeAccordionValue(value, type, items));

	function isOpen(itemValue: string): boolean {
		return openValues.includes(itemValue);
	}

	function setOpenValues(next: string[]) {
		const nextValue = accordionValueFromOpenValues(next, type);
		value = nextValue;
		onValueChange?.(nextValue);
	}

	function toggleItem(item: AccordionWithContentItem) {
		if (item.disabled) return;

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

	function getSelectedCheckboxValues(item: AccordionWithContentItem): number[] {
		return item.selectedCheckboxValues ?? [];
	}

	function isCheckboxChecked(item: AccordionWithContentItem, optionValue: number): boolean {
		return getSelectedCheckboxValues(item).includes(optionValue);
	}

	/** Matches ignoring thousands separators, so "6250" finds the "6,250" option. */
	function searchKey(text: string): string {
		return text.replace(/,/g, '').trim().toLowerCase();
	}

	function visibleCheckboxes(item: AccordionWithContentItem): AccordionWithContentCheckboxOption[] {
		const options = item.checkboxes ?? [];
		const query = searchKey(searchQueries.get(item.value) ?? '');
		if (!searchable || !query) return options;
		return options.filter((option) =>
			searchKey(option.label ?? String(option.value)).includes(query)
		);
	}

	function sectionCheckboxState(item: AccordionWithContentItem): {
		checked: boolean;
		indeterminate: boolean;
	} {
		const total = item.checkboxes?.length ?? 0;
		const selected = getSelectedCheckboxValues(item).length;

		return {
			checked: total > 0 && selected === total,
			indeterminate: selected > 0 && selected < total
		};
	}
</script>

<div class={cn(accordionWithContentClass, className)} {...rest}>
	{#each items as item (item.value)}
		{@const expanded = isOpen(item.value)}
		{@const triggerId = `${fallbackId}-trigger-${item.value}`}
		{@const panelId = `${fallbackId}-panel-${item.value}`}
		<div class={cn(accordionWithContentItemClass, itemClass)}>
			<div class="flex items-stretch">
				<button
					type="button"
					id={triggerId}
					class={cn(
						accordionWithContentTriggerClass,
						expanded && 'border-b border-border',
						'min-w-0 flex-1',
						triggerClass
					)}
					aria-expanded={expanded}
					aria-controls={panelId}
					disabled={item.disabled}
					onclick={() => toggleItem(item)}
				>
					{#if onSectionCheckboxChange && item.checkboxes?.length}
						{@const sectionState = sectionCheckboxState(item)}
						<div
							role="presentation"
							onclick={(event) => event.stopPropagation()}
							onkeydown={(event) => event.stopPropagation()}
						>
							<Checkbox
								checked={sectionState.checked}
								indeterminate={sectionState.indeterminate}
								size="sm"
								onCheckedChange={(checked) => onSectionCheckboxChange(item.value, checked)}
								aria-label="Select all stock lengths for {item.label}"
							/>
						</div>
					{/if}
					{#if expanded}
						<ChevronDown class={cn(accordionWithContentIconClass)} aria-hidden="true" />
					{:else}
						<ChevronRight class={cn(accordionWithContentIconClass)} aria-hidden="true" />
					{/if}
					<div class={accordionWithContentTriggerMetaClass}>
						<div class={accordionWithContentTriggerTitleRowClass}>
							<span class={accordionWithContentTriggerTitleClass}>{item.label}</span>
							{#if item.badge}
								<span class={accordionWithContentBadgeClass(item.badgeTone ?? 'primary')}
									>{item.badge}</span
								>
							{/if}
						</div>
						{#if item.description}
							<span class={accordionWithContentDescriptionClass}>{item.description}</span>
						{/if}
					</div>
					{#if item.summary}
						<span class={accordionWithContentSummaryClass}>{item.summary}</span>
					{/if}
				</button>
				{#if itemActionLabel && onItemAction}
					<div class="flex shrink-0 items-center px-3">
						<Button
							variant="outline"
							size="sm"
							class="rounded-none"
							label={itemActionLabel}
							disabled={item.disabled}
							onclick={() => onItemAction(item.value)}
						/>
					</div>
				{/if}
			</div>

			<div
				id={panelId}
				role="region"
				aria-labelledby={triggerId}
				class={accordionWithContentContentWrapperClass(expanded)}
			>
				<div class={accordionWithContentContentInnerClass}>
					{#if expanded}
						{#if item.checkboxes?.length}
							{@const query = searchQueries.get(item.value) ?? ''}
							{@const options = visibleCheckboxes(item)}
							{#if searchable}
								<div class={accordionWithContentSearchClass}>
									<div class="relative max-w-md">
										<Search
											class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
											aria-hidden="true"
										/>
										<Input
											value={query}
											oninput={(event) => searchQueries.set(item.value, event.currentTarget.value)}
											placeholder={searchPlaceholder}
											aria-label="Search {item.label} stock lengths"
											class="rounded-none pl-9"
										/>
									</div>
								</div>
							{/if}
							{#if (onCheckboxSelectAll || onCheckboxDeselectAll) && !onSectionCheckboxChange}
								<div class={accordionWithContentToolbarClass}>
									{#if onCheckboxSelectAll}
										<Button
											variant="outline"
											size="sm"
											class="rounded-none"
											label="Select all"
											onclick={() => onCheckboxSelectAll(item.value)}
										/>
									{/if}
									{#if onCheckboxDeselectAll}
										<Button
											variant="outline"
											size="sm"
											class="rounded-none"
											label="Deselect all"
											onclick={() => onCheckboxDeselectAll(item.value)}
										/>
									{/if}
								</div>
							{/if}
							{#if options.length === 0}
								<p class="p-5 text-sm text-muted-foreground">
									No stock lengths match “{query.trim()}”.
								</p>
							{:else}
								<div class={accordionWithContentCheckboxGridClass}>
									{#each options as option (option.value)}
										{@const checked = isCheckboxChecked(item, option.value)}
										<label class={accordionWithContentCheckboxLabelClass}>
											<Checkbox
												{checked}
												size="sm"
												class={accordionWithContentCheckboxClass}
												onCheckedChange={(nextChecked) =>
													onCheckboxChange?.(item.value, option.value, nextChecked)}
											/>
											<span>{option.label ?? option.value}</span>
										</label>
									{/each}
								</div>
							{/if}
						{:else if item.content}
							<div class={cn(accordionWithContentTextClass, contentClass)}>{item.content}</div>
						{/if}
					{/if}
				</div>
			</div>
		</div>
	{/each}
</div>
