<script lang="ts">
	import type { Component } from 'svelte';
	import { cn } from '$lib/utils/cn';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { cardContentClass, cardShellClasses } from './card.styles';
	import { kpiCardCellClass, kpiCardCellContentClass } from './kpi-card.styles';

	type Props = {
		label: string;
		value: string;
		/** Shows a skeleton in place of the value while it loads. */
		loading?: boolean;
		trend?: string;
		valueTitle?: string;
		icon: Component;
		index?: number;
		columns?: number;
		class?: string;
		valueClass?: string;
	};

	let {
		label,
		value,
		trend,
		valueTitle,
		icon: Icon,
		index,
		columns = 4,
		class: className = '',
		valueClass = '',
		loading = false
	}: Props = $props();

	const isStripCell = $derived(index !== undefined);
	const dividerClass = $derived(isStripCell ? kpiCardCellClass(index!, columns) : '');
</script>

<div
	class={cn(
		isStripCell
			? cn(kpiCardCellContentClass, dividerClass, className)
			: cardShellClasses('default', cn('min-w-0', className))
	)}
>
	<div class={cn(!isStripCell && cardContentClass, !isStripCell && 'py-4')}>
		<div class="flex min-w-0 items-center gap-2 truncate text-sm text-muted-foreground">
			<Icon class="size-4 shrink-0" aria-hidden="true" />
			<span class="truncate">{label}</span>
		</div>

		{#if loading}
			<Skeleton class="mt-3 h-6 w-24" />
		{:else}
			<p
				class={cn(
					'mt-3 truncate font-heading text-xl leading-snug font-semibold text-foreground',
					valueClass
				)}
				title={valueTitle}
			>
				<span class="truncate" aria-label={value} title={value}>{value}</span>
			</p>
		{/if}
		{#if trend}
			<p class="mt-1 text-xs text-muted-foreground">{trend}</p>
		{/if}
	</div>
</div>
