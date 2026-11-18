<script lang="ts">
	import type { Component } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils/cn';
	import {
		filterCardButtonClass,
		filterCardCellClass,
		type FilterCardStripLayout
	} from './filter-card.styles';

	type Props = {
		label: string;
		value: string | number;
		icon?: Component;
		selected?: boolean;
		/** Position in a filter strip; applies responsive divider borders when set. */
		index?: number;
		/** Same layout object as FilterCardStrip (columns / wideColumns / wideMinWidth). */
		layout?: FilterCardStripLayout;
		/**
		 * @deprecated Prefer `layout.wideColumns`. Large-screen column count for divider math.
		 */
		lgCols?: number;
		/** When false, the card is display-only. Default true. */
		clickable?: boolean;
		class?: string;
	} & HTMLButtonAttributes;

	let {
		label,
		value,
		icon: Icon,
		selected = false,
		index,
		layout,
		lgCols = 5,
		clickable = true,
		class: className = '',
		onclick,
		...rest
	}: Props = $props();

	const dividerClass = $derived(
		index === undefined ? '' : filterCardCellClass(index, layout ?? { wideColumns: lgCols })
	);
	const classes = $derived(
		cn(filterCardButtonClass(selected, '', clickable), dividerClass, className)
	);
</script>

<button
	type="button"
	aria-pressed={clickable ? selected : undefined}
	aria-disabled={clickable ? undefined : true}
	tabindex={clickable ? undefined : -1}
	class={classes}
	onclick={clickable ? onclick : undefined}
	{...rest}
>
	<div class="flex items-center gap-2 text-sm text-muted-foreground">
		{#if typeof Icon === 'function'}
			<Icon class="size-4 shrink-0" aria-hidden="true" />
		{/if}
		<span>{label}</span>
	</div>
	<p class="mt-3 font-heading text-xl leading-snug font-semibold text-foreground">
		{value}
	</p>
</button>
