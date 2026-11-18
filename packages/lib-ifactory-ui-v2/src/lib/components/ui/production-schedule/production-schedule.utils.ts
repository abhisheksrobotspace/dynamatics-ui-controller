import type { ScheduledJob } from '$lib/gantt/aps-types';

export function timeToPercent(minutes: number, spanMin: number): number {
	if (spanMin <= 0) return 0;
	return Math.max(0, Math.min(100, (minutes / spanMin) * 100));
}

export function buildUtilizationPath(points: number[], width: number, height: number): string {
	if (points.length === 0) return '';
	const step = points.length === 1 ? 0 : width / (points.length - 1);
	let path = `M 0 ${height}`;
	points.forEach((point, index) => {
		const x = index * step;
		const y = height - point * height;
		path += ` L ${x} ${y}`;
	});
	path += ` L ${width} ${height} Z`;
	return path;
}

export type UtilizationSegment = {
	startMs: number;
	endMs: number;
	ratio: number;
};

export const GROUP_UTILIZATION_COLORS: Record<string, string> = {
	B: '#64748B',
	CPD: '#EC4899',
	CPS: '#F97316',
	H: '#F59E0B',
	N: '#EF4444',
	CDS: '#3B82F6'
};

export function groupUtilizationColor(groupId: string): string {
	return GROUP_UTILIZATION_COLORS[groupId.toUpperCase()] ?? '#94A3B8';
}

/** Sweep-line busy fraction per time segment for a machine group. */
export function buildGroupUtilizationSegments(
	jobs: ScheduledJob[],
	machineIds: string[],
	viewportStart: number,
	viewportEnd: number
): UtilizationSegment[] {
	if (machineIds.length === 0 || viewportEnd <= viewportStart) return [];

	const machineSet = new Set(machineIds);
	const totalMachines = machineIds.length;
	const deltas = new Map<number, number>();

	for (const job of jobs) {
		if (!machineSet.has(job.machine_id)) continue;
		const start = Math.max(job.start, viewportStart);
		const end = Math.min(job.end, viewportEnd);
		if (start >= end) continue;
		deltas.set(start, (deltas.get(start) ?? 0) + 1);
		deltas.set(end, (deltas.get(end) ?? 0) - 1);
	}

	if (deltas.size === 0) return [];

	const times = [...deltas.keys()].sort((a, b) => a - b);
	const raw: UtilizationSegment[] = [];
	let busy = 0;
	let cursor = viewportStart;

	for (const time of times) {
		if (time > cursor && busy > 0) {
			raw.push({
				startMs: cursor,
				endMs: time,
				ratio: Math.min(1, busy / totalMachines)
			});
		}
		busy += deltas.get(time) ?? 0;
		cursor = time;
	}

	if (cursor < viewportEnd && busy > 0) {
		raw.push({
			startMs: cursor,
			endMs: viewportEnd,
			ratio: Math.min(1, busy / totalMachines)
		});
	}

	const merged: UtilizationSegment[] = [];
	for (const seg of raw) {
		if (seg.ratio <= 0) continue;
		const last = merged[merged.length - 1];
		if (last && last.ratio === seg.ratio && last.endMs === seg.startMs) {
			last.endMs = seg.endMs;
		} else {
			merged.push({ ...seg });
		}
	}

	return merged;
}
