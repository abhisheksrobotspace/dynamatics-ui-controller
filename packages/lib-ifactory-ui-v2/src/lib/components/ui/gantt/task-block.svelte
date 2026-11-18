<script lang="ts">
	import { ganttState } from '$lib/gantt/state.svelte';
	import { cn } from '$lib/utils/cn';
	import { Lock } from '@lucide/svelte';

	let {
		job,
		onclick,
		oncontextmenu,
		highlightedOrderIds = null as string[] | null,
		editMode = false
	} = $props();

	let isLocked = $derived(ganttState.lockedTasks.has(ganttState.getJobId(job)) || job.isFixed);

	let setupOffset = $derived((job.setup_time || 0) * 1000);

	let prodStartX = $derived(ganttState.timeToX(job.start));
	let setupStartX = $derived(ganttState.timeToX(job.start - setupOffset));

	let totalX = $derived(setupStartX);
	let totalW = $derived(ganttState.timeToX(job.end) - setupStartX);

	let setupW = $derived(prodStartX - setupStartX);
	let inHighlightedSet = $derived(
		highlightedOrderIds === null ||
			(job.highlightIds?.length ? job.highlightIds : [job.order_id]).some((id: string) =>
				highlightedOrderIds.includes(id)
			)
	);

	let label = $derived(job.order_number);

	let pointerDownX = 0;

	function handleContextMenu(e: MouseEvent) {
		if (!editMode) return;
		e.preventDefault();
		e.stopPropagation();
		oncontextmenu?.(e, job);
	}

	function handleClick(e: MouseEvent) {
		// Ignore click if this was a drag (use local down-X — ganttState.dragStartX is only set in edit mode).
		if (Math.abs(e.clientX - pointerDownX) > 5) return;

		e.stopPropagation();
		onclick?.(job);
	}

	function handleMouseDown(e: MouseEvent) {
		pointerDownX = e.clientX;
		if (!editMode || isLocked) return;
		if (e.button !== 0) return;
		e.stopPropagation();

		if (ganttState.placingJob) return;

		ganttState.draggingJob = job;
		ganttState.dragStartX = e.clientX;
		ganttState.dragStartTime = job.start;
		ganttState.hasMoved = false;
		ganttState.dragSnapshot = null;
		ganttState.originalJobState = {
			start: job.start,
			end: job.end,
			machine_id: job.machine_id
		};
	}
</script>

<div
	class={cn(
		'absolute top-4 z-10 flex h-8 items-center overflow-hidden border border-white text-[10px] font-medium whitespace-nowrap text-white select-none',
		editMode && !isLocked ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
		(!inHighlightedSet || job.isDimmed) && 'opacity-20 grayscale'
	)}
	style="left: {totalX}px; width: {totalW}px;"
	onclick={handleClick}
	oncontextmenu={handleContextMenu}
	onmousedown={handleMouseDown}
	role="button"
	tabindex="0"
	onkeydown={(e) => {
		if (e.key === 'Enter') {
			e.stopPropagation();
			onclick?.(job);
		}
	}}
	title="{label} (Qty: {job.quantity}{job.setup_time ? `, Setup: ${job.setup_time}s` : ''})"
>
	{#if job.setup_time && job.setup_time > 0}
		<div
			class="h-full shrink-0 overflow-hidden"
			style="width: {setupW}px; background-color: #F59E0B; background-image: repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(0,0,0,0.12) 3px, rgba(0,0,0,0.12) 6px);"
		></div>
	{/if}

	<div
		class={cn(
			'flex h-full min-w-0 flex-1 items-center gap-1 overflow-hidden px-2',
			!job.color && 'bg-[#3B82F6]'
		)}
		style={job.color ? `background-color: ${job.color};` : ''}
	>
		<span class="truncate leading-tight">{label}</span>
		{#if isLocked}
			<Lock class="size-3 shrink-0" />
		{/if}
	</div>
</div>
