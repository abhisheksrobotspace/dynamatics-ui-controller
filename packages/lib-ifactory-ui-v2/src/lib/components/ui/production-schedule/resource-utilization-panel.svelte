<script lang="ts">
	import { ChevronDown, ChevronUp } from '@lucide/svelte';
	import { cn } from '$lib/utils/cn';
	import type { ScheduledJob } from '$lib/gantt/aps-types';
	import { ganttState } from '$lib/gantt/state.svelte';
	import TimelineHeader from '../gantt/timeline-header.svelte';
	import UtilizationTimelineRow from './utilization-timeline-row.svelte';
	import {
		buildGroupUtilizationSegments,
		groupUtilizationColor
	} from './production-schedule.utils';
	import {
		GANTT_UTILIZATION_LABEL_WIDTH,
		GANTT_UTILIZATION_Y_AXIS_WIDTH
	} from '$lib/gantt/gantt-layout.constants';
	import { isTimeInScheduleSpan } from '$lib/gantt/gantt-data.utils';
	import { tooltip } from '$lib/components/ui/tooltip';
	import { visiblePixelWindow, type TimelineVisibleWindow } from '$lib/gantt/timeline.utils';

	type ResourceGroup = {
		id: string;
		name: string;
		machines: { machine_id: string }[];
	};

	type Props = {
		open?: boolean;
		jobs?: ScheduledJob[];
		resourceGroups?: ResourceGroup[];
		scrollLeft?: number;
		currentTimeMs?: number | null;
		title?: string;
		class?: string;
	};

	let {
		open = $bindable(true),
		jobs = [],
		resourceGroups = [],
		scrollLeft = $bindable(0),
		currentTimeMs = null,
		title = 'Resource Utilization',
		class: className = ''
	}: Props = $props();

	const LABEL_WIDTH = GANTT_UTILIZATION_LABEL_WIDTH;
	const Y_AXIS_WIDTH = GANTT_UTILIZATION_Y_AXIS_WIDTH;
	const FIXED_LEFT_WIDTH = $derived(ganttState.sidebarWidth);
	const HEADER_HEIGHT = 44;
	const ROW_HEIGHT = 80;
	const Y_LABELS = ['100%', '75%', '50%', '25%', '0%'];

	let scrollContainer = $state<HTMLDivElement | null>(null);
	let viewWidth = $state(1200);

	const chartWidth = $derived(ganttState.totalWidth);
	const visible = $derived.by((): TimelineVisibleWindow =>
		visiblePixelWindow(scrollLeft, viewWidth)
	);
	const nowX = $derived(currentTimeMs != null ? ganttState.timeToX(currentTimeMs) : null);
	const showNowLine = $derived(
		currentTimeMs != null &&
			nowX != null &&
			nowX >= 0 &&
			nowX <= chartWidth &&
			isTimeInScheduleSpan(currentTimeMs, jobs)
	);

	const groupRows = $derived(
		resourceGroups.map((group) => ({
			group,
			segments: buildGroupUtilizationSegments(
				jobs,
				group.machines.map((m) => m.machine_id),
				ganttState.viewportStart,
				ganttState.viewportEnd
			),
			color: groupUtilizationColor(group.id)
		}))
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

	function onScroll(e: Event) {
		scrollLeft = (e.currentTarget as HTMLDivElement).scrollLeft;
	}
</script>

<div
	class={cn('flex shrink-0 flex-col overflow-hidden border border-border bg-background', className)}
>
	<button
		type="button"
		class="flex h-9 w-full flex-none items-center justify-between border-b border-border px-4 text-left hover:bg-muted/20"
		aria-expanded={open}
		onclick={() => (open = !open)}
	>
		<span class="text-sm font-bold text-foreground select-none">{title}</span>
		{#if open}
			<ChevronDown class="size-4 shrink-0 text-muted-foreground" />
		{:else}
			<ChevronUp class="size-4 shrink-0 text-muted-foreground" />
		{/if}
	</button>

	{#if open}
		<div class="flex max-h-80 min-h-0 overflow-hidden">
			<div
				class="flex shrink-0 flex-col border-r border-border bg-background"
				style="width: {FIXED_LEFT_WIDTH}px;"
			>
				<div
					class="flex shrink-0 border-b border-border bg-[#F4F4F5]"
					style="height: {HEADER_HEIGHT}px;"
				>
					<div
						class="flex items-center border-r border-border px-2 text-[11px] font-bold text-foreground"
						style="width: {LABEL_WIDTH}px;"
					>
						Machine Groups
					</div>
					<div style="width: {Y_AXIS_WIDTH}px;"></div>
				</div>
				{#each groupRows as row (row.group.id)}
					<div class="flex border-b border-border last:border-b-0" style="height: {ROW_HEIGHT}px;">
						<div
							class="flex flex-col justify-center gap-0.5 border-r border-border px-3"
							style="width: {LABEL_WIDTH}px;"
						>
							<span
								class="truncate text-[12px] font-medium text-foreground"
								{@attach tooltip({
									content: row.group.name,
									side: 'top',
									onlyWhenTruncated: true
								})}
							>
								{row.group.name}
							</span>
							<span class="text-[11px] text-muted-foreground">
								{row.group.machines.length} Machine{row.group.machines.length === 1 ? '' : 's'}
							</span>
						</div>
						<div
							class="relative flex shrink-0 flex-col items-center justify-between py-1 text-center text-[9px] text-muted-foreground"
							style="width: {Y_AXIS_WIDTH}px;"
						>
							{#each Y_LABELS as label (label)}
								<span class="w-full leading-none">{label}</span>
							{/each}
						</div>
					</div>
				{/each}
			</div>

			<div
				bind:this={scrollContainer}
				class="min-w-0 flex-1 overflow-x-auto overflow-y-hidden"
				onscroll={onScroll}
			>
				<div class="relative shrink-0" style="width: {chartWidth}px;">
					<TimelineHeader {visible} />

					<div class="relative shrink-0" style="width: {chartWidth}px;">
						{#each groupRows as row (row.group.id)}
							<div
								class="border-b border-border last:border-b-0"
								style="height: {ROW_HEIGHT}px; width: {chartWidth}px;"
							>
								<UtilizationTimelineRow
									segments={row.segments}
									color={row.color}
									groupId={row.group.id}
									rowHeight={ROW_HEIGHT}
									{chartWidth}
									{visible}
								/>
							</div>
						{/each}

						{#if showNowLine && nowX != null}
							<div
								class="pointer-events-none absolute top-0 bottom-0 z-10 border-l-2 border-dashed border-primary"
								style="left: {nowX}px;"
							></div>
						{/if}
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>
