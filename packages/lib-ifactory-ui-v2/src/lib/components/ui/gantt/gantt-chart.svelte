<script lang="ts">
	import { ganttState } from '$lib/gantt/state.svelte';
	import TimelineHeader from './timeline-header.svelte';
	import ResourceRow from './resource-row.svelte';
	import Grid from './grid.svelte';
	import DependencyArrows from './dependency-arrows.svelte';
	import { cn } from '$lib/utils/cn';
	import type { Machine, ScheduledJob, Downtime } from '$lib/gantt/aps-types';
	import { isTimeInScheduleSpan, zoomGanttKeepingView } from '$lib/gantt/gantt-data.utils';
	import { visiblePixelWindow, type TimelineVisibleWindow } from '$lib/gantt/timeline.utils';

	let {
		resources = [] as Machine[],
		jobs = [] as ScheduledJob[],
		downtimes = [] as Downtime[],
		edges = [] as { from: string; to: string }[],
		arrowOrderId = null as string | null,
		selectedOrder = 'all',
		highlightedOrderIds = null as string[] | null,
		class: className,
		onJobClick = undefined,
		onJobContextMenu = undefined,
		scrollLeft = $bindable(0),
		editMode = false,
		currentTimeMs = null as number | null
	} = $props();

	let scrollContainer = $state<HTMLDivElement>();
	let sidebarScrollArea = $state<HTMLDivElement>();
	let syncingScroll = false;
	let viewWidth = $state(1200);
	let zoomRaf = 0;

	const visible = $derived.by((): TimelineVisibleWindow =>
		visiblePixelWindow(scrollLeft, viewWidth)
	);

	$effect(() => {
		if (scrollContainer && scrollContainer.scrollLeft !== scrollLeft) {
			scrollContainer.scrollLeft = scrollLeft;
		}
	});

	$effect(() => {
		const el = scrollContainer;
		if (!el) return;
		const measure = () => {
			viewWidth = el.clientWidth || 1200;
		};
		measure();
		const ro = new ResizeObserver(measure);
		ro.observe(el);
		return () => ro.disconnect();
	});

	function syncSidebarScrollTop(top: number) {
		if (!sidebarScrollArea || syncingScroll) return;
		syncingScroll = true;
		sidebarScrollArea.scrollTop = top;
		syncingScroll = false;
	}

	function onScroll(e: Event) {
		const target = e.currentTarget as HTMLDivElement;
		scrollLeft = target.scrollLeft;
		syncSidebarScrollTop(target.scrollTop);
	}

	function handleSidebarWheel(e: WheelEvent) {
		if (e.ctrlKey) {
			handleWheel(e);
			return;
		}
		if (!scrollContainer) return;
		scrollContainer.scrollTop += e.deltaY;
		syncSidebarScrollTop(scrollContainer.scrollTop);
		e.preventDefault();
	}

	$effect(() => {
		ganttState.resources = resources;
	});

	function handleWheel(e: WheelEvent) {
		if (e.ctrlKey) {
			e.preventDefault();
			const delta = e.deltaY > 0 ? 0.9 : 1.1;
			const next = Math.max(0.1, Math.min(20, ganttState.zoom * delta));
			const rect = scrollContainer?.getBoundingClientRect();
			const anchorX =
				rect && scrollContainer ? e.clientX - rect.left + scrollContainer.scrollLeft : undefined;
			// Coalesce zoom storms; keep time under cursor (or view center) fixed.
			if (zoomRaf) cancelAnimationFrame(zoomRaf);
			zoomRaf = requestAnimationFrame(() => {
				zoomRaf = 0;
				scrollLeft = zoomGanttKeepingView(next, {
					scrollLeft,
					viewWidth,
					anchorX
				});
			});
		}
	}
	function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number) {
		return aStart < bEnd && aEnd > bStart;
	}

	function setupMs(job: ScheduledJob) {
		return (job.setup_time || 0) * 1000;
	}

	function syncLockedEntry(job: ScheduledJob) {
		const id = ganttState.getJobId(job);
		if (!ganttState.lockedTasks.has(id) && !job.isFixed) return;
		ganttState.lockedTasks.set(id, {
			start: job.start,
			end: job.end,
			machine_id: job.machine_id
		});
	}

	function applyDragWithPushAside(proposedMachineId: string, newStart: number, duration: number) {
		const dragging = ganttState.draggingJob;
		if (!dragging) return;

		if (ganttState.dragSnapshot) {
			ganttState.restoreDragSnapshot(jobs);
		}

		const minStart = ganttState.viewportStart + setupMs(dragging);
		const maxStart = Math.max(minStart, ganttState.viewportEnd - duration);
		let finalStart = Math.min(Math.max(newStart, minStart), maxStart);
		dragging.machine_id = proposedMachineId;

		const draggingId = ganttState.getJobId(dragging);

		const fixedObstacles: { start: number; end: number }[] = [];
		for (const dt of downtimes) {
			if (dt.machine_id === proposedMachineId) {
				fixedObstacles.push({ start: dt.start, end: dt.end });
			}
		}
		fixedObstacles.sort((a, b) => a.start - b.start);

		for (let pass = 0; pass < fixedObstacles.length + 1; pass++) {
			let moved = false;
			for (const obstacle of fixedObstacles) {
				if (!overlaps(finalStart, finalStart + duration, obstacle.start, obstacle.end)) continue;
				const distToLeft = finalStart + duration - obstacle.start;
				const distToRight = obstacle.end - finalStart;
				finalStart = distToLeft <= distToRight ? obstacle.start - duration : obstacle.end;
				moved = true;
			}
			if (!moved) break;
		}

		finalStart = Math.min(Math.max(finalStart, minStart), maxStart);
		dragging.start = finalStart;
		dragging.end = finalStart + duration;

		let changed = true;
		let guard = 0;
		while (changed && guard < jobs.length + 2) {
			guard += 1;
			changed = false;

			const rowJobs = jobs
				.filter((j) => j.machine_id === proposedMachineId)
				.sort((a, b) => a.start - b.start);

			for (const job of rowJobs) {
				if (ganttState.getJobId(job) === draggingId) continue;
				if (!overlaps(dragging.start, dragging.end, job.start, job.end)) continue;

				const jobDuration = job.end - job.start;
				job.start = dragging.end;
				job.end = job.start + jobDuration;
				syncLockedEntry(job);
				changed = true;
			}

			for (let i = 1; i < rowJobs.length; i++) {
				const prev = rowJobs[i - 1];
				const curr = rowJobs[i];
				if (ganttState.getJobId(curr) === draggingId) continue;
				if (!overlaps(prev.start, prev.end, curr.start, curr.end)) continue;
				const currDuration = curr.end - curr.start;
				curr.start = prev.end;
				curr.end = curr.start + currDuration;
				syncLockedEntry(curr);
				changed = true;
			}
		}
	}

	function handleWindowMouseMove(e: MouseEvent) {
		if (!ganttState.draggingJob) return;

		if (!ganttState.dragSnapshot) {
			ganttState.dragSnapshot = jobs.map((job) => ({
				id: ganttState.getJobId(job),
				start: job.start,
				end: job.end,
				machine_id: job.machine_id
			}));
		}

		const snap = ganttState.dragSnapshot?.find(
			(entry) => entry.id === ganttState.getJobId(ganttState.draggingJob)
		);
		const dragDuration = snap
			? snap.end - snap.start
			: ganttState.draggingJob.end - ganttState.draggingJob.start;

		let newStart: number;

		if (ganttState.placingJob && scrollContainer) {
			const rect = scrollContainer.getBoundingClientRect();
			const absoluteX = e.clientX - rect.left + scrollContainer.scrollLeft;
			const timeAtCursor = ganttState.xToTime(absoluteX);
			newStart = timeAtCursor - dragDuration / 2;
			ganttState.hasMoved = true;
		} else {
			const dx = e.clientX - ganttState.dragStartX;
			if (Math.abs(dx) > 5) {
				ganttState.hasMoved = true;
			}
			const dt = (dx / ganttState.zoom) * 60000;
			newStart = ganttState.dragStartTime + dt;
		}

		let proposedMachineId = ganttState.draggingJob.machine_id;
		if (scrollContainer) {
			const rect = scrollContainer.getBoundingClientRect();
			const relativeY = e.clientY - rect.top + scrollContainer.scrollTop;
			const contentOffsetY = 44;
			const yInGrid = relativeY - contentOffsetY;
			const rowIndex = Math.floor(yInGrid / ganttState.ROW_HEIGHT);
			const clampedIndex = Math.max(0, Math.min(rowIndex, resources.length - 1));

			if (resources.length > 0) {
				const targetMachine = resources[clampedIndex];
				const jobKey = ganttState.getJobId(ganttState.draggingJob);
				const validMachines = ganttState.validMachinesByJob.get(jobKey);
				if (!validMachines || validMachines.has(targetMachine.machine_id)) {
					proposedMachineId = targetMachine.machine_id;
				}
			}
		}

		applyDragWithPushAside(proposedMachineId, newStart, dragDuration);
	}

	function handleWindowMouseUp() {
		if (ganttState.draggingJob) {
			if (ganttState.hasMoved) {
				ganttState.confirmMoveJob = ganttState.draggingJob;
			}
			ganttState.draggingJob = null;
		}
	}

	const nowX = $derived(currentTimeMs != null ? ganttState.timeToX(currentTimeMs) : null);
	const showNowLine = $derived(
		currentTimeMs != null &&
			nowX != null &&
			nowX >= 0 &&
			nowX <= ganttState.totalWidth &&
			isTimeInScheduleSpan(currentTimeMs, jobs)
	);
</script>

<svelte:window onmousemove={handleWindowMouseMove} onmouseup={handleWindowMouseUp} />

<div class={cn('relative flex h-full min-h-0 w-full overflow-hidden bg-background', className)}>
	<div
		class="relative z-40 flex min-h-0 flex-none flex-col overflow-hidden border-r border-border bg-[#F4F4F5]"
		style="width: {ganttState.sidebarWidth}px;"
	>
		<div
			class="flex h-11 flex-none items-center border-b border-border bg-[#F4F4F5] px-2 text-[11px] font-bold text-foreground"
		>
			Machine Name
		</div>
		<div
			bind:this={sidebarScrollArea}
			class="min-h-0 flex-1 overflow-x-hidden overflow-y-hidden"
			onwheel={handleSidebarWheel}
		>
			{#each resources as resource, index (resource.machine_id)}
				<div
					class={[
						'flex items-center px-2 text-[13px] font-bold',
						index < resources.length - 1 ? 'border-b border-border' : ''
					]}
					style="height: {ganttState.ROW_HEIGHT}px;"
					title={resource.machine_name}
				>
					<span class="truncate">{resource.machine_name}</span>
				</div>
			{/each}
		</div>
	</div>

	<div
		class="relative z-0 min-h-0 min-w-0 flex-1 overflow-auto"
		bind:this={scrollContainer}
		onwheel={handleWheel}
		onscroll={onScroll}
	>
		<div class="shrink-0" style="width: {ganttState.totalWidth}px;">
			<div class="sticky top-0 z-50">
				<TimelineHeader {visible} />
			</div>

			<div class="relative overflow-hidden">
				<Grid {visible} />
				{#if edges.length > 0 && arrowOrderId && !ganttState.placingJob}
					<DependencyArrows {jobs} {edges} {arrowOrderId} />
				{/if}

				{#if showNowLine && nowX != null}
					<div
						class="pointer-events-none absolute top-0 bottom-0 z-30 border-l-2 border-dashed border-primary"
						style="left: {nowX}px;"
					></div>
				{/if}

				{#each resources as resource, index (resource.machine_id)}
					<ResourceRow
						{resource}
						{jobs}
						{downtimes}
						{onJobClick}
						{onJobContextMenu}
						{selectedOrder}
						{highlightedOrderIds}
						{editMode}
						{visible}
						showBottomBorder={index < resources.length - 1}
					/>
				{/each}
			</div>
		</div>
	</div>
</div>
