<script lang="ts">
	import type { Component } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils/cn';
	import {
		reasonCardClass,
		reasonCardIconClass,
		reasonCardIndexClass,
		reasonCardLabelClass
	} from './reason-card.styles';
	import type { ReasonCardIconTone } from './reason-card.types';

	type Props = {
		label: string;
		/** Corner index / reason number (e.g. stoppage code). */
		index?: string | number;
		icon: Component<{ class?: string; strokeWidth?: number }>;
		iconTone?: ReasonCardIconTone;
		iconClass?: string;
		labelClass?: string;
		indexClass?: string;
		class?: string;
	} & HTMLButtonAttributes;

	let {
		label,
		index,
		icon: Icon,
		iconTone = 'primary',
		iconClass = '',
		labelClass = '',
		indexClass = '',
		class: className = '',
		type = 'button',
		...rest
	}: Props = $props();

	const rootClasses = $derived(reasonCardClass(className));
	const iconClasses = $derived(cn(reasonCardIconClass(iconTone), iconClass));
	const labelClasses = $derived(cn(reasonCardLabelClass, labelClass));
	const indexClasses = $derived(cn(reasonCardIndexClass, indexClass));
</script>

<button {type} class={rootClasses} {...rest}>
	{#if index !== undefined && index !== ''}
		<span class={indexClasses}>{index}</span>
	{/if}
	<Icon class={iconClasses} strokeWidth={2} aria-hidden="true" />
	<span class={labelClasses}>{label}</span>
</button>
