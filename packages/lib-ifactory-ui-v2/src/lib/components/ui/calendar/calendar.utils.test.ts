import { describe, expect, it } from 'vitest';
import type { CalendarEvent } from './calendar.constants';
import { daysWithEvents, eventsOnDay, layoutDayEvents, toIsoDate } from './calendar.utils';

function event(
	id: string,
	startHour: number,
	startMin: number,
	endHour: number,
	endMin: number
): CalendarEvent {
	// const day = new Date(2026, 0, 16);
	return {
		id,
		title: id,
		start: new Date(2026, 0, 16, startHour, startMin),
		end: new Date(2026, 0, 16, endHour, endMin)
	};
}

describe('layoutDayEvents', () => {
	const day = new Date(2026, 0, 16);

	it('gives full width when events do not overlap', () => {
		const positioned = layoutDayEvents([event('a', 9, 0, 10, 0), event('b', 11, 0, 12, 0)], day);

		expect(positioned).toHaveLength(2);
		for (const row of positioned) {
			expect(row.leftPct).toBe(0);
			expect(row.widthPct).toBe(100);
		}
	});

	it('splits three identical intervals into equal side-by-side columns', () => {
		const positioned = layoutDayEvents(
			[event('c', 17, 30, 18, 30), event('a', 17, 30, 18, 30), event('b', 17, 30, 18, 30)],
			day
		);

		expect(positioned).toHaveLength(3);
		const widths = new Set(positioned.map((row) => row.widthPct));
		expect(widths).toEqual(new Set([100 / 3]));
		const lefts = positioned.map((row) => row.leftPct).sort((a, b) => a - b);
		expect(lefts).toEqual([0, 100 / 3, 200 / 3]);
	});

	it('keeps chained overlaps in one cluster with shared column count', () => {
		// A 9–11, B 10–12, C 11:30–12:30 → all transitively overlap
		const positioned = layoutDayEvents(
			[event('c', 11, 30, 12, 30), event('a', 9, 0, 11, 0), event('b', 10, 0, 12, 0)],
			day
		);

		expect(positioned).toHaveLength(3);
		expect(new Set(positioned.map((row) => row.widthPct)).size).toBe(1);
		expect(positioned[0]!.widthPct).toBeLessThan(100);
		const byId = Object.fromEntries(positioned.map((row) => [row.event.id, row]));
		expect(byId.a!.leftPct).not.toBe(byId.b!.leftPct);
	});
});

describe('daysWithEvents', () => {
	it('includes every day a multi-day event spans', () => {
		const days = daysWithEvents([
			{
				id: '1',
				title: 'Span',
				start: new Date(2026, 0, 10, 9, 0),
				end: new Date(2026, 0, 12, 17, 0)
			}
		]);

		expect([...days].sort()).toEqual(['2026-01-10', '2026-01-11', '2026-01-12']);
	});

	it('matches eventsOnDay for a single-day event', () => {
		const events: CalendarEvent[] = [
			{
				id: '1',
				title: 'One',
				start: new Date(2026, 5, 15, 10, 0),
				end: new Date(2026, 5, 15, 11, 0)
			}
		];
		const day = new Date(2026, 5, 15);

		expect(daysWithEvents(events).has(toIsoDate(day))).toBe(true);
		expect(eventsOnDay(events, day)).toHaveLength(1);
	});
});
