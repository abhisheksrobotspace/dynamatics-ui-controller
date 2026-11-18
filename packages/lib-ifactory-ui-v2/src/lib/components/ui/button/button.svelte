<script lang="ts">
	import type { Component } from 'svelte';
	import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';
	import { Loader2 } from '@lucide/svelte';
	import { cn } from '$lib/utils/cn';

	type Variant = 'primary' | 'secondary' | 'outline' | 'ghost';
	type Size = 'sm' | 'md' | 'lg' | 'icon';

	type Props = {
		variant?: Variant;
		size?: Size;
		label?: string;
		icon?: Component<{ class?: string }>;
		iconPosition?: 'left' | 'right';
		iconClass?: string;
		class?: string;
		disabled?: boolean;
		loading?: boolean;
		href?: string;
		type?: HTMLButtonAttributes['type'];
	} & HTMLButtonAttributes &
		HTMLAnchorAttributes;

	let {
		variant = 'primary',
		size = 'md',
		label,
		icon: Icon,
		iconPosition = 'left',
		iconClass = '',
		class: className = '',
		disabled = false,
		loading = false,
		href,
		type = 'button',
		...rest
	}: Props = $props();

	const isDisabled = $derived(disabled || loading);
	const iconClasses = $derived(cn('size-4 shrink-0', iconClass));

	const classes = $derived(
		cn(
			'inline-flex cursor-pointer items-center justify-center gap-2 font-medium transition-colors',
			'focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none',
			// Keep pointer events so hover cursor and hit-testing work; without this, clicks pass
			// through disabled buttons to parents (e.g. DataTable row onClick).
			'disabled:cursor-not-allowed disabled:opacity-50',
			{
				'bg-primary text-white hover:bg-primary/90': variant === 'primary',
				'bg-foreground text-white hover:bg-foreground/90': variant === 'secondary',
				'border border-border bg-background text-foreground hover:bg-foreground/5':
					variant === 'outline',
				'text-foreground hover:bg-foreground/5': variant === 'ghost',
				'px-3 py-1.5 text-sm': size === 'sm',
				'px-4 py-2 text-sm': size === 'md',
				'px-5 py-2.5 text-base': size === 'lg',
				'size-9 p-0': size === 'icon'
			},
			className
		)
	);
</script>

{#if href && !isDisabled}
	<a {href} class={classes} {...rest}>
		{#if loading}
			<Loader2 class="size-4 shrink-0 animate-spin" aria-hidden="true" />
		{:else if Icon && iconPosition === 'left'}
			<Icon class={iconClasses} aria-hidden="true" />
		{/if}

		{#if label}
			{label}
		{/if}

		{#if !loading && Icon && iconPosition === 'right'}
			<Icon class={iconClasses} aria-hidden="true" />
		{/if}
	</a>
{:else}
	<button {type} disabled={isDisabled} class={classes} {...rest}>
		{#if loading}
			<Loader2 class="size-4 shrink-0 animate-spin" aria-hidden="true" />
		{:else if Icon && iconPosition === 'left'}
			<Icon class={iconClasses} aria-hidden="true" />
		{/if}

		{#if label}
			{label}
		{/if}

		{#if !loading && Icon && iconPosition === 'right'}
			<Icon class={iconClasses} aria-hidden="true" />
		{/if}
	</button>
{/if}
