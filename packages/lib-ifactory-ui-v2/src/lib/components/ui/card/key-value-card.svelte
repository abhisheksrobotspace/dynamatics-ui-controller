<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils/cn';
	import {
		keyValueCardClass,
		keyValueCardLabelClass,
		keyValueCardValueClass
	} from './key-value-card.styles';

	type Props = {
		label: string;
		value: string;
		class?: string;
		labelClass?: string;
		valueClass?: string;
	} & HTMLAttributes<HTMLDivElement>;

	let {
		label,
		value,
		class: className = '',
		labelClass = '',
		valueClass = '',
		...rest
	}: Props = $props();

	const rootClasses = $derived(keyValueCardClass(className));
	const labelClasses = $derived(cn(keyValueCardLabelClass, labelClass));
	const valueClasses = $derived(cn(keyValueCardValueClass, valueClass));
</script>

<div class={rootClasses} {...rest}>
	<span class={labelClasses}>{label}</span>
	<span class={valueClasses}>{value}</span>
</div>
