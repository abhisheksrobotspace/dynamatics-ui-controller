import type { Machine, ScheduledJob } from './aps-types';
import { ganttState } from './state.svelte';
import { SvelteMap } from 'svelte/reactivity';

export function buildValidMachinesByJob(
	jobs: ScheduledJob[],
	machines: Machine[]
): SvelteMap<string, Set<string>> {
	const map = new SvelteMap<string, Set<string>>();

	for (const job of jobs) {
		const key = ganttState.getJobId(job);
		const current = machines.find((m) => m.machine_id === job.machine_id);
		const groupId = current?.resource_group_id;
		const valid = machines
			.filter((m) => !groupId || m.resource_group_id === groupId)
			.map((m) => m.machine_id);
		map.set(key, new Set(valid));
	}

	return map;
}

export function resetGanttEditState(): void {
	ganttState.draggingJob = null;
	ganttState.confirmMoveJob = null;
	ganttState.placingJob = null;
	ganttState.originalJobState = null;
	ganttState.dragSnapshot = null;
	ganttState.hasMoved = false;
	ganttState.previousSelectedOrder = null;
}
