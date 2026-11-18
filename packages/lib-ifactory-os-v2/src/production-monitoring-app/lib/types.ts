/**
 * Production monitoring domain types. Field names mirror v1 CMS collections
 * (machines, machine_group_master, production_data, machine_availability, …)
 * so the future backend integration only swaps API internals, not screens.
 */

import type { MachineTypeId } from './constants.js';

export type MachineFloorStatus =
	'Active' | 'Production' | 'Setup' | 'Offline' | 'Stopped' | 'Idle' | string;

export type MachineGroup = {
	id: number;
	name: string;
};

export type OperatorRef = {
	id: number;
	oid: string;
	name: string;
};

export type Shift = {
	id: number;
	name: string;
	start_time: string;
	end_time: string;
};

export type AlertMaster = {
	id: number;
	name: string;
};

export type Machine = {
	id: number;
	mid: string;
	name: string;
	status_id: number;
	machine_type_id: MachineTypeId;
	machine_group_id: number;
	prod_unit: string;
	oee: number | null;
	oid: number | null;
	jid: string | null;
	machine_state: number;
	status_code: number | null;
	interlock_state: boolean | null;
	last_sync: string;
	mac_id: string;
	energy_installed: boolean;
};

export type ProductionSample = {
	mid: number;
	ts: string;
	part_weight: number;
	jid: string;
	mir: string;
	operations: number;
};

export type ProductionAggregate = {
	mid: number;
	jid: string;
	mir: string;
	ts: string;
	total_weight: number;
	total_parts: number;
	total_operations: number;
	job_start_time: string;
	job_end_time: string;
	metadata?: {
		markings?: Record<string, JobMarkingMetadata>;
	};
};

export type JobMarkingMetadata = {
	marking?: string;
	pcsPerBar?: string;
	totalOperations?: number;
	poNo?: string;
	pcs?: string;
	markingLength?: string;
	partWeight?: number;
	totalParts?: number;
	quantity?: number;
	producedCount?: number;
};

export type AvailabilitySample = {
	mid: number;
	machine_state: number;
	status_code: number | null;
	duration_ms: number;
	operation_count: number;
	generated_at: string;
};

export type BreakdownEvent = {
	mid: number;
	created_at: string;
};

export type EnergyReading = {
	mid: number;
	ts: string;
	kWh: number;
};

export type MachineGroupOption = {
	value: string;
	label: string;
};

export type KpiOffset = {
	value: string;
	trend: string;
};

export type StatusBarSegment = 'primary' | 'online' | 'error' | 'loading' | 'offline';

export type DashboardMachineCard = {
	id: number;
	name: string;
	mid: string;
	status: MachineFloorStatus;
	cardStatus: 'online' | 'offline' | 'loading' | 'error';
	production: string;
	uom: string;
	oee: string;
	oeeNumeric: number | null;
	jobsCompleted: number;
	breakdowns: number;
	lastSync: string;
	/** Production vs highest machine — filled ticks; remainder is empty. */
	statusBar: StatusBarSegment[];
};

export type DashboardPayload = {
	totalWeight: KpiOffset;
	breakdowns: KpiOffset;
	oee: KpiOffset;
	jobsCompleted: KpiOffset;
	machines: DashboardMachineCard[];
	productionChart: {
		labels: string[];
		values: number[];
	};
};

export type MachineListRow = {
	id: number;
	machine_name: string;
	machine_status: MachineFloorStatus;
	operator_name: string;
	interlockState: string;
	last_sync: string;
	macId: string;
	isActive: boolean;
};

export type MachinesListPayload = {
	total: number;
	active: number;
	inactive: number;
	rows: MachineListRow[];
};

export type ProductionListRow = {
	id: number;
	machine_name: string;
	status: MachineFloorStatus;
	oee: string;
	uptime: number;
	downtime: number;
	totalProduction: string;
	energyConsumed: string;
	isActive: boolean;
};

export type ProductionListPayload = {
	total: number;
	active: number;
	inactive: number;
	totalProduction: string;
	totalEnergy: string;
	rows: ProductionListRow[];
};

export type MachineJobRow = {
	jid: string;
	machine_name: string;
	mir: string;
	sectionDM: string;
	allocationGroupNo: string;
	rmLength: string;
	totalWeight: string;
	totalParts: string;
	totalOperations: string;
	jobStartDate: string;
	jobEndDate: string;
	jobStatus: 'Completed' | 'In Progress';
};

export type JobMarkingRow = {
	id: string;
	marking: string;
	poNo: string;
	pcsPerBar: string;
	operations: number;
	pcs: string;
	progress: string;
	markingLength: string;
	partWeight: string;
};

export type MachineJobDetailsPayload = {
	jid: string;
	machineId: number;
	machineName: string;
	jobStatus: 'Completed' | 'In Progress';
	mir: string;
	rmLength: string;
	allocationGroup: string;
	uptimeMins: number;
	downtimeMins: number;
	jobStarted: string;
	jobEnded: string;
	totalWeight: string;
	markings: JobMarkingRow[];
};

export type JobsTab = 'completed' | 'inProgress' | 'assigned';

export type AssignedJobRow = {
	id: string;
	machine_id: number;
	machine_name: string;
	mir: string;
	sectionDM: string;
	allocationGroupNo: string;
	rmLength: string;
	plannedStartDate: string;
};

export type JobsListRow = {
	id: string;
	machine_id: number;
	jid: string;
	machine_name: string;
	mir: string;
	sectionDM: string;
	allocationGroupNo: string;
	rmLength: string;
	totalWeight: string;
	totalParts: string;
	totalOperations: string;
	jobStartDate: string;
	jobEndDate: string;
};

export type JobsListPayload = {
	total: number;
	completed: number;
	inProgress: number;
	assigned: number;
	assignedRows: AssignedJobRow[];
	inProgressRows: JobsListRow[];
	completedRows: JobsListRow[];
};

export type HmiJobRow = {
	id: string;
	machine_id: number;
	machine_name: string;
	po: string;
	mir: string;
	marking: string;
	sectionDM: string;
	rmLength: string;
	allocationGroupNo: string;
	createdAt: string;
};

export type MachineDetailsPayload = {
	id: number;
	name: string;
	mid: string;
	lastSync: string;
	status: MachineFloorStatus;
	cardStatus: 'online' | 'offline' | 'loading' | 'error';
	qty: string;
	partsProduced: number;
	operatorName: string;
	upTime: string;
	downTime: string;
	oee: string;
	energyConsumed: string;
	totalOperations: number;
	jobs: MachineJobRow[];
	performance: {
		labels: string[];
		values: number[];
		uom: string;
	};
	productionReport: {
		labels: string[];
		uptime: number[];
		downtime: number[];
	};
	downtime: {
		labels: string[];
		values: number[];
	};
};

export type TicketStatusCode = 0 | 1 | 2 | 3;
export type TicketStatusLabel = 'OPEN' | 'IN PROGRESS' | 'CLOSED';

export type TicketListRow = {
	id: number;
	ticket_id: number;
	machine_name: string;
	alert_name: string;
	ticket_status: TicketStatusCode;
	created_at: string;
	closed_at: string;
	duration: string;
	job_id: string;
	operator: string;
};

export type TicketsListPayload = {
	total: number;
	open: number;
	inProgress: number;
	closed: number;
	rows: TicketListRow[];
};

export type OperatorListRow = {
	id: number;
	operator_name: string;
	operator_id: string;
	duration: string;
	first_login: string;
	latest_logout: string;
	uptime: number;
	downtime: number;
	total_production: string;
};

export type SearchByMirRow = JobsListRow & {
	jobStatus: 'Completed' | 'In Progress';
};

export type SearchByMarkingRow = {
	id: string;
	marking: string;
	poNo: string;
	mir: string;
	sectionDimension: string;
	allocationGroup: string;
	mid: string;
	operator: string;
	pcsPerBar: string;
	pcs: string;
	progress: string;
	partWeight: string;
	totalWeight: string;
	markingLength: string;
};

/** Raw maintenance_tickets mock — v1 CMS item. */
export type MaintenanceTicket = {
	id: number;
	mid: number;
	alert_id: number | null;
	status: TicketStatusCode;
	created_at: string;
	closed_at: string | null;
	jid: string | null;
	oid: number | null;
};
