<script lang="ts">
	import type { HTMLTextareaAttributes } from 'svelte/elements';
	import { textareaClasses, type TextareaSize, type TextareaVariant } from './textarea.styles';

	type Props = {
		ref?: HTMLTextAreaElement | null;
		variant?: TextareaVariant;
		size?: TextareaSize;
		error?: boolean;
		class?: string;
	} & HTMLTextareaAttributes;

	let {
		ref = $bindable(null),
		value = $bindable(),
		variant = 'default',
		size = 'md',
		error = false,
		class: className = '',
		...rest
	}: Props = $props();

	const classes = $derived(textareaClasses(variant, size, error, className));
</script>

<textarea bind:this={ref} bind:value class={classes} {...rest}></textarea>
