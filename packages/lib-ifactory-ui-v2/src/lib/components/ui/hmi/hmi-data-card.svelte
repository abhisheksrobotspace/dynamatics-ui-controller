<script lang="ts">
	import type { Component, Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils/cn';
	import type { HmiTone } from './hmi.constants';
	import {
		hmiDataCardClass,
		hmiDataCardIconClass,
		hmiDataCardLabelClass,
		hmiDataCardTileClass,
		hmiDataCardUnitClass,
		hmiDataCardValueClass,
		hmiDataCardValueRowClass
	} from './hmi.styles';

	type Props = {
		label: string;
		value: string | number;
		/** Smaller, muted suffix next to the value (pcs, mm, / 40 pcs). */
		unit?: string;
		/** Coloured icon tile on the left (e.g. Uptime / Downtime). */
		icon?: Component<{ class?: string; strokeWidth?: number }>;
		iconTone?: HmiTone;
		class?: string;
		labelClass?: string;
		valueClass?: string;
		unitClass?: string;
		iconTileClass?: string;
		/** Extra content below the value row (progress bar, caption). */
		children?: Snippet;
	} & HTMLAttributes<HTMLDivElement>;

	let {
		label,
		value,
		unit,
		icon: Icon,
		iconTone = 'go',
		class: className = '',
		labelClass = '',
		valueClass = '',
		unitClass = '',
		iconTileClass = '',
		children,
		...rest
	}: Props = $props();

	const hasIcon = $derived(Boolean(Icon));
</script>

{#snippet body()}
	<p class={hmiDataCardLabelClass(hasIcon, labelClass)}>{label}</p>
	<div class={hmiDataCardValueRowClass}>
		<span class={hmiDataCardValueClass(hasIcon, valueClass)}>{value}</span>
		{#if unit}
			<span class={cn(hmiDataCardUnitClass, unitClass)}>{unit}</span>
		{/if}
	</div>
	{@render children?.()}
{/snippet}

<div class={hmiDataCardClass(hasIcon, className)} {...rest}>
	{#if Icon}
		<div class={hmiDataCardTileClass(iconTone, iconTileClass)}>
			<Icon class={hmiDataCardIconClass} strokeWidth={2.5} />
		</div>
		<div class="flex min-w-0 flex-1 flex-col">
			{@render body()}
		</div>
	{:else}
		{@render body()}
	{/if}
</div>
