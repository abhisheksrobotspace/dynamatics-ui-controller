<script lang="ts">
	import { ganttState } from '$lib/gantt/state.svelte';
	import { getTimelineTicks, type TimelineVisibleWindow } from '$lib/gantt/timeline.utils';

	let { visible = null as TimelineVisibleWindow | null } = $props();

	const ticks = $derived(getTimelineTicks(undefined, undefined, undefined, visible).slice(1));
</script>

<div class="pointer-events-none absolute inset-0 z-0" style="width: {ganttState.totalWidth}px;">
	{#each ticks as tick (tick.time)}
		<div class="absolute top-0 bottom-0 border-l border-border/30" style="left: {tick.x}px;"></div>
	{/each}
</div>
