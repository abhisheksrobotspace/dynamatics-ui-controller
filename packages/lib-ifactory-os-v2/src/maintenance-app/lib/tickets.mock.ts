import type {
	MaintenanceTicket,
	TicketComment,
	TicketInstruction,
	TicketReasonChange
} from './types.js';

/** ISO timestamp `days` back from now, at the given hour/minute. */
function daysAgo(days: number, hour = 9, minute = 0): string {
	const date = new Date();
	date.setDate(date.getDate() - days);
	date.setHours(hour, minute, 0, 0);
	return date.toISOString();
}

function dateKey(days: number): string {
	const date = new Date();
	date.setDate(date.getDate() - days);
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

function hoursAgo(hours: number): string {
	return new Date(Date.now() - hours * 3_600_000).toISOString();
}

/** Shift id (mockShifts) whose window contains "now" — A 06-14, B 14-22, C 22-06. */
function currentShiftId(): number {
	const hour = new Date().getHours();
	if (hour >= 6 && hour < 14) return 1;
	if (hour >= 14 && hour < 22) return 2;
	return 3;
}

/** Day the current shift started on (night shift after midnight began yesterday). */
function currentShiftDateKey(): string {
	return new Date().getHours() < 6 ? dateKey(1) : dateKey(0);
}

export const mockTickets: MaintenanceTicket[] = [
	// --- Open / in-progress breakdown tickets ---
	{
		id: 1001,
		ticket_id: 'a1f61c3e-0001-4d6e-9df1-1b3f6f1c0001',
		mid: 101,
		factory_id: 1,
		alert_id: 3,
		sub_alert_id: 31,
		issue: null,
		description: 'Spindle vibration beyond limit, bearing suspected.',
		event_id: 103,
		status: 1,
		priority: 'High',
		assigned_to: 1,
		created_at: daysAgo(0, 7, 40),
		started_at: null,
		resolved_at: null,
		closed_at: null,
		shift_id: 1,
		shift_date: dateKey(0),
		planned_start_date: null,
		planned_start_time: null,
		attachments: [],
		metadata: {}
	},
	{
		id: 1002,
		ticket_id: 'a1f61c3e-0002-4d6e-9df1-1b3f6f1c0002',
		mid: 103,
		factory_id: 1,
		alert_id: 3,
		sub_alert_id: 33,
		issue: null,
		description: 'Punching motor tripping on overload.',
		event_id: 111,
		status: 2,
		priority: 'Medium',
		assigned_to: 2,
		created_at: daysAgo(1, 11, 15),
		started_at: daysAgo(1, 12, 5),
		resolved_at: null,
		closed_at: null,
		shift_id: 2,
		shift_date: dateKey(1),
		planned_start_date: null,
		planned_start_time: null,
		attachments: [],
		metadata: { attendedBy: 'Sai Electricals' }
	},
	{
		id: 1003,
		ticket_id: 'a1f61c3e-0003-4d6e-9df1-1b3f6f1c0003',
		mid: 104,
		factory_id: 1,
		alert_id: 13,
		sub_alert_id: 35,
		issue: null,
		description: 'Oil pooling under press ram.',
		event_id: 6,
		status: 3,
		priority: 'High',
		assigned_to: 3,
		created_at: daysAgo(2, 8, 0),
		started_at: daysAgo(2, 9, 30),
		resolved_at: null,
		closed_at: null,
		shift_id: 1,
		shift_date: dateKey(2),
		planned_start_date: dateKey(2),
		planned_start_time: '08:00',
		attachments: [],
		metadata: {}
	},
	{
		id: 1004,
		ticket_id: 'a1f61c3e-0004-4d6e-9df1-1b3f6f1c0004',
		mid: 102,
		factory_id: 1,
		alert_id: 3,
		sub_alert_id: 32,
		issue: null,
		description: 'Feed conveyor belt snapped mid-run.',
		event_id: 103,
		status: 1,
		priority: 'Medium',
		assigned_to: null,
		created_at: daysAgo(0, 10, 20),
		started_at: null,
		resolved_at: null,
		closed_at: null,
		shift_id: 1,
		shift_date: dateKey(0),
		planned_start_date: null,
		planned_start_time: null,
		attachments: [],
		metadata: {}
	},

	// --- Closed breakdown tickets (attended: have started_at) ---
	{
		id: 1005,
		ticket_id: 'a1f61c3e-0005-4d6e-9df1-1b3f6f1c0005',
		mid: 101,
		factory_id: 1,
		alert_id: 3,
		sub_alert_id: 34,
		issue: null,
		description: 'Control cabinet fuse blown after power dip.',
		event_id: 111,
		status: 0,
		priority: 'Low',
		assigned_to: 2,
		created_at: daysAgo(4, 14, 10),
		started_at: daysAgo(4, 14, 45),
		resolved_at: daysAgo(4, 16, 0),
		closed_at: daysAgo(4, 16, 30),
		shift_id: 2,
		shift_date: dateKey(4),
		planned_start_date: null,
		planned_start_time: null,
		attachments: [],
		metadata: {
			attendedBy: '',
			analysis: {
				partAssembly: 'Control cabinet',
				problem: 'Main control fuse blown',
				rootCause: 'Voltage dip caused inrush current on restart',
				correctiveAction: 'Replaced fuse, added restart delay timer',
				whys: [
					'Fuse blew on restart',
					'Inrush current exceeded rating',
					'No restart delay configured'
				]
			}
		}
	},
	{
		id: 1006,
		ticket_id: 'a1f61c3e-0006-4d6e-9df1-1b3f6f1c0006',
		mid: 105,
		factory_id: 1,
		alert_id: 13,
		sub_alert_id: 36,
		issue: null,
		description: 'Kettle burner pressure dropping intermittently.',
		event_id: 103,
		status: 0,
		priority: 'High',
		assigned_to: 3,
		created_at: daysAgo(6, 6, 50),
		started_at: daysAgo(6, 7, 30),
		resolved_at: daysAgo(6, 11, 0),
		closed_at: daysAgo(6, 11, 20),
		shift_id: 1,
		shift_date: dateKey(6),
		planned_start_date: null,
		planned_start_time: null,
		attachments: [],
		metadata: { attendedBy: 'ThermoServ AMC' }
	},

	// --- Closed unattended breakdown ticket (no started_at) ---
	{
		id: 1007,
		ticket_id: 'a1f61c3e-0007-4d6e-9df1-1b3f6f1c0007',
		mid: 106,
		factory_id: 1,
		alert_id: 3,
		sub_alert_id: null,
		issue: null,
		description: 'Crane limit switch alarm; self-resolved after reset.',
		event_id: 111,
		status: 0,
		priority: null,
		assigned_to: null,
		created_at: daysAgo(3, 19, 5),
		started_at: null,
		resolved_at: null,
		closed_at: daysAgo(3, 19, 40),
		shift_id: 2,
		shift_date: dateKey(3),
		planned_start_date: null,
		planned_start_time: null,
		attachments: [],
		metadata: {}
	},

	// --- Closed within the current shift (demoes the reason-correction window) ---
	{
		id: 1011,
		ticket_id: 'a1f61c3e-0011-4d6e-9df1-1b3f6f1c0011',
		mid: 102,
		factory_id: 1,
		alert_id: 3,
		sub_alert_id: 31,
		issue: null,
		description: 'Spindle jam cleared after tool change.',
		event_id: 103,
		status: 0,
		priority: 'Medium',
		assigned_to: 1,
		created_at: hoursAgo(3),
		started_at: hoursAgo(2.5),
		resolved_at: hoursAgo(1),
		closed_at: hoursAgo(0.5),
		shift_id: currentShiftId(),
		shift_date: currentShiftDateKey(),
		planned_start_date: null,
		planned_start_time: null,
		attachments: [],
		metadata: {}
	},

	// --- Other (non-breakdown) tickets ---
	{
		id: 1008,
		ticket_id: 'a1f61c3e-0008-4d6e-9df1-1b3f6f1c0008',
		mid: 103,
		factory_id: 1,
		alert_id: 4,
		sub_alert_id: null,
		issue: null,
		description: 'Burrs on punched holes above tolerance.',
		event_id: 103,
		status: 1,
		priority: 'Medium',
		assigned_to: 4,
		created_at: daysAgo(1, 9, 45),
		started_at: null,
		resolved_at: null,
		closed_at: null,
		shift_id: 1,
		shift_date: dateKey(1),
		planned_start_date: null,
		planned_start_time: null,
		attachments: [],
		metadata: {}
	},
	{
		id: 1009,
		ticket_id: 'a1f61c3e-0009-4d6e-9df1-1b3f6f1c0009',
		mid: 106,
		factory_id: 1,
		alert_id: 5,
		sub_alert_id: null,
		issue: null,
		description: 'Walkway guard rail loose near crane bay.',
		event_id: 6,
		status: 2,
		priority: 'High',
		assigned_to: 1,
		created_at: daysAgo(2, 13, 30),
		started_at: daysAgo(2, 15, 0),
		resolved_at: null,
		closed_at: null,
		shift_id: 2,
		shift_date: dateKey(2),
		planned_start_date: dateKey(2),
		planned_start_time: '13:00',
		attachments: [],
		metadata: {}
	},
	{
		id: 1010,
		ticket_id: 'a1f61c3e-0010-4d6e-9df1-1b3f6f1c0010',
		mid: 105,
		factory_id: 1,
		alert_id: 4,
		sub_alert_id: null,
		issue: null,
		description: 'Zinc coating thickness below spec on batch 88.',
		event_id: 111,
		status: 0,
		priority: 'Low',
		assigned_to: 4,
		created_at: daysAgo(5, 10, 0),
		started_at: daysAgo(5, 10, 40),
		resolved_at: daysAgo(5, 12, 30),
		closed_at: daysAgo(5, 13, 0),
		shift_id: 1,
		shift_date: dateKey(5),
		planned_start_date: null,
		planned_start_time: null,
		attachments: [],
		metadata: {}
	},
	{
		id: 1011,
		ticket_id: 'a1f61c3e-0001-4d6e-9df1-1b3f6f1c0001',
		mid: 101,
		factory_id: 1,
		alert_id: 3,
		sub_alert_id: 31,
		issue: null,
		description: 'Spindle vibration beyond limit, bearing suspected.',
		event_id: 103,
		status: 1,
		priority: 'High',
		assigned_to: 1,
		created_at: daysAgo(0, 7, 40),
		started_at: null,
		resolved_at: null,
		closed_at: null,
		shift_id: 1,
		shift_date: dateKey(0),
		planned_start_date: null,
		planned_start_time: null,
		attachments: [],
		metadata: {}
	},
	{
		id: 1012,
		ticket_id: 'a1f61c3e-0002-4d6e-9df1-1b3f6f1c0002',
		mid: 103,
		factory_id: 1,
		alert_id: 3,
		sub_alert_id: 33,
		issue: null,
		description: 'Punching motor tripping on overload.',
		event_id: 111,
		status: 2,
		priority: 'Medium',
		assigned_to: 2,
		created_at: daysAgo(1, 11, 15),
		started_at: daysAgo(1, 12, 5),
		resolved_at: null,
		closed_at: null,
		shift_id: 2,
		shift_date: dateKey(1),
		planned_start_date: null,
		planned_start_time: null,
		attachments: [],
		metadata: { attendedBy: 'Sai Electricals' }
	},
	{
		id: 1013,
		ticket_id: 'a1f61c3e-0003-4d6e-9df1-1b3f6f1c0003',
		mid: 104,
		factory_id: 1,
		alert_id: 13,
		sub_alert_id: 35,
		issue: null,
		description: 'Oil pooling under press ram.',
		event_id: 6,
		status: 3,
		priority: 'High',
		assigned_to: 3,
		created_at: daysAgo(2, 8, 0),
		started_at: daysAgo(2, 9, 30),
		resolved_at: null,
		closed_at: null,
		shift_id: 1,
		shift_date: dateKey(2),
		planned_start_date: dateKey(2),
		planned_start_time: '08:00',
		attachments: [],
		metadata: {}
	},
	{
		id: 1014,
		ticket_id: 'a1f61c3e-0004-4d6e-9df1-1b3f6f1c0004',
		mid: 102,
		factory_id: 1,
		alert_id: 3,
		sub_alert_id: 32,
		issue: null,
		description: 'Feed conveyor belt snapped mid-run.',
		event_id: 103,
		status: 1,
		priority: 'Medium',
		assigned_to: null,
		created_at: daysAgo(0, 10, 20),
		started_at: null,
		resolved_at: null,
		closed_at: null,
		shift_id: 1,
		shift_date: dateKey(0),
		planned_start_date: null,
		planned_start_time: null,
		attachments: [],
		metadata: {}
	}
];

export const mockTicketInstructions: TicketInstruction[] = [
	{ id: 1, ticket_id: 1001, instruction_id: 1, is_completed: true },
	{ id: 2, ticket_id: 1001, instruction_id: 4, is_completed: false },
	{ id: 3, ticket_id: 1002, instruction_id: 1, is_completed: true },
	{ id: 4, ticket_id: 1002, instruction_id: 7, is_completed: false },
	{ id: 5, ticket_id: 1003, instruction_id: 3, is_completed: false },
	{ id: 6, ticket_id: 1005, instruction_id: 5, is_completed: true }
];

export const mockTicketComments: TicketComment[] = [
	{
		id: 1,
		ticket_id: 1001,
		comment: 'Vibration reading 12 mm/s at spindle housing. Ordered replacement bearing.',
		user_id: 1,
		created_at: daysAgo(0, 8, 30)
	},
	{
		id: 2,
		ticket_id: 1002,
		comment: 'Megger test done, winding insulation OK. Suspect overload relay drift.',
		user_id: 2,
		created_at: daysAgo(1, 13, 10)
	},
	{
		id: 3,
		ticket_id: 1005,
		comment: 'Fuse replaced and restart delay set to 5s.',
		user_id: 2,
		created_at: daysAgo(4, 15, 50)
	}
];

export const mockTicketReasonChanges: TicketReasonChange[] = [
	{
		id: 1,
		ticket_id: 1005,
		mid: 101,
		old_alert_id: 4,
		new_alert_id: 3,
		old_sub_alert_id: null,
		new_sub_alert_id: 34,
		note: 'Misclassified as quality issue at HMI; actual cause was electrical.',
		changed_by: 2,
		changed_at: daysAgo(4, 17, 0)
	},
	{
		id: 2,
		ticket_id: 1006,
		mid: 105,
		old_alert_id: 3,
		new_alert_id: 13,
		old_sub_alert_id: 33,
		new_sub_alert_id: 36,
		note: 'Burner is utility equipment; moved to utility breakdown.',
		changed_by: 3,
		changed_at: daysAgo(5, 9, 20)
	}
];
