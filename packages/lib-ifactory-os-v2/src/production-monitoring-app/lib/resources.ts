import {
	ALL_MACHINES_GROUP_ID,
	CNC_GROUP_ID,
	LAST_SYNC_ONLINE_MS,
	MACHINE_STATES,
	TICKET_STATUS
} from './constants.js';
import type {
	Machine,
	MachineFloorStatus,
	MachineGroup,
	StatusBarSegment,
	TicketStatusCode,
	TicketStatusLabel
} from './types.js';

/** Matches ui-v2 StatusBar default length so footers stay aligned. */
export const STATUS_BAR_SEGMENT_COUNT = 19;

/**
 * StatusBar fill vs the highest production on any machine in the current set.
 * Filled ticks are all `online`; remainder is `offline`. `0` leaves the bar empty.
 */
export function buildStatusBarSegments(
	production: number,
	maxProduction: number,
	length = STATUS_BAR_SEGMENT_COUNT
): StatusBarSegment[] {
	const filledCount = filledStatusBarCount(production, maxProduction, length);
	return Array.from({ length }, (_, index) => (index < filledCount ? 'online' : 'offline'));
}

function filledStatusBarCount(production: number, maxProduction: number, length: number): number {
	if (!(production > 0) || !(maxProduction > 0)) return 0;
	if (production >= maxProduction) return length;
	return Math.min(length, Math.round((production / maxProduction) * length));
}

export function getMachineAvailability(data: {
	uptime: number;
	downtime: number;
	shutdown: number;
	setup: number;
	managementLoss: number;
}): { availability: number; oee: number } {
	const machineOperatingTime = data.uptime;
	const availability =
		Number.parseFloat(
			(
				(machineOperatingTime / (machineOperatingTime + data.downtime + data.managementLoss)) *
				100
			).toFixed(2)
		) || 0;
	const machineNetOperationTime = machineOperatingTime * (1 - data.setup / 1000);
	const performance =
		machineOperatingTime === 0 ? 0 : machineNetOperationTime / machineOperatingTime;
	const oee = Number.parseFloat(((availability / 100) * performance * 100 || 0).toFixed(2));
	return { availability, oee };
}

export function splitJid(jid: string | null | undefined): {
	mir: string;
	sectionDM: string;
	allocGroupNo: string;
	rmLength: string;
} {
	const parts = jid?.split('-') ?? [];
	return {
		mir: parts[0] || '-',
		sectionDM: parts[1] || '-',
		allocGroupNo: parts[2] || '-',
		rmLength: parts[3] || '-'
	};
}

export function formatPercentageOffset(
	current: number,
	previous: number,
	durationLabel: string
): { value: string; trend: string } {
	if (previous === 0 && current > 0) {
		return { value: String(current), trend: `↑ 100% from last ${durationLabel}` };
	}
	if (previous === 0 && current === 0) {
		return { value: String(current), trend: `0% from last ${durationLabel}` };
	}
	const change = ((current - previous) / previous) * 100;
	const abs = Math.abs(change);
	const formatted = abs % 1 === 0 ? abs.toFixed(0) : abs.toFixed(1);
	const arrow = change > 0 ? '↑' : change < 0 ? '↓' : '';
	return {
		value: String(current),
		trend: `${arrow} ${formatted}% from last ${durationLabel}`.trim()
	};
}

export function resolveFloorStatus(
	machine: Pick<Machine, 'last_sync' | 'machine_state' | 'status_code'>,
	alertNameById: Map<number, string>,
	now = Date.now()
): MachineFloorStatus {
	const lastSync = new Date(machine.last_sync).getTime();
	if (!machine.last_sync || Number.isNaN(lastSync) || now - lastSync > LAST_SYNC_ONLINE_MS) {
		return 'Offline';
	}
	if (machine.machine_state === MACHINE_STATES.SETUP) return 'Setup';
	if (machine.machine_state === MACHINE_STATES.PRODUCTION) return 'Active';
	if (machine.status_code != null) return alertNameById.get(machine.status_code) ?? 'Stopped';
	return 'Stopped';
}

export function toCardStatus(
	status: MachineFloorStatus
): 'online' | 'offline' | 'loading' | 'error' {
	const normalised = status.toLowerCase();
	if (normalised === 'active' || normalised === 'production') return 'online';
	if (normalised === 'setup' || normalised === 'idle') return 'loading';
	if (normalised === 'offline') return 'offline';
	return 'error';
}

export function toBadgeVariant(
	status: MachineFloorStatus
): 'online' | 'offline' | 'loading' | 'error' {
	return toCardStatus(status);
}

export function ticketStatusLabel(status: TicketStatusCode): TicketStatusLabel {
	if (status === TICKET_STATUS.OPEN) return 'OPEN';
	if (status === TICKET_STATUS.IN_PROGRESS || status === TICKET_STATUS.IN_PROGRESS_ALT) {
		return 'IN PROGRESS';
	}
	return 'CLOSED';
}

export function isTicketOpen(status: TicketStatusCode): boolean {
	return status === TICKET_STATUS.OPEN;
}

export function isTicketInProgress(status: TicketStatusCode): boolean {
	return status === TICKET_STATUS.IN_PROGRESS || status === TICKET_STATUS.IN_PROGRESS_ALT;
}

export function isTicketClosed(status: TicketStatusCode): boolean {
	return status === TICKET_STATUS.CLOSED;
}

export function toTicketBadgeVariant(
	status: TicketStatusCode
): 'online' | 'offline' | 'loading' | 'error' {
	if (isTicketOpen(status)) return 'error';
	if (isTicketInProgress(status)) return 'loading';
	if (isTicketClosed(status)) return 'online';
	return 'offline';
}

export function toJobOrTicketBadgeVariant(
	status: string | number
): 'online' | 'offline' | 'loading' | 'error' {
	const code = typeof status === 'number' ? status : Number(status.trim());
	if (
		code === TICKET_STATUS.CLOSED ||
		code === TICKET_STATUS.OPEN ||
		code === TICKET_STATUS.IN_PROGRESS ||
		code === TICKET_STATUS.IN_PROGRESS_ALT
	) {
		return toTicketBadgeVariant(code);
	}
	if (typeof status !== 'string') return 'offline';
	const normalised = status.replace(/\s+/g, '').toLowerCase();
	if (normalised === 'completed' || normalised === 'closed') return 'online';
	if (normalised === 'inprogress') return 'loading';
	if (normalised === 'open') return 'error';
	return 'offline';
}

export function isMachineActive(status: MachineFloorStatus): boolean {
	return status !== 'Offline';
}

export function matchesMachineGroup(
	machine: Pick<Machine, 'machine_group_id' | 'machine_type_id'>,
	groupId: number,
	groups: MachineGroup[]
): boolean {
	if (groupId === ALL_MACHINES_GROUP_ID) return true;
	if (groupId === CNC_GROUP_ID) {
		const cncIds = groups.filter((group) => /\bcnc\b/i.test(group.name)).map((group) => group.id);
		return cncIds.includes(machine.machine_group_id);
	}
	return machine.machine_group_id === groupId;
}

export function inRange(iso: string, from: Date, to: Date): boolean {
	const ts = new Date(iso).getTime();
	return ts >= from.getTime() && ts <= to.getTime();
}

export function minutesFromMs(ms: number): number {
	return Math.round(ms / 60_000);
}

/** Clock-style duration used on tickets / operators (`HH:MM:SS` plus optional days). */
export function formatClockDuration(
	fromIso: string,
	toIso?: string | null,
	now = Date.now()
): string {
	const start = new Date(fromIso).getTime();
	const end = toIso ? new Date(toIso).getTime() : now;
	if (Number.isNaN(start) || Number.isNaN(end)) return '-';
	const ms = Math.abs(end - start);
	const clock = new Date(ms).toISOString().substring(11, 19);
	const days = Math.floor(ms / 86_400_000);
	return days ? `${clock} + ${days} (d)` : clock;
}
