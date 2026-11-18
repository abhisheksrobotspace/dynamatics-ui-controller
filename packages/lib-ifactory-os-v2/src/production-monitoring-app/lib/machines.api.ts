// Mock-backed production monitoring API. Integration note: v1 sources are
// cms/items/machines, machine_group_master, production_data,
// production_aggregates, machine_availability, maintenance_tickets,
// oee_reports, energy_data, operators, ifactory_alerts_master, devices,
// machine_device_map.
import { formatUtcAsIst } from '$lib/datetime/format-ist.js';
import {
	ALL_MACHINES_GROUP_ID,
	CNC_GROUP_ID,
	MACHINE_STATES,
	MACHINE_TYPES,
	PROD_REPORT_BAR_DURATION_HOURS
} from './constants.js';
import { formatRangeDuration, previousWindow } from './date-range.js';
import {
	mockAlerts,
	mockAssignedJobs,
	mockAssignedJobTimes,
	mockAvailability,
	mockBreakdowns,
	mockEnergy,
	mockHmiJobs,
	mockMachineGroups,
	mockMachines,
	mockOperators,
	mockOperatorSessions,
	mockProductionAggregates,
	mockProductionSamples,
	mockShifts,
	mockTickets
} from './machines.mock.js';
import { clone, mockDelay } from './mock-utils.js';
import {
	buildStatusBarSegments,
	formatClockDuration,
	formatPercentageOffset,
	getMachineAvailability,
	inRange,
	isMachineActive,
	matchesMachineGroup,
	minutesFromMs,
	resolveFloorStatus,
	splitJid,
	toCardStatus,
	isTicketClosed,
	isTicketInProgress,
	isTicketOpen
} from './resources.js';
import type {
	DashboardMachineCard,
	DashboardPayload,
	HmiJobRow,
	JobMarkingMetadata,
	JobMarkingRow,
	Machine,
	MachineDetailsPayload,
	MachineGroup,
	MachineGroupOption,
	MachineJobDetailsPayload,
	MachineJobRow,
	MachinesListPayload,
	JobsListPayload,
	JobsListRow,
	OperatorListRow,
	ProductionListPayload,
	ProductionListRow,
	ProductionAggregate,
	ProductionSample,
	SearchByMarkingRow,
	SearchByMirRow,
	Shift,
	TicketListRow,
	TicketsListPayload
} from './types.js';

const machineLabels = new Map<string, string>();
const jobLabels = new Map<string, string>();

export function getMachineLabel(machineId: string): string {
	return machineLabels.get(machineId) ?? `Machine ${machineId}`;
}

export function rememberMachineLabel(machineId: string, label: string): void {
	machineLabels.set(machineId, label);
}

export async function ensureMachineLabel(machineId: string, signal?: AbortSignal): Promise<void> {
	if (machineLabels.has(machineId)) return;
	await mockDelay(signal, 40);
	const machine = mockMachines.find((row) => String(row.id) === machineId);
	rememberMachineLabel(machineId, machine?.name ?? `Machine ${machineId}`);
}

export function getJobLabel(jobId: string): string {
	return jobLabels.get(jobId) ?? jobId;
}

export function rememberJobLabel(jobId: string, label: string): void {
	jobLabels.set(jobId, label);
}

export async function ensureJobLabel(jobId: string, signal?: AbortSignal): Promise<void> {
	if (jobLabels.has(jobId)) return;
	await mockDelay(signal, 20);
	rememberJobLabel(jobId, jobId);
}

export async function listMachineGroups(signal?: AbortSignal): Promise<MachineGroup[]> {
	await mockDelay(signal);
	return clone(mockMachineGroups);
}

export async function listShifts(signal?: AbortSignal): Promise<Shift[]> {
	await mockDelay(signal);
	return clone(mockShifts);
}

export async function listMachineGroupOptions(signal?: AbortSignal): Promise<MachineGroupOption[]> {
	await mockDelay(signal);
	const hasCnc = mockMachineGroups.some((group) => /\bcnc\b/i.test(group.name));
	return [
		{ value: String(ALL_MACHINES_GROUP_ID), label: 'All Machines' },
		...(hasCnc ? [{ value: String(CNC_GROUP_ID), label: 'CNC Machines' }] : []),
		...mockMachineGroups.map((group) => ({ value: String(group.id), label: group.name }))
	];
}

export type RangeFilter = {
	from: Date;
	to: Date;
	machineGroupId: number;
};

function kgToMt(kg: number): number {
	return Number.parseFloat((kg / 1000).toFixed(2));
}

function alertNameById(): Map<number, string> {
	return new Map(mockAlerts.map((alert) => [alert.id, alert.name]));
}

function operatorNameById(): Map<number, string> {
	return new Map(mockOperators.map((operator) => [operator.id, operator.name]));
}

function scopedMachines(machineGroupId: number): Machine[] {
	return mockMachines.filter(
		(machine) =>
			machine.machine_type_id !== MACHINE_TYPES.GATEWAY &&
			matchesMachineGroup(machine, machineGroupId, mockMachineGroups)
	);
}

function usesAggregates(machine: Machine): boolean {
	return (
		machine.machine_type_id === MACHINE_TYPES.MANUAL ||
		machine.machine_type_id === MACHINE_TYPES.PLASMA
	);
}

function productionKgForMachine(machine: Machine, from: Date, to: Date): number {
	if (usesAggregates(machine)) {
		return mockProductionAggregates
			.filter((row) => row.mid === machine.id && inRange(row.ts, from, to))
			.reduce((sum, row) => sum + row.total_weight, 0);
	}
	return mockProductionSamples
		.filter((row) => row.mid === machine.id && inRange(row.ts, from, to))
		.reduce((sum, row) => sum + row.part_weight, 0);
}

function jobsCompletedForMachine(machineId: number, from: Date, to: Date): number {
	return mockProductionAggregates.filter(
		(row) => row.mid === machineId && inRange(row.ts, from, to)
	).length;
}

function breakdownsForMachine(machineId: number, from: Date, to: Date): number {
	return mockBreakdowns.filter((row) => row.mid === machineId && inRange(row.created_at, from, to))
		.length;
}

function availabilityTotals(machineId: number, from: Date, to: Date) {
	let uptime = 0;
	let downtime = 0;
	let setup = 0;
	let shutdown = 0;
	let managementLoss = 0;
	let operationCount = 0;
	for (const sample of mockAvailability) {
		if (sample.mid !== machineId || !inRange(sample.generated_at, from, to)) continue;
		const minutes = minutesFromMs(sample.duration_ms);
		operationCount += sample.operation_count;
		if (sample.machine_state === MACHINE_STATES.PRODUCTION) uptime += minutes;
		else if (
			sample.machine_state === MACHINE_STATES.IDLE ||
			sample.machine_state === MACHINE_STATES.DOWNTIME
		) {
			downtime += minutes;
		} else if (sample.machine_state === MACHINE_STATES.SETUP) setup += minutes;
		else if (sample.machine_state === MACHINE_STATES.MANAGEMENT_LOSS) managementLoss += minutes;
		else if (sample.machine_state === MACHINE_STATES.SHUTDOWN) shutdown += minutes;
	}
	return { uptime, downtime, setup, shutdown, managementLoss, operationCount };
}

function formatOee(oee: number | null): { label: string; numeric: number | null } {
	if (oee == null) return { label: 'No Data', numeric: null };
	const numeric = Number.parseFloat((oee * 100).toFixed(2));
	return { label: numeric.toFixed(2), numeric };
}

function kpiFromTotals(
	current: number,
	previous: number,
	durationLabel: string,
	formatValue: (n: number) => string
) {
	const offset = formatPercentageOffset(current, previous, durationLabel);
	return { value: formatValue(current), trend: offset.trend };
}

export async function getDashboard(
	filter: RangeFilter,
	signal?: AbortSignal
): Promise<DashboardPayload> {
	await mockDelay(signal);
	const machines = scopedMachines(filter.machineGroupId);
	const alerts = alertNameById();
	const durationLabel = formatRangeDuration(filter.from, filter.to);
	const past = previousWindow(filter.from, filter.to);

	const maxProduction = machines.reduce((highest, machine) => {
		const production = kgToMt(productionKgForMachine(machine, filter.from, filter.to));
		return Math.max(highest, production);
	}, 0);

	const cards: DashboardMachineCard[] = machines.map((machine) => {
		const status = resolveFloorStatus(machine, alerts);
		const production = kgToMt(productionKgForMachine(machine, filter.from, filter.to));
		const oee = formatOee(machine.oee);
		rememberMachineLabel(String(machine.id), machine.name);
		return {
			id: machine.id,
			name: machine.name,
			mid: machine.mid,
			status,
			cardStatus: toCardStatus(status),
			production: production.toFixed(2),
			uom: machine.prod_unit,
			oee: oee.label,
			oeeNumeric: oee.numeric,
			jobsCompleted: jobsCompletedForMachine(machine.id, filter.from, filter.to),
			breakdowns: breakdownsForMachine(machine.id, filter.from, filter.to),
			lastSync: formatUtcAsIst(machine.last_sync),
			statusBar: buildStatusBarSegments(production, maxProduction)
		};
	});

	cards.sort((a, b) => Number.parseFloat(b.production) - Number.parseFloat(a.production));

	const currentWeight = cards.reduce((sum, card) => sum + Number.parseFloat(card.production), 0);
	const previousWeight = machines.reduce(
		(sum, machine) => sum + kgToMt(productionKgForMachine(machine, past.from, past.to)),
		0
	);
	const currentBreakdowns = cards.reduce((sum, card) => sum + card.breakdowns, 0);
	const previousBreakdowns = machines.reduce(
		(sum, machine) => sum + breakdownsForMachine(machine.id, past.from, past.to),
		0
	);
	const currentJobs = cards.reduce((sum, card) => sum + card.jobsCompleted, 0);
	const previousJobs = machines.reduce(
		(sum, machine) => sum + jobsCompletedForMachine(machine.id, past.from, past.to),
		0
	);

	const currentOee = machines.length
		? cards.reduce((sum, card) => sum + (card.oeeNumeric ?? 0), 0) / machines.length
		: 0;

	const plantAvailability = machines.reduce(
		(acc, machine) => {
			const totals = availabilityTotals(machine.id, filter.from, filter.to);
			acc.uptime += totals.uptime;
			acc.downtime += totals.downtime;
			acc.setup += totals.setup;
			acc.shutdown += totals.shutdown;
			acc.managementLoss += totals.managementLoss;
			return acc;
		},
		{ uptime: 0, downtime: 0, setup: 0, shutdown: 0, managementLoss: 0 }
	);
	const previousAvailability = machines.reduce(
		(acc, machine) => {
			const totals = availabilityTotals(machine.id, past.from, past.to);
			acc.uptime += totals.uptime;
			acc.downtime += totals.downtime;
			acc.setup += totals.setup;
			acc.shutdown += totals.shutdown;
			acc.managementLoss += totals.managementLoss;
			return acc;
		},
		{ uptime: 0, downtime: 0, setup: 0, shutdown: 0, managementLoss: 0 }
	);
	const currentEff = getMachineAvailability(plantAvailability).availability;
	const previousEff = getMachineAvailability(previousAvailability).availability;

	const chartMachines = cards.filter((card) => Number.parseFloat(card.production) > 0);

	return {
		totalWeight: kpiFromTotals(
			currentWeight,
			previousWeight,
			durationLabel,
			(n) => `${n.toFixed(2)} MT`
		),
		breakdowns: kpiFromTotals(currentBreakdowns, previousBreakdowns, durationLabel, (n) =>
			String(n)
		),
		oee: {
			value: `${currentOee.toFixed(2)}%`,
			trend: formatPercentageOffset(currentEff, previousEff, durationLabel).trend
		},
		jobsCompleted: kpiFromTotals(currentJobs, previousJobs, durationLabel, (n) => String(n)),
		machines: cards,
		productionChart: {
			labels: chartMachines.map((card) => card.name),
			values: chartMachines.map((card) => Number.parseFloat(card.production))
		}
	};
}

export async function listMachinesTable(
	filter: RangeFilter,
	signal?: AbortSignal
): Promise<MachinesListPayload> {
	await mockDelay(signal);
	const machines = scopedMachines(filter.machineGroupId);
	const alerts = alertNameById();
	const operators = operatorNameById();

	const rows = machines.map((machine) => {
		const status = resolveFloorStatus(machine, alerts);
		rememberMachineLabel(String(machine.id), machine.name);
		return {
			id: machine.id,
			machine_name: machine.name,
			machine_status: status,
			operator_name: machine.oid == null ? 'N/A' : (operators.get(machine.oid) ?? 'Default User'),
			interlockState:
				machine.interlock_state == null ? '-' : machine.interlock_state ? 'On' : 'Off',
			last_sync: formatUtcAsIst(machine.last_sync),
			macId: machine.mac_id || '-',
			isActive: isMachineActive(status)
		};
	});

	return {
		total: rows.length,
		active: rows.filter((row) => row.isActive).length,
		inactive: rows.filter((row) => !row.isActive).length,
		rows
	};
}

function parseEnergyKwh(value: string): number {
	if (value === 'Not Installed') return 0;
	return Number.parseFloat(value.replace(' kWh', '')) || 0;
}

export async function listProductionTable(
	filter: RangeFilter,
	signal?: AbortSignal
): Promise<ProductionListPayload> {
	await mockDelay(signal);
	const machines = scopedMachines(filter.machineGroupId);
	const alerts = alertNameById();

	const rows: ProductionListRow[] = machines.map((machine) => {
		const status = resolveFloorStatus(machine, alerts);
		const totals = availabilityTotals(machine.id, filter.from, filter.to);
		const oee = formatOee(machine.oee);
		const productionMt = kgToMt(productionKgForMachine(machine, filter.from, filter.to));
		const energy = energyConsumedKwh(machine, filter.from, filter.to);
		rememberMachineLabel(String(machine.id), machine.name);
		return {
			id: machine.id,
			machine_name: machine.name,
			status,
			oee: oee.numeric == null ? 'No Data' : `${oee.label}%`,
			uptime: totals.uptime,
			downtime: totals.downtime,
			totalProduction: productionMt.toFixed(2),
			energyConsumed: energy,
			isActive: isMachineActive(status)
		};
	});

	rows.sort((a, b) => Number.parseFloat(b.totalProduction) - Number.parseFloat(a.totalProduction));

	const totalProduction = rows
		.reduce((sum, row) => sum + Number.parseFloat(row.totalProduction), 0)
		.toFixed(2);
	const totalEnergy = rows
		.reduce((sum, row) => sum + parseEnergyKwh(row.energyConsumed), 0)
		.toFixed(2);

	return {
		total: rows.length,
		active: rows.filter((row) => row.isActive).length,
		inactive: rows.filter((row) => !row.isActive).length,
		totalProduction,
		totalEnergy,
		rows
	};
}

function energyConsumedKwh(machine: Machine, from: Date, to: Date): string {
	if (!machine.energy_installed) return 'Not Installed';
	const readings = mockEnergy
		.filter((row) => row.mid === machine.id && inRange(row.ts, from, to))
		.sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
	if (readings.length < 2) return '0.00 kWh';
	const min = readings[0]?.kWh ?? 0;
	const max = readings[readings.length - 1]?.kWh ?? 0;
	return `${(Math.abs(max - min) / 1000).toFixed(2)} kWh`;
}

function buildJobs(machine: Machine, from: Date, to: Date): MachineJobRow[] {
	const completed: MachineJobRow[] = mockProductionAggregates
		.filter((job) => job.mid === machine.id && inRange(job.ts, from, to))
		.map((job) => {
			const parts = splitJid(job.jid);
			return {
				jid: job.jid,
				machine_name: machine.name,
				mir: job.mir || parts.mir,
				sectionDM: parts.sectionDM,
				allocationGroupNo: parts.allocGroupNo,
				rmLength: parts.rmLength,
				totalWeight: kgToMt(job.total_weight).toFixed(2),
				totalParts: String(job.total_parts),
				totalOperations: String(job.total_operations),
				jobStartDate: formatUtcAsIst(job.job_start_time),
				jobEndDate: formatUtcAsIst(job.job_end_time),
				jobStatus: 'Completed' as const
			};
		});

	const completedJids = new Set(completed.map((job) => job.jid));
	const inProgressMap = new Map<
		string,
		{ startedAt: string; weight: number; parts: number; ops: number; mir: string }
	>();
	for (const sample of mockProductionSamples.filter(
		(row) => row.mid === machine.id && inRange(row.ts, from, to) && !completedJids.has(row.jid)
	)) {
		const existing = inProgressMap.get(sample.jid);
		if (existing) {
			existing.weight += sample.part_weight;
			existing.parts += 1;
			existing.ops += sample.operations;
		} else {
			inProgressMap.set(sample.jid, {
				startedAt: sample.ts,
				weight: sample.part_weight,
				parts: 1,
				ops: sample.operations,
				mir: sample.mir
			});
		}
	}

	const inProgress: MachineJobRow[] = [...inProgressMap.entries()].map(([jid, job]) => {
		const parts = splitJid(jid);
		return {
			jid,
			machine_name: machine.name,
			mir: job.mir || parts.mir,
			sectionDM: parts.sectionDM,
			allocationGroupNo: parts.allocGroupNo,
			rmLength: parts.rmLength,
			totalWeight: kgToMt(job.weight).toFixed(2),
			totalParts: String(job.parts),
			totalOperations: String(job.ops),
			jobStartDate: formatUtcAsIst(job.startedAt),
			jobEndDate: '-',
			jobStatus: 'In Progress' as const
		};
	});

	return [...inProgress, ...completed];
}

function performanceSeries(
	machine: Machine,
	from: Date,
	to: Date
): { labels: string[]; values: number[] } {
	if (usesAggregates(machine)) {
		const rows = mockProductionAggregates
			.filter((row) => row.mid === machine.id && inRange(row.ts, from, to))
			.sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
		return {
			labels: rows.map((row) => formatUtcAsIst(row.ts)),
			values: rows.map((row) => kgToMt(row.total_weight))
		};
	}
	const rows = mockProductionSamples
		.filter((row) => row.mid === machine.id && inRange(row.ts, from, to))
		.sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
	return {
		labels: rows.map((row) => formatUtcAsIst(row.ts)),
		values: rows.map((row) => kgToMt(row.part_weight))
	};
}

function productionReportSeries(
	machineId: number,
	from: Date,
	to: Date
): { labels: string[]; uptime: number[]; downtime: number[] } {
	const labels: string[] = [];
	const uptime: number[] = [];
	const downtime: number[] = [];
	const stepMs = PROD_REPORT_BAR_DURATION_HOURS * 60 * 60 * 1000;
	let cursor = new Date(from);
	while (cursor.getTime() < to.getTime()) {
		const next = new Date(Math.min(cursor.getTime() + stepMs, to.getTime()));
		const bucket = availabilityTotals(machineId, cursor, next);
		labels.push(formatUtcAsIst(cursor.toISOString(), { dateStyle: 'short', timeStyle: 'short' }));
		uptime.push(bucket.uptime);
		downtime.push(bucket.downtime);
		cursor = next;
		if (next.getTime() === to.getTime()) break;
	}
	return { labels, uptime, downtime };
}

function downtimeSeries(
	machineId: number,
	from: Date,
	to: Date
): { labels: string[]; values: number[] } {
	const alerts = alertNameById();
	const byReason = new Map<string, number>();
	for (const sample of mockAvailability) {
		if (sample.mid !== machineId || !inRange(sample.generated_at, from, to)) continue;
		if (sample.machine_state === MACHINE_STATES.PRODUCTION) continue;
		const reason =
			sample.status_code != null ? (alerts.get(sample.status_code) ?? 'Other') : 'Other';
		byReason.set(reason, (byReason.get(reason) ?? 0) + minutesFromMs(sample.duration_ms));
	}
	return {
		labels: [...byReason.keys()],
		values: [...byReason.values()]
	};
}

export async function getMachineDetails(
	machineId: string,
	from: Date,
	to: Date,
	signal?: AbortSignal
): Promise<MachineDetailsPayload | null> {
	await mockDelay(signal);
	const machine = mockMachines.find((row) => String(row.id) === machineId);
	if (!machine) return null;

	const alerts = alertNameById();
	const operators = operatorNameById();
	const status = resolveFloorStatus(machine, alerts);
	const productionKg = productionKgForMachine(machine, from, to);
	const totals = availabilityTotals(machine.id, from, to);
	const jobs = buildJobs(machine, from, to);
	const partsProduced = usesAggregates(machine)
		? mockProductionAggregates
				.filter((row) => row.mid === machine.id && inRange(row.ts, from, to))
				.reduce((sum, row) => sum + row.total_parts, 0)
		: mockProductionSamples.filter((row) => row.mid === machine.id && inRange(row.ts, from, to))
				.length;
	const jobOps = jobs.reduce(
		(sum, job) => sum + (Number.parseInt(job.totalOperations, 10) || 0),
		0
	);
	const oee = formatOee(machine.oee);
	rememberMachineLabel(String(machine.id), machine.name);

	return {
		id: machine.id,
		name: machine.name,
		mid: machine.mid,
		lastSync: formatUtcAsIst(machine.last_sync),
		status,
		cardStatus: toCardStatus(status),
		qty: `${kgToMt(productionKg).toFixed(2)} ${machine.prod_unit}`,
		partsProduced,
		operatorName: machine.oid == null ? 'N/A' : (operators.get(machine.oid) ?? 'N/A'),
		upTime: `${totals.uptime} mins`,
		downTime: `${totals.downtime} mins`,
		oee: oee.numeric == null ? 'No Data' : `${oee.label}%`,
		energyConsumed: energyConsumedKwh(machine, from, to),
		totalOperations: jobOps + totals.operationCount,
		jobs,
		performance: { ...performanceSeries(machine, from, to), uom: machine.prod_unit },
		productionReport: productionReportSeries(machine.id, from, to),
		downtime: downtimeSeries(machine.id, from, to)
	};
}

function jobAvailabilityMins(
	machineId: number,
	from: Date,
	to: Date
): { uptime: number; downtime: number } {
	let uptime = 0;
	let downtime = 0;
	for (const sample of mockAvailability) {
		if (sample.mid !== machineId || !inRange(sample.generated_at, from, to)) continue;
		const minutes = minutesFromMs(sample.duration_ms);
		if (sample.machine_state === MACHINE_STATES.PRODUCTION) uptime += minutes;
		else if (sample.machine_state === MACHINE_STATES.DOWNTIME) downtime += minutes;
	}
	return { uptime, downtime };
}

function markingProgress(
	machine: Machine,
	marking: JobMarkingMetadata,
	totalParts: number
): string {
	const isAngle = machine.machine_type_id === MACHINE_TYPES.ANGLE;
	if (isAngle) {
		const target =
			(Number.parseInt(marking.pcs ?? '', 10) || 0) *
			(Number.parseInt(marking.pcsPerBar ?? '', 10) || 0);
		return totalParts > 0 ? `${totalParts}/${target || '-'}` : '-';
	}
	const quantity = marking.quantity ?? 0;
	return quantity > 0 ? `${totalParts}/${quantity}` : String(totalParts);
}

function buildMarkingRowsFromMetadata(
	machine: Machine,
	aggregate: ProductionAggregate
): JobMarkingRow[] {
	const markings = aggregate.metadata?.markings;
	if (!markings || Object.keys(markings).length === 0) {
		const parts = splitJid(aggregate.jid);
		return [
			{
				id: `${aggregate.jid}-0`,
				marking: aggregate.mir || parts.mir,
				poNo: '-',
				pcsPerBar: '-',
				operations: aggregate.total_operations,
				pcs: String(aggregate.total_parts),
				progress: String(aggregate.total_parts),
				markingLength: parts.rmLength,
				partWeight: kgToMt(aggregate.total_weight / Math.max(aggregate.total_parts, 1)).toFixed(2)
			}
		];
	}

	return Object.entries(markings).map(([key, marking], index) => {
		const totalParts = marking.totalParts ?? marking.producedCount ?? 0;
		return {
			id: `${aggregate.jid}-${index}`,
			marking: marking.marking ?? key.split('-')[0] ?? '-',
			poNo: marking.poNo ?? '-',
			pcsPerBar: marking.pcsPerBar ?? '-',
			operations: marking.totalOperations ?? 0,
			pcs: marking.pcs ?? '-',
			progress: markingProgress(machine, marking, totalParts),
			markingLength: marking.markingLength ?? '-',
			partWeight: kgToMt(marking.partWeight ?? 0).toFixed(2)
		};
	});
}

function buildMarkingRowsFromSamples(
	machine: Machine,
	jid: string,
	samples: ProductionSample[]
): JobMarkingRow[] {
	if (samples.length === 0) return [];
	const parts = splitJid(jid);
	const chunkSize = Math.max(1, Math.ceil(samples.length / 2));
	const chunks = [samples.slice(0, chunkSize), samples.slice(chunkSize)].filter(
		(chunk) => chunk.length > 0
	);

	return chunks.map((chunk, index) => {
		const operations = chunk.reduce((sum, sample) => sum + sample.operations, 0);
		const avgWeight = chunk.reduce((sum, sample) => sum + sample.part_weight, 0) / chunk.length;
		const marking = `MK-${String.fromCharCode(65 + index)}`;
		const poNo = `PO-${2400 + index}`;
		const pcs = '12';
		const pcsPerBar = '4';
		const metadata: JobMarkingMetadata = { pcs, pcsPerBar, totalParts: chunk.length };
		return {
			id: `${jid}-${index}`,
			marking,
			poNo,
			pcsPerBar,
			operations,
			pcs,
			progress: markingProgress(machine, metadata, chunk.length),
			markingLength: parts.rmLength,
			partWeight: kgToMt(avgWeight).toFixed(2)
		};
	});
}

export async function getMachineJobDetails(
	machineId: string,
	jobId: string,
	signal?: AbortSignal
): Promise<MachineJobDetailsPayload | null> {
	await mockDelay(signal);
	const decodedJobId = decodeURIComponent(jobId);
	const machine = mockMachines.find((row) => String(row.id) === machineId);
	if (!machine) return null;

	const jidParts = splitJid(decodedJobId);
	const aggregate = mockProductionAggregates.find(
		(row) => row.mid === machine.id && row.jid === decodedJobId
	);

	if (aggregate) {
		const from = new Date(aggregate.job_start_time);
		const to = new Date(aggregate.job_end_time);
		const availability = jobAvailabilityMins(machine.id, from, to);
		rememberMachineLabel(String(machine.id), machine.name);
		rememberJobLabel(decodedJobId, decodedJobId);

		return {
			jid: decodedJobId,
			machineId: machine.id,
			machineName: machine.name,
			jobStatus: 'Completed',
			mir: aggregate.mir || jidParts.mir,
			rmLength: jidParts.rmLength,
			allocationGroup: jidParts.allocGroupNo,
			uptimeMins: availability.uptime,
			downtimeMins: availability.downtime,
			jobStarted: formatUtcAsIst(aggregate.job_start_time),
			jobEnded: formatUtcAsIst(aggregate.job_end_time),
			totalWeight: `${kgToMt(aggregate.total_weight).toFixed(2)} ${machine.prod_unit}`,
			markings: buildMarkingRowsFromMetadata(machine, aggregate)
		};
	}

	const samples = mockProductionSamples
		.filter((row) => row.mid === machine.id && row.jid === decodedJobId)
		.sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
	if (samples.length === 0) return null;

	const startedAt = samples[0]?.ts ?? new Date().toISOString();
	const from = new Date(startedAt);
	const to = new Date();
	const availability = jobAvailabilityMins(machine.id, from, to);
	const totalWeightKg = samples.reduce((sum, sample) => sum + sample.part_weight, 0);
	rememberMachineLabel(String(machine.id), machine.name);
	rememberJobLabel(decodedJobId, decodedJobId);

	return {
		jid: decodedJobId,
		machineId: machine.id,
		machineName: machine.name,
		jobStatus: 'In Progress',
		mir: samples[0]?.mir || jidParts.mir,
		rmLength: jidParts.rmLength,
		allocationGroup: jidParts.allocGroupNo,
		uptimeMins: availability.uptime,
		downtimeMins: availability.downtime,
		jobStarted: formatUtcAsIst(startedAt),
		jobEnded: '-',
		totalWeight: `${kgToMt(totalWeightKg).toFixed(2)} ${machine.prod_unit}`,
		markings: buildMarkingRowsFromSamples(machine, decodedJobId, samples)
	};
}

const ALL_MACHINES_FILTER = 'all';

export async function listMachineSelectOptions(
	machineGroupId: number,
	signal?: AbortSignal
): Promise<MachineGroupOption[]> {
	await mockDelay(signal, 40);
	return [
		{ value: ALL_MACHINES_FILTER, label: 'All Machines' },
		...scopedMachines(machineGroupId).map((machine) => ({
			value: String(machine.id),
			label: machine.name
		}))
	];
}

function jobsRowFromAggregate(
	machine: Machine,
	jid: string,
	mir: string,
	totalWeightKg: number,
	totalParts: number,
	totalOperations: number,
	startIso: string,
	endIso: string
): JobsListRow {
	const parts = splitJid(jid);
	return {
		id: `${machine.id}-${jid}`,
		machine_id: machine.id,
		jid,
		machine_name: machine.name,
		mir: mir || parts.mir,
		sectionDM: parts.sectionDM,
		allocationGroupNo: parts.allocGroupNo,
		rmLength: parts.rmLength,
		totalWeight: kgToMt(totalWeightKg).toFixed(2),
		totalParts: String(totalParts),
		totalOperations: String(totalOperations),
		jobStartDate: formatUtcAsIst(startIso),
		jobEndDate: formatUtcAsIst(endIso)
	};
}

export async function listJobsTable(
	filter: RangeFilter & { machineId?: string },
	signal?: AbortSignal
): Promise<JobsListPayload> {
	await mockDelay(signal);
	const machines = scopedMachines(filter.machineGroupId);
	const machineById = new Map(machines.map((machine) => [machine.id, machine]));
	const machineFilterId =
		filter.machineId && filter.machineId !== ALL_MACHINES_FILTER ? Number(filter.machineId) : null;

	const completedRows: JobsListRow[] = mockProductionAggregates
		.filter((job) => {
			const machine = machineById.get(job.mid);
			if (!machine) return false;
			if (machineFilterId != null && machine.id !== machineFilterId) return false;
			return inRange(job.ts, filter.from, filter.to);
		})
		.sort((a, b) => new Date(b.job_start_time).getTime() - new Date(a.job_start_time).getTime())
		.map((job) => {
			const machine = machineById.get(job.mid)!;
			return jobsRowFromAggregate(
				machine,
				job.jid,
				job.mir,
				job.total_weight,
				job.total_parts,
				job.total_operations,
				job.job_start_time,
				job.job_end_time
			);
		});

	const completedKeys = new Set(completedRows.map((row) => `${row.machine_id}-${row.jid}`));
	const inProgressMap = new Map<
		string,
		{ startedAt: string; weight: number; parts: number; ops: number; mir: string; machine: Machine }
	>();
	for (const sample of mockProductionSamples) {
		const machine = machineById.get(sample.mid);
		if (!machine) continue;
		if (machineFilterId != null && machine.id !== machineFilterId) continue;
		if (!inRange(sample.ts, filter.from, filter.to)) continue;
		const key = `${machine.id}-${sample.jid}`;
		if (completedKeys.has(key)) continue;
		const existing = inProgressMap.get(key);
		if (existing) {
			existing.weight += sample.part_weight;
			existing.parts += 1;
			existing.ops += sample.operations;
		} else {
			inProgressMap.set(key, {
				startedAt: sample.ts,
				weight: sample.part_weight,
				parts: 1,
				ops: sample.operations,
				mir: sample.mir,
				machine
			});
		}
	}

	const inProgressRows: JobsListRow[] = [...inProgressMap.entries()]
		.sort((a, b) => new Date(b[1].startedAt).getTime() - new Date(a[1].startedAt).getTime())
		.map(([key, job]) => {
			const jid = key.slice(key.indexOf('-') + 1);
			return {
				...jobsRowFromAggregate(
					job.machine,
					jid,
					job.mir,
					job.weight,
					job.parts,
					job.ops,
					job.startedAt,
					job.startedAt
				),
				jobEndDate: '-'
			};
		});

	const assignedRows = mockAssignedJobs
		.filter((job) => {
			const machine = machineById.get(job.machine_id);
			if (!machine) return false;
			if (machineFilterId != null && machine.id !== machineFilterId) return false;
			const planned = mockAssignedJobTimes[`${job.machine_id}-${job.mir}`];
			return planned ? inRange(planned, filter.from, filter.to) : true;
		})
		.map((job) => {
			const machine = machineById.get(job.machine_id)!;
			const planned =
				mockAssignedJobTimes[`${job.machine_id}-${job.mir}`] ?? new Date().toISOString();
			return {
				id: `${job.machine_id}-${job.mir}`,
				machine_id: job.machine_id,
				machine_name: machine.name,
				mir: job.mir,
				sectionDM: job.sectionDM,
				allocationGroupNo: job.allocationGroupNo,
				rmLength: job.rmLength,
				plannedStartDate: formatUtcAsIst(planned)
			};
		});

	return {
		total: assignedRows.length + inProgressRows.length + completedRows.length,
		completed: completedRows.length,
		inProgress: inProgressRows.length,
		assigned: assignedRows.length,
		assignedRows,
		inProgressRows,
		completedRows
	};
}

export async function listHmiJobs(
	machineGroupId: number,
	machineId?: string,
	signal?: AbortSignal
): Promise<HmiJobRow[]> {
	await mockDelay(signal);
	const allowed = new Set(scopedMachines(machineGroupId).map((machine) => machine.id));
	const machineFilterId = machineId && machineId !== ALL_MACHINES_FILTER ? Number(machineId) : null;

	return clone(
		mockHmiJobs
			.filter((row) => {
				if (!allowed.has(row.machine_id)) return false;
				if (machineFilterId != null && row.machine_id !== machineFilterId) return false;
				return true;
			})
			.map((row) => ({
				...row,
				createdAt: formatUtcAsIst(row.createdAt)
			}))
	);
}

export async function listTicketsTable(
	filter: RangeFilter,
	signal?: AbortSignal
): Promise<TicketsListPayload> {
	await mockDelay(signal);
	const allowed = new Set(scopedMachines(filter.machineGroupId).map((machine) => machine.id));
	const machines = new Map(mockMachines.map((machine) => [machine.id, machine]));
	const operators = new Map(mockOperators.map((operator) => [operator.id, operator]));
	const alerts = alertNameById();

	const rows: TicketListRow[] = mockTickets
		.filter(
			(ticket) => allowed.has(ticket.mid) && inRange(ticket.created_at, filter.from, filter.to)
		)
		.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
		.map((ticket) => {
			const machine = machines.get(ticket.mid);
			const operator = ticket.oid == null ? null : operators.get(ticket.oid);
			const alertName =
				ticket.alert_id == null
					? '-'
					: `${ticket.alert_id} - ${alerts.get(ticket.alert_id) ?? 'IDLE'}`;
			return {
				id: ticket.id,
				ticket_id: ticket.id,
				machine_name: machine?.name ?? String(ticket.mid),
				alert_name: alertName,
				ticket_status: ticket.status,
				created_at: formatUtcAsIst(ticket.created_at),
				closed_at: ticket.closed_at ? formatUtcAsIst(ticket.closed_at) : '-',
				duration: formatClockDuration(ticket.created_at, ticket.closed_at),
				job_id: ticket.jid ?? '-',
				operator: operator ? `${operator.oid}-${operator.name}` : '-'
			};
		});

	return {
		total: rows.length,
		open: rows.filter((row) => isTicketOpen(row.ticket_status)).length,
		inProgress: rows.filter((row) => isTicketInProgress(row.ticket_status)).length,
		closed: rows.filter((row) => isTicketClosed(row.ticket_status)).length,
		rows
	};
}

export async function listOperatorsTable(
	filter: { from: Date; to: Date },
	signal?: AbortSignal
): Promise<OperatorListRow[]> {
	await mockDelay(signal);
	const machineById = new Map(mockMachines.map((machine) => [machine.id, machine]));

	return mockOperators
		.map((operator) => {
			const session = mockOperatorSessions.find((row) => row.oid === operator.id);
			if (!session || !inRange(session.firstLogin, filter.from, filter.to)) return null;

			let uptimeMs = 0;
			let downtimeMs = 0;
			for (const sample of mockAvailability) {
				if (!inRange(sample.generated_at, filter.from, filter.to)) continue;
				const machine = machineById.get(sample.mid);
				if (machine?.oid !== operator.id) continue;
				if (sample.machine_state === MACHINE_STATES.PRODUCTION) uptimeMs += sample.duration_ms;
				if (
					sample.machine_state === MACHINE_STATES.DOWNTIME ||
					sample.machine_state === MACHINE_STATES.IDLE
				) {
					downtimeMs += sample.duration_ms;
				}
			}

			let productionKg = 0;
			for (const machine of mockMachines) {
				if (machine.oid !== operator.id) continue;
				productionKg += productionKgForMachine(machine, filter.from, filter.to);
			}

			return {
				id: operator.id,
				operator_name: operator.name,
				operator_id: operator.oid,
				duration: formatClockDuration(session.firstLogin, session.latestLogout),
				first_login: formatUtcAsIst(session.firstLogin),
				latest_logout: session.latestLogout ? formatUtcAsIst(session.latestLogout) : '-',
				uptime: minutesFromMs(uptimeMs),
				downtime: minutesFromMs(downtimeMs),
				total_production: kgToMt(productionKg).toFixed(2)
			};
		})
		.filter((row): row is OperatorListRow => row != null);
}

export async function listSearchByMir(
	filter: RangeFilter,
	signal?: AbortSignal
): Promise<SearchByMirRow[]> {
	const jobs = await listJobsTable(filter, signal);
	return [
		...jobs.inProgressRows.map((row) => ({ ...row, jobStatus: 'In Progress' as const })),
		...jobs.completedRows.map((row) => ({ ...row, jobStatus: 'Completed' as const }))
	];
}

export async function listSearchByMarking(
	filter: RangeFilter,
	signal?: AbortSignal
): Promise<SearchByMarkingRow[]> {
	await mockDelay(signal);
	const machines = scopedMachines(filter.machineGroupId);
	const allowed = new Set(machines.map((machine) => machine.id));
	const machineById = new Map(machines.map((machine) => [machine.id, machine]));
	const operators = new Map(mockOperators.map((operator) => [operator.id, operator]));
	const rows: SearchByMarkingRow[] = [];

	for (const aggregate of mockProductionAggregates) {
		if (!allowed.has(aggregate.mid) || !inRange(aggregate.ts, filter.from, filter.to)) continue;
		const machine = machineById.get(aggregate.mid);
		if (!machine) continue;
		const operator = machine.oid == null ? null : operators.get(machine.oid);
		const parts = splitJid(aggregate.jid);
		const markings = aggregate.metadata?.markings ?? {};
		for (const [key, marking] of Object.entries(markings)) {
			rows.push({
				id: `${aggregate.mid}-${key}`,
				marking: marking.marking || key,
				poNo: marking.poNo || '-',
				mir: aggregate.mir,
				sectionDimension: parts.sectionDM,
				allocationGroup: parts.allocGroupNo,
				mid: machine.name,
				operator: operator ? `${operator.oid}-${operator.name}` : '-',
				pcsPerBar: marking.pcsPerBar || '-',
				pcs: marking.pcs || '-',
				progress: marking.totalParts != null ? String(marking.totalParts) : '-',
				partWeight: marking.partWeight == null ? '-' : (marking.partWeight / 1000).toFixed(3),
				totalWeight: aggregate.total_weight ? kgToMt(aggregate.total_weight).toFixed(3) : '-',
				markingLength: marking.markingLength || '-'
			});
		}
	}

	for (const job of mockHmiJobs) {
		if (!allowed.has(job.machine_id) || !inRange(job.createdAt, filter.from, filter.to)) continue;
		const already = rows.some(
			(row) => row.mir === job.mir && row.marking === job.marking && row.mid === job.machine_name
		);
		if (already) continue;
		const machine = machineById.get(job.machine_id);
		const operator = machine?.oid == null ? null : operators.get(machine.oid);
		rows.push({
			id: job.id,
			marking: job.marking,
			poNo: job.po,
			mir: job.mir,
			sectionDimension: job.sectionDM,
			allocationGroup: job.allocationGroupNo,
			mid: job.machine_name,
			operator: operator ? `${operator.oid}-${operator.name}` : '-',
			pcsPerBar: '-',
			pcs: '-',
			progress: '-',
			partWeight: '-',
			totalWeight: '-',
			markingLength: job.rmLength
		});
	}

	return rows.sort((a, b) => a.mid.localeCompare(b.mid));
}
