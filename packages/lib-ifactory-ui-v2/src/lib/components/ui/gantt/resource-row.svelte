<script lang="ts">
	import TaskBlock from './task-block.svelte';
	import DowntimeBlock from './downtime-block.svelte';
	import type { ScheduledJob, Downtime } from '$lib/gantt/aps-types';
	import { ganttState } from '$lib/gantt/state.svelte';
	import type { TimelineVisibleWindow } from '$lib/gantt/timeline.utils';

	let {
		resource,
		jobs = [] as ScheduledJob[],
		downtimes = [] as Downtime[],
		onJobClick = undefined,
		onJobContextMenu = undefined,
		selectedOrder,
		highlightedOrderIds = null as string[] | null,
		editMode = false,
		showBottomBorder = true,
		visible = null as TimelineVisibleWindow | null
	} = $props();

	const visibleTime = $derived.by(() => {
		if (!visible) return null;
		const zoom = Math.max(ganttState.zoom, 1e-6);
		return {
			tMin: ganttState.viewportStart + (visible.xMin / zoom) * 60_000,
			tMax: ganttState.viewportStart + (visible.xMax / zoom) * 60_000
		};
	});

	// Filter jobs for this specific machine (and cull off-screen when zoomed)
	const rowJobs = $derived(jobs.filter((j) => j.machine_id === resource.machine_id));
	const rowDowntimes = $derived(downtimes.filter((d) => d.machine_id === resource.machine_id));

	let myJobs = $derived.by(() => {
		if (!visibleTime) return rowJobs;
		const { tMin, tMax } = visibleTime;
		return rowJobs.filter((j) => {
			const setupMs = (j.setup_time || 0) * 1000;
			return j.end >= tMin && j.start - setupMs <= tMax;
		});
	});

	let myDowntimes = $derived.by(() => {
		if (!visibleTime) return rowDowntimes;
		const { tMin, tMax } = visibleTime;
		return rowDowntimes.filter((d) => d.end >= tMin && d.start <= tMax);
	});
</script>

<div
	class={['group relative hover:bg-muted/10', showBottomBorder ? 'border-b border-border' : '']}
	style="height: {ganttState.ROW_HEIGHT}px;"
>
	{#if rowJobs.length === 0 && rowDowntimes.length === 0}
		<p
			class="pointer-events-none absolute inset-0 flex items-center px-3 text-xs text-muted-foreground"
		>
			No load
		</p>
	{/if}

	{#each myDowntimes as dt (dt.machine_id + '-' + dt.start + '-' + dt.end)}
		<DowntimeBlock downtime={dt} />
	{/each}

	{#each myJobs as job (job.task_uid ?? job.order_id + '-' + job.node_id)}
		<TaskBlock
			{job}
			onclick={onJobClick}
			oncontextmenu={onJobContextMenu}
			{selectedOrder}
			{highlightedOrderIds}
			{editMode}
		/>
	{/each}
</div>
