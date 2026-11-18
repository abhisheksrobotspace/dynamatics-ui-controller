import type { ScheduledMaintenanceEvent } from './types.js';

/**
 * Mock scheduled-maintenance events. Dates are computed relative to "now"
 * so the calendar demo always has content in the visible range.
 */

function toIsoDate(date: Date): string {
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${date.getFullYear()}-${month}-${day}`;
}

function daysFromToday(days: number): string {
	const date = new Date();
	date.setDate(date.getDate() + days);
	return toIsoDate(date);
}

/** Monday of the current week. */
function currentMonday(): string {
	const date = new Date();
	const day = date.getDay();
	date.setDate(date.getDate() + (day === 0 ? -6 : 1 - day));
	return toIsoDate(date);
}

function firstOfCurrentMonth(): string {
	const date = new Date();
	return toIsoDate(new Date(date.getFullYear(), date.getMonth(), 1));
}

export const mockEvents: ScheduledMaintenanceEvent[] = [
	{
		id: 901,
		title: 'Shift-start safety inspection',
		mid: 101,
		description: 'Walkaround inspection before first shift.',
		priority: 'Low',
		start_date: firstOfCurrentMonth(),
		start_time: '08:00',
		duration_minutes: 30,
		rrule: 'RRULE:FREQ=DAILY',
		assigned_to: 1,
		instruction_ids: [1],
		created_at: new Date().toISOString()
	},
	{
		id: 902,
		title: 'Weekly lubrication round',
		mid: 103,
		description: 'Grease all nipples on the plasma line.',
		priority: 'Medium',
		start_date: currentMonday(),
		start_time: '10:00',
		duration_minutes: 90,
		rrule: 'RRULE:FREQ=WEEKLY',
		assigned_to: 2,
		instruction_ids: [2, 3],
		created_at: new Date().toISOString()
	},
	{
		id: 903,
		title: 'Compressor overhaul',
		mid: 104,
		description: 'Quarterly strip-down of the press compressor.',
		priority: 'High',
		start_date: firstOfCurrentMonth(),
		start_time: '14:00',
		duration_minutes: 240,
		rrule: 'RRULE:FREQ=MONTHLY;INTERVAL=3',
		assigned_to: 3,
		instruction_ids: [1, 7],
		created_at: new Date().toISOString()
	},
	{
		id: 904,
		title: 'Replace conveyor belt',
		mid: 106,
		description: 'One-off replacement of the worn crane conveyor belt.',
		priority: 'High',
		start_date: daysFromToday(2),
		start_time: '11:00',
		duration_minutes: 180,
		rrule: null,
		assigned_to: 4,
		instruction_ids: [1, 2],
		created_at: new Date().toISOString()
	},
	{
		id: 905,
		title: 'Coolant quality check',
		mid: 102,
		description: null,
		priority: 'Low',
		start_date: daysFromToday(1),
		start_time: '16:30',
		duration_minutes: 45,
		rrule: null,
		assigned_to: 2,
		instruction_ids: [],
		created_at: new Date().toISOString()
	},
	// Intentionally overlapping one-offs on "today" for day/week column layout demos.
	{
		id: 906,
		title: 'Overlap A — filter change',
		mid: 101,
		description: 'Concurrent with B and C to exercise side-by-side columns.',
		priority: 'High',
		start_date: daysFromToday(0),
		start_time: '17:30',
		duration_minutes: 60,
		rrule: null,
		assigned_to: 1,
		instruction_ids: [1],
		created_at: new Date().toISOString()
	},
	{
		id: 907,
		title: 'Overlap B — sensor calibration',
		mid: 103,
		description: 'Concurrent with A and C to exercise side-by-side columns.',
		priority: 'Medium',
		start_date: daysFromToday(0),
		start_time: '17:30',
		duration_minutes: 60,
		rrule: null,
		assigned_to: 2,
		instruction_ids: [2],
		created_at: new Date().toISOString()
	},
	{
		id: 908,
		title: 'Overlap C — safety walk',
		mid: 104,
		description: 'Concurrent with A and B to exercise side-by-side columns.',
		priority: 'Low',
		start_date: daysFromToday(0),
		start_time: '17:30',
		duration_minutes: 60,
		rrule: null,
		assigned_to: 3,
		instruction_ids: [],
		created_at: new Date().toISOString()
	}
];
