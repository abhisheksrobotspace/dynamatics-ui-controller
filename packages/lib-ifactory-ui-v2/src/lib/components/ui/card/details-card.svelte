<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils/cn';
	import {
		detailsCardCaptionClass,
		detailsCardClass,
		detailsCardItemClass,
		detailsCardLabelClass,
		detailsCardPanelClass,
		detailsCardValueClass
	} from './details-card.styles';
	import type { DetailsCardColumns, DetailsCardItem } from './details-card.types';

	type Props = {
		items: DetailsCardItem[];
		columns?: DetailsCardColumns;
		caption?: string;
		class?: string;
		captionClass?: string;
		panelClass?: string;
		itemClass?: string;
		labelClass?: string;
		valueClass?: string;
	} & HTMLAttributes<HTMLDivElement>;

	let {
		items,
		columns = 2,
		caption,
		class: className = '',
		captionClass = '',
		panelClass = '',
		itemClass = '',
		labelClass = '',
		valueClass = '',
		...rest
	}: Props = $props();

	const rootClasses = $derived(detailsCardClass(className));
	const captionClasses = $derived(cn(detailsCardCaptionClass, captionClass));
	const panelClasses = $derived(detailsCardPanelClass(columns, panelClass));
	const itemClasses = $derived(cn(detailsCardItemClass, itemClass));
	const labelClasses = $derived(cn(detailsCardLabelClass, labelClass));
	const valueClasses = $derived(cn(detailsCardValueClass, valueClass));
</script>

<div class={rootClasses} {...rest}>
	{#if caption}
		<p class={captionClasses}>{caption}</p>
	{/if}
	<div class={panelClasses} role="group" aria-label={caption || undefined}>
		{#each items as item, index (item.label + index)}
			<div class={itemClasses}>
				<span class={labelClasses}>{item.label}</span>
				<span class={valueClasses}>{item.value}</span>
			</div>
		{/each}
	</div>
</div>
