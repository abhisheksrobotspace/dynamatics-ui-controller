import {
	CALENDAR_MIN_EVENT_MINUTES,
	type CalendarEvent,
	type CalendarView
} from './calendar.constants';

const MINUTES_PER_DAY = 24 * 60;

export type CalendarGridDay = {
	date: Date;
	inMonth: boolean;
};

export function startOfDay(date: Date): Date {
	const next = new Date(date);
	next.setHours(0, 0, 0, 0);
	return next;
}

export function endOfDay(date: Date): Date {
	const next = new Date(date);
	next.setHours(23, 59, 59, 999);
	return next;
}

export function isSameDay(a: Date, b: Date): boolean {
	return (
		a.getFullYear() === b.getFullYear() &&
		a.getMonth() === b.getMonth() &&
		a.getDate() === b.getDate()
	);
}

export function addDays(date: Date, days: number): Date {
	const next = new Date(date);
	next.setDate(next.getDate() + days);
	return next;
}

export function addMonths(date: Date, months: number): Date {
	const next = new Date(date);
	next.setMonth(next.getMonth() + months);
	return next;
}

export function addYears(date: Date, years: number): Date {
	const next = new Date(date);
	next.setFullYear(next.getFullYear() + years);
	return next;
}

/** Monday of the week containing `date`. */
export function startOfWeek(date: Date): Date {
	const day = date.getDay();
	const diff = day === 0 ? -6 : 1 - day;
	return startOfDay(addDays(date, diff));
}

export function getWeekDays(date: Date): Date[] {
	const monday = startOfWeek(date);
	return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
}

/**
 * 42-cell (6 week) Monday-first grid for the month containing `monthDate`,
 * including leading/trailing overflow days.
 */
export function buildMonthGrid(monthDate: Date): CalendarGridDay[] {
	const year = monthDate.getFullYear();
	const month = monthDate.getMonth();
	const first = new Date(year, month, 1);
	const gridStart = startOfWeek(first);
	return Array.from({ length: 42 }, (_, index) => {
		const date = addDays(gridStart, index);
		return { date, inMonth: date.getMonth() === month };
	});
}

export function navigateDate(date: Date, view: CalendarView, direction: 1 | -1): Date {
	switch (view) {
		case 'day':
			return addDays(date, direction);
		case 'week':
			return addDays(date, direction * 7);
		case 'month':
			return addMonths(date, direction);
		case 'year':
			return addYears(date, direction);
	}
}

// --- Formatting ---

export function toIsoDate(date: Date): string {
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${date.getFullYear()}-${month}-${day}`;
}

export function formatMonthName(date: Date, short = false): string {
	return date.toLocaleDateString('en-US', { month: short ? 'short' : 'long' });
}

export function formatCalendarTitle(date: Date, view: CalendarView): string {
	if (view === 'year') {
		return String(date.getFullYear());
	}
	if (view === 'month') {
		return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
	}
	if (view === 'week') {
		const days = getWeekDays(date);
		const first = days[0];
		const last = days[6];
		const firstLabel = first.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
		const lastLabel = last.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
		return `${firstLabel} – ${lastLabel}, ${first.getFullYear()}`;
	}
	return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export function formatCalendarSubtitle(date: Date, view: CalendarView): string {
	if (view === 'day') {
		return date.toLocaleDateString('en-US', { weekday: 'long' });
	}
	return '';
}

export function formatEventTime(date: Date): string {
	return date
		.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
		.replace(':00 ', ' ');
}

export function formatHourLabel(hour: number): string {
	if (hour === 0) return '12AM';
	if (hour < 12) return `${hour}AM`;
	if (hour === 12) return '12PM';
	return `${hour - 12}PM`;
}

// --- Event queries ---

function eventEnd(event: CalendarEvent): Date {
	if (event.end && event.end.getTime() > event.start.getTime()) {
		return event.end;
	}
	return new Date(event.start.getTime() + CALENDAR_MIN_EVENT_MINUTES * 60_000);
}

/** Events overlapping `day`, sorted by start time. */
export function eventsOnDay(events: CalendarEvent[], day: Date): CalendarEvent[] {
	const dayStart = startOfDay(day).getTime();
	const dayEnd = endOfDay(day).getTime();
	return events
		.filter((event) => event.start.getTime() <= dayEnd && eventEnd(event).getTime() >= dayStart)
		.sort((a, b) => a.start.getTime() - b.start.getTime());
}

/** ISO date keys for mini-month / year-view event dots (O(1) lookup per day). */
export function daysWithEvents(events: CalendarEvent[]): Set<string> {
	const days = new Set<string>();
	for (const event of events) {
		const start = startOfDay(event.start);
		const end = startOfDay(eventEnd(event));
		for (let cursor = start; cursor.getTime() <= end.getTime(); cursor = addDays(cursor, 1)) {
			days.add(toIsoDate(cursor));
		}
	}
	return days;
}

// --- Time-grid layout (day/week views) ---

export type PositionedEvent = {
	event: CalendarEvent;
	/** Percentages of the 24h column. */
	topPct: number;
	heightPct: number;
	leftPct: number;
	widthPct: number;
	timeLabel: string;
};

type LayoutSegment = {
	event: CalendarEvent;
	startMin: number;
	endMin: number;
	column: number;
	columns: number;
};

/**
 * Positions a day's events in the 24h column, splitting overlapping events
 * into side-by-side columns (same approach as the v1 maintenance calendar).
 */
export function layoutDayEvents(events: CalendarEvent[], day: Date): PositionedEvent[] {
	const dayStart = startOfDay(day).getTime();
	const dayEnd = endOfDay(day).getTime() + 1;

	const segments: LayoutSegment[] = eventsOnDay(events, day)
		.map((event) => {
			const start = Math.max(event.start.getTime(), dayStart);
			const end = Math.min(eventEnd(event).getTime(), dayEnd);
			const startMin = (start - dayStart) / 60_000;
			const endMin = Math.min(
				Math.max((end - dayStart) / 60_000, startMin + CALENDAR_MIN_EVENT_MINUTES),
				MINUTES_PER_DAY
			);
			return { event, startMin, endMin, column: 0, columns: 1 };
		})
		// Start ascending, then longer duration first (matches v1 layoutEvents packing).
		.sort((a, b) => a.startMin - b.startMin || b.endMin - b.startMin - (a.endMin - a.startMin));

	// Group into clusters of transitively-overlapping segments, assign columns.
	let cluster: LayoutSegment[] = [];
	let clusterEnd = -1;
	const flushCluster = () => {
		const columnEnds: number[] = [];
		for (const segment of cluster) {
			let column = columnEnds.findIndex((end) => end <= segment.startMin);
			if (column === -1) {
				column = columnEnds.length;
				columnEnds.push(segment.endMin);
			} else {
				columnEnds[column] = segment.endMin;
			}
			segment.column = column;
		}
		for (const segment of cluster) {
			segment.columns = columnEnds.length;
		}
		cluster = [];
	};

	for (const segment of segments) {
		if (cluster.length > 0 && segment.startMin >= clusterEnd) {
			flushCluster();
		}
		cluster.push(segment);
		clusterEnd = Math.max(clusterEnd, segment.endMin);
	}
	if (cluster.length > 0) flushCluster();

	return segments.map((segment) => {
		const widthPct = 100 / segment.columns;
		return {
			event: segment.event,
			topPct: (segment.startMin / MINUTES_PER_DAY) * 100,
			heightPct: ((segment.endMin - segment.startMin) / MINUTES_PER_DAY) * 100,
			leftPct: segment.column * widthPct,
			widthPct,
			timeLabel: formatEventTime(segment.event.start)
		};
	});
}
