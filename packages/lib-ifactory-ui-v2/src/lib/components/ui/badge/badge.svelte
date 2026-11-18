<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils/cn';

	type Variant = 'default' | 'secondary' | 'outline' | 'online' | 'error' | 'loading' | 'offline';

	type Props = {
		variant?: Variant;
		label?: string;
		dot?: boolean;
		class?: string;
	} & HTMLAttributes<HTMLSpanElement>;

	const statusVariants: Variant[] = ['online', 'error', 'loading', 'offline'];

	let { variant = 'default', label, dot, class: className = '', ...rest }: Props = $props();

	const showDot = $derived(dot ?? statusVariants.includes(variant));

	const classes = $derived(
		cn(
			'inline-flex items-center gap-1.5 text-xs font-medium',
			{
				'px-2.5 py-1': statusVariants.includes(variant) || showDot,
				'px-2 py-0.5': !statusVariants.includes(variant) && !showDot,
				'bg-primary/10 text-primary': variant === 'default',
				'bg-foreground/5 text-muted-foreground': variant === 'secondary',
				'border border-border bg-background text-foreground': variant === 'outline',
				'bg-status-online-badge text-status-online': variant === 'online',
				'bg-status-error-badge text-status-error': variant === 'error',
				'bg-status-loading-badge text-status-loading': variant === 'loading',
				'bg-status-offline-badge text-status-offline': variant === 'offline'
			},
			className
		)
	);

	const dotClass = $derived(
		cn('size-1.5 shrink-0 rounded-full', {
			'bg-primary': variant === 'default',
			'bg-status-online': variant === 'online',
			'bg-status-error': variant === 'error',
			'bg-status-loading': variant === 'loading',
			'bg-status-offline': variant === 'offline'
		})
	);
</script>

<span class={classes} {...rest}>
	{#if showDot}
		<span class={dotClass} aria-hidden="true"></span>
	{/if}
	{#if label}
		{label}
	{/if}
</span>
