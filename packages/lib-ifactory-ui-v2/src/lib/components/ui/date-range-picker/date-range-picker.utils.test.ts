import { describe, expect, it } from 'vitest';
import {
	calendarDaySpan,
	getAllShiftsRange,
	getCurrentProductionDayRange,
	getPresetRange,
	getProductionDayRange,
	getShiftSelectionRange,
	isOutsideMaxRangeFromAnchor,
	isWithinMaxRangeDays,
	sortShiftsByProductionOrder,
	startOfWeekSunday,
	type ShiftConfig
} from './date-range-picker.utils';

/** Classic overnight-last pattern (22:00→06:00). */
const CLASSIC_SHIFTS: ShiftConfig[] = [
	{ name: 'Shift A', start: '06:00', end: '14:00' },
	{ name: 'Shift B', start: '14:00', end: '22:00' },
	{ name: 'Shift C', start: '22:00', end: '06:00' }
];

/**
 * Live Nicco plant (from HAR): wall-clock order is Shift 3, 1, 2.
 * Production day is 07:00 → next 07:00 (not midnight → midnight).
 */
const NICCO_SHIFTS: ShiftConfig[] = [
	{ name: 'Shift 3', start: '00:00', end: '07:00' },
	{ name: 'Shift 1', start: '07:00', end: '15:30' },
	{ name: 'Shift 2', start: '15:30', end: '00:00' }
];

function local(year: number, monthIndex: number, day: number, hour = 0, minute = 0): Date {
	return new Date(year, monthIndex, day, hour, minute, 0, 0);
}

describe('sortShiftsByProductionOrder', () => {
	it('orders Nicco as Shift 1 → 2 → 3', () => {
		const ordered = sortShiftsByProductionOrder(NICCO_SHIFTS);
		expect(ordered.map((s) => s.name)).toEqual(['Shift 1', 'Shift 2', 'Shift 3']);
	});
});

describe('getProductionDayRange', () => {
	it('classic: day starts at 06:00 not midnight', () => {
		const range = getProductionDayRange(CLASSIC_SHIFTS, local(2026, 9, 22));
		expect(range.from).toEqual(local(2026, 9, 22, 6, 0));
		expect(range.to).toEqual(local(2026, 9, 23, 6, 0));
	});

	it('Nicco: 07:00 → next 07:00 (not 00:00 → 00:00)', () => {
		const range = getProductionDayRange(NICCO_SHIFTS, local(2026, 9, 22));
		expect(range.from).toEqual(local(2026, 9, 22, 7, 0));
		expect(range.to).toEqual(local(2026, 9, 23, 7, 0));
	});

	it('uses DEFAULT_SHIFTS when shifts are empty', () => {
		const range = getProductionDayRange([], local(2026, 9, 23));
		expect(range.from).toEqual(local(2026, 9, 23, 7, 0));
		expect(range.to).toEqual(local(2026, 9, 24, 7, 0));
	});
});

describe('getAllShiftsRange / getCurrentProductionDayRange', () => {
	it('afternoon: last completed is 22nd 07:00 → 23rd 07:00', () => {
		const at = local(2026, 9, 23, 15, 13); // Shift 1
		const range = getAllShiftsRange(NICCO_SHIFTS, at);
		expect(range.from).toEqual(local(2026, 9, 22, 7, 0));
		expect(range.to).toEqual(local(2026, 9, 23, 7, 0));
	});

	it('02:30: last completed is still 21st → 22nd (current day not finished)', () => {
		const at = local(2026, 9, 23, 2, 30); // overnight Shift 3
		const range = getAllShiftsRange(NICCO_SHIFTS, at);
		expect(range.from).toEqual(local(2026, 9, 21, 7, 0));
		expect(range.to).toEqual(local(2026, 9, 22, 7, 0));
	});

	it('afternoon: current production day is 23rd 07:00 → 24th 07:00', () => {
		const at = local(2026, 9, 23, 15, 13);
		const range = getCurrentProductionDayRange(NICCO_SHIFTS, at);
		expect(range.from).toEqual(local(2026, 9, 23, 7, 0));
		expect(range.to).toEqual(local(2026, 9, 24, 7, 0));
	});

	it('02:30: current production day is still 22nd → 23rd', () => {
		const at = local(2026, 9, 23, 2, 30);
		const range = getCurrentProductionDayRange(NICCO_SHIFTS, at);
		expect(range.from).toEqual(local(2026, 9, 22, 7, 0));
		expect(range.to).toEqual(local(2026, 9, 23, 7, 0));
	});
});

describe('getShiftSelectionRange', () => {
	it('in Shift 1, selecting Shift 2 returns yesterday Shift 2', () => {
		const at = local(2026, 9, 23, 10, 0); // Shift 1
		const shift2 = NICCO_SHIFTS.find((s) => s.name === 'Shift 2')!;
		const range = getShiftSelectionRange(shift2, at);
		expect(range.from).toEqual(local(2026, 9, 22, 15, 30));
		expect(range.to).toEqual(local(2026, 9, 23, 0, 0));
	});

	it('in Shift 1, selecting Shift 3 returns this morning overnight window', () => {
		const at = local(2026, 9, 23, 10, 0);
		const shift3 = NICCO_SHIFTS.find((s) => s.name === 'Shift 3')!;
		const range = getShiftSelectionRange(shift3, at);
		expect(range.from).toEqual(local(2026, 9, 23, 0, 0));
		expect(range.to).toEqual(local(2026, 9, 23, 7, 0));
	});
});

describe('getPresetRange', () => {
	const at = local(2026, 9, 23, 15, 13); // Fri 23 Oct 2026 afternoon

	it('today (afternoon): current production day 23rd→24th', () => {
		const range = getPresetRange('today', NICCO_SHIFTS, at);
		expect(range.from).toEqual(local(2026, 9, 23, 7, 0));
		expect(range.to).toEqual(local(2026, 9, 24, 7, 0));
	});

	it('last_day (afternoon): last completed 22nd→23rd', () => {
		const range = getPresetRange('last_day', NICCO_SHIFTS, at);
		expect(range.from).toEqual(local(2026, 9, 22, 7, 0));
		expect(range.to).toEqual(local(2026, 9, 23, 7, 0));
	});

	it('last_day at 02:30: last completed is 21st→22nd', () => {
		const early = local(2026, 9, 23, 2, 30);
		const range = getPresetRange('last_day', NICCO_SHIFTS, early);
		expect(range.from).toEqual(local(2026, 9, 21, 7, 0));
		expect(range.to).toEqual(local(2026, 9, 22, 7, 0));
	});

	it('last_week: previous Sun–Sat production window (classic)', () => {
		expect(startOfWeekSunday(at)).toEqual(local(2026, 9, 18));
		const range = getPresetRange('last_week', CLASSIC_SHIFTS, at);
		expect(range.from).toEqual(local(2026, 9, 11, 6, 0));
		expect(range.to).toEqual(local(2026, 9, 18, 6, 0));
	});

	it('last_month: 1st of prev month → last day end next morning (classic)', () => {
		const range = getPresetRange('last_month', CLASSIC_SHIFTS, at);
		expect(range.from).toEqual(local(2026, 8, 1, 6, 0));
		expect(range.to).toEqual(local(2026, 9, 1, 6, 0));
	});
});

describe('max range days', () => {
	it('calendarDaySpan is inclusive', () => {
		expect(calendarDaySpan(local(2026, 9, 1), local(2026, 9, 1))).toBe(1);
		expect(calendarDaySpan(local(2026, 9, 1), local(2026, 9, 7))).toBe(7);
	});

	it('isWithinMaxRangeDays respects the cap', () => {
		expect(isWithinMaxRangeDays(local(2026, 9, 1), local(2026, 9, 7), 7)).toBe(true);
		expect(isWithinMaxRangeDays(local(2026, 9, 1), local(2026, 9, 8), 7)).toBe(false);
		expect(isWithinMaxRangeDays(local(2026, 9, 1), local(2026, 9, 100), null)).toBe(true);
	});

	it('isOutsideMaxRangeFromAnchor disables beyond span', () => {
		const anchor = local(2026, 9, 10);
		expect(isOutsideMaxRangeFromAnchor(local(2026, 9, 16), anchor, 7)).toBe(false);
		expect(isOutsideMaxRangeFromAnchor(local(2026, 9, 17), anchor, 7)).toBe(true);
	});
});
