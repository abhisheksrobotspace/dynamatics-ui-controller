/**
 * Maintenance domain types. Field names mirror the v1 CMS collections
 * (maintenance_tickets, ifactory_alerts_master, instructions, ...) in
 * snake_case so the future backend integration only swaps the API layer
 * internals, not the screens.
 */

/** 0 = Closed, 1 = Open, 2/3 = In Progress (see constants.ts). */
export type TicketStatusCode = 0 | 1 | 2 | 3;

export type TicketPriority = 'Low' | 'Medium' | 'High';

export type TicketAnalysis = {
	partAssembly: string;
	problem: string;
	rootCause: string;
	correctiveAction: string;
	/** 5-Whys chain; UI keeps at least one entry. */
	whys: string[];
};

export type TicketMetadata = {
	/** Contractor / external person who attended the ticket. */
	attendedBy?: string;
	analysis?: TicketAnalysis;
};

export type MaintenanceTicket = {
	id: number;
	/** External UUID-ish ticket reference. */
	ticket_id: string;
	/** Machine/asset id the ticket is raised against. */
	mid: number | null;
	factory_id: number | null;
	alert_id: number | null;
	sub_alert_id: number | null;
	issue: string | null;
	description: string | null;
	/** Origin event: 103/111 = ioWare devices, 6 = iFactory maintenance module. */
	event_id: number;
	status: TicketStatusCode;
	priority: TicketPriority | null;
	assigned_to: number | null;
	created_at: string;
	started_at: string | null;
	resolved_at: string | null;
	closed_at: string | null;
	shift_id: number | null;
	shift_date: string | null;
	planned_start_date: string | null;
	planned_start_time: string | null;
	/** File ids attached to the ticket. */
	attachments: string[];
	metadata: TicketMetadata;
};

/**
 * One row of the alert taxonomy. Three levels share this table:
 * top-level alert (no parent_id), sub-category (is_alert_sub_category,
 * parent = alert), reason (is_alert_reason, parent = sub-category).
 */
export type AlertMaster = {
	id: number;
	name: string;
	description: string | null;
	parent_id: number | null;
	is_alert_sub_category: boolean;
	is_alert_reason: boolean;
	alert_group_id: number | null;
	available_on_hmi: boolean;
};

export type Instruction = {
	id: number;
	instruction_text: string;
	estimated_duration_minutes: number;
};

/** Link row between a ticket and an instruction, with completion state. */
export type TicketInstruction = {
	id: number;
	ticket_id: number;
	instruction_id: number;
	is_completed: boolean;
};

export type TicketComment = {
	id: number;
	ticket_id: number;
	comment: string;
	user_id: number | null;
	created_at: string;
};

export type TicketReasonChange = {
	id: number;
	ticket_id: number;
	mid: number | null;
	old_alert_id: number | null;
	new_alert_id: number | null;
	old_sub_alert_id: number | null;
	new_sub_alert_id: number | null;
	note: string | null;
	changed_by: number | null;
	changed_at: string;
};

export type AssetRef = {
	id: number;
	display_id: string;
	name: string;
	model_no: string | null;
	factory_id: number | null;
	machine_group_id: number | null;
};

export type MachineGroup = {
	id: number;
	name: string;
};

export type UserRef = {
	id: number;
	first_name: string;
	last_name: string;
};

export type Shift = {
	id: number;
	name: string;
	/** HH:mm:ss */
	start_time: string;
	/** HH:mm:ss */
	end_time: string;
};

export type TicketFile = {
	id: string;
	name: string;
	type: string;
	size: number;
	url: string;
};

/** Scheduled preventive-maintenance event (calendar). */
export type ScheduledMaintenanceEvent = {
	id: number;
	title: string;
	mid: number | null;
	description: string | null;
	priority: TicketPriority | null;
	/** yyyy-mm-dd */
	start_date: string;
	/** HH:mm */
	start_time: string;
	duration_minutes: number;
	/** RFC 5545 RRULE string, or null for one-off events. */
	rrule: string | null;
	assigned_to: number | null;
	instruction_ids: number[];
	created_at: string;
};

/**
 * Stubbed approval request (v1 endpoint: cms/approvals/requests).
 * Schedule-affecting changes to events go through approvals, not direct writes.
 */
export type EventApprovalRequest = {
	id: number;
	approval_type: 'maintenance_events';
	event_id: number;
	action: 'update' | 'delete';
	/** For deletes: remove one occurrence or the whole series. */
	delete_scope?: 'current_only' | 'entire_series';
	changes?: Record<string, string>;
	request_comment: string | null;
	requested_at: string;
};
