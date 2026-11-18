<script lang="ts">
	import { cn } from '$lib/utils/cn';
	import FilterCard from './filter-card.svelte';
	import {
		filterCardStripClassFor,
		type FilterCardStripBreakpoint,
		type FilterCardStripLayout
	} from './filter-card.styles';
	import type { FilterCardItem } from './filter-card.types';

	type Props = {
		items: FilterCardItem[];
		value?: string;
		onValueChange?: (id: string) => void;
		class?: string;
		clickable?: boolean;
		/**
		 * Columns below `wideMinWidth`. Default 3.
		 * Example: `columns={3}` → 3-per-row until the wide breakpoint.
		 */
		columns?: number;
		/**
		 * Columns at/above `wideMinWidth`. Default = `items.length` (capped at 6).
		 * Example: `wideColumns={6}` → one row of six on wide screens.
		 */
		wideColumns?: number;
		/**
		 * Min viewport width (px) for the wide layout. Default 1441 (≤1440 keeps `columns`).
		 * Allowed: 1025 | 1281 | 1441.
		 */
		wideMinWidth?: FilterCardStripBreakpoint;
	};

	let {
		items,
		value = $bindable(),
		onValueChange,
		class: className = '',
		clickable = true,
		columns = 3,
		wideColumns,
		wideMinWidth = 1441
	}: Props = $props();

	const layout = $derived.by((): Required<FilterCardStripLayout> => ({
		columns,
		wideColumns: wideColumns ?? Math.min(6, Math.max(1, items.length)),
		wideMinWidth
	}));

	const stripClass = $derived(cn(filterCardStripClassFor(layout), className));

	function isClickable(item: FilterCardItem) {
		return item.clickable ?? clickable;
	}

	function select(id: string) {
		value = id;
		onValueChange?.(id);
	}
</script>

<div class={stripClass}>
	{#each items as item, index (item.id)}
		{@const itemClickable = isClickable(item)}
		<FilterCard
			label={item.label}
			value={item.count}
			icon={item.icon}
			selected={itemClickable && value === item.id}
			{index}
			{layout}
			clickable={itemClickable}
			onclick={itemClickable ? () => select(item.id) : undefined}
		/>
	{/each}
</div>
