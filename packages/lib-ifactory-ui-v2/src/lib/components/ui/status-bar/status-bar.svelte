<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import clsx from 'clsx';
	import { defaultStatusBarSegments, type StatusBarSegment } from './status-bar.constants';

	type StatusBarSize = 'default' | 'compact';

	type Props = {
		segments?: StatusBarSegment[];
		size?: StatusBarSize;
		class?: string;
	} & HTMLAttributes<HTMLDivElement>;

	let {
		segments = defaultStatusBarSegments,
		size = 'default',
		class: className = '',
		...rest
	}: Props = $props();

	const segmentClass: Record<StatusBarSegment, string> = {
		primary: 'bg-primary',
		online: 'bg-status-online',
		error: 'bg-status-error',
		loading: 'bg-status-loading',
		offline: 'bg-status-offline/35'
	};

	const containerClass = $derived(
		clsx('flex gap-1', size === 'compact' ? 'h-4 w-auto' : 'h-5 w-full', className)
	);

	const barClass = $derived(size === 'compact' ? 'h-4 w-1.5 shrink-0' : 'flex-1');
</script>

<div class={containerClass} {...rest}>
	{#each segments as segment, i (i)}
		<div class={clsx(barClass, segmentClass[segment])}></div>
	{/each}
</div>
