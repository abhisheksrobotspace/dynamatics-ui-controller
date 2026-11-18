<script lang="ts">
	import { Lock } from '@lucide/svelte';
	import { timeToPercent } from './production-schedule.utils';
	import type { ScheduleResource, ScheduleTask } from './production-schedule.constants';

	type Props = {
		resources: ScheduleResource[];
		tasks: ScheduleTask[];
		timelineStart: string;
		timelineHours: string[];
		currentTimeMin: number;
		timelineSpanMin: number;
		editMode?: boolean;
		incompatibleResources?: string[];
		selectedTaskId?: string | null;
		onSelectTask?: (taskId: string) => void;
		class?: string;
	};

	let {
		resources,
		tasks,
		timelineStart,
		timelineHours,
		currentTimeMin,
		timelineSpanMin,
		editMode = false,
		incompatibleResources = [],
		selectedTaskId = null,
		onSelectTask,
		class: className = ''
	}: Props = $props();

	const currentTimeLeft = $derived(timeToPercent(currentTimeMin, timelineSpanMin));

	function tasksForResource(resourceId: string): ScheduleTask[] {
		return tasks.filter((task) => task.resourceId === resourceId);
	}

	function hasLoad(resourceId: string): boolean {
		return tasksForResource(resourceId).length > 0;
	}
</script>

<div class="flex min-h-0 flex-1 flex-col overflow-hidden bg-background {className}">
	<div
		class="flex items-center justify-end gap-4 border-b border-border px-4 py-2 text-xs text-muted-foreground"
	>
		<span class="inline-flex items-center gap-1.5">
			<span class="inline-block size-3 bg-[#5eead4]"></span>
			Task
		</span>
		<span class="inline-flex items-center gap-1.5">
			<span class="inline-block size-3 bg-primary"></span>
			Changeover
		</span>
	</div>

	<div class="min-h-0 flex-1 overflow-auto">
		<div class="min-w-[720px]">
			<div
				class="sticky top-0 z-10 grid border-b border-border bg-surface"
				style:grid-template-columns="5rem 1fr"
			>
				<div class="border-r border-border px-2 py-2 text-xs font-medium text-muted-foreground">
					Machine Name
				</div>
				<div class="grid" style:grid-template-columns={`repeat(${timelineHours.length}, 1fr)`}>
					{#each timelineHours as hour, index (hour)}
						<div
							class={[
								'px-2 py-2 text-xs font-medium text-muted-foreground uppercase',
								index < timelineHours.length - 1 ? 'border-r border-border' : ''
							]}
						>
							{timelineStart}
							{hour}
						</div>
					{/each}
				</div>
			</div>

			{#each resources as resource (resource.id)}
				<div
					class="relative grid border-b border-border"
					style:grid-template-columns="5rem 1fr"
					style:min-height="3rem"
				>
					<div
						class="flex items-center border-r border-border px-2 text-xs font-medium text-foreground"
					>
						{resource.label}
					</div>

					<div class="relative">
						<div
							class="absolute inset-0 grid"
							style:grid-template-columns={`repeat(${timelineHours.length}, 1fr)`}
						>
							{#each timelineHours as hour, index (hour)}
								<div
									class={index < timelineHours.length - 1 ? 'border-r border-border/70' : ''}
								></div>
							{/each}
						</div>

						<div
							class="pointer-events-none absolute top-0 bottom-0 z-20 border-l border-dashed border-status-error"
							style:left="{currentTimeLeft}%"
						></div>

						{#if !hasLoad(resource.id)}
							<p class="absolute inset-0 flex items-center px-3 text-xs text-muted-foreground">
								No load
							</p>
						{/if}

						{#each tasksForResource(resource.id) as task (task.id)}
							{@const left = timeToPercent(task.startMin, timelineSpanMin)}
							{@const width = timeToPercent(task.durationMin, timelineSpanMin)}
							{@const changeoverWidth = task.changeoverMin
								? timeToPercent(task.changeoverMin, timelineSpanMin)
								: 0}
							<button
								type="button"
								class={[
									'absolute top-2 z-10 flex h-8 min-w-0 items-center overflow-hidden border border-black/10 px-2 text-left text-[11px] font-medium text-foreground',
									selectedTaskId === task.id ? 'ring-2 ring-primary' : '',
									editMode && task.locked ? 'opacity-70' : ''
								]}
								style:left="{left}%"
								style:width="{width}%"
								style:background-color={task.color}
								title={task.label}
								onclick={() => onSelectTask?.(task.id)}
							>
								{#if task.changeoverMin && changeoverWidth > 0}
									<span
										class="absolute top-0 bottom-0 left-0 bg-primary"
										style:width="{Math.min(changeoverWidth / width, 0.35) * 100}%"
										style:background-image="repeating-linear-gradient(45deg, transparent,
										transparent 3px, rgba(255,255,255,0.45) 3px, rgba(255,255,255,0.45) 6px)"
									></span>
								{/if}
								<span class="relative z-10 truncate">{task.label}</span>
								{#if task.locked}
									<Lock class="relative z-10 ml-1 size-3 shrink-0" />
								{/if}
							</button>
						{/each}

						{#if editMode && incompatibleResources.includes(resource.id)}
							<div class="absolute top-1/2 right-2 z-20 -translate-y-1/2">
								<span
									class="border border-status-error bg-status-error-badge px-2 py-0.5 text-[10px] font-semibold tracking-wide text-status-error uppercase"
								>
									Incompatible step group
								</span>
							</div>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	</div>
</div>
