<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils/cn';

	type Size = 'sm' | 'md' | 'lg';

	type Props = {
		src?: string;
		alt?: string;
		fallback?: string;
		size?: Size;
		class?: string;
	} & HTMLAttributes<HTMLSpanElement>;

	let {
		src,
		alt = '',
		fallback = '',
		size = 'md',
		class: className = '',
		...rest
	}: Props = $props();

	const initials = $derived(
		fallback
			.trim()
			.split(/\s+/)
			.map((part) => part[0])
			.join('')
			.slice(0, 2)
			.toUpperCase()
	);

	const classes = $derived(
		cn(
			'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-foreground/5 font-medium text-muted-foreground',
			{
				'size-6 text-xs': size === 'sm',
				'size-8 text-sm': size === 'md',
				'size-10 text-base': size === 'lg'
			},
			className
		)
	);
</script>

<span
	class={classes}
	role={src ? undefined : 'img'}
	aria-label={src ? undefined : alt || fallback || initials}
	{...rest}
>
	{#if src}
		<img class="size-full object-cover" {src} {alt} />
	{:else}
		{initials}
	{/if}
</span>
