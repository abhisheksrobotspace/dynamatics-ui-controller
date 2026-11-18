<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { ChevronDown, ChevronUp } from '@lucide/svelte';
	import { cn } from '$lib/utils/cn';
	import type { AccordionItem, AccordionType } from './accordion.constants';
	import {
		accordionClass,
		accordionContentClass,
		accordionContentInnerClass,
		accordionContentWrapperClass,
		accordionIconClass,
		accordionItemClass,
		accordionTriggerClass,
		accordionTriggerTitleClass
	} from './accordion.styles';
	import { accordionValueFromOpenValues, normalizeAccordionValue } from './accordion.utils';

	type Props = {
		items: AccordionItem[];
		type?: AccordionType;
		value?: string | string[];
		collapsible?: boolean;
		onValueChange?: (value: string | string[]) => void;
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
		class: className = '',
		itemClass = '',
		triggerClass = '',
		contentClass = '',
		...rest
	}: Props = $props();

	const fallbackId = `accordion-${Math.random().toString(36).slice(2, 9)}`;

	const openValues = $derived(normalizeAccordionValue(value, type, items));

	function isOpen(itemValue: string): boolean {
		return openValues.includes(itemValue);
	}

	function setOpenValues(next: string[]) {
		const nextValue = accordionValueFromOpenValues(next, type);
		value = nextValue;
		onValueChange?.(nextValue);
	}

	function toggleItem(item: AccordionItem) {
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
</script>

<div class={cn(accordionClass, className)} {...rest}>
	{#each items as item (item.value)}
		{@const expanded = isOpen(item.value)}
		{@const triggerId = `${fallbackId}-trigger-${item.value}`}
		{@const panelId = `${fallbackId}-panel-${item.value}`}
		<div class={cn(accordionItemClass, itemClass)}>
			<button
				type="button"
				id={triggerId}
				class={cn(accordionTriggerClass, triggerClass)}
				aria-expanded={expanded}
				aria-controls={panelId}
				disabled={item.disabled}
				onclick={() => toggleItem(item)}
			>
				<span class={accordionTriggerTitleClass}>{item.title}</span>
				{#if expanded}
					<ChevronUp class={accordionIconClass} aria-hidden="true" />
				{:else}
					<ChevronDown class={accordionIconClass} aria-hidden="true" />
				{/if}
			</button>
			<div
				id={panelId}
				role="region"
				aria-labelledby={triggerId}
				class={accordionContentWrapperClass(expanded)}
			>
				<div class={accordionContentInnerClass}>
					<div class={cn(accordionContentClass, contentClass)}>{item.content}</div>
				</div>
			</div>
		</div>
	{/each}
</div>
