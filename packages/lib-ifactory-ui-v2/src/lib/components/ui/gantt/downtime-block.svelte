<script lang="ts">
	import { ganttState } from '$lib/gantt/state.svelte';
	import type { Downtime } from '$lib/gantt/aps-types';
	import { cn } from '$lib/utils/cn';

	let { downtime } = $props<{ downtime: Downtime }>();

	let x = $derived(ganttState.timeToX(downtime.start));
	let w = $derived(ganttState.timeToX(downtime.end) - x);

	function handleContextMenu(e: MouseEvent) {
		e.preventDefault();
		alert(
			`Downtime Details:\nType: ${downtime.type}\nReason: ${downtime.reason}\nStatus: ${downtime.status}\nStart: ${downtime.start_abs || downtime.start}\nEnd: ${downtime.end_abs || downtime.end}`
		);
	}
</script>

<div
	class={cn(
		'absolute top-1 bottom-1 z-0 flex items-center justify-center overflow-hidden border whitespace-nowrap opacity-90 select-none',
		downtime.type === 'MAINTENANCE'
			? 'border-orange-500 bg-orange-300 text-orange-900'
			: downtime.type === 'BREAKDOWN'
				? 'border-red-700 bg-red-500 text-white'
				: 'border-gray-600 bg-gray-400 text-gray-900'
	)}
	style="
    left: {x}px; 
    width: {w}px;
    {downtime.type === 'MAINTENANCE'
		? 'background-image: repeating-linear-gradient(45deg, rgba(255,165,0,0.3) 0px, rgba(255,165,0,0.3) 10px, transparent 10px, transparent 20px);'
		: ''}
  "
	oncontextmenu={handleContextMenu}
	title={`Type: ${downtime.type}\nReason: ${downtime.reason}\nStatus: ${downtime.status}`}
	role="presentation"
>
	{#if w > 40}
		<span class="truncate px-1 text-[10px] font-bold">{downtime.type}</span>
	{/if}
</div>
