<script lang="ts">
	import type { Component } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import { ChevronRight } from '@lucide/svelte';
	import { cn } from '$lib/utils/cn';
	import {
		listRowClass,
		listRowLeadingClass,
		listRowLabelClass,
		listRowTrailingClass
	} from './list-row.styles';

	type Props = {
		label: string;
		labelClass?: string;
		leadingIcon?: Component<{ class?: string }>;
		leadingIconClass?: string;
		trailingIcon?: Component<{ class?: string }>;
		trailingIconClass?: string;
		showChevron?: boolean;
		chevronClass?: string;
		disabled?: boolean;
		class?: string;
	} & HTMLButtonAttributes;

	let {
		label,
		labelClass = '',
		leadingIcon: LeadingIcon,
		leadingIconClass = '',
		trailingIcon: TrailingIcon,
		trailingIconClass = '',
		showChevron = true,
		chevronClass = '',
		disabled = false,
		class: className = '',
		type = 'button',
		...rest
	}: Props = $props();

	const leadingIconClasses = $derived(cn('size-5 sm:size-6', leadingIconClass));
	const trailingIconClasses = $derived(cn('size-4 text-muted', trailingIconClass));
	const chevronClasses = $derived(cn('size-6 text-muted', chevronClass));
</script>

<button {type} {disabled} class={listRowClass(className, disabled)} {...rest}>
	{#if LeadingIcon}
		<div class={listRowLeadingClass}>
			<LeadingIcon class={leadingIconClasses} aria-hidden="true" />
		</div>
	{/if}

	<span class={cn(listRowLabelClass, labelClass)}>{label}</span>

	{#if TrailingIcon || showChevron}
		<div class={listRowTrailingClass}>
			{#if TrailingIcon}
				<TrailingIcon class={trailingIconClasses} aria-hidden="true" />
			{/if}
			{#if showChevron}
				<ChevronRight class={chevronClasses} aria-hidden="true" />
			{/if}
		</div>
	{/if}
</button>
