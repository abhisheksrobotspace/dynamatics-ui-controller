import type { Machine, ScheduledJob } from './aps-types';
import { ganttState } from './state.svelte';

export type ScheduleTreeNodeLike = {
	id: string;
	children?: ScheduleTreeNodeLike[];
};

/** Slug for marking ids (e.g. "J55 DA 87H" → "j55-da-87h"). */
export function markSlug(label: string): string {
	return label
		.trim()
		.toLowerCase()
		.replace(/×/g, 'x')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');
}

function findTreeNode(nodes: ScheduleTreeNodeLike[], id: string): ScheduleTreeNodeLike | null {
	for (const node of nodes) {
		if (node.id === id) return node;
		if (node.children) {
			const found = findTreeNode(node.children, id);
			if (found) return found;
		}
	}
	return null;
}

function collectTreeLeafIds(node: ScheduleTreeNodeLike): string[] {
	if (!node.children?.length) return [node.id];
	return node.children.flatMap(collectTreeLeafIds);
}

/** Leaf marking ids under a sidebar tree selection; null = show all bars. */
export function highlightIdsForTreeSelection(
	tree: ScheduleTreeNodeLike[],
	selectedId: string
): string[] | null {
	if (!selectedId || selectedId === 'all') return null;
	const node = findTreeNode(tree, selectedId);
	if (!node) return null;
	const ids = collectTreeLeafIds(node);
	return ids.length > 0 ? ids : null;
}

export function getScheduleSpanMs(jobs: ScheduledJob[]): { startMs: number; endMs: number } | null {
	let minStart = Infinity;
	let maxEnd = -Infinity;

	for (const job of jobs) {
		const setupOffset = (job.setup_time || 0) * 1000;
		minStart = Math.min(minStart, job.start - setupOffset);
		maxEnd = Math.max(maxEnd, job.end);
	}

	if (minStart >= maxEnd) return null;
	return { startMs: minStart, endMs: maxEnd };
}

export function isTimeInScheduleSpan(timeMs: number, jobs: ScheduledJob[]): boolean {
	const span = getScheduleSpanMs(jobs);
	if (!span) return false;
	return timeMs >= span.startMs && timeMs <= span.endMs;
}

/**
 * Fit the chart to `[first task … last task]`.
 *
 * The axis begins at the earliest assigned task — not `Date.now()`, and not the empty
 * lead-in before any work is booked. `simulationStartMs` is only the absolute-time
 * anchor for placing jobs / the START label.
 */
export function configureGanttViewport(jobs: ScheduledJob[], simulationStartMs?: number): void {
	const span = getScheduleSpanMs(jobs);
	const minStart = span?.startMs ?? Infinity;
	const maxEnd = span?.endMs ?? -Infinity;

	const fallback =
		simulationStartMs != null && Number.isFinite(simulationStartMs)
			? simulationStartMs
			: Date.now();

	if (span) {
		const trailMs = Math.min((maxEnd - minStart) * 0.04, 24 * 3600000);
		ganttState.viewportStart = minStart;
		ganttState.viewportEnd = maxEnd + trailMs;
	} else {
		ganttState.viewportStart = fallback;
		ganttState.viewportEnd = fallback + 24 * 3600000;
	}

	if (simulationStartMs != null && Number.isFinite(simulationStartMs)) {
		ganttState.simulationStartTime = simulationStartMs;
	}
}

/**
 * Zoom for a readable first screenful from the left edge (first task).
 * Do NOT fit the whole makespan — a multi-week span shrinks bars to sub-pixels.
 */
export function fitGanttZoomToInitialWindow(hours = 8, targetWidthPx = 1200): void {
	const durationMin = Math.max(1, hours * 60);
	ganttState.zoom = Math.max(0.5, Math.min(20, targetWidthPx / durationMin));
}

/**
 * Change zoom while keeping the time under `anchorX` (defaults to viewport center) fixed.
 * Returns the new scrollLeft so the chart does not jump to another day.
 */
export function zoomGanttKeepingView(
	nextZoom: number,
	opts: { scrollLeft: number; viewWidth: number; anchorX?: number }
): number {
	const oldZoom = Math.max(ganttState.zoom, 1e-6);
	const zoom = Math.max(0.1, Math.min(20, nextZoom));
	const viewWidth = Math.max(1, opts.viewWidth);
	const anchorX = opts.anchorX ?? opts.scrollLeft + viewWidth / 2;
	const anchorTime = ganttState.viewportStart + (anchorX / oldZoom) * 60_000;

	ganttState.zoom = zoom;

	const newAnchorX = ((anchorTime - ganttState.viewportStart) / 60_000) * zoom;
	const offsetInView = anchorX - opts.scrollLeft;
	const maxScroll = Math.max(0, ganttState.totalWidth - viewWidth);
	return Math.max(0, Math.min(maxScroll, newAnchorX - offsetInView));
}

export function machinesFromResources(
	resources: Array<{ id: string; label: string; groupId: string }>
): Machine[] {
	return resources.map((resource) => {
		const group = resource.groupId?.trim();
		const name = group ? `${resource.label} (${group})` : resource.label;
		return {
			machine_id: resource.id,
			machine_name: name,
			resource_group_id: resource.groupId,
			resource_group_ids: [resource.groupId]
		};
	});
}

const RESOURCE_GROUP_LABELS: Record<string, string> = {
	B: 'Bending (B)',
	H: 'Heel Grinding (H)',
	N: 'Notching (N)',
	CPD: 'Cutting Punching Drilling (CPD)',
	CPS: 'Cutting Punching Stamping (CPS)',
	CDS: 'Cutting Drilling Stamping (CDS)'
};

export function resourceGroupsFromMachines(
	machines: Machine[]
): Array<{ id: string; name: string; machines: Machine[] }> {
	const groups = new Map<string, Machine[]>();
	for (const machine of machines) {
		const groupId = machine.resource_group_id ?? 'other';
		if (!groups.has(groupId)) groups.set(groupId, []);
		groups.get(groupId)?.push(machine);
	}

	return Array.from(groups.entries())
		.map(([id, groupMachines]) => ({
			id,
			name: RESOURCE_GROUP_LABELS[id] ?? id,
			machines: groupMachines
		}))
		.sort((a, b) => a.name.localeCompare(b.name));
}

/** Each successor → latest predecessor that finished at or before it starts. */
export function pairDependencyTasks<T extends { start: number; end: number }>(
	fromTasks: T[],
	toTasks: T[]
): Array<{ from: T; to: T }> {
	if (fromTasks.length === 0) return [];
	return toTasks.map((to) => {
		let from: T | undefined;
		for (const candidate of fromTasks) {
			if (candidate.end > to.start) continue;
			if (!from || candidate.end >= from.end) from = candidate;
		}
		// ponytail: skip overlapping predecessors; last-finished from-task if none qualify
		from ??= fromTasks.reduce((best, task) => (task.end >= best.end ? task : best));
		return { from, to };
	});
}

export function jobsFromScheduleTasks(
	tasks: Array<{
		id: string;
		resourceId: string;
		label: string;
		orderId?: string;
		jobCardId?: string;
		bomItemId?: string;
		markLabel?: string;
		stepId?: string;
		startMin: number;
		durationMin: number;
		changeoverMin?: number;
		color: string;
		locked?: boolean;
		qty?: number;
		highlightIds?: string[];
	}>,
	simulationStartMs: number
): ScheduledJob[] {
	return tasks.map((task) => {
		const start = simulationStartMs + task.startMin * 60_000;
		const end = simulationStartMs + (task.startMin + task.durationMin) * 60_000;
		const mark = task.markLabel ?? task.label.split(' / ')[0] ?? task.id;
		// Job card is the Gantt order; fall back to bom_item / mark for older payloads.
		const orderId = task.jobCardId?.trim() || task.bomItemId?.trim() || markSlug(mark);

		return {
			order_id: orderId,
			order_number: mark,
			product_id: '',
			quantity: task.qty ?? 1,
			start,
			end,
			machine_id: task.resourceId,
			node_id: task.stepId,
			task_uid: task.id,
			color: task.color,
			setup_time: task.changeoverMin ? task.changeoverMin * 60 : 0,
			isFixed: task.locked,
			resource_group_name: task.stepId,
			highlightIds: task.highlightIds
		};
	});
}
