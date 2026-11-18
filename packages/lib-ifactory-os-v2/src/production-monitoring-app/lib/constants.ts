/**
 * Magic ids carried over from v1 PMS. When the real backend integration
 * lands, reconcile these in ONE place: here.
 *
 * v1 sources: cms/items/machines.machine_type_id, synthetic CNC group 100.
 */
export const MACHINE_TYPES = {
	ANGLE: 1,
	PLATE: 2,
	MANUAL: 3,
	PLASMA: 4,
	GATEWAY: 5
} as const;

export type MachineTypeId = (typeof MACHINE_TYPES)[keyof typeof MACHINE_TYPES];

/** Synthetic "all machines in CNC-named groups" option (v1 Home/Machines). */
export const ALL_MACHINES_GROUP_ID = 0;
export const CNC_GROUP_ID = 100;

export const MACHINE_STATES = {
	IDLE: 1,
	SETUP: 2,
	PRODUCTION: 3,
	DOWNTIME: 4,
	MANAGEMENT_LOSS: 5,
	SHUTDOWN: 6
} as const;

/** v1: cms/items/maintenance_tickets.status — 2 and 3 are both in progress. */
export const TICKET_STATUS = {
	CLOSED: 0,
	OPEN: 1,
	IN_PROGRESS: 2,
	IN_PROGRESS_ALT: 3
} as const;

/** Offline if last_sync is older than this (v1: 24h). */
export const LAST_SYNC_ONLINE_MS = 24 * 60 * 60 * 1000;

export const PROD_REPORT_BAR_DURATION_HOURS = 2;
