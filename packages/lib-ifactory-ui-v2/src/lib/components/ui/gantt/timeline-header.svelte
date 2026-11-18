<script lang="ts">
	import { ganttState } from '$lib/gantt/state.svelte';
	import { getTimelineTicks, type TimelineVisibleWindow } from '$lib/gantt/timeline.utils';

	let { visible = null as TimelineVisibleWindow | null } = $props();

	let ticks = $derived(getTimelineTicks(undefined, undefined, undefined, visible));
</script>

<div
	class="relative h-11 shrink-0 overflow-hidden border-b border-border bg-[#F4F4F5]"
	style="width: {ganttState.totalWidth}px;"
>
	{#each ticks as tick (tick.time)}
		<div
			class="pointer-events-none absolute top-0 bottom-0 border-l border-border px-2 py-3 text-[11px] font-bold text-foreground select-none"
			style="left: {tick.x}px;"
		>
			{tick.label}
		</div>
	{/each}
</div>
