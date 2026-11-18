import { DEFAULT_SHIFTS, MONTH_NAMES } from './date-range-picker.constants';

export type Meridiem = 'AM' | 'PM';

export type TimeValue = {
	hour: string;
	minute: string;
	meridiem: Meridiem;
};

export type CalendarDay = {
	date: number;
	month: number;
	year: number;
	isCurrentMonth: boolean;
};

export type DateParts = {
	day: number;
	month: number;
	year: number;
};

export type ShiftConfig = {
	name: string;
	start: string;
	end: string;
};

export type DateRangeSelection = {
	from: Date;
	to: Date;
	shift?: string;
};

/** Preset ids for the optional date-range preset dropdown. */
export type DateRangePresetId = 'today' | 'last_day' | 'last_week' | 'last_month' | 'custom';

export const DATE_RANGE_PRESET_OPTIONS: { id: DateRangePresetId; label: string }[] = [
	{ id: 'today', label: 'Today' },
	{ id: 'last_day', label: 'Last day' },
	{ id: 'last_week', label: 'Last week' },
	{ id: 'last_month', label: 'Last month' },
	{ id: 'custom', label: 'Custom' }
];

export function padTwo(value: number | string): string {
	return String(value).padStart(2, '0');
}

export function toCalendarDate(parts: DateParts): Date {
	return new Date(parts.year, parts.month, parts.day);
}

export function sameDay(a: Date, b: Date): boolean {
	return (
		a.getFullYear() === b.getFullYear() &&
		a.getMonth() === b.getMonth() &&
		a.getDate() === b.getDate()
	);
}

export function startOfDay(date: Date): Date {
	return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function isBetweenInclusive(date: Date, from: Date | null, to: Date | null): boolean {
	if (!from || !to) return false;
	const value = startOfDay(date).getTime();
	const start = startOfDay(from).getTime();
	const end = startOfDay(to).getTime();
	const min = Math.min(start, end);
	const max = Math.max(start, end);
	return value >= min && value <= max;
}

export function isInHoverRange(
	date: Date,
	from: Date | null,
	hovered: Date | null,
	to: Date | null
): boolean {
	if (!from || !hovered || to) return false;
	const value = startOfDay(date).getTime();
	const start = startOfDay(from).getTime();
	const end = startOfDay(hovered).getTime();
	const min = Math.min(start, end);
	const max = Math.max(start, end);
	return value >= min && value <= max;
}

export function buildCalendarDays(year: number, month: number): CalendarDay[] {
	const firstDay = new Date(year, month, 1);
	const startOffset = firstDay.getDay();
	const start = new Date(year, month, 1 - startOffset);
	const days: CalendarDay[] = [];

	for (let index = 0; index < 42; index += 1) {
		const current = new Date(start);
		current.setDate(start.getDate() + index);
		days.push({
			date: current.getDate(),
			month: current.getMonth(),
			year: current.getFullYear(),
			isCurrentMonth: current.getMonth() === month
		});
	}

	return days;
}

export function addMonths(date: Date, amount: number): Date {
	const next = new Date(date);
	next.setMonth(next.getMonth() + amount, 1);
	return next;
}

export function formatMonthYear(date: Date): string {
	return `${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
}

export function toTimeValue(date: Date): TimeValue {
	const parts = date.toLocaleTimeString('en-US', {
		hour: '2-digit',
		minute: '2-digit',
		hour12: true
	});
	const [clock, meridiem] = parts.split(' ');
	const [hour, minute] = clock.split(':');
	return {
		hour: padTwo(hour),
		minute,
		meridiem: meridiem.toUpperCase() as Meridiem
	};
}

export function parseTimeValue(time: TimeValue): { hours: number; minutes: number } {
	let hour = Number.parseInt(time.hour, 10);
	const minute = Number.parseInt(time.minute, 10);

	if (Number.isNaN(hour) || Number.isNaN(minute)) {
		return { hours: 0, minutes: 0 };
	}

	if (time.meridiem === 'AM') {
		hour = hour === 12 ? 0 : hour;
	} else {
		hour = hour === 12 ? 12 : hour + 12;
	}

	return { hours: hour, minutes: minute };
}

export function combineDateAndTime(date: Date, time: TimeValue): Date {
	const { hours, minutes } = parseTimeValue(time);
	const next = new Date(date);
	next.setHours(hours, minutes, 0, 0);
	return next;
}

export function formatTriggerLabel(from: Date, to: Date, showTime: boolean): string {
	const dateFormatter = new Intl.DateTimeFormat('en-GB', {
		day: 'numeric',
		month: 'short'
	});
	const timeFormatter = new Intl.DateTimeFormat('en-GB', {
		hour: '2-digit',
		minute: '2-digit',
		hour12: false
	});

	const fromDate = dateFormatter.format(from);
	const toDate = dateFormatter.format(to);

	if (!showTime) {
		return `${fromDate} – ${toDate}`;
	}

	const fromTime = timeFormatter.format(from);
	const toTime = timeFormatter.format(to);

	if (sameDay(from, to)) {
		return `${fromDate} ${fromTime} – ${toTime}`;
	}

	return `${fromDate} ${fromTime} – ${toDate} ${toTime}`;
}

export function formatTimeInput(time: TimeValue): string {
	return `${padTwo(time.hour)}:${padTwo(time.minute)}`;
}

export function parseTimeInput(value: string, meridiem: Meridiem): TimeValue {
	const [hour = '12', minute = '00'] = value.replace(/[^\d:]/g, '').split(':');
	const parsedHour = Number.parseInt(hour.slice(0, 2), 10);
	const parsedMinute = Number.parseInt(minute.slice(0, 2), 10);

	return {
		hour: padTwo(Number.isNaN(parsedHour) ? 12 : Math.min(12, Math.max(1, parsedHour))),
		minute: padTwo(Number.isNaN(parsedMinute) ? 0 : Math.min(59, Math.max(0, parsedMinute))),
		meridiem
	};
}

export function parseShiftTime(timeStr: string, baseDate: Date): Date {
	const [hours = 0, minutes = 0] = timeStr.split(':').map(Number);
	const next = new Date(baseDate);
	next.setHours(hours, minutes, 0, 0);
	return next;
}

export function parseTimeToMs(timeStr: string): number {
	const [hours = 0, minutes = 0, seconds = 0] = timeStr.split(':').map(Number);
	return (hours * 3600 + minutes * 60 + seconds) * 1000;
}

export function isOvernightShift(shift: ShiftConfig): boolean {
	const startMs = parseTimeToMs(shift.start);
	const endMs = parseTimeToMs(shift.end);
	return endMs <= startMs;
}

export function getShiftRange(shift: ShiftConfig, baseDate: Date): { start: Date; end: Date } {
	const start = parseShiftTime(shift.start, baseDate);
	const end = parseShiftTime(shift.end, baseDate);
	if (end <= start) {
		end.setDate(end.getDate() + 1);
	}
	return { start, end };
}

export function getShiftRangeForName(
	shifts: ShiftConfig[],
	shiftName: string,
	baseDate: Date
): { start: Date; end: Date } | null {
	const shift = shifts.find((item) => item.name === shiftName);
	if (!shift) return null;
	return getShiftRange(shift, baseDate);
}

export function getShiftSelectionRange(shift: ShiftConfig, at = new Date()): DateRangeSelection {
	let { start, end } = getShiftRange(shift, startOfDay(at));

	// Not started yet today → most recent completed instance (yesterday's),
	// e.g. in Shift 1 selecting Shift 2 / overnight Shift 3.
	if (at < start) {
		start = new Date(start);
		end = new Date(end);
		start.setDate(start.getDate() - 1);
		end.setDate(end.getDate() - 1);
	}

	return {
		from: start,
		to: end,
		shift: shift.name
	};
}

/**
 * Clock ms from midnight for the production-day boundary (Shift 1 start).
 * Skips 00:00 "morning continuation" shifts (e.g. Nicco Shift 3 00:00–07:00)
 * so the day starts at the first real daytime shift (07:00), not midnight.
 */
export function getProductionDayStartMs(shifts: ShiftConfig[]): number {
	const starts = shifts.map((shift) => parseTimeToMs(shift.start));
	const nonMidnight = starts.filter((ms) => ms > 0);
	return Math.min(...(nonMidnight.length ? nonMidnight : starts));
}

export function sortShiftsByProductionOrder(shifts: ShiftConfig[]): ShiftConfig[] {
	if (shifts.length <= 1) return [...shifts];
	const dayStartMs = getProductionDayStartMs(shifts);
	const dayMs = 86_400_000;
	return [...shifts].sort((a, b) => {
		const aOrd = (parseTimeToMs(a.start) - dayStartMs + dayMs) % dayMs;
		const bOrd = (parseTimeToMs(b.start) - dayStartMs + dayMs) % dayMs;
		return aOrd - bOrd;
	});
}

/**
 * Production day that contains `at`.
 * Before Shift 1 starts (e.g. 02:30), that is still yesterday's day (07:00→07:00).
 */
export function getCurrentProductionDayRange(
	shifts: ShiftConfig[],
	at = new Date()
): DateRangeSelection {
	const list = shifts.length > 0 ? shifts : [...DEFAULT_SHIFTS];
	let range = getProductionDayRange(list, startOfDay(at));
	if (at < range.from) {
		range = getProductionDayRange(list, addDays(startOfDay(at), -1));
	}
	return range;
}

/** Last fully completed production day (range.to <= at). */
export function getAllShiftsRange(shifts: ShiftConfig[], at = new Date()): DateRangeSelection {
	const list = shifts.length > 0 ? shifts : [...DEFAULT_SHIFTS];
	let range = getProductionDayRange(list, startOfDay(at));
	while (range.to > at) {
		range = getProductionDayRange(list, addDays(startOfDay(range.from), -1));
	}
	return range;
}

export function getActiveShiftRange(shifts: ShiftConfig[], at = new Date()): DateRangeSelection {
	for (const shift of shifts) {
		const { start, end } = getShiftRange(shift, at);
		if (at >= start && at < end) {
			return { from: start, to: end, shift: shift.name };
		}

		const yesterdayStart = new Date(start);
		yesterdayStart.setDate(yesterdayStart.getDate() - 1);
		const yesterdayEnd = new Date(end);
		yesterdayEnd.setDate(yesterdayEnd.getDate() - 1);
		if (at >= yesterdayStart && at < yesterdayEnd) {
			return { from: yesterdayStart, to: yesterdayEnd, shift: shift.name };
		}
	}

	if (shifts.length > 0) {
		return getShiftSelectionRange(shifts[0], at);
	}

	return getAllShiftsRange(shifts, at);
}

export function getRangeForShiftName(
	shifts: ShiftConfig[],
	shiftName: string,
	at = new Date()
): DateRangeSelection {
	if (shiftName === 'All Shifts') {
		return getAllShiftsRange(shifts, at);
	}

	const shift = shifts.find((item) => item.name === shiftName);
	if (!shift) {
		return getAllShiftsRange(shifts, at);
	}

	return getShiftSelectionRange(shift, at);
}

export function selectionFromRange(range: DateRangeSelection): {
	fromDate: Date | null;
	toDate: Date | null;
	fromTime: TimeValue;
	toTime: TimeValue;
} {
	return {
		fromDate: range.from,
		toDate: range.to,
		fromTime: toTimeValue(range.from),
		toTime: toTimeValue(range.to)
	};
}

export function buildRangeFromSelection({
	fromDate,
	toDate,
	fromTime,
	toTime,
	shift
}: {
	fromDate: Date;
	toDate: Date;
	fromTime: TimeValue;
	toTime: TimeValue;
	shift?: string;
}): DateRangeSelection {
	return {
		from: combineDateAndTime(fromDate, fromTime),
		to: combineDateAndTime(toDate, toTime),
		shift
	};
}

export function normalizeRangeOrder(
	fromDate: Date,
	toDate: Date
): { fromDate: Date; toDate: Date } {
	if (startOfDay(fromDate) <= startOfDay(toDate)) {
		return { fromDate, toDate };
	}

	return { fromDate: toDate, toDate: fromDate };
}

export function addDays(date: Date, amount: number): Date {
	const next = startOfDay(date);
	next.setDate(next.getDate() + amount);
	return next;
}

/** Sunday that starts the calendar week containing `date` (Sun–Sat). */
export function startOfWeekSunday(date: Date): Date {
	const day = startOfDay(date);
	day.setDate(day.getDate() - day.getDay());
	return day;
}

/** Inclusive calendar-day count between two dates (same day → 1). */
export function calendarDaySpan(from: Date, to: Date): number {
	const start = startOfDay(from).getTime();
	const end = startOfDay(to).getTime();
	return Math.floor(Math.abs(end - start) / 86_400_000) + 1;
}

export function isWithinMaxRangeDays(
	from: Date,
	to: Date,
	maxRangeDays: number | null | undefined
): boolean {
	if (maxRangeDays == null || maxRangeDays <= 0) return true;
	return calendarDaySpan(from, to) <= maxRangeDays;
}

/**
 * One production day on `baseDate`: from production-day start (e.g. Shift 1 at 07:00)
 * through the same clock time next calendar day (Shift 3 / overnight end next morning).
 *
 * Nicco example (ordered by start_time as 00:00 / 07:00 / 15:30): day is 07:00→07:00,
 * not midnight→midnight.
 */
export function getProductionDayRange(shifts: ShiftConfig[], baseDate: Date): DateRangeSelection {
	const day = startOfDay(baseDate);
	const list = shifts.length > 0 ? shifts : [...DEFAULT_SHIFTS];
	const startMs = getProductionDayStartMs(list);
	const hours = Math.floor(startMs / 3_600_000);
	const minutes = Math.floor((startMs % 3_600_000) / 60_000);
	const from = new Date(day);
	from.setHours(hours, minutes, 0, 0);
	const to = new Date(from);
	to.setDate(to.getDate() + 1);
	return { from, to, shift: 'All Shifts' };
}

/**
 * Resolve a non-custom preset to a concrete range using plant shifts
 * (ordered by start time; last shift may end the next morning).
 */
export function getPresetRange(
	preset: Exclude<DateRangePresetId, 'custom'>,
	shifts: ShiftConfig[],
	at = new Date()
): DateRangeSelection {
	const today = startOfDay(at);

	if (preset === 'today') {
		// Production day containing now (before Shift 1, still yesterday's 07:00→07:00).
		return getCurrentProductionDayRange(shifts, at);
	}

	if (preset === 'last_day') {
		// Last fully completed production day (at 15:00 on the 23rd → 22nd 07:00→23rd 07:00;
		// at 02:30 on the 23rd → 21st 07:00→22nd 07:00).
		return getAllShiftsRange(shifts, at);
	}

	if (preset === 'last_week') {
		const thisWeekSunday = startOfWeekSunday(today);
		const lastWeekSunday = addDays(thisWeekSunday, -7);
		const lastWeekSaturday = addDays(lastWeekSunday, 6);
		const from = getProductionDayRange(shifts, lastWeekSunday).from;
		const to = getProductionDayRange(shifts, lastWeekSaturday).to;
		return { from, to, shift: 'All Shifts' };
	}

	// last_month: 1st of prev month → last calendar day of prev month (Shift 3 overnight into the 1st)
	const firstOfPrevMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
	const lastDayOfPrevMonth = new Date(today.getFullYear(), today.getMonth(), 0);
	const from = getProductionDayRange(shifts, firstOfPrevMonth).from;
	const to = getProductionDayRange(shifts, lastDayOfPrevMonth).to;
	return { from, to, shift: 'All Shifts' };
}

/** True when `date` is outside the max-span window around an anchor (for day disable). */
export function isOutsideMaxRangeFromAnchor(
	date: Date,
	anchor: Date,
	maxRangeDays: number | null | undefined
): boolean {
	if (maxRangeDays == null || maxRangeDays <= 0) return false;
	return calendarDaySpan(anchor, date) > maxRangeDays;
}
