<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils/cn';

	type Props = {
		text?: string;
		for?: string;
		required?: boolean;
		class?: string;
	} & HTMLAttributes<HTMLLabelElement>;

	let { text, for: htmlFor, required = false, class: className = '', ...rest }: Props = $props();

	const classes = $derived(cn('text-sm font-medium text-foreground', className));
</script>

<label class={classes} for={htmlFor} {...rest}>
	{#if text}
		{text}
	{/if}
	{#if required}
		<span class="text-status-error" aria-hidden="true">*</span>
		<span class="sr-only">(required)</span>
	{/if}
</label>
