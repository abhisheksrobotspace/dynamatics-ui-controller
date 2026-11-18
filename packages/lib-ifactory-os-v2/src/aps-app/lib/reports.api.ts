import type { TreeTableNode } from '@ifactory/ui-v2';
import { apiClient } from '../../lib/api/api-client.js';
import { datahubQuery, leftJoin, pickAlias, pickAliasString } from '../../lib/api/datahub-query.js';
import { rowsFromEnvelope, type ApiEnvelope } from '../../lib/api/types.js';
import { listJobCardRows } from './job-cards.api.js';
import {
	getScheduleRequest,
	rememberScheduleRequestLabel,
	scheduleRequestLabel
} from './schedule-requests.api.js';

export type ReportRunItem = {
	value: string;
	label: string;
};

export type ScheduleStructureRow = {
	workOrder: string;
	structure: string;
	sets: string;
	sections: string;
	marks: string;
	weight: string;
	plant: string;
	plannedDue: string;
	start: string;
	estCompletion: string;
	makespan: string;
};

export type ScheduleReport = {
	planId: string;
	runId: string;
	runLabel: string;
	ranAt: string;
	runItems: ReportRunItem[];
	kpis: Array<{ label: string; value: string }>;
	footer: string;
	nodes: TreeTableNode<ScheduleStructureRow>[];
};

export type MachineReportRow = {
	machine: string;
	group: string;
	jobs: string;
	parts: string;
	weight: string;
	busy: string;
	changeover: string;
	idle: string;
	totalSpan: string;
	utilization: string;
};

export type MachinesReport = {
	planId: string;
	runId: string;
	runLabel: string;
	ranAt: string;
	runItems: ReportRunItem[];
	kpis: Array<{ label: string; value: string }>;
	nodes: TreeTableNode<MachineReportRow>[];
};

/** Report “plan” = schedule request (route param still named planId). */
type PlanRow = {
	plan_id: string;
	name?: string | null;
	due_date?: string | null;
	plant_id?: string | null;
	summary?: Record<string, unknown> | null;
};

type MachineUtilizationRow = {
	machine_id: string;
	group?: string | null;
	jobs?: number | null;
	parts?: number | null;
	weight_mt?: number | null;
	busy_s?: number | null;
	changeover_s?: number | null;
	idle_s?: number | null;
	span_s?: number | null;
	utilization_pct?: number | null;
};

type RunRow = {
	run_id: string;
	request_id: string;
	version?: number | null;
	run_type?: string | null;
	solver?: string | null;
	status: string;
	schedule_start?: string | null;
	makespan_s?: number | null;
	num_tasks?: number | null;
	on_time_count?: number | null;
	total_orders?: number | null;
	breached_orders?: number | null;
	summary?: {
		machine_utilization?: MachineUtilizationRow[];
		total_weight_mt?: number | null;
		machines_used?: number | null;
	} | null;
	created_at?: string | null;
};

type TaskRow = {
	task_id: string;
	run_id: string;
	order_id?: string | null;
	bom_id?: string | null;
	mark_no?: string | null;
	machine_id?: string | null;
	product?: string | null;
	qty?: number | null;
	start_time?: string | null;
	end_time?: string | null;
	duration_s?: number | null;
	changeover_before_s?: number | null;
};

type BomRow = { bom_id: string; structure_id: string; bom_name: string };
type StructureRow = { structure_id: string; project_id: string; name: string };
type ProjectRow = {
	project_id: string;
	name: string;
	metadata?: Record<string, unknown> | null;
};
type PlanProductionPlanRow = {
	production_plan_id: string;
	selected_lines?: Record<string, number> | null;
};
type ProductionPlanLineRow = {
	production_plan_line_id: string;
	production_plan_id: string;
	bom_id: string;
	quantity: number;
};
type CpPlanRunRow = {
	bom_id: string;
	section_plan_ids?: string[] | null;
};
type CpSectionPlanRow = {
	section_plan_id: string;
	bom_id: string;
	section: string;
	num_bars?: number | null;
	total_stock_weight_kg?: number | string | null;
};
type MachineGroupRow = {
	group_id: string;
	name?: string | null;
	machine_ids?: string[] | null;
};

const RUN_SELECT = [
	'run_id',
	'request_id',
	'version',
	'run_type',
	'solver',
	'status',
	'schedule_start',
	'makespan_s',
	'num_tasks',
	'on_time_count',
	'total_orders',
	'breached_orders',
	'summary',
	'created_at'
].join(',');

const TASK_SELECT = [
	'task_id',
	'run_id',
	'order_id',
	'bom_id',
	'mark_no',
	'machine_id',
	'product',
	'qty',
	'start_time',
	'end_time',
	'duration_s',
	'changeover_before_s'
].join(',');

function idListParam(ids: string[]): string {
	return ids.map((id) => encodeURIComponent(id)).join(',');
}

function chunkIds(ids: string[], maxEncodedLen = 2500): string[][] {
	const unique = [...new Set(ids.filter(Boolean))];
	const chunks: string[][] = [];
	let current: string[] = [];
	let length = 0;
	for (const id of unique) {
		const pieceLength = encodeURIComponent(id).length;
		if (current.length > 0 && length + pieceLength + 1 > maxEncodedLen) {
			chunks.push(current);
			current = [];
			length = 0;
		}
		current.push(id);
		length += pieceLength + (current.length > 1 ? 1 : 0);
	}
	if (current.length > 0) chunks.push(current);
	return chunks;
}

async function listByIds<T extends Record<string, unknown>>(
	entity: string,
	column: string,
	ids: string[],
	select: string,
	signal?: AbortSignal
): Promise<T[]> {
	const rows: T[] = [];
	for (const chunk of chunkIds(ids)) {
		const envelope = await apiClient.get<ApiEnvelope<T[]>>(
			apiClient.datahub(
				`${entity}?limit=5000&${column}__in=${idListParam(chunk)}&select=${select}`
			),
			{ signal }
		);
		rows.push(...rowsFromEnvelope<T>(envelope.data));
	}
	return rows;
}

async function loadBase(
	planId: string,
	runId?: string,
	signal?: AbortSignal
): Promise<{ plan: PlanRow; run: RunRow; runs: RunRow[]; tasks: TaskRow[] } | null> {
	const request = await getScheduleRequest(planId, signal);
	if (!request) return null;

	const label = scheduleRequestLabel(request);
	rememberScheduleRequestLabel(request.request_id, label);
	const plan: PlanRow = {
		plan_id: request.request_id,
		name: label,
		due_date: request.horizon_end ?? null,
		plant_id: request.plant_id,
		summary: { plants: request.plant_id }
	};

	const runsEnvelope = await apiClient.get<ApiEnvelope<RunRow[]>>(
		apiClient.datahub(
			`aps_schedule_runs?request_id=${encodeURIComponent(request.request_id)}&status=completed&orderBy=version:desc&select=${RUN_SELECT}&limit=5000`
		),
		{ signal }
	);
	const runs = rowsFromEnvelope<RunRow>(runsEnvelope.data);
	const run = runs.find((candidate) => candidate.run_id === runId) ?? runs[0];
	if (!run) return null;

	// KPIs/table prefer run.summary.machine_utilization — skip the heavy tasks GET when present.
	const hasSummaryMetrics =
		Array.isArray(run.summary?.machine_utilization) && run.summary.machine_utilization.length > 0;
	if (hasSummaryMetrics) {
		return { plan, run, runs, tasks: [] };
	}

	const tasksEnvelope = await apiClient.get<ApiEnvelope<TaskRow[]>>(
		apiClient.datahub(
			`aps_schedule_tasks?run_id=${encodeURIComponent(run.run_id)}&orderBy=sequence:asc&select=${TASK_SELECT}&limit=5000`
		),
		{ signal }
	);

	return { plan, run, runs, tasks: rowsFromEnvelope<TaskRow>(tasksEnvelope.data) };
}

function runItems(runs: RunRow[]): ReportRunItem[] {
	return runs.map((run) => ({
		value: run.run_id,
		label: `${run.run_type === 'replan' ? 'Replan' : 'Schedule'} v${run.version ?? '?'} · ${formatDateTime(run.created_at)}`
	}));
}

function numberValue(value: unknown): number {
	const n = typeof value === 'number' ? value : Number(value);
	return Number.isFinite(n) ? n : 0;
}

function formatDateTime(value: string | null | undefined): string {
	if (!value) return '-';
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return value;
	return date.toLocaleString('en-GB', {
		day: '2-digit',
		month: 'short',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		hour12: false
	});
}

function formatDate(value: string | null | undefined): string {
	if (!value) return '-';
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return value;
	return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

function formatClock(value: number): string {
	if (!Number.isFinite(value)) return '-';
	return new Date(value).toLocaleTimeString('en-GB', {
		hour: '2-digit',
		minute: '2-digit',
		hour12: false
	});
}

function formatDuration(seconds: number): string {
	if (!Number.isFinite(seconds) || seconds <= 0) return '-';
	const rounded = Math.round(seconds);
	const h = Math.floor(rounded / 3600);
	const m = Math.floor((rounded % 3600) / 60);
	const s = rounded % 60;
	return [h ? `${h}h` : '', m ? `${m}m` : '', !h && s ? `${s}s` : ''].filter(Boolean).join(' ');
}

function metadataString(metadata: Record<string, unknown> | null | undefined, ...keys: string[]) {
	for (const key of keys) {
		const value = metadata?.[key];
		if (typeof value === 'string' && value.trim()) return value.trim();
	}
	return '';
}

function planString(plan: PlanRow, key: string): string {
	const value = plan.summary?.[key];
	if (typeof value === 'string' && value.trim()) return value.trim();
	if (Array.isArray(value)) return value.filter((item) => typeof item === 'string').join(' + ');
	return '-';
}

async function selectedSetsByBom(
	planId: string,
	signal?: AbortSignal
): Promise<Map<string, number>> {
	const linksEnvelope = await apiClient.get<ApiEnvelope<PlanProductionPlanRow[]>>(
		apiClient.datahub(
			`aps_production_plans?plan_id=${encodeURIComponent(planId)}&select=production_plan_id,selected_lines&limit=5000`
		),
		{ signal }
	);
	const links = rowsFromEnvelope<PlanProductionPlanRow>(linksEnvelope.data);
	const productionPlanIds = [...new Set(links.map((link) => link.production_plan_id))];
	const lines = await listByIds<ProductionPlanLineRow>(
		'proj_production_plan_lines',
		'production_plan_id',
		productionPlanIds,
		'production_plan_line_id,production_plan_id,bom_id,quantity',
		signal
	);
	const byProductionPlan = new Map<string, ProductionPlanLineRow[]>();
	for (const line of lines) {
		const bucket = byProductionPlan.get(line.production_plan_id) ?? [];
		bucket.push(line);
		byProductionPlan.set(line.production_plan_id, bucket);
	}

	const sets = new Map<string, number>();
	for (const link of links) {
		const selected = link.selected_lines ?? {};
		const keys = Object.keys(selected);
		const active =
			keys.length > 0
				? (byProductionPlan.get(link.production_plan_id) ?? []).filter((line) =>
						keys.includes(line.production_plan_line_id)
					)
				: (byProductionPlan.get(link.production_plan_id) ?? []);
		for (const line of active) {
			const selectedQty = numberValue(selected[line.production_plan_line_id]);
			const qty = selectedQty > 0 ? selectedQty : numberValue(line.quantity);
			sets.set(line.bom_id, (sets.get(line.bom_id) ?? 0) + qty);
		}
	}
	return sets;
}

type JobCardBomAgg = { sets: number; marks: number; weightMt: number };

/** Prefer job-card aggregates when the run has cards; falls back to production-plan lines. */
async function bomAggregatesForRun(
	planId: string,
	runId: string,
	signal?: AbortSignal
): Promise<{ byBom: Map<string, JobCardBomAgg>; fromJobCards: boolean }> {
	const cards = await listJobCardRows(runId, signal);
	const active = cards.filter((card) => card.status !== 'cancelled');
	if (active.length === 0) {
		const setsByBom = await selectedSetsByBom(planId, signal);
		const byBom = new Map<string, JobCardBomAgg>();
		for (const [bomId, sets] of setsByBom) {
			byBom.set(bomId, { sets, marks: 0, weightMt: 0 });
		}
		return { byBom, fromJobCards: false };
	}

	const byBom = new Map<string, JobCardBomAgg>();
	for (const card of active) {
		const bomId = card.bom_id?.trim();
		if (!bomId) continue;
		const prev = byBom.get(bomId) ?? { sets: 0, marks: 0, weightMt: 0 };
		prev.sets += numberValue(card.num_sets);
		prev.marks += numberValue(card.marks_count);
		prev.weightMt += numberValue(card.total_weight_mt);
		byBom.set(bomId, prev);
	}
	return { byBom, fromJobCards: true };
}

async function latestSectionPlansByBom(
	bomIds: string[],
	signal?: AbortSignal
): Promise<Map<string, CpSectionPlanRow[]>> {
	const latestRuns = new Map<string, CpPlanRunRow>();
	for (const chunk of chunkIds(bomIds)) {
		const envelope = await apiClient.get<ApiEnvelope<CpPlanRunRow[]>>(
			apiClient.datahub(
				`cp_plan_runs?limit=5000&bom_id__in=${idListParam(chunk)}&status=completed&orderBy=version:desc&select=bom_id,section_plan_ids`
			),
			{ signal }
		);
		for (const run of rowsFromEnvelope<CpPlanRunRow>(envelope.data)) {
			if (!latestRuns.has(run.bom_id)) latestRuns.set(run.bom_id, run);
		}
	}

	const plans = await listByIds<CpSectionPlanRow>(
		'cp_section_plans',
		'section_plan_id',
		[...latestRuns.values()].flatMap((run) => run.section_plan_ids ?? []),
		'section_plan_id,bom_id,section,num_bars,total_stock_weight_kg',
		signal
	);
	const byBom = new Map<string, CpSectionPlanRow[]>();
	for (const plan of plans) {
		const list = byBom.get(plan.bom_id) ?? [];
		list.push(plan);
		byBom.set(plan.bom_id, list);
	}
	return byBom;
}

export async function loadScheduleReport(
	planId: string,
	runId?: string,
	signal?: AbortSignal
): Promise<ScheduleReport | null> {
	const base = await loadBase(planId, runId, signal);
	if (!base) return null;
	const { plan, run, runs, tasks } = base;

	// Prefer job-card aggregates for the run; fall back to production-plan selected lines.
	const { byBom: bomAgg, fromJobCards } = await bomAggregatesForRun(
		plan.plan_id,
		run.run_id,
		signal
	);
	const planBomIds = [...bomAgg.keys()];
	const taskBomIds = [
		...new Set(tasks.map((task) => task.bom_id).filter((id): id is string => Boolean(id)))
	];

	const bomIds = [...new Set([...planBomIds, ...taskBomIds])];
	const [bomRows, sectionPlansByBom] = await Promise.all([
		bomIds.length === 0
			? Promise.resolve([] as Record<string, unknown>[])
			: datahubQuery<Record<string, unknown>>(
					'proj_boms',
					{
						bom_id__in: bomIds.join(','),
						select:
							'bom_id,structure_id,bom_name,s.structure_id,s.project_id,s.name,p.project_id,p.name,p.metadata',
						joins: [
							leftJoin('proj_structures', 's', 'structure_id', 's.structure_id'),
							{
								entity: 'proj_projects',
								alias: 'p',
								type: 'left',
								on: [{ leftField: 's.project_id', op: 'eq', rightField: 'p.project_id' }]
							}
						]
					},
					signal
				),
		latestSectionPlansByBom(bomIds, signal)
	]);
	const bomById = new Map<string, BomRow>();
	const structureById = new Map<string, StructureRow>();
	const projectById = new Map<string, ProjectRow>();
	for (const row of bomRows) {
		const bomId = String(row.bom_id ?? '');
		if (!bomId) continue;
		const structureId = pickAliasString(row, 's', 'structure_id') || String(row.structure_id ?? '');
		const projectId =
			pickAliasString(row, 's', 'project_id') || pickAliasString(row, 'p', 'project_id');
		bomById.set(bomId, {
			bom_id: bomId,
			structure_id: structureId,
			bom_name: String(row.bom_name ?? '')
		});
		if (structureId && !structureById.has(structureId)) {
			structureById.set(structureId, {
				structure_id: structureId,
				project_id: projectId,
				name: pickAliasString(row, 's', 'name')
			});
		}
		if (projectId && !projectById.has(projectId)) {
			projectById.set(projectId, {
				project_id: projectId,
				name: pickAliasString(row, 'p', 'name'),
				metadata: (pickAlias(row, 'p', 'metadata') ?? undefined) as
					Record<string, unknown> | undefined
			});
		}
	}

	type Bucket = {
		bom: BomRow;
		structure: StructureRow;
		project: ProjectRow;
		tasks: TaskRow[];
	};
	const buckets = new Map<string, Bucket>();
	for (const task of tasks) {
		const bom = task.bom_id ? bomById.get(task.bom_id) : undefined;
		const structure = bom ? structureById.get(bom.structure_id) : undefined;
		const project = structure ? projectById.get(structure.project_id) : undefined;
		if (!bom || !structure || !project) continue;
		const bucket = buckets.get(bom.bom_id) ?? { bom, structure, project, tasks: [] };
		bucket.tasks.push(task);
		buckets.set(bom.bom_id, bucket);
	}

	const byProject = new Map<string, Bucket[]>();
	for (const bucket of buckets.values()) {
		const list = byProject.get(bucket.project.project_id) ?? [];
		list.push(bucket);
		byProject.set(bucket.project.project_id, list);
	}

	const plants = planString(plan, 'plants');
	const nodes: TreeTableNode<ScheduleStructureRow>[] = [];
	let totalWeightMt = numberValue(run.summary?.total_weight_mt);
	if (!totalWeightMt && fromJobCards) {
		totalWeightMt = [...bomAgg.values()].reduce((sum, agg) => sum + agg.weightMt, 0);
	}
	for (const [projectId, projectBuckets] of byProject) {
		const project = projectById.get(projectId)!;
		const workOrder =
			metadataString(project.metadata, 'work_order_no', 'workOrderNo', 'work_order') ||
			project.name;
		const children: TreeTableNode<ScheduleStructureRow>[] = projectBuckets.map((bucket) => {
			const starts = bucket.tasks
				.map((task) => new Date(task.start_time ?? '').getTime())
				.filter(Number.isFinite);
			const ends = bucket.tasks
				.map((task) => new Date(task.end_time ?? '').getTime())
				.filter(Number.isFinite);
			const start = starts.length ? Math.min(...starts) : NaN;
			const end = ends.length ? Math.max(...ends) : NaN;
			const marks = new Set(bucket.tasks.map((task) => task.mark_no).filter(Boolean));
			const sectionPlans = sectionPlansByBom.get(bucket.bom.bom_id) ?? [];
			const sectionPlanByName = new Map(
				sectionPlans.map((sectionPlan) => [sectionPlan.section.trim().toLowerCase(), sectionPlan])
			);
			// Only sections that appear in both APS tasks and a CP plan (skip BOM-only / unplanned).
			const sections = [
				...new Set(
					bucket.tasks
						.map((task) => (task.product ?? '').trim())
						.filter((name) => name && sectionPlanByName.has(name.toLowerCase()))
				)
			];
			const sets = bomAgg.get(bucket.bom.bom_id)?.sets ?? 1;
			const cardAgg = bomAgg.get(bucket.bom.bom_id);
			// ponytail: roll up CP section stock weight; run.summary.total_weight_mt often absent
			const weightKg = sections.reduce((sum, section) => {
				const sectionPlan = sectionPlanByName.get(section.toLowerCase());
				return sum + numberValue(sectionPlan?.total_stock_weight_kg);
			}, 0);
			const weightMtFromCp = (weightKg * Math.max(sets, 1)) / 1000;
			const weightMt =
				fromJobCards && cardAgg && cardAgg.weightMt > 0 ? cardAgg.weightMt : weightMtFromCp;
			if (!numberValue(run.summary?.total_weight_mt)) totalWeightMt += weightMt;
			const marksLabel = fromJobCards && cardAgg ? String(cardAgg.marks) : String(marks.size);
			return {
				id: `report-${bucket.bom.bom_id}`,
				label: workOrder,
				defaultExpanded: true,
				data: {
					workOrder,
					structure: `${bucket.structure.name} - ${bucket.bom.bom_name}`,
					sets: String(bomAgg.get(bucket.bom.bom_id)?.sets ?? '-'),
					sections: String(sections.length),
					marks: marksLabel,
					weight: weightMt > 0 ? weightMt.toFixed(2) : '-',
					plant: plants,
					plannedDue: formatDate(plan.due_date),
					start: formatClock(start),
					estCompletion: formatClock(end),
					makespan: formatDuration((end - start) / 1000)
				},
				details: sections.map((name) => {
					const sectionPlan = sectionPlanByName.get(name.toLowerCase())!;
					const bars = numberValue(sectionPlan.num_bars);
					const weight = numberValue(sectionPlan.total_stock_weight_kg);
					return `${name} · ${bars} ${bars === 1 ? 'bar' : 'bars'} · ${weight.toLocaleString('en-IN', { maximumFractionDigits: 2 })} kg`;
				})
			};
		});
		nodes.push({
			id: `project-${projectId}`,
			kind: 'group',
			label: project.name,
			children
		});
	}

	const uniqueMarks = fromJobCards
		? [...bomAgg.values()].reduce((sum, agg) => sum + agg.marks, 0)
		: new Set(tasks.map((task) => task.mark_no).filter(Boolean)).size;
	const totalSets = [...bomAgg.values()].reduce((sum, agg) => sum + agg.sets, 0);
	const totalOrders = run.total_orders ?? byProject.size;
	const onTime = run.on_time_count ?? 0;

	return {
		planId: plan.plan_id,
		runId: run.run_id,
		runLabel: plan.name?.trim() || plan.plan_id,
		ranAt: `${formatDateTime(run.created_at)} - Ran by scheduler`,
		runItems: runItems(runs),
		kpis: [
			{ label: 'Work Orders', value: String(byProject.size || totalOrders) },
			{ label: 'Sets', value: String(totalSets) },
			{ label: 'Total Weight', value: totalWeightMt ? `${totalWeightMt.toFixed(2)} MT` : '-' },
			{ label: 'Total Tasks', value: String(run.num_tasks ?? tasks.length) },
			{ label: 'Makespan', value: formatDuration(numberValue(run.makespan_s)) },
			{ label: 'On-time', value: `${onTime} / ${totalOrders}` },
			{ label: 'Plants', value: plants }
		],
		footer: `${totalSets} sets · ${totalWeightMt ? `${totalWeightMt.toFixed(2)} MT` : '-'} · ${uniqueMarks} marks`,
		nodes
	};
}

function groupLabel(groupId: string): string {
	const labels: Record<string, string> = {
		B: 'Bending',
		H: 'Heel Grinding',
		N: 'Notching',
		CPD: 'Cutting Punching Drilling',
		CPS: 'Cutting Punching Stamping',
		CDS: 'Cutting Drilling Stamping'
	};
	return labels[groupId.toUpperCase()] ?? groupId;
}

function derivedMachineMetrics(tasks: TaskRow[]): MachineUtilizationRow[] {
	const byMachine = new Map<string, TaskRow[]>();
	for (const task of tasks) {
		const machine = task.machine_id?.trim();
		if (!machine) continue;
		const bucket = byMachine.get(machine) ?? [];
		bucket.push(task);
		byMachine.set(machine, bucket);
	}
	return [...byMachine].map(([machine, rows]) => {
		const starts = rows
			.map((row) => new Date(row.start_time ?? '').getTime())
			.filter(Number.isFinite);
		const ends = rows.map((row) => new Date(row.end_time ?? '').getTime()).filter(Number.isFinite);
		const spanS =
			starts.length && ends.length ? (Math.max(...ends) - Math.min(...starts)) / 1000 : 0;
		const busyS = rows.reduce((sum, row) => sum + numberValue(row.duration_s), 0);
		const changeoverS = rows.reduce((sum, row) => sum + numberValue(row.changeover_before_s), 0);
		const group = machine.match(/^[A-Za-z]+/)?.[0]?.toUpperCase() ?? machine;
		return {
			machine_id: machine,
			group,
			jobs: rows.length,
			parts: rows.reduce((sum, row) => sum + numberValue(row.qty), 0),
			busy_s: busyS,
			changeover_s: changeoverS,
			span_s: spanS,
			idle_s: Math.max(0, spanS - busyS - changeoverS),
			utilization_pct: spanS > 0 ? (busyS / spanS) * 100 : 0
		};
	});
}

export async function loadMachinesReport(
	planId: string,
	runId?: string,
	signal?: AbortSignal
): Promise<MachinesReport | null> {
	const base = await loadBase(planId, runId, signal);
	if (!base) return null;
	const { plan, run, runs, tasks } = base;

	const groupsEnvelope = await apiClient.get<ApiEnvelope<MachineGroupRow[]>>(
		apiClient.datahub('aps_machine_groups?select=group_id,name,machine_ids&limit=5000'),
		{ signal }
	);
	const groups = rowsFromEnvelope<MachineGroupRow>(groupsEnvelope.data);
	const groupByMachine = new Map<string, MachineGroupRow>();
	for (const group of groups) {
		for (const machineId of group.machine_ids ?? []) groupByMachine.set(machineId, group);
	}

	const summaryMetrics = run.summary?.machine_utilization;
	const metrics =
		Array.isArray(summaryMetrics) && summaryMetrics.length > 0
			? summaryMetrics
			: derivedMachineMetrics(tasks);
	const byGroup = new Map<string, MachineUtilizationRow[]>();
	for (const metric of metrics) {
		const configured = groupByMachine.get(metric.machine_id);
		const groupId = configured?.group_id ?? metric.group ?? 'Other';
		const bucket = byGroup.get(groupId) ?? [];
		bucket.push({ ...metric, group: groupId });
		byGroup.set(groupId, bucket);
	}

	const nodes: TreeTableNode<MachineReportRow>[] = [];
	for (const [groupId, machineRows] of byGroup) {
		const name =
			groups.find((group) => group.group_id === groupId)?.name?.trim() || groupLabel(groupId);
		const children: TreeTableNode<MachineReportRow>[] = machineRows.map((metric) => ({
			id: metric.machine_id,
			label: metric.machine_id,
			data: {
				machine: metric.machine_id,
				group: name,
				jobs: String(numberValue(metric.jobs)),
				parts: String(numberValue(metric.parts)),
				weight: numberValue(metric.weight_mt) ? numberValue(metric.weight_mt).toFixed(2) : '-',
				busy: formatDuration(numberValue(metric.busy_s)),
				changeover: formatDuration(numberValue(metric.changeover_s)),
				idle: formatDuration(numberValue(metric.idle_s)),
				totalSpan: formatDuration(numberValue(metric.span_s)),
				utilization: `${numberValue(metric.utilization_pct).toFixed(2)}%`
			}
		}));
		const jobs = machineRows.reduce((sum, metric) => sum + numberValue(metric.jobs), 0);
		const parts = machineRows.reduce((sum, metric) => sum + numberValue(metric.parts), 0);
		// Throughput sum within the group (same convention as parts) - may exceed plan total_weight_mt.
		const weightMt = machineRows.reduce((sum, metric) => sum + numberValue(metric.weight_mt), 0);
		const busy = machineRows.reduce((sum, metric) => sum + numberValue(metric.busy_s), 0);
		const changeover = machineRows.reduce(
			(sum, metric) => sum + numberValue(metric.changeover_s),
			0
		);
		const avgUtilization =
			machineRows.reduce((sum, metric) => sum + numberValue(metric.utilization_pct), 0) /
			Math.max(1, machineRows.length);
		const weightLabel = weightMt > 0 ? `${weightMt.toFixed(2)} MT` : '-';
		children.push({
			id: `footer-${groupId}`,
			kind: 'group-footer',
			label: `${groupId} Total: ${jobs} jobs • ${parts} parts • ${weightLabel} • ${formatDuration(busy)} busy • ${formatDuration(changeover)} changeover • ${avgUtilization.toFixed(1)}% avg utilization`
		});
		nodes.push({ id: `group-${groupId}`, kind: 'group', label: name, children });
	}

	const totalBusy = metrics.reduce((sum, metric) => sum + numberValue(metric.busy_s), 0);
	const totalChangeover = metrics.reduce(
		(sum, metric) => sum + numberValue(metric.changeover_s),
		0
	);
	const totalIdle = metrics.reduce((sum, metric) => sum + numberValue(metric.idle_s), 0);
	const avgUtilization =
		metrics.reduce((sum, metric) => sum + numberValue(metric.utilization_pct), 0) /
		Math.max(1, metrics.length);
	// Unique-mark plan total from the solver - do NOT sum machine_utilization[].weight_mt
	// (throughput multi-counts multi-step routes by design).
	const totalWeightMt = numberValue(run.summary?.total_weight_mt);
	const configuredMachines = new Set(groups.flatMap((group) => group.machine_ids ?? [])).size;

	return {
		planId: plan.plan_id,
		runId: run.run_id,
		runLabel: plan.name?.trim() || plan.plan_id,
		ranAt: `${formatDateTime(run.created_at)} - Ran by scheduler`,
		runItems: runItems(runs),
		kpis: [
			{ label: 'Avg Utilization', value: `${avgUtilization.toFixed(1)}%` },
			{
				label: 'Total Weight',
				value: totalWeightMt > 0 ? `${totalWeightMt.toFixed(2)} MT` : '-'
			},
			{ label: 'Total Busy', value: formatDuration(totalBusy) },
			{ label: 'Total Changeover', value: formatDuration(totalChangeover) },
			{ label: 'Total Idle', value: formatDuration(totalIdle) },
			{
				label: 'Machines Used',
				value: `${metrics.length}${configuredMachines ? ` of ${configuredMachines}` : ''}`
			}
		],
		nodes
	};
}

export function scheduleReportHash(planId: string): string {
	return `#/ShopFloorPlanning/Aps/${encodeURIComponent(planId)}/Schedule`;
}

export function machinesReportHash(planId: string): string {
	return `#/ShopFloorPlanning/Aps/${encodeURIComponent(planId)}/Machines`;
}
