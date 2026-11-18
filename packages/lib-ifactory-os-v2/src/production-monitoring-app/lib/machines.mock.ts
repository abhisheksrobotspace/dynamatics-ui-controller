import { MACHINE_STATES, MACHINE_TYPES } from './constants.js';
import type {
	AlertMaster,
	AssignedJobRow,
	AvailabilitySample,
	BreakdownEvent,
	EnergyReading,
	HmiJobRow,
	Machine,
	MachineGroup,
	MaintenanceTicket,
	OperatorRef,
	ProductionAggregate,
	ProductionSample,
	Shift
} from './types.js';

const now = Date.now();

function isoHoursAgo(hours: number): string {
	return new Date(now - hours * 3_600_000).toISOString();
}

export const mockMachineGroups: MachineGroup[] = [
	{ id: 1, name: 'CNC Angle Line' },
	{ id: 2, name: 'CNC Plate Line' },
	{ id: 3, name: 'Plasma Bay' },
	{ id: 4, name: 'Manual Stations' }
];

export const mockOperators: OperatorRef[] = [
	{ id: 1, oid: 'OP01', name: 'Ravi Kumar' },
	{ id: 2, oid: 'OP02', name: 'Sunita Patil' },
	{ id: 3, oid: 'OP03', name: 'Mohan Das' },
	{ id: 4, oid: 'OP04', name: 'Ayesha Khan' }
];

export const mockShifts: Shift[] = [
	{ id: 1, name: 'Shift A', start_time: '06:00:00', end_time: '14:00:00' },
	{ id: 2, name: 'Shift B', start_time: '14:00:00', end_time: '22:00:00' },
	{ id: 3, name: 'Shift C', start_time: '22:00:00', end_time: '06:00:00' }
];

export const mockAlerts: AlertMaster[] = [
	{ id: 1, name: 'Idle' },
	{ id: 3, name: 'Breakdown' },
	{ id: 4, name: 'No Material' },
	{ id: 7, name: 'Tool Change' }
];

export const mockMachines: Machine[] = [
	{
		id: 101,
		mid: 'CNC-01',
		name: 'CNC Angle Line 1',
		status_id: 1,
		machine_type_id: MACHINE_TYPES.ANGLE,
		machine_group_id: 1,
		prod_unit: 'MT',
		oee: 0.86,
		oid: 1,
		jid: 'MIR210-50x50x6-2-12000',
		machine_state: MACHINE_STATES.PRODUCTION,
		status_code: null,
		interlock_state: true,
		last_sync: isoHoursAgo(0.2),
		mac_id: 'A4:CF:12:88:01:11',
		energy_installed: true
	},
	{
		id: 102,
		mid: 'CNC-02',
		name: 'CNC Angle Line 2',
		status_id: 1,
		machine_type_id: MACHINE_TYPES.ANGLE,
		machine_group_id: 1,
		prod_unit: 'MT',
		oee: 0.74,
		oid: 2,
		jid: 'MIR211-65x65x6-1-9000',
		machine_state: MACHINE_STATES.SETUP,
		status_code: null,
		interlock_state: true,
		last_sync: isoHoursAgo(0.5),
		mac_id: 'A4:CF:12:88:01:12',
		energy_installed: true
	},
	{
		id: 103,
		mid: 'PLT-01',
		name: 'CNC Plate Line 1',
		status_id: 1,
		machine_type_id: MACHINE_TYPES.PLATE,
		machine_group_id: 2,
		prod_unit: 'MT',
		oee: 0.81,
		oid: 3,
		jid: 'MIR340-PL12',
		machine_state: MACHINE_STATES.PRODUCTION,
		status_code: null,
		interlock_state: false,
		last_sync: isoHoursAgo(1.1),
		mac_id: 'A4:CF:12:88:02:21',
		energy_installed: true
	},
	{
		id: 104,
		mid: 'PLM-01',
		name: 'Plasma Table 1',
		status_id: 1,
		machine_type_id: MACHINE_TYPES.PLASMA,
		machine_group_id: 3,
		prod_unit: 'MT',
		oee: 0.62,
		oid: 4,
		jid: 'MIR410-MARK-A',
		machine_state: MACHINE_STATES.DOWNTIME,
		status_code: 3,
		interlock_state: true,
		last_sync: isoHoursAgo(0.8),
		mac_id: 'A4:CF:12:88:03:31',
		energy_installed: false
	},
	{
		id: 105,
		mid: 'MAN-01',
		name: 'Manual Fit-up 1',
		status_id: 1,
		machine_type_id: MACHINE_TYPES.MANUAL,
		machine_group_id: 4,
		prod_unit: 'MT',
		oee: 0.55,
		oid: null,
		jid: null,
		machine_state: MACHINE_STATES.IDLE,
		status_code: 4,
		interlock_state: null,
		last_sync: isoHoursAgo(3),
		mac_id: 'A4:CF:12:88:04:41',
		energy_installed: false
	},
	{
		id: 106,
		mid: 'CNC-03',
		name: 'CNC Angle Line 3',
		status_id: 1,
		machine_type_id: MACHINE_TYPES.ANGLE,
		machine_group_id: 1,
		prod_unit: 'MT',
		oee: null,
		oid: 1,
		jid: null,
		machine_state: MACHINE_STATES.SHUTDOWN,
		status_code: 7,
		interlock_state: false,
		last_sync: isoHoursAgo(36),
		mac_id: 'A4:CF:12:88:01:13',
		energy_installed: true
	}
];

function samplesFor(
	mid: number,
	jid: string,
	mir: string,
	weightsKg: Array<{ hoursAgo: number; weight: number; operations: number }>
): ProductionSample[] {
	return weightsKg.map((sample) => ({
		mid,
		jid,
		mir,
		ts: isoHoursAgo(sample.hoursAgo),
		part_weight: sample.weight,
		operations: sample.operations
	}));
}

export const mockProductionSamples: ProductionSample[] = [
	...samplesFor(101, 'MIR210-50x50x6-2-12000', 'MIR210', [
		{ hoursAgo: 2, weight: 420_000, operations: 12 },
		{ hoursAgo: 8, weight: 380_000, operations: 10 },
		{ hoursAgo: 20, weight: 410_000, operations: 11 },
		{ hoursAgo: 32, weight: 360_000, operations: 9 },
		{ hoursAgo: 50, weight: 390_000, operations: 10 },
		{ hoursAgo: 70, weight: 340_000, operations: 8 },
		{ hoursAgo: 90, weight: 355_000, operations: 9 },
		{ hoursAgo: 110, weight: 300_000, operations: 7 },
		{ hoursAgo: 140, weight: 280_000, operations: 6 },
		{ hoursAgo: 180, weight: 250_000, operations: 6 }
	]),
	...samplesFor(102, 'MIR211-65x65x6-1-9000', 'MIR211', [
		{ hoursAgo: 4, weight: 210_000, operations: 6 },
		{ hoursAgo: 16, weight: 240_000, operations: 7 },
		{ hoursAgo: 28, weight: 190_000, operations: 5 },
		{ hoursAgo: 44, weight: 220_000, operations: 6 },
		{ hoursAgo: 68, weight: 180_000, operations: 5 },
		{ hoursAgo: 100, weight: 160_000, operations: 4 },
		{ hoursAgo: 150, weight: 140_000, operations: 4 }
	]),
	...samplesFor(103, 'MIR340-PL12', 'MIR340', [
		{ hoursAgo: 3, weight: 510_000, operations: 14 },
		{ hoursAgo: 14, weight: 470_000, operations: 12 },
		{ hoursAgo: 26, weight: 495_000, operations: 13 },
		{ hoursAgo: 48, weight: 430_000, operations: 11 },
		{ hoursAgo: 72, weight: 400_000, operations: 10 },
		{ hoursAgo: 96, weight: 380_000, operations: 9 },
		{ hoursAgo: 160, weight: 320_000, operations: 8 }
	]),
	...samplesFor(104, 'MIR410-MARK-A', 'MIR410', [
		{ hoursAgo: 6, weight: 90_000, operations: 4 },
		{ hoursAgo: 22, weight: 110_000, operations: 5 },
		{ hoursAgo: 40, weight: 80_000, operations: 3 },
		{ hoursAgo: 80, weight: 70_000, operations: 3 },
		{ hoursAgo: 130, weight: 60_000, operations: 2 }
	]),
	...samplesFor(105, 'PO88-FIT1', 'PO88', [
		{ hoursAgo: 5, weight: 40_000, operations: 2 },
		{ hoursAgo: 18, weight: 35_000, operations: 2 },
		{ hoursAgo: 42, weight: 30_000, operations: 1 },
		{ hoursAgo: 88, weight: 28_000, operations: 1 }
	])
];

export const mockProductionAggregates: ProductionAggregate[] = [
	{
		mid: 101,
		jid: 'MIR209-40x40x5-1-8000',
		mir: 'MIR209',
		ts: isoHoursAgo(30),
		total_weight: 1_150_000,
		total_parts: 42,
		total_operations: 86,
		job_start_time: isoHoursAgo(54),
		job_end_time: isoHoursAgo(30),
		metadata: {
			markings: {
				'MK-A-PO1001': {
					marking: 'MK-A',
					poNo: 'PO1001',
					pcsPerBar: '4',
					totalOperations: 44,
					pcs: '12',
					markingLength: '8000',
					partWeight: 27_500,
					totalParts: 36,
					producedCount: 36
				},
				'MK-B-PO1002': {
					marking: 'MK-B',
					poNo: 'PO1002',
					pcsPerBar: '3',
					totalOperations: 42,
					pcs: '10',
					markingLength: '7600',
					partWeight: 29_800,
					totalParts: 6,
					producedCount: 6
				}
			}
		}
	},
	{
		mid: 101,
		jid: 'MIR208-50x50x6-3-11000',
		mir: 'MIR208',
		ts: isoHoursAgo(78),
		total_weight: 980_000,
		total_parts: 36,
		total_operations: 70,
		job_start_time: isoHoursAgo(100),
		job_end_time: isoHoursAgo(78)
	},
	{
		mid: 102,
		jid: 'MIR200-65x65x8-1-7000',
		mir: 'MIR200',
		ts: isoHoursAgo(40),
		total_weight: 640_000,
		total_parts: 22,
		total_operations: 40,
		job_start_time: isoHoursAgo(62),
		job_end_time: isoHoursAgo(40),
		metadata: {
			markings: {
				'MK-C-PO2201': {
					marking: 'MK-C',
					poNo: 'PO2201',
					pcsPerBar: '2',
					totalOperations: 40,
					pcs: '11',
					markingLength: '7000',
					partWeight: 29_090,
					totalParts: 22,
					producedCount: 22
				}
			}
		}
	},
	{
		mid: 103,
		jid: 'MIR339-PL10',
		mir: 'MIR339',
		ts: isoHoursAgo(36),
		total_weight: 1_420_000,
		total_parts: 18,
		total_operations: 54,
		job_start_time: isoHoursAgo(60),
		job_end_time: isoHoursAgo(36)
	},
	{
		mid: 104,
		jid: 'MIR409-MARK-B',
		mir: 'MIR409',
		ts: isoHoursAgo(24),
		total_weight: 220_000,
		total_parts: 8,
		total_operations: 16,
		job_start_time: isoHoursAgo(48),
		job_end_time: isoHoursAgo(24)
	},
	{
		mid: 105,
		jid: 'PO87-FIT1',
		mir: 'PO87',
		ts: isoHoursAgo(20),
		total_weight: 95_000,
		total_parts: 4,
		total_operations: 8,
		job_start_time: isoHoursAgo(44),
		job_end_time: isoHoursAgo(20)
	}
];

function availability(
	mid: number,
	hoursAgo: number,
	state: number,
	durationMin: number,
	statusCode: number | null,
	ops = 0
): AvailabilitySample {
	return {
		mid,
		machine_state: state,
		status_code: statusCode,
		duration_ms: durationMin * 60_000,
		operation_count: ops,
		generated_at: isoHoursAgo(hoursAgo)
	};
}

export const mockAvailability: AvailabilitySample[] = [
	availability(101, 2, MACHINE_STATES.PRODUCTION, 110, null, 12),
	availability(101, 8, MACHINE_STATES.PRODUCTION, 95, null, 10),
	availability(101, 8, MACHINE_STATES.DOWNTIME, 20, 3, 0),
	availability(101, 20, MACHINE_STATES.PRODUCTION, 100, null, 11),
	availability(101, 32, MACHINE_STATES.SETUP, 25, null, 0),
	availability(101, 50, MACHINE_STATES.PRODUCTION, 90, null, 10),
	availability(101, 90, MACHINE_STATES.PRODUCTION, 80, null, 9),
	availability(101, 140, MACHINE_STATES.PRODUCTION, 70, null, 6),
	availability(102, 4, MACHINE_STATES.SETUP, 40, null, 0),
	availability(102, 16, MACHINE_STATES.PRODUCTION, 85, null, 7),
	availability(102, 28, MACHINE_STATES.PRODUCTION, 70, null, 5),
	availability(102, 44, MACHINE_STATES.DOWNTIME, 30, 4, 0),
	availability(102, 68, MACHINE_STATES.PRODUCTION, 75, null, 5),
	availability(103, 3, MACHINE_STATES.PRODUCTION, 105, null, 14),
	availability(103, 14, MACHINE_STATES.PRODUCTION, 98, null, 12),
	availability(103, 26, MACHINE_STATES.DOWNTIME, 15, 7, 0),
	availability(103, 48, MACHINE_STATES.PRODUCTION, 88, null, 11),
	availability(103, 96, MACHINE_STATES.PRODUCTION, 80, null, 9),
	availability(104, 6, MACHINE_STATES.DOWNTIME, 50, 3, 0),
	availability(104, 22, MACHINE_STATES.PRODUCTION, 40, null, 5),
	availability(104, 40, MACHINE_STATES.DOWNTIME, 35, 3, 0),
	availability(104, 80, MACHINE_STATES.PRODUCTION, 30, null, 3),
	availability(105, 5, MACHINE_STATES.IDLE, 60, 1, 0),
	availability(105, 18, MACHINE_STATES.PRODUCTION, 25, null, 2),
	availability(105, 42, MACHINE_STATES.IDLE, 40, 4, 0),
	availability(106, 36, MACHINE_STATES.SHUTDOWN, 180, 7, 0)
];

export const mockBreakdowns: BreakdownEvent[] = [
	{ mid: 101, created_at: isoHoursAgo(8) },
	{ mid: 102, created_at: isoHoursAgo(44) },
	{ mid: 103, created_at: isoHoursAgo(26) },
	{ mid: 104, created_at: isoHoursAgo(6) },
	{ mid: 104, created_at: isoHoursAgo(40) },
	{ mid: 104, created_at: isoHoursAgo(80) },
	{ mid: 105, created_at: isoHoursAgo(18) }
];

export const mockEnergy: EnergyReading[] = [
	{ mid: 101, ts: isoHoursAgo(160), kWh: 12_400 },
	{ mid: 101, ts: isoHoursAgo(1), kWh: 18_920 },
	{ mid: 102, ts: isoHoursAgo(160), kWh: 8_100 },
	{ mid: 102, ts: isoHoursAgo(1), kWh: 11_350 },
	{ mid: 103, ts: isoHoursAgo(160), kWh: 15_000 },
	{ mid: 103, ts: isoHoursAgo(1), kWh: 21_400 },
	{ mid: 106, ts: isoHoursAgo(160), kWh: 4_200 },
	{ mid: 106, ts: isoHoursAgo(40), kWh: 4_280 }
];

/** Planned jobs not yet started (v1: cms/items/jobs). */
export const mockAssignedJobs: Omit<AssignedJobRow, 'id' | 'machine_name' | 'plannedStartDate'>[] =
	[
		{
			machine_id: 101,
			mir: 'MIR212',
			sectionDM: '40x40x4',
			allocationGroupNo: '1',
			rmLength: '6000'
		},
		{
			machine_id: 102,
			mir: 'MIR213',
			sectionDM: '65x65x6',
			allocationGroupNo: '2',
			rmLength: '9000'
		},
		{
			machine_id: 103,
			mir: 'MIR341',
			sectionDM: 'PL12',
			allocationGroupNo: '-',
			rmLength: '-'
		},
		{
			machine_id: 105,
			mir: 'PO89',
			sectionDM: '-',
			allocationGroupNo: '-',
			rmLength: '-'
		}
	];

export const mockAssignedJobTimes: Record<string, string> = {
	'101-MIR212': isoHoursAgo(6),
	'102-MIR213': isoHoursAgo(12),
	'103-MIR341': isoHoursAgo(18),
	'105-PO89': isoHoursAgo(3)
};

/** Flattened HMI live rows (v1: cms/items/machine_jobs_state). */
export const mockHmiJobs: HmiJobRow[] = [
	{
		id: '101-MIR210-PO1001-MK-A',
		machine_id: 101,
		machine_name: 'CNC Angle Line 1',
		po: 'PO1001',
		mir: 'MIR210',
		marking: 'MK-A',
		sectionDM: '50x50x6',
		rmLength: '12000',
		allocationGroupNo: '2',
		createdAt: isoHoursAgo(0.4)
	},
	{
		id: '101-MIR210-PO1002-MK-B',
		machine_id: 101,
		machine_name: 'CNC Angle Line 1',
		po: 'PO1002',
		mir: 'MIR210',
		marking: 'MK-B',
		sectionDM: '50x50x6',
		rmLength: '11000',
		allocationGroupNo: '2',
		createdAt: isoHoursAgo(0.6)
	},
	{
		id: '102-MIR211-PO2201-MK-C',
		machine_id: 102,
		machine_name: 'CNC Angle Line 2',
		po: 'PO2201',
		mir: 'MIR211',
		marking: 'MK-C',
		sectionDM: '65x65x6',
		rmLength: '9000',
		allocationGroupNo: '1',
		createdAt: isoHoursAgo(1.2)
	},
	{
		id: '103-MIR340-PO3301-PL12',
		machine_id: 103,
		machine_name: 'CNC Plate Line 1',
		po: 'PO3301',
		mir: 'MIR340',
		marking: 'PL12-A',
		sectionDM: 'PL12',
		rmLength: '-',
		allocationGroupNo: '-',
		createdAt: isoHoursAgo(0.8)
	},
	{
		id: '104-MIR410-PO4401-MARK-A',
		machine_id: 104,
		machine_name: 'Plasma Table 1',
		po: 'PO4401',
		mir: 'MIR410',
		marking: 'MARK-A',
		sectionDM: '-',
		rmLength: '-',
		allocationGroupNo: '-',
		createdAt: isoHoursAgo(2)
	}
];

/** v1: cms/items/maintenance_tickets — status 1 open, 2/3 in progress, 0 closed. */
export const mockTickets: MaintenanceTicket[] = [
	{
		id: 501,
		mid: 101,
		alert_id: 1,
		status: 1,
		created_at: isoHoursAgo(5),
		closed_at: null,
		jid: 'MIR210-50x50x6-2-12000',
		oid: 1
	},
	{
		id: 502,
		mid: 102,
		alert_id: 3,
		status: 2,
		created_at: isoHoursAgo(18),
		closed_at: null,
		jid: 'MIR211-65x65x6-1-9000',
		oid: 2
	},
	{
		id: 503,
		mid: 104,
		alert_id: 3,
		status: 0,
		created_at: isoHoursAgo(40),
		closed_at: isoHoursAgo(32),
		jid: 'MIR410-MARK-A',
		oid: 3
	},
	{
		id: 504,
		mid: 103,
		alert_id: 4,
		status: 3,
		created_at: isoHoursAgo(8),
		closed_at: null,
		jid: 'MIR340-PL12',
		oid: 1
	},
	{
		id: 505,
		mid: 105,
		alert_id: null,
		status: 0,
		created_at: isoHoursAgo(72),
		closed_at: isoHoursAgo(60),
		jid: 'PO88-FIT1',
		oid: 4
	},
	{
		id: 506,
		mid: 101,
		alert_id: 7,
		status: 1,
		created_at: isoHoursAgo(2),
		closed_at: null,
		jid: 'MIR210-50x50x6-2-12000',
		oid: 1
	}
];

export const mockOperatorSessions: {
	oid: number;
	firstLogin: string;
	latestLogout: string | null;
}[] = [
	{ oid: 1, firstLogin: isoHoursAgo(10), latestLogout: null },
	{ oid: 2, firstLogin: isoHoursAgo(9), latestLogout: isoHoursAgo(1) },
	{ oid: 3, firstLogin: isoHoursAgo(14), latestLogout: isoHoursAgo(6) },
	{ oid: 4, firstLogin: isoHoursAgo(7), latestLogout: isoHoursAgo(0.5) }
];
