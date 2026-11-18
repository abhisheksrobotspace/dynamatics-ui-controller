import { SvelteMap } from 'svelte/reactivity';
import type { Machine, ScheduledJob } from './aps-types';
import { GANTT_SIDEBAR_WIDTH } from './gantt-layout.constants';

export class GanttState {
	// Zoom level: pixels per minute
	zoom = $state(2);

	// Visible time range (timestamps)
	viewportStart = $state(Date.now());
	viewportEnd = $state(Date.now() + 24 * 60 * 60 * 1000);

	// Machine-name column width (matches utilization label + Y-axis)
	sidebarWidth = $state(GANTT_SIDEBAR_WIDTH);

	// Context resources for Y-axis lookup
	resources = $state<Machine[]>([]);

	// Drag State
	draggingJob = $state<ScheduledJob | null>(null);
	dragStartX = $state(0);
	dragStartTime = $state(0);
	dragStartMachineIndex = $state(-1);

	// Move & Confirm State
	originalJobState = $state<{ start: number; end: number; machine_id: string } | null>(null);
	/** Snapshot of all jobs at drag start — used to restore on reject after push-aside. */
	dragSnapshot = $state<{ id: string; start: number; end: number; machine_id: string }[] | null>(
		null
	);
	placingJob = $state<ScheduledJob | null>(null);
	confirmMoveJob = $state<ScheduledJob | null>(null);
	hasMoved = $state(false);
	previousSelectedOrder = $state<string | null>(null);

	// Locked State
	lockedTasks = new SvelteMap<string, { start: number; end: number; machine_id: string }>();

	// Valid machines per task (task id -> set of machine_ids)
	validMachinesByJob = $state(new SvelteMap<string, Set<string>>());

	// Backend coordinates helper
	simulationStartTime = $state<number>(0);

	// Constants
	readonly ROW_HEIGHT = 64;

	getJobId(job: Pick<ScheduledJob, 'order_id' | 'node_id'> & { task_uid?: string }): string {
		if (job?.task_uid) return String(job.task_uid);
		return `${job.order_id}_${job.node_id}`;
	}

	restoreDragSnapshot(jobs: ScheduledJob[]) {
		if (!this.dragSnapshot) return;
		const byId: Record<string, { start: number; end: number; machine_id: string }> = {};
		for (const entry of this.dragSnapshot) {
			byId[entry.id] = entry;
		}
		for (const job of jobs) {
			const snap = byId[this.getJobId(job)];
			if (!snap) continue;
			job.start = snap.start;
			job.end = snap.end;
			job.machine_id = snap.machine_id;
		}
	}

	timeToX(time: number): number {
		const diffMin = (time - this.viewportStart) / 60000;
		return diffMin * this.zoom;
	}

	xToTime(x: number): number {
		const diffMin = x / this.zoom;
		return this.viewportStart + diffMin * 60000;
	}

	generateTicks(): { time: number; label: string }[] {
		const ticks: { time: number; label: string }[] = [];
		const durationMs = this.viewportEnd - this.viewportStart;
		const durationHours = durationMs / (1000 * 60 * 60);

		let intervalMs: number;
		if (durationHours <= 24) {
			intervalMs = 2 * 60 * 60 * 1000;
		} else if (durationHours <= 72) {
			intervalMs = 6 * 60 * 60 * 1000;
		} else if (durationHours <= 168) {
			intervalMs = 12 * 60 * 60 * 1000;
		} else {
			intervalMs = 24 * 60 * 60 * 1000;
		}

		const startTick = Math.ceil(this.viewportStart / intervalMs) * intervalMs;
		const labelFmt = new Intl.DateTimeFormat('en-US', {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
			hour12: false
		});
		for (let t = startTick; t <= this.viewportEnd; t += intervalMs) {
			ticks.push({ time: t, label: labelFmt.format(t) });
		}

		return ticks;
	}

	get totalWidth(): number {
		return this.timeToX(this.viewportEnd);
	}
}

export const ganttState = new GanttState();
