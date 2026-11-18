<script lang="ts">
	import { ganttState } from '$lib/gantt/state.svelte';
	import { pairDependencyTasks } from '$lib/gantt/gantt-data.utils';
	import type { ScheduledJob } from '$lib/gantt/aps-types';

	let {
		jobs,
		edges,
		/** When set, draw flow arrows for this mark only (bar click on a multi-step mark). */
		arrowOrderId = null as string | null
	} = $props<{
		jobs: ScheduledJob[];
		edges: { from: string; to: string }[];
		arrowOrderId?: string | null;
	}>();

	const ROW_HEIGHT = ganttState.ROW_HEIGHT;

	function getTaskCenter(task: ScheduledJob): { x: number; y: number } | null {
		const machineIndex = ganttState.resources.findIndex((r) => r.machine_id === task.machine_id);
		if (machineIndex === -1) return null;

		const xStart = ganttState.timeToX(task.start);
		const xEnd = ganttState.timeToX(task.end);
		const x = xStart + (xEnd - xStart) / 2;
		const y = machineIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
		return { x, y };
	}

	let arrows = $derived.by(() => {
		const result: { d: string; key: string }[] = [];
		if (!arrowOrderId) return result;

		const orderJobs = jobs.filter((j: ScheduledJob) => j.order_id === arrowOrderId);
		if (orderJobs.length < 2) return result;

		for (const edge of edges) {
			const fromTasks = orderJobs.filter((j) => j.node_id === edge.from);
			const toTasks = orderJobs.filter((j) => j.node_id === edge.to);
			if (fromTasks.length === 0 || toTasks.length === 0) continue;

			for (const { from: fromTask, to: toTask } of pairDependencyTasks(fromTasks, toTasks)) {
				const start = getTaskCenter(fromTask);
				const end = getTaskCenter(toTask);
				if (!start || !end) continue;

				const sX = ganttState.timeToX(fromTask.end);
				const sY = start.y;
				const eX = ganttState.timeToX(toTask.start);
				const eY = end.y;

				const dist = Math.abs(eX - sX);
				const offset = Math.max(dist / 2, 40);
				const sameMachine = fromTask.machine_id === toTask.machine_id;

				let cp1x: number, cp1y: number, cp2x: number, cp2y: number;
				if (sameMachine) {
					const bump = 18;
					cp1x = sX + offset;
					cp1y = sY - bump;
					cp2x = eX - offset;
					cp2y = eY - bump;
				} else {
					cp1x = sX + offset;
					cp1y = sY;
					cp2x = eX - offset;
					cp2y = eY;
				}

				const d = `M ${sX} ${sY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${eX} ${eY}`;
				result.push({
					d,
					key: `${arrowOrderId}-${edge.from}-${edge.to}-${fromTask.task_uid ?? fromTask.start}-${toTask.task_uid ?? toTask.start}`
				});
			}
		}
		return result;
	});
</script>

<svg
	class="pointer-events-none absolute top-0 left-0 z-0 h-full w-full"
	style="width: {ganttState.totalWidth}px; height: 100%;"
>
	<defs>
		<marker id="arrowhead" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto">
			<polygon points="0 0, 6 2, 0 4" fill="#555" />
		</marker>
	</defs>
	{#each arrows as arrow (arrow.key)}
		<path
			d={arrow.d}
			stroke="#555"
			stroke-width="1.5"
			fill="none"
			marker-end="url(#arrowhead)"
			class="opacity-60 transition-opacity hover:opacity-100"
		/>
	{/each}
</svg>
