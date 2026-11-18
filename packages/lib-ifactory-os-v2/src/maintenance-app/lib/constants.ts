import type {
	MaintenanceTicket,
	Shift,
	TicketAnalysis,
	TicketMetadata,
	TicketPriority,
	TicketStatusCode
} from './types.js';

/**
 * Magic ids carried over from v1 (hardcoded there too). They drive the
 * breakdown-vs-other split and the ticket source label. When the real
 * backend integration lands, reconcile these in ONE place: here.
 *
 * - event_id 103 / 111: tickets raised by ioWare devices
 * - event_id 6: tickets raised inside the iFactory maintenance module
 * - alert_id 3 / 13: "breakdown" alert categories
 * - alert_id 2: scheduled-maintenance alert category
 */
export const MAINTENANCE_MODULE_EVENT_ID = 6;
export const IOWARE_EVENT_IDS = [103, 111] as const;
export const TICKET_EVENT_IDS = [...IOWARE_EVENT_IDS, MAINTENANCE_MODULE_EVENT_ID] as const;
export const BREAKDOWN_ALERT_IDS = [3, 13] as const;
/** "Other tickets" excludes breakdown (3, 13) and scheduled (2) categories. */
export const OTHER_TICKETS_EXCLUDED_ALERT_IDS = [2, 3, 13] as const;

export const TICKET_STATUS = {
	CLOSED: 0,
	OPEN: 1,
	IN_PROGRESS: 2,
	/** Legacy second in-progress code; treated identically to 2. */
	IN_PROGRESS_ALT: 3
} as const;

export type TicketStatusLabel = 'Open' | 'In Progress' | 'Closed';

export function mapTicketStatus(
	status: TicketStatusCode | null | undefined
): TicketStatusLabel | '-' {
	if (status === 0) return 'Closed';
	if (status === 1) return 'Open';
	if (status === 2 || status === 3) return 'In Progress';
	return '-';
}

export const TICKET_PRIORITIES: TicketPriority[] = ['Low', 'Medium', 'High'];

export type TicketSource = 'ioWare' | 'iFactory' | '-';

export function getTicketSource(eventId: number | null | undefined): TicketSource {
	if (eventId === 103 || eventId === 111) return 'ioWare';
	if (eventId === MAINTENANCE_MODULE_EVENT_ID) return 'iFactory';
	return '-';
}

/** Formats a duration between two instants as "HH:mm" (days folded into hours). */
export function calculateDuration(
	startTime: string | null | undefined,
	endTime: string | null | undefined
): string {
	if (!startTime) return '-';
	const start = new Date(startTime).getTime();
	const end = endTime ? new Date(endTime).getTime() : Date.now();
	const diffMs = end - start;
	if (diffMs < 0) return '-';

	const totalMinutes = Math.floor(diffMs / 60000);
	const hours = Math.floor(totalMinutes / 60);
	const minutes = totalMinutes % 60;
	return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function formatDateTime(value: string | null | undefined): string {
	if (!value) return '-';
	return new Date(value).toLocaleString('en-IN', {
		year: 'numeric',
		month: 'numeric',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		hour12: true
	});
}

/**
 * Case duration ends at closed_at for closed tickets and resolved_at
 * otherwise (v1 behaviour).
 */
export function getCaseEndAt(ticket: MaintenanceTicket): string | null {
	if (ticket.status === TICKET_STATUS.CLOSED) {
		return ticket.closed_at ?? ticket.resolved_at ?? null;
	}
	return ticket.resolved_at ?? ticket.closed_at ?? null;
}

/** Work duration ends at resolved_at, falling back to closed_at. */
export function getWorkEndAt(ticket: MaintenanceTicket): string | null {
	return ticket.resolved_at ?? ticket.closed_at ?? null;
}

/** Analysis metadata with defaults; UI always keeps at least one Why entry. */
export function normalizeAnalysis(metadata: TicketMetadata | null | undefined): TicketAnalysis {
	const analysis = metadata?.analysis;
	const whys = (analysis?.whys ?? []).map((why) => String(why ?? ''));
	return {
		partAssembly: analysis?.partAssembly ?? '',
		problem: analysis?.problem ?? '',
		rootCause: analysis?.rootCause ?? '',
		correctiveAction: analysis?.correctiveAction ?? '',
		whys: whys.length > 0 ? whys : ['']
	};
}

/**
 * Mock stand-in for the logged-in OS user (v1 read `user.id` from the OS
 * shell). Integration: resolve from the v2 OS user store instead.
 */
export const CURRENT_USER_ID = 1;

/**
 * v1 rule (canEditClosedTicketAlertId): the issue/sub-reason of a CLOSED
 * ticket may only be corrected during the shift the ticket belongs to,
 * plus a 10-minute grace period after shift end.
 */
export function canEditClosedTicketIssue(
	ticket: Pick<MaintenanceTicket, 'status' | 'shift_id' | 'shift_date'>,
	shifts: Shift[],
	now = new Date()
): boolean {
	if (ticket.status !== TICKET_STATUS.CLOSED) return false;
	if (ticket.shift_id == null || !ticket.shift_date) return false;
	const shift = shifts.find((row) => row.id === ticket.shift_id);
	if (!shift) return false;

	const [startHours = 0, startMinutes = 0] = shift.start_time.split(':').map(Number);
	const [endHours = 0, endMinutes = 0] = shift.end_time.split(':').map(Number);
	const shiftStart = new Date(`${ticket.shift_date}T00:00:00`);
	shiftStart.setHours(startHours, startMinutes, 0, 0);
	const shiftEnd = new Date(shiftStart);
	shiftEnd.setHours(endHours, endMinutes, 0, 0);
	if (shiftEnd.getTime() <= shiftStart.getTime()) {
		shiftEnd.setDate(shiftEnd.getDate() + 1);
	}
	const graceEnd = new Date(shiftEnd.getTime() + 10 * 60 * 1000);
	return now.getTime() >= shiftStart.getTime() && now.getTime() <= graceEnd.getTime();
}

/**
 * Module-raised scheduled tickets (event 6) stay hidden until their
 * planned start date arrives (v1 behaviour).
 */
export function isTicketVisibleToday(ticket: MaintenanceTicket, today = new Date()): boolean {
	if (ticket.event_id !== MAINTENANCE_MODULE_EVENT_ID) return true;
	const plannedStartDate = String(ticket.planned_start_date ?? '').split('T')[0];
	if (!plannedStartDate) return true;

	const year = today.getFullYear();
	const month = String(today.getMonth() + 1).padStart(2, '0');
	const day = String(today.getDate()).padStart(2, '0');
	return plannedStartDate <= `${year}-${month}-${day}`;
}
