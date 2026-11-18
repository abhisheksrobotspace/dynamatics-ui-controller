<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils/cn';
	import {
		statusMetricCardClass,
		statusMetricCardLabelClass,
		statusMetricCardValueClass
	} from './status-metric-card.styles';
	import type { StatusMetricCardTone } from './status-metric-card.types';

	type Props = {
		value: string;
		label: string;
		tone?: StatusMetricCardTone;
		class?: string;
		valueClass?: string;
		labelClass?: string;
	} & HTMLAttributes<HTMLDivElement>;

	let {
		value,
		label,
		tone = 'online',
		class: className = '',
		valueClass = '',
		labelClass = '',
		...rest
	}: Props = $props();

	const rootClasses = $derived(statusMetricCardClass(tone, className));
	const valueClasses = $derived(cn(statusMetricCardValueClass, valueClass));
	const labelClasses = $derived(cn(statusMetricCardLabelClass, labelClass));
</script>

<div class={rootClasses} {...rest}>
	<p class={valueClasses}>{value}</p>
	<p class={labelClasses}>{label}</p>
</div>
