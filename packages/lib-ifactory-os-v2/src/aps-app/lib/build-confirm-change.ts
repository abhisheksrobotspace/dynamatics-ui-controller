import type { ScheduleConfirmChange, ScheduleChangeImpact, ScheduleTask } from '@ifactory/ui-v2';

type LockedTaskState = {
	start: number;
	end: number;
	machine_id: string;
};

function formatConfirmTime(ms: number): string {
	const d = new Date(ms);
	if (Number.isNaN(d.getTime())) return '-';
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function machineLabel(machineId: string, labels: Map<string, string>): string {
	return labels.get(machineId) ?? machineId;
}

function formatChangeover(
	beforeMachine: string,
	afterMachine: string,
	changeoverMin?: number
): string {
	if (beforeMachine !== afterMachine) {
		return changeoverMin != null && changeoverMin > 0
			? `+${changeoverMin}m (switch)`
			: 'Machine switch';
	}
	if (changeoverMin != null && changeoverMin > 0) return `${changeoverMin}m`;
	return '-';
}

function taskLabel(task: ScheduleTask): string {
	return task.markLabel?.trim() || task.label.trim() || task.id;
}

/** Build the confirm-rerun summary from pinned Gantt edits vs the loaded schedule. */
export function buildConfirmChange(
	tasks: ScheduleTask[],
	lockedTasks: Map<string, LockedTaskState>,
	machineLabels: Map<string, string>,
	simulationStartMs: number,
	otherTaskIdsOnAffectedMachines = 0
): ScheduleConfirmChange {
	const empty: ScheduleConfirmChange = {
		beforeMachine: '-',
		afterMachine: '-',
		beforeStart: '-',
		beforeEnd: '-',
		afterStart: '-',
		afterEnd: '-',
		changeover: '-',
		impacts: []
	};

	if (lockedTasks.size === 0) return empty;

	const taskById = new Map(tasks.map((task) => [task.id, task]));
	const impacts: ScheduleChangeImpact[] = [];
	let primary: {
		beforeMachine: string;
		afterMachine: string;
		beforeStart: string;
		beforeEnd: string;
		afterStart: string;
		afterEnd: string;
		changeover: string;
		deltaAbs: number;
	} | null = null;

	for (const [taskId, fixed] of lockedTasks) {
		const task = taskById.get(taskId);
		if (!task) continue;

		const beforeMachineId = task.resourceId;
		const afterMachineId = fixed.machine_id;
		const beforeMachine = machineLabel(beforeMachineId, machineLabels);
		const afterMachine = machineLabel(afterMachineId, machineLabels);
		const beforeStartMs = simulationStartMs + task.startMin * 60_000;
		const beforeEndMs = beforeStartMs + task.durationMin * 60_000;
		const beforeStart = formatConfirmTime(beforeStartMs);
		const beforeEnd = formatConfirmTime(beforeEndMs);
		const afterStart = formatConfirmTime(fixed.start);
		const afterEnd = formatConfirmTime(fixed.end);
		const changeover = formatChangeover(beforeMachine, afterMachine, task.changeoverMin);
		const deltaMin = Math.round((fixed.start - beforeStartMs) / 60_000);
		const deltaAbs = Math.abs(deltaMin);
		const mark = taskLabel(task);
		const step = task.stepId?.trim() || '-';

		if (beforeMachine !== afterMachine) {
			impacts.push({
				type: 'shift',
				text: `${step} - ${mark} moves ${beforeMachine} → ${afterMachine}`
			});
		} else if (deltaMin !== 0) {
			const sign = deltaMin > 0 ? '+' : '';
			impacts.push({
				type: 'task-shift',
				text: `${step} - ${mark} shifts ${sign}${deltaMin}m on ${afterMachine}`
			});
		} else {
			impacts.push({
				type: 'task-shift',
				text: `${step} - ${mark} retimed on ${afterMachine}`
			});
		}

		if (!primary || deltaAbs > primary.deltaAbs) {
			primary = {
				beforeMachine,
				afterMachine,
				beforeStart,
				beforeEnd,
				afterStart,
				afterEnd,
				changeover,
				deltaAbs
			};
		}
	}

	if (otherTaskIdsOnAffectedMachines > 0) {
		impacts.push({
			type: 'task-shift',
			text: `${otherTaskIdsOnAffectedMachines} other task(s) on affected machine(s) may be re-sequenced`
		});
	}

	if (lockedTasks.size > 1) {
		impacts.push({
			type: 'shift',
			text: `${lockedTasks.size} tasks pinned - solver will replan around all edits`
		});
	}

	if (impacts.length === 0) {
		impacts.push({
			type: 'shift',
			text: 'Dependent steps will be re-sequenced by the solver'
		});
	}

	if (!primary) return empty;

	return {
		beforeMachine: primary.beforeMachine,
		afterMachine: primary.afterMachine,
		beforeStart: primary.beforeStart,
		beforeEnd: primary.beforeEnd,
		afterStart: primary.afterStart,
		afterEnd: primary.afterEnd,
		changeover: primary.changeover,
		impacts
	};
}
