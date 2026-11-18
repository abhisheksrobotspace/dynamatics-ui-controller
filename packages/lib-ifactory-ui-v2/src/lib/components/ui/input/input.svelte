<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';
	import { inputClasses, type InputSize, type InputVariant } from './input.styles';

	type Props = {
		ref?: HTMLInputElement | null;
		variant?: InputVariant;
		size?: InputSize;
		error?: boolean;
		class?: string;
	} & Omit<HTMLInputAttributes, 'size'>;

	let {
		ref = $bindable(null),
		value = $bindable(),
		variant = 'default',
		size = 'md',
		error = false,
		class: className = '',
		...rest
	}: Props = $props();

	const classes = $derived(inputClasses(variant, size, error, className));
</script>

<input bind:this={ref} bind:value class={classes} {...rest} />
