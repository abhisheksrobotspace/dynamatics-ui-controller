import { ganttState } from '$lib/gantt/state.svelte';

export type TimelineTick = {
	time: number;
	label: string;
	x: number;
};

/** Horizontal cull window for ticks / bars (px along the chart). */
export type TimelineVisibleWindow = {
	xMin: number;
	xMax: number;
};

export function formatTimelineTickLabel(timeMs: number, tickIntervalMin: number): string {
	// Day-or-longer ticks: include month (and year when not the current calendar year) so a
	// multi-month schedule that starts far from "today" is readable on the axis.
	if (tickIntervalMin >= 1440) {
		const sameYear = new Date(timeMs).getFullYear() === new Date().getFullYear();
		return new Intl.DateTimeFormat([], {
			month: 'short',
			day: 'numeric',
			...(sameYear ? {} : { year: 'numeric' })
		}).format(timeMs);
	}

	const hour = Number(
		new Intl.DateTimeFormat([], { hour: '2-digit', hour12: false }).format(timeMs)
	);
	const minute = Number(new Intl.DateTimeFormat([], { minute: '2-digit' }).format(timeMs));

	const dateStr = new Intl.DateTimeFormat([], {
		month: 'short',
		day: 'numeric'
	}).format(timeMs);

	if (hour === 0 && minute === 0) return dateStr;

	const timeStr = new Intl.DateTimeFormat([], {
		hour: '2-digit',
		minute: '2-digit',
		hour12: false
	}).format(timeMs);

	return `${dateStr} ${timeStr}`;
}

export function resolveTimelineTickIntervalMin(zoom: number): number {
	const minPixelWidth = 100;
	const minMinutes = minPixelWidth / zoom;

	const validIntervals = [15, 30, 60, 120, 240, 480, 720, 1440];
	let tickIntervalMin = validIntervals.find((i) => i >= minMinutes) || 1440;

	if (minMinutes > 1440) {
		tickIntervalMin = Math.ceil(minMinutes / 1440) * 1440;
	}

	return tickIntervalMin;
}

/** Visible pixel window from scroll position (with side buffer for smooth pan). */
export function visiblePixelWindow(
	scrollLeft: number,
	viewWidth: number,
	bufferPx = 480
): TimelineVisibleWindow {
	const width = Math.max(0, viewWidth);
	return {
		xMin: Math.max(0, scrollLeft - bufferPx),
		xMax: scrollLeft + width + bufferPx
	};
}

/**
 * Timeline ticks. Pass `visible` when zoomed into a long makespan — otherwise a 15‑min
 * interval over months creates tens of thousands of DOM/SVG nodes and crashes on zoom.
 */
export function getTimelineTicks(
	viewportStart = ganttState.viewportStart,
	viewportEnd = ganttState.viewportEnd,
	zoom = ganttState.zoom,
	visible?: TimelineVisibleWindow | null
): TimelineTick[] {
	const tickIntervalMin = resolveTimelineTickIntervalMin(zoom);
	const intervalMs = tickIntervalMin * 60_000;
	/** Same gap we use when choosing the interval — labels closer than this collide. */
	const minGapPx = 100;

	const tickList: TimelineTick[] = [];

	const rangeStartMs =
		visible != null
			? Math.max(viewportStart, viewportStart + (visible.xMin / Math.max(zoom, 1e-6)) * 60_000)
			: viewportStart;
	const rangeEndMs =
		visible != null
			? Math.min(viewportEnd, viewportStart + (visible.xMax / Math.max(zoom, 1e-6)) * 60_000)
			: viewportEnd;

	// Walk interval boundaries only. Do NOT also pin a label at the raw viewportStart:
	// first tasks often start off-grid (e.g. 23:59), and that label sits on top of the
	// next :00 / :15 tick.
	let current = Math.ceil(rangeStartMs / intervalMs) * intervalMs;
	if (current < rangeStartMs) current += intervalMs;

	const maxTicks = 200;
	while (current <= rangeEndMs && tickList.length < maxTicks) {
		const x = ((current - viewportStart) / 60_000) * zoom;
		const prev = tickList[tickList.length - 1];
		if (!prev || x - prev.x >= minGapPx) {
			tickList.push({
				time: current,
				label: formatTimelineTickLabel(current, tickIntervalMin),
				x
			});
		}
		current += intervalMs;
	}

	return tickList;
}
