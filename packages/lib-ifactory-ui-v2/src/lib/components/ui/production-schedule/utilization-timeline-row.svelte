<script lang="ts">
	import { ganttState } from '$lib/gantt/state.svelte';
	import { getTimelineTicks, type TimelineVisibleWindow } from '$lib/gantt/timeline.utils';
	import type { UtilizationSegment } from './production-schedule.utils';

	type Props = {
		segments?: UtilizationSegment[];
		color?: string;
		groupId?: string;
		rowHeight?: number;
		/** Full chart width (scroll extent) — kept for layout; SVG paints only the visible window. */
		chartWidth?: number;
		visible?: TimelineVisibleWindow | null;
	};

	let {
		segments = [],
		color = '#94A3B8',
		groupId = 'group',
		rowHeight = 80,
		chartWidth = 0,
		visible = null
	}: Props = $props();

	const fullWidth = $derived(chartWidth > 0 ? chartWidth : ganttState.totalWidth);
	const gradientId = $derived(`util-fill-${groupId}`);
	const ticks = $derived(getTimelineTicks(undefined, undefined, undefined, visible));

	const winLeft = $derived(visible?.xMin ?? 0);
	const winWidth = $derived(
		visible != null ? Math.max(1, visible.xMax - visible.xMin) : Math.max(1, fullWidth)
	);

	const visibleSegments = $derived.by(() => {
		if (!visible) return segments;
		const zoom = Math.max(ganttState.zoom, 1e-6);
		const tMin = ganttState.viewportStart + (visible.xMin / zoom) * 60_000;
		const tMax = ganttState.viewportStart + (visible.xMax / zoom) * 60_000;
		return segments.filter((seg) => seg.endMs >= tMin && seg.startMs <= tMax);
	});

	const gridLines = [0, 0.25, 0.5, 0.75, 1];

	function barHeight(ratio: number): number {
		return ratio * rowHeight;
	}
</script>

<div class="relative block shrink-0" style="width: {fullWidth}px; height: {rowHeight}px;">
	<svg
		class="absolute top-0 block"
		style="left: {winLeft}px;"
		width={winWidth}
		height={rowHeight}
		viewBox="0 0 {winWidth} {rowHeight}"
		preserveAspectRatio="none"
		aria-hidden="true"
	>
		<defs>
			<linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
				<stop offset="0%" stop-color={color} stop-opacity="0.45" />
				<stop offset="100%" stop-color={color} stop-opacity="0.12" />
			</linearGradient>
		</defs>

		{#each ticks as tick (tick.time)}
			{@const x = tick.x - winLeft}
			<line x1={x} y1="0" x2={x} y2={rowHeight} stroke="#E4E4E7" stroke-width="1" />
		{/each}

		{#each gridLines as level (level)}
			{@const y = rowHeight - level * rowHeight}
			<line x1="0" y1={y} x2={winWidth} y2={y} stroke="#E4E4E7" stroke-width="1" />
		{/each}

		{#each visibleSegments as seg, index (index)}
			{@const absX = ganttState.timeToX(seg.startMs)}
			{@const w = Math.max(0, ganttState.timeToX(seg.endMs) - absX)}
			{@const x = absX - winLeft}
			{@const h = barHeight(seg.ratio)}
			{#if w > 0 && h > 0}
				<rect
					{x}
					y={rowHeight - h}
					width={w}
					height={h}
					fill="url(#{gradientId})"
					stroke={color}
					stroke-width="0.5"
					stroke-opacity="0.35"
				/>
			{/if}
		{/each}

		<line x1="0" y1={rowHeight} x2={winWidth} y2={rowHeight} stroke="#E4E4E7" stroke-width="1" />
	</svg>
</div>
