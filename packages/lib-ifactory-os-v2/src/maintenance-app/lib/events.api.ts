// Mock-backed scheduled-events API. Integration note: v1 stored one
// maintenance_tickets row per occurrence (created via rrule expansion in
// AddEvent) and routed schedule changes through cms/approvals/requests.
// Here the event is the source of truth and occurrences are expanded
// on read; only this module changes when the backend lands.
import { RRule } from 'rrule';
import { mockEvents } from './events.mock.js';
import { clone, mockDelay, nextMockId } from './mock-utils.js';
import type { EventApprovalRequest, ScheduledMaintenanceEvent } from './types.js';

const eventsStore: ScheduledMaintenanceEvent[] = clone(mockEvents);
const approvalRequestsStore: EventApprovalRequest[] = [];

// --- Occurrence expansion ---

export type EventOccurrence = {
	/** Unique per occurrence: `${event id}:${start ISO}`. */
	key: string;
	event: ScheduledMaintenanceEvent;
	start: Date;
	end: Date;
};

function eventStartDate(event: ScheduledMaintenanceEvent): Date {
	return new Date(`${event.start_date}T${event.start_time || '00:00'}:00`);
}

function occurrenceFor(event: ScheduledMaintenanceEvent, start: Date): EventOccurrence {
	return {
		key: `${event.id}:${start.toISOString()}`,
		event,
		start,
		end: new Date(start.getTime() + event.duration_minutes * 60_000)
	};
}

function expandEvent(event: ScheduledMaintenanceEvent, from: Date, till: Date): EventOccurrence[] {
	const dtstart = eventStartDate(event);
	if (!event.rrule) {
		const single = occurrenceFor(event, dtstart);
		return single.end >= from && single.start <= till ? [single] : [];
	}
	try {
		const rule = new RRule({ ...RRule.parseString(event.rrule), dtstart });
		// Widen the window by one event duration so occurrences that start
		// before `from` but overlap it are still included.
		const windowStart = new Date(from.getTime() - event.duration_minutes * 60_000);
		return rule.between(windowStart, till, true).map((start) => occurrenceFor(event, start));
	} catch {
		// Malformed rule (bad mock/backend data): degrade to the first occurrence.
		return [occurrenceFor(event, dtstart)];
	}
}

export async function listEventOccurrences(
	from: Date,
	till: Date,
	signal?: AbortSignal
): Promise<EventOccurrence[]> {
	await mockDelay(signal);
	return eventsStore
		.map((event) => ({ ...clone(event) }))
		.flatMap((event) => expandEvent(event, from, till))
		.sort((a, b) => a.start.getTime() - b.start.getTime());
}

// --- CRUD ---

export async function getEvent(
	id: number,
	signal?: AbortSignal
): Promise<ScheduledMaintenanceEvent | null> {
	await mockDelay(signal);
	const event = eventsStore.find((row) => row.id === id);
	return event ? clone(event) : null;
}

export type CreateEventInput = Omit<ScheduledMaintenanceEvent, 'id' | 'created_at'>;

export async function createEvent(
	input: CreateEventInput,
	signal?: AbortSignal
): Promise<ScheduledMaintenanceEvent> {
	await mockDelay(signal);
	const event: ScheduledMaintenanceEvent = {
		...clone(input),
		id: nextMockId(),
		created_at: new Date().toISOString()
	};
	eventsStore.push(event);
	return clone(event);
}

export type UpdateEventInput = Partial<CreateEventInput>;

/**
 * Direct update for non-schedule fields (title, asset, priority, ...).
 * Schedule changes (dates, times, recurrence) must go through
 * `requestEventChangeApproval` instead — mirrors the v1 approval flow.
 */
export async function updateEvent(
	id: number,
	patch: UpdateEventInput,
	signal?: AbortSignal
): Promise<ScheduledMaintenanceEvent> {
	await mockDelay(signal);
	const event = eventsStore.find((row) => row.id === id);
	if (!event) throw new Error('Event not found.');
	Object.assign(event, clone(patch));
	return clone(event);
}

// --- Approval stubs (v1: POST cms/approvals/requests) ---

export type EventChangeApprovalInput = {
	eventId: number;
	changes: Record<string, string>;
	comment: string;
};

export async function requestEventChangeApproval(
	input: EventChangeApprovalInput,
	signal?: AbortSignal
): Promise<EventApprovalRequest> {
	await mockDelay(signal);
	if (!eventsStore.some((row) => row.id === input.eventId)) {
		throw new Error('Event not found.');
	}
	const request: EventApprovalRequest = {
		id: nextMockId(),
		approval_type: 'maintenance_events',
		event_id: input.eventId,
		action: 'update',
		changes: clone(input.changes),
		request_comment: input.comment.trim() || null,
		requested_at: new Date().toISOString()
	};
	approvalRequestsStore.push(request);
	return clone(request);
}

export type EventDeleteApprovalInput = {
	eventId: number;
	scope: 'current_only' | 'entire_series';
	comment: string;
};

export async function requestEventDeleteApproval(
	input: EventDeleteApprovalInput,
	signal?: AbortSignal
): Promise<EventApprovalRequest> {
	await mockDelay(signal);
	if (!eventsStore.some((row) => row.id === input.eventId)) {
		throw new Error('Event not found.');
	}
	const request: EventApprovalRequest = {
		id: nextMockId(),
		approval_type: 'maintenance_events',
		event_id: input.eventId,
		action: 'delete',
		delete_scope: input.scope,
		request_comment: input.comment.trim() || null,
		requested_at: new Date().toISOString()
	};
	approvalRequestsStore.push(request);
	return clone(request);
}

export async function listEventApprovalRequests(
	signal?: AbortSignal
): Promise<EventApprovalRequest[]> {
	await mockDelay(signal);
	return clone(approvalRequestsStore);
}

// --- Recurrence helpers (shared by AddEvent form and future screens) ---

export type EventFrequency =
	| 'once'
	| 'daily'
	| 'weekly'
	| 'fortnightly'
	| 'monthly'
	| 'quarterly'
	| 'half-yearly'
	| 'yearly'
	| 'custom';

export type CustomRepeatUnit = 'day' | 'week' | 'month' | 'year';

export type RecurrenceInput = {
	frequency: EventFrequency;
	/** Custom mode: repeat every N units. */
	customInterval: number;
	customUnit: CustomRepeatUnit;
	/** Custom weekly mode: selected weekdays, 0=Sun ... 6=Sat. */
	customWeekdays: number[];
	/** How the series ends (ignored for 'once'). */
	endType: 'date' | 'count';
	/** yyyy-mm-dd, when endType is 'date'. */
	endDate: string;
	/** Occurrence count, when endType is 'count'. */
	endCount: number;
};

/** JS Sunday=0 ... Saturday=6 mapped to rrule weekday constants. */
const RRULE_WEEKDAYS = [
	RRule.SU,
	RRule.MO,
	RRule.TU,
	RRule.WE,
	RRule.TH,
	RRule.FR,
	RRule.SA
] as const;

const PRESET_FREQUENCIES: Record<
	Exclude<EventFrequency, 'once' | 'custom'>,
	{ freq: number; interval: number }
> = {
	daily: { freq: RRule.DAILY, interval: 1 },
	weekly: { freq: RRule.WEEKLY, interval: 1 },
	fortnightly: { freq: RRule.WEEKLY, interval: 2 },
	monthly: { freq: RRule.MONTHLY, interval: 1 },
	quarterly: { freq: RRule.MONTHLY, interval: 3 },
	'half-yearly': { freq: RRule.MONTHLY, interval: 6 },
	yearly: { freq: RRule.YEARLY, interval: 1 }
};

const CUSTOM_UNIT_FREQUENCIES: Record<CustomRepeatUnit, number> = {
	day: RRule.DAILY,
	week: RRule.WEEKLY,
	month: RRule.MONTHLY,
	year: RRule.YEARLY
};

export function defaultRecurrenceInput(): RecurrenceInput {
	return {
		frequency: 'once',
		customInterval: 1,
		customUnit: 'week',
		customWeekdays: [],
		endType: 'count',
		endDate: '',
		endCount: 10
	};
}

/**
 * Reverses `buildRruleString` for edit-mode prefill. Unrecognisable
 * freq/interval combos fall back to the equivalent custom settings.
 */
export function parseRruleToRecurrence(rrule: string | null): RecurrenceInput {
	const recurrence = defaultRecurrenceInput();
	if (!rrule) return recurrence;

	let options: Partial<ReturnType<typeof RRule.parseString>>;
	try {
		options = RRule.parseString(rrule);
	} catch {
		return recurrence;
	}

	const interval = options.interval ?? 1;
	const presetEntry = (
		Object.entries(PRESET_FREQUENCIES) as [
			Exclude<EventFrequency, 'once' | 'custom'>,
			{ freq: number; interval: number }
		][]
	).find(([, preset]) => preset.freq === options.freq && preset.interval === interval);

	const hasWeekdays = Array.isArray(options.byweekday) && options.byweekday.length > 0;
	if (presetEntry && !hasWeekdays) {
		recurrence.frequency = presetEntry[0];
	} else {
		recurrence.frequency = 'custom';
		recurrence.customInterval = interval;
		recurrence.customUnit =
			options.freq === RRule.DAILY
				? 'day'
				: options.freq === RRule.MONTHLY
					? 'month'
					: options.freq === RRule.YEARLY
						? 'year'
						: 'week';
		if (hasWeekdays && Array.isArray(options.byweekday)) {
			// rrule counts Monday=0 ... Sunday=6; JS Date counts Sunday=0.
			const rruleDayNames = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
			recurrence.customWeekdays = options.byweekday
				.map((weekday) => {
					if (typeof weekday === 'number') return weekday;
					if (typeof weekday === 'string') return rruleDayNames.indexOf(weekday);
					return weekday.weekday;
				})
				.filter((rruleDay) => rruleDay >= 0)
				.map((rruleDay) => (rruleDay + 1) % 7);
		}
	}

	if (options.until) {
		recurrence.endType = 'date';
		const until = options.until;
		const month = String(until.getMonth() + 1).padStart(2, '0');
		const day = String(until.getDate()).padStart(2, '0');
		recurrence.endDate = `${until.getFullYear()}-${month}-${day}`;
	} else if (options.count) {
		recurrence.endType = 'count';
		recurrence.endCount = options.count;
	}

	return recurrence;
}

/**
 * Builds the stored RRULE string (without DTSTART; the event's start
 * date/time is the series anchor). Returns null for one-off events.
 */
export function buildRruleString(recurrence: RecurrenceInput, seriesStart: Date): string | null {
	if (recurrence.frequency === 'once') return null;

	const options: ConstructorParameters<typeof RRule>[0] = {};
	if (recurrence.frequency === 'custom') {
		options.freq = CUSTOM_UNIT_FREQUENCIES[recurrence.customUnit];
		options.interval = Math.max(1, Math.floor(recurrence.customInterval) || 1);
		if (recurrence.customUnit === 'week') {
			const weekdays =
				recurrence.customWeekdays.length > 0 ? recurrence.customWeekdays : [seriesStart.getDay()];
			options.byweekday = weekdays.map((day) => RRULE_WEEKDAYS[day]);
		}
	} else {
		const preset = PRESET_FREQUENCIES[recurrence.frequency];
		options.freq = preset.freq;
		options.interval = preset.interval;
	}

	if (recurrence.endType === 'date' && recurrence.endDate) {
		const until = new Date(`${recurrence.endDate}T23:59:59`);
		options.until = until;
	} else if (recurrence.endType === 'count') {
		options.count = Math.max(1, Math.floor(recurrence.endCount) || 1);
	}

	return new RRule(options).toString();
}
