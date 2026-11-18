// Mock-backed tickets API. Integration note: v1 sources are
// cms/items/maintenance_tickets, ticket_instructions, tickets_comments,
// ticket_reason_changes and the reason-correction endpoint
// cms/maintenance/tickets/:id/reason-correction.
import {
	BREAKDOWN_ALERT_IDS,
	MAINTENANCE_MODULE_EVENT_ID,
	OTHER_TICKETS_EXCLUDED_ALERT_IDS,
	TICKET_EVENT_IDS
} from './constants.js';
import {
	mockTicketComments,
	mockTicketInstructions,
	mockTicketReasonChanges,
	mockTickets
} from './tickets.mock.js';
import { clone, mockDelay, nextMockId } from './mock-utils.js';
import type {
	MaintenanceTicket,
	TicketComment,
	TicketFile,
	TicketInstruction,
	TicketMetadata,
	TicketPriority,
	TicketReasonChange,
	TicketStatusCode
} from './types.js';

const ticketsStore: MaintenanceTicket[] = clone(mockTickets);
const ticketInstructionsStore: TicketInstruction[] = clone(mockTicketInstructions);
const commentsStore: TicketComment[] = clone(mockTicketComments);
const reasonChangesStore: TicketReasonChange[] = clone(mockTicketReasonChanges);

// --- Breadcrumb label registry (mirrors aps-app manufacturing-plans pattern) ---

const ticketLabels = new Map<string, string>();

export function getTicketLabel(ticketId: string): string {
	return ticketLabels.get(ticketId) ?? `Ticket ${ticketId}`;
}

export function rememberTicketLabel(ticketId: string, label: string): void {
	ticketLabels.set(ticketId, label);
}

// --- Ticket listing ---

export type TicketListKind = 'breakdown' | 'other';

export type TicketListFilter = {
	kind: TicketListKind;
	/** Status codes to include (server-side filter in v1). */
	statuses?: TicketStatusCode[];
	/** created_at range (closed tabs in v1). */
	from?: Date;
	till?: Date;
	/** Restrict to these machine/asset ids (machine-group filter). */
	machineIds?: number[];
};

function matchesKind(ticket: MaintenanceTicket, kind: TicketListKind): boolean {
	if (!TICKET_EVENT_IDS.some((id) => id === ticket.event_id)) return false;
	if (ticket.alert_id == null) return false;
	if (kind === 'breakdown') {
		return BREAKDOWN_ALERT_IDS.some((id) => id === ticket.alert_id);
	}
	return !OTHER_TICKETS_EXCLUDED_ALERT_IDS.some((id) => id === ticket.alert_id);
}

export async function listTickets(
	filter: TicketListFilter,
	signal?: AbortSignal
): Promise<MaintenanceTicket[]> {
	await mockDelay(signal);
	return clone(
		ticketsStore
			.filter((ticket) => matchesKind(ticket, filter.kind))
			.filter((ticket) => !filter.statuses || filter.statuses.includes(ticket.status))
			.filter((ticket) => {
				if (!filter.from || !filter.till) return true;
				const createdAt = new Date(ticket.created_at).getTime();
				return createdAt >= filter.from.getTime() && createdAt <= filter.till.getTime();
			})
			.filter(
				(ticket) =>
					!filter.machineIds ||
					filter.machineIds.length === 0 ||
					(ticket.mid != null && filter.machineIds.includes(ticket.mid))
			)
			.sort((a, b) => b.created_at.localeCompare(a.created_at))
	);
}

export async function getTicket(
	id: number,
	signal?: AbortSignal
): Promise<MaintenanceTicket | null> {
	await mockDelay(signal);
	const ticket = ticketsStore.find((row) => row.id === id);
	return ticket ? clone(ticket) : null;
}

export type CreateTicketInput = {
	mid: number;
	factory_id: number | null;
	alert_id: number;
	sub_alert_id: number | null;
	description: string | null;
	priority: TicketPriority | null;
	assigned_to: number | null;
	attendedBy: string;
	instruction_ids: number[];
};

export async function createTicket(
	input: CreateTicketInput,
	signal?: AbortSignal
): Promise<MaintenanceTicket> {
	await mockDelay(signal);
	const now = new Date();
	const ticket: MaintenanceTicket = {
		id: nextMockId(),
		ticket_id: crypto.randomUUID(),
		mid: input.mid,
		factory_id: input.factory_id,
		alert_id: input.alert_id,
		sub_alert_id: input.sub_alert_id,
		issue: null,
		description: input.description,
		event_id: MAINTENANCE_MODULE_EVENT_ID,
		status: 1,
		priority: input.priority,
		assigned_to: input.assigned_to,
		created_at: now.toISOString(),
		started_at: null,
		resolved_at: null,
		closed_at: null,
		shift_id: 1,
		shift_date: now.toISOString().slice(0, 10),
		planned_start_date: null,
		planned_start_time: null,
		attachments: [],
		metadata: input.attendedBy ? { attendedBy: input.attendedBy } : {}
	};
	ticketsStore.push(ticket);
	for (const instructionId of input.instruction_ids) {
		ticketInstructionsStore.push({
			id: nextMockId(),
			ticket_id: ticket.id,
			instruction_id: instructionId,
			is_completed: false
		});
	}
	return clone(ticket);
}

export type UpdateTicketInput = Partial<
	Pick<
		MaintenanceTicket,
		| 'mid'
		| 'alert_id'
		| 'sub_alert_id'
		| 'description'
		| 'priority'
		| 'assigned_to'
		| 'status'
		| 'started_at'
		| 'resolved_at'
		| 'closed_at'
		| 'attachments'
	>
> & { metadata?: TicketMetadata };

export async function updateTicket(
	id: number,
	patch: UpdateTicketInput,
	signal?: AbortSignal
): Promise<MaintenanceTicket> {
	await mockDelay(signal);
	const ticket = ticketsStore.find((row) => row.id === id);
	if (!ticket) throw new Error('Ticket not found.');
	Object.assign(ticket, clone(patch));
	return clone(ticket);
}

export async function deleteTicket(id: number, signal?: AbortSignal): Promise<void> {
	await mockDelay(signal);
	const index = ticketsStore.findIndex((row) => row.id === id);
	if (index >= 0) ticketsStore.splice(index, 1);
}

// --- Ticket instructions ---

export async function listTicketInstructions(
	ticketId: number,
	signal?: AbortSignal
): Promise<TicketInstruction[]> {
	await mockDelay(signal);
	return clone(ticketInstructionsStore.filter((row) => row.ticket_id === ticketId));
}

export async function addTicketInstructions(
	ticketId: number,
	instructionIds: number[],
	signal?: AbortSignal
): Promise<void> {
	await mockDelay(signal);
	const existing = new Set(
		ticketInstructionsStore
			.filter((row) => row.ticket_id === ticketId)
			.map((row) => row.instruction_id)
	);
	for (const instructionId of instructionIds) {
		if (existing.has(instructionId)) continue;
		ticketInstructionsStore.push({
			id: nextMockId(),
			ticket_id: ticketId,
			instruction_id: instructionId,
			is_completed: false
		});
	}
}

export async function setTicketInstructionCompleted(
	ticketInstructionId: number,
	isCompleted: boolean,
	signal?: AbortSignal
): Promise<void> {
	await mockDelay(signal);
	const row = ticketInstructionsStore.find((item) => item.id === ticketInstructionId);
	if (row) row.is_completed = isCompleted;
}

export async function removeTicketInstruction(
	ticketInstructionId: number,
	signal?: AbortSignal
): Promise<void> {
	await mockDelay(signal);
	const index = ticketInstructionsStore.findIndex((item) => item.id === ticketInstructionId);
	if (index >= 0) ticketInstructionsStore.splice(index, 1);
}

// --- Comments ---

export async function listTicketComments(
	ticketId: number,
	signal?: AbortSignal
): Promise<TicketComment[]> {
	await mockDelay(signal);
	return clone(
		commentsStore
			.filter((row) => row.ticket_id === ticketId)
			.sort((a, b) => b.created_at.localeCompare(a.created_at))
	);
}

export async function addTicketComment(
	ticketId: number,
	comment: string,
	userId: number | null,
	signal?: AbortSignal
): Promise<TicketComment> {
	await mockDelay(signal);
	const row: TicketComment = {
		id: nextMockId(),
		ticket_id: ticketId,
		comment,
		user_id: userId,
		created_at: new Date().toISOString()
	};
	commentsStore.push(row);
	return clone(row);
}

// --- Attachments (mock file registry; v1 used the CMS files endpoint) ---

const filesStore = new Map<string, TicketFile>();

export async function listTicketFiles(
	ticketId: number,
	signal?: AbortSignal
): Promise<TicketFile[]> {
	await mockDelay(signal);
	const ticket = ticketsStore.find((row) => row.id === ticketId);
	if (!ticket) return [];
	return ticket.attachments
		.map((fileId) => filesStore.get(fileId))
		.filter((file): file is TicketFile => file != null)
		.map((file) => ({ ...file }));
}

export async function uploadTicketAttachment(
	ticketId: number,
	file: File,
	signal?: AbortSignal
): Promise<TicketFile> {
	await mockDelay(signal, 400);
	const ticket = ticketsStore.find((row) => row.id === ticketId);
	if (!ticket) throw new Error('Ticket not found.');
	const stored: TicketFile = {
		id: crypto.randomUUID(),
		name: file.name,
		type: file.type,
		size: file.size,
		// Object URL keeps the preview/download working for the session.
		url: URL.createObjectURL(file)
	};
	filesStore.set(stored.id, stored);
	ticket.attachments.push(stored.id);
	return { ...stored };
}

export async function deleteTicketAttachment(
	ticketId: number,
	fileId: string,
	signal?: AbortSignal
): Promise<void> {
	await mockDelay(signal);
	const ticket = ticketsStore.find((row) => row.id === ticketId);
	if (!ticket) throw new Error('Ticket not found.');
	ticket.attachments = ticket.attachments.filter((id) => id !== fileId);
	filesStore.delete(fileId);
}

// --- Reason changes (audit log + correction) ---

export async function listReasonChanges(
	from: Date,
	till: Date,
	signal?: AbortSignal
): Promise<TicketReasonChange[]> {
	await mockDelay(signal);
	return clone(
		reasonChangesStore
			.filter((row) => {
				const changedAt = new Date(row.changed_at).getTime();
				return changedAt >= from.getTime() && changedAt <= till.getTime();
			})
			.sort((a, b) => b.changed_at.localeCompare(a.changed_at))
	);
}

export type ReasonCorrectionInput = {
	newAlertId: number;
	newSubAlertId: number | null;
	note: string;
	changedBy: number | null;
};

/** v1 endpoint: cms/maintenance/tickets/:id/reason-correction. */
export async function submitReasonCorrection(
	ticketId: number,
	input: ReasonCorrectionInput,
	signal?: AbortSignal
): Promise<void> {
	await mockDelay(signal);
	const ticket = ticketsStore.find((row) => row.id === ticketId);
	if (!ticket) throw new Error('Ticket not found.');
	reasonChangesStore.push({
		id: nextMockId(),
		ticket_id: ticketId,
		mid: ticket.mid,
		old_alert_id: ticket.alert_id,
		new_alert_id: input.newAlertId,
		old_sub_alert_id: ticket.sub_alert_id,
		new_sub_alert_id: input.newSubAlertId,
		note: input.note || null,
		changed_by: input.changedBy,
		changed_at: new Date().toISOString()
	});
	ticket.alert_id = input.newAlertId;
	ticket.sub_alert_id = input.newSubAlertId;
}
