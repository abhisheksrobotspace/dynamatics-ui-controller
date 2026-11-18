import type {
	ScheduleJobDetail,
	ScheduleResource,
	ScheduleTask,
	UtilizationSeries
} from '@ifactory/ui-v2';
import { apiClient } from '../../lib/api/api-client.js';
import { datahubQuery, leftJoin, pickAliasString } from '../../lib/api/datahub-query.js';
import { triggerJob, waitForJob, type AsyncJobRow } from '../../lib/api/jobs.js';
import { rowsFromEnvelope, type ApiEnvelope } from '../../lib/api/types.js';
import { formatUtcAsIst } from '../../lib/datetime/format-ist.js';
import { user } from '../../lib/os/index.svelte.js';
import { broadcastApsScheduleEnded, broadcastApsScheduleStarted } from './aps-schedule-bus.js';
import { rememberManufacturingPlanLabel } from './manufacturing-plans.js';
import { getScheduleRequest, scheduleRequestLabel } from './schedule-requests.api.js';
import type { ApsSchedulerUiSolver } from './aps-scheduler.js';
import { DEFAULT_APS_SOLVER } from './aps-scheduler.js';
import {
	listJobCardLineRowsForCards,
	listJobCardRows,
	type ApsJobCardLineRow
} from './job-cards.api.js';
import {
	buildJobCardOrderTree,
	flattenUnitTaskMarks,
	formatGanttBarLabel,
	formatJobCardLeafLabel,
	formatScheduleTaskLabel,
	taskGanttHighlightIds,
	taskOrderId,
	type FlattenedUnitMark,
	type JobCardTreeRow
} from './production-schedule.derive.js';
import { timelineHoursFromStart } from './scheduler-datetime.js';
import type {
	ProductionScheduleData,
	ScheduleDependencyEdge
} from './production-schedule.types.js';
import { formatIsoDateDdMmYyyy } from './create-plan-ds.utils.js';

type PlanRow = {
	plan_id: string;
	name?: string | null;
	latest_run_id?: string | null;
	summary?: Record<string, unknown>;
};

type PlanRunRow = {
	run_id: string;
	plan_id: string;
	version?: number | null;
	base_run_id?: string | null;
	run_type?: string | null;
	status: string;
	schedule_start?: string | null;
	makespan_s?: number | null;
	num_tasks?: number | null;
	published_at?: string | null;
	published_by?: string | null;
	sources_frozen?: boolean | null;
	summary?: {
		machine_utilization?: Array<{
			machine_id: string;
			group?: string;
			utilization_pct?: number;
			busy_s?: number;
			span_s?: number;
		}>;
		machines_used?: number;
		total_weight_mt?: number;
		warnings?: unknown;
	} | null;
	metadata?: Record<string, unknown> | null;
	created_at?: string;
};

type ScheduledTaskRow = {
	task_id: string;
	run_id: string;
	plan_id?: string | null;
	work_order_id?: string | null;
	bom_item_id?: string | null;
	bom_id?: string | null;
	mark_no?: string | null;
	node_id?: string | null;
	step_code?: string | null;
	machine_id?: string | null;
	product?: string | null;
	qty?: number | null;
	holes?: number | null;
	rm_id?: string | null;
	dxf_file_id?: string | null;
	start_time?: string | null;
	end_time?: string | null;
	duration_s?: number | null;
	changeover_before_s?: number | null;
	sequence?: number | null;
	locked?: boolean | null;
	is_fixed?: boolean | null;
	job_card_id?: string | null;
	card_id?: string | null;
	task_kind?: string | null;
	unit_index?: number | null;
	bundle_index?: number | null;
	metadata?: { marks?: unknown; order_id?: string } | null;
};

function normalizeTask(row: ScheduledTaskRow): ScheduledTaskRow {
	return {
		...row,
		job_card_id: row.card_id ?? row.job_card_id,
		locked: row.is_fixed ?? row.locked,
		bom_item_id: row.bom_id ?? row.bom_item_id
	};
}

const TASK_COLORS = [
	'#3B82F6',
	'#8B5CF6',
	'#14B8A6',
	'#F59E0B',
	'#EF4444',
	'#6366F1',
	'#A855F7',
	'#64748B',
	'#0EA5E9',
	'#84CC16'
];

const GROUP_COLORS: Record<string, string> = {
	B: '#64748B',
	CPD: '#3B82F6',
	CDS: '#3B82F6',
	CPS: '#14B8A6',
	H: '#F59E0B',
	N: '#EF4444'
};

const TASK_SELECT = [
	'task_id',
	'run_id',
	'order_id',
	'order_key',
	'card_id',
	'bom_id',
	'mark_no',
	'node_id',
	'step_code',
	'machine_id',
	'product',
	'qty',
	'holes',
	'rm_id',
	'start_time',
	'end_time',
	'duration_s',
	'changeover_before_s',
	'sequence',
	'is_fixed',
	'task_kind',
	'unit_index',
	'bundle_index',
	'metadata'
].join(',');

const RUN_SELECT = [
	'run_id',
	'request_id',
	'version',
	'base_run_id',
	'run_type',
	'status',
	'schedule_start',
	'makespan_s',
	'num_tasks',
	'published_at',
	'published_by',
	'sources_frozen',
	'summary',
	'created_at'
].join(',');

function colorForMark(mark: string): string {
	let hash = 0;
	for (let i = 0; i < mark.length; i++) hash = (hash * 31 + mark.charCodeAt(i)) | 0;
	return TASK_COLORS[Math.abs(hash) % TASK_COLORS.length] ?? TASK_COLORS[0]!;
}

function groupFromMachineId(machineId: string, stepCode?: string | null): string {
	if (stepCode?.trim()) return stepCode.trim().toUpperCase();
	const match = machineId
		.trim()
		.toUpperCase()
		.match(/^([A-Z]+)/);
	return match?.[1] ?? machineId;
}

function formatMakespan(seconds: number | null | undefined): string {
	const s = Math.max(0, Math.round(seconds ?? 0));
	const h = Math.floor(s / 3600);
	const m = Math.floor((s % 3600) / 60);
	if (h <= 0) return `${m}M`;
	return `${h}H ${m}M`;
}

function formatClock(ms: number): string {
	const d = new Date(ms);
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function getPlan(planId: string, signal?: AbortSignal): Promise<PlanRow | undefined> {
	const request = await getScheduleRequest(planId, signal).catch(() => null);
	if (request) {
		return {
			plan_id: request.request_id,
			name: scheduleRequestLabel(request),
			latest_run_id: null,
			summary: undefined
		};
	}
	return undefined;
}

/**
 * Release banner label from request sources ⟕ shopfloor lines (denormalized DS name/date).
 * One round-trip — no N+1 per source month, no proj_delivery_schedules re-fetch.
 */
async function resolveDeliveryScheduleLabel(planId: string, signal?: AbortSignal): Promise<string> {
	const rows = await datahubQuery<Record<string, unknown>>(
		'aps_request_sources',
		{
			request_id: planId,
			limit: 5000,
			select: [
				'request_source_id',
				'shopfloor_plan_id',
				'l.delivery_schedule_id',
				'l.delivery_schedule_name',
				'l.delivery_date'
			].join(','),
			joins: [leftJoin('pln_shopfloor_plan_lines', 'l', 'shopfloor_plan_id', 'l.shopfloor_plan_id')]
		},
		signal
	).catch(() => [] as Record<string, unknown>[]);

	const labels: string[] = [];
	const seen = new Set<string>();
	for (const row of rows) {
		const scheduleId = pickAliasString(row, 'l', 'delivery_schedule_id');
		const name = pickAliasString(row, 'l', 'delivery_schedule_name').trim();
		const deliveryDate = pickAliasString(row, 'l', 'delivery_date').trim();
		const key = scheduleId || `${name}|${deliveryDate}`;
		if (!key || seen.has(key)) continue;
		seen.add(key);
		const dateLabel = deliveryDate ? formatIsoDateDdMmYyyy(deliveryDate.slice(0, 10)) : '';
		const label = name && dateLabel ? `${name} - ${dateLabel}` : name || dateLabel;
		if (label) labels.push(label);
	}
	return labels.length > 0 ? `DELIVERY SCHEDULE ${labels.join('/')}` : 'DELIVERY SCHEDULE -';
}

/** In-flight APS solve row (orchestrator sets this after snapshot build). */
export async function getActiveScheduleRun(
	planId: string,
	signal?: AbortSignal
): Promise<PlanRunRow | undefined> {
	const envelope = await apiClient.get<ApiEnvelope<PlanRunRow[]>>(
		apiClient.datahub(
			`aps_schedule_runs?request_id=${encodeURIComponent(planId)}&status=solving&orderBy=created_at:desc&select=${RUN_SELECT}&limit=1`
		),
		{ signal }
	);
	const row = rowsFromEnvelope<PlanRunRow & { request_id?: string }>(envelope.data)[0];
	return row ? toPlanRun(row) : undefined;
}

type ApsAsyncJobRow = Pick<AsyncJobRow, 'job_id' | 'status'> & {
	request?: { request_id?: string; plan_id?: string; op?: string } | null;
};

const ACTIVE_APS_JOB_STATUSES = ['queued', 'dispatched', 'processing'] as const;

/** In-flight APS async job (exists immediately after Run Schedule - before `aps_plan_runs.solving`). */
export async function getActiveApsScheduleJob(
	planId: string,
	signal?: AbortSignal
): Promise<ApsAsyncJobRow | undefined> {
	const envelope = await apiClient.get<ApiEnvelope<ApsAsyncJobRow[]>>(
		apiClient.datahub(
			`async_jobs?feature=aps&status__in=${ACTIVE_APS_JOB_STATUSES.join(',')}&orderBy=created_at:desc&select=job_id,status,request&limit=50`
		),
		{ signal }
	);
	return rowsFromEnvelope<ApsAsyncJobRow>(envelope.data).find(
		(row) => row.request?.request_id === planId || row.request?.plan_id === planId
	);
}

/** True when any tab/user has an APS schedule/replan in progress for this plan. */
export async function isPlanScheduleActive(planId: string, signal?: AbortSignal): Promise<boolean> {
	const [run, job] = await Promise.all([
		getActiveScheduleRun(planId, signal),
		getActiveApsScheduleJob(planId, signal)
	]);
	return Boolean(run || job);
}

function toPlanRun(row: PlanRunRow & { request_id?: string }): PlanRunRow {
	return { ...row, plan_id: row.request_id ?? row.plan_id };
}

async function getLatestCompletedRun(
	planId: string,
	preferredRunId: string | null | undefined,
	signal?: AbortSignal
): Promise<PlanRunRow | undefined> {
	if (preferredRunId) {
		const byId = await apiClient.get<ApiEnvelope<PlanRunRow[]>>(
			apiClient.datahub(
				`aps_schedule_runs?run_id=${encodeURIComponent(preferredRunId)}&select=${RUN_SELECT}&limit=1`
			),
			{ signal }
		);
		const row = rowsFromEnvelope<PlanRunRow & { request_id?: string }>(byId.data)[0];
		if (row?.status === 'completed') return toPlanRun(row);
	}

	const envelope = await apiClient.get<ApiEnvelope<PlanRunRow[]>>(
		apiClient.datahub(
			`aps_schedule_runs?request_id=${encodeURIComponent(planId)}&status=completed&orderBy=created_at:desc&select=${RUN_SELECT}&limit=1`
		),
		{ signal }
	);
	const latest = rowsFromEnvelope<PlanRunRow & { request_id?: string }>(envelope.data)[0];
	return latest ? toPlanRun(latest) : undefined;
}

async function getCompletedRunById(
	planId: string,
	runId: string,
	signal?: AbortSignal
): Promise<PlanRunRow | undefined> {
	const envelope = await apiClient.get<ApiEnvelope<PlanRunRow[]>>(
		apiClient.datahub(
			`aps_schedule_runs?run_id=${encodeURIComponent(runId)}&request_id=${encodeURIComponent(planId)}&select=${RUN_SELECT}&limit=1`
		),
		{ signal }
	);
	const row = rowsFromEnvelope<PlanRunRow & { request_id?: string }>(envelope.data)[0];
	if (row?.status === 'completed') return toPlanRun(row);
	return undefined;
}

async function listTasks(runId: string, signal?: AbortSignal): Promise<ScheduledTaskRow[]> {
	const envelope = await apiClient.get<ApiEnvelope<ScheduledTaskRow[]>>(
		apiClient.datahub(
			`aps_schedule_tasks?run_id=${encodeURIComponent(runId)}&orderBy=sequence:asc&select=${TASK_SELECT}&limit=5000`
		),
		{ signal }
	);
	return rowsFromEnvelope<ScheduledTaskRow>(envelope.data).map(normalizeTask);
}

function buildResources(tasks: ScheduledTaskRow[]): ScheduleResource[] {
	const byId = new Map<string, ScheduleResource>();
	for (const task of tasks) {
		const machineId = (task.machine_id ?? '').trim();
		if (!machineId || byId.has(machineId)) continue;
		byId.set(machineId, {
			id: machineId,
			label: machineId,
			groupId: groupFromMachineId(machineId, task.step_code)
		});
	}
	return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}

function nodeSortKey(nodeId: string): number {
	const trimmed = nodeId.trim();
	const orchestrator = /^s(\d+)$/.exec(trimmed);
	if (orchestrator) return Number(orchestrator[1]);
	const legacy = /^step_(\d+)_/i.exec(trimmed);
	if (legacy) return Number(legacy[1]);
	return Number.MAX_SAFE_INTEGER;
}

/** Linear process-chain edges from scheduled steps (orchestrator node_ids: s0, s1, s2…). */
function buildDependencyEdges(rows: ScheduledTaskRow[]): ScheduleDependencyEdge[] {
	const byCard = new Map<string, ScheduledTaskRow[]>();
	for (const row of rows) {
		const nodeId = row.node_id?.trim();
		if (!nodeId) continue;
		const key = taskOrderId(row.job_card_id);
		const list = byCard.get(key) ?? [];
		list.push(row);
		byCard.set(key, list);
	}

	const seen = new Set<string>();
	const edges: ScheduleDependencyEdge[] = [];
	for (const tasks of byCard.values()) {
		const byNode = new Map<string, ScheduledTaskRow>();
		for (const task of tasks) {
			const id = task.node_id!.trim();
			if (!byNode.has(id)) byNode.set(id, task);
		}
		const ordered = [...byNode.values()].sort(
			(a, b) => nodeSortKey(a.node_id!) - nodeSortKey(b.node_id!)
		);
		for (let i = 0; i < ordered.length - 1; i++) {
			const from = ordered[i]!.node_id!.trim();
			const to = ordered[i + 1]!.node_id!.trim();
			const sig = `${from}\0${to}`;
			if (seen.has(sig)) continue;
			seen.add(sig);
			edges.push({ from, to });
		}
	}
	return edges;
}

function stepColor(stepCode: string | null | undefined): string {
	const step = stepCode?.trim().toUpperCase() ?? '';
	return GROUP_COLORS[step] ?? colorForMark(step || 'task');
}

function buildTasks(
	rows: ScheduledTaskRow[],
	anchorMs: number,
	cardsById: Map<string, JobCardTreeRow>
): ScheduleTask[] {
	return rows
		.filter((row) => row.machine_id && row.start_time)
		.map((row) => {
			const card = row.job_card_id ? cardsById.get(row.job_card_id) : undefined;
			const label = formatGanttBarLabel(card, row.product);
			const startMs = new Date(row.start_time!).getTime();
			const endMs = row.end_time
				? new Date(row.end_time).getTime()
				: startMs + (row.duration_s ?? 0) * 1000;
			const startMin = Math.max(0, Math.round((startMs - anchorMs) / 60_000));
			const durationMin = Math.max(
				1,
				Math.round((endMs - startMs) / 60_000) || Math.round((row.duration_s ?? 60) / 60)
			);
			const changeoverMin =
				row.changeover_before_s != null && row.changeover_before_s > 0
					? Math.round(row.changeover_before_s / 60)
					: undefined;
			const stepId = row.node_id ?? row.step_code ?? undefined;
			const order = taskOrderId(row.job_card_id);
			const pinOrderId =
				typeof row.metadata?.order_id === 'string' ? row.metadata.order_id.trim() : '';
			return {
				id: row.task_id,
				resourceId: row.machine_id!,
				label,
				orderId: row.work_order_id ?? undefined,
				jobCardId: order,
				pinOrderId: pinOrderId || undefined,
				bomItemId: row.bom_item_id?.trim() || undefined,
				markLabel: label,
				stepId,
				startMin,
				durationMin,
				changeoverMin,
				color: stepColor(row.step_code),
				locked: Boolean(row.locked),
				qty: row.qty ?? undefined,
				highlightIds: taskGanttHighlightIds(row, rows)
			};
		});
}

function detailFromTaskRow(row: ScheduledTaskRow): ScheduleJobDetail {
	const title = formatScheduleTaskLabel(row);
	const startMs = row.start_time ? new Date(row.start_time).getTime() : NaN;
	const endMs = row.end_time ? new Date(row.end_time).getTime() : NaN;
	const durationMin =
		Number.isFinite(startMs) && Number.isFinite(endMs)
			? Math.max(1, Math.round((endMs - startMs) / 60_000))
			: Math.round((row.duration_s ?? 0) / 60);
	const changeover =
		row.changeover_before_s != null && row.changeover_before_s > 0
			? `${Math.round(row.changeover_before_s / 60)}m`
			: undefined;

	return {
		title,
		color: stepColor(row.step_code),
		sections: [
			{
				title: 'Assignment',
				fields: [
					{ label: 'Machine', value: row.machine_id ?? '-' },
					{ label: 'Step', value: row.step_code?.trim() || '-' }
				]
			},
			{
				title: 'Production',
				fields: [
					{ label: 'Product', value: row.product ?? title },
					{ label: 'Qty', value: row.qty ?? '-' },
					{ label: 'Holes', value: row.holes ?? '-' },
					{ label: 'RM ID', value: row.rm_id ?? '-' }
				]
			},
			{
				title: 'Timing',
				fields: [
					{
						label: 'Start',
						value: row.start_time ? formatUtcAsIst(row.start_time) : '-'
					},
					{
						label: 'End',
						value: row.end_time ? formatUtcAsIst(row.end_time) : '-'
					},
					{ label: 'Duration', value: `${durationMin}m` },
					...(changeover ? [{ label: 'Changeover before', value: changeover }] : [])
				]
			}
		]
	};
}

function markValueFromTask(mark: FlattenedUnitMark): string {
	return [
		`bar ${mark.bar}`,
		mark.machine_id,
		mark.rm_id,
		mark.qty != null ? `qty ${mark.qty}` : null,
		mark.start_time ? formatUtcAsIst(mark.start_time) : null,
		mark.end_time ? formatUtcAsIst(mark.end_time) : null
	]
		.filter(Boolean)
		.join(' · ');
}

function markValueFromLine(line: ApsJobCardLineRow): string {
	const length = line.length_mm == null || line.length_mm === '' ? null : `${line.length_mm} mm`;
	const pcs = line.pieces_total == null ? null : `${line.pieces_total} pcs`;
	return [length, pcs].filter(Boolean).join(' · ') || '-';
}

function uniqueJoin(values: Array<string | null | undefined>): string {
	return [...new Set(values.map((v) => v?.trim()).filter((v): v is string => Boolean(v)))].join(
		', '
	);
}

function earliestIso(values: Array<string | null | undefined>): string | null {
	const sorted = values.filter((v): v is string => Boolean(v?.trim())).sort();
	return sorted[0] ?? null;
}

function latestIso(values: Array<string | null | undefined>): string | null {
	const sorted = values.filter((v): v is string => Boolean(v?.trim())).sort();
	return sorted[sorted.length - 1] ?? null;
}

function unitTasksOf(
	rows: ScheduledTaskRow[],
	cardId: string,
	taskId?: string | null
): ScheduledTaskRow[] {
	return rows
		.filter(
			(row) =>
				row.task_kind === 'unit' &&
				row.job_card_id === cardId &&
				(!taskId || row.task_id === taskId)
		)
		.sort((a, b) => (a.start_time ?? '').localeCompare(b.start_time ?? ''));
}

function sectionSummary(units: ScheduledTaskRow[]) {
	if (units.length === 0) return [];
	const qty = units.reduce((sum, row) => sum + (row.qty ?? 0), 0);
	const start = earliestIso(units.map((row) => row.start_time));
	const end = latestIso(units.map((row) => row.end_time));
	return [
		{
			title: 'Assignment',
			fields: [
				{ label: 'Machine', value: uniqueJoin(units.map((row) => row.machine_id)) || '-' },
				{ label: 'Step', value: units[0]?.step_code?.trim() || '-' }
			]
		},
		{
			title: 'Production',
			fields: [
				{ label: 'Product', value: units[0]?.product?.trim() || '-' },
				{ label: 'Bars', value: units.length },
				{ label: 'Qty', value: qty || '-' },
				{ label: 'RM ID', value: uniqueJoin(units.map((row) => row.rm_id)) || '-' }
			]
		},
		{
			title: 'Timing',
			fields: [
				{ label: 'Start', value: start ? formatUtcAsIst(start) : '-' },
				{ label: 'End', value: end ? formatUtcAsIst(end) : '-' }
			]
		}
	];
}

function markingsDetail(
	title: string,
	color: string,
	marks: FlattenedUnitMark[],
	lines: ApsJobCardLineRow[] = [],
	units: ScheduledTaskRow[] = []
): ScheduleJobDetail {
	const fields =
		marks.length > 0
			? marks.map((mark) => ({ label: mark.mark_no, value: markValueFromTask(mark) }))
			: lines.map((line) => ({
					label: line.mark_no?.trim() || line.job_card_line_id,
					value: markValueFromLine(line)
				}));
	return {
		title,
		color,
		sections: [
			...sectionSummary(units),
			{
				title: 'Markings',
				fields: fields.length > 0 ? fields : [{ label: 'Marks', value: 'No marks yet' }]
			}
		]
	};
}

async function buildJobDetails(
	rows: ScheduledTaskRow[],
	cards: JobCardTreeRow[],
	signal?: AbortSignal
): Promise<{
	byMarkId: Record<string, ScheduleJobDetail>;
	byTaskId: Record<string, ScheduleJobDetail>;
}> {
	const byMarkId: Record<string, ScheduleJobDetail> = {};
	const byTaskId: Record<string, ScheduleJobDetail> = {};
	const liveCards = cards.filter((card) => card.status !== 'cancelled');
	const needLines: string[] = [];

	for (const card of liveCards) {
		if (flattenUnitTaskMarks(rows, card.job_card_id).length === 0) {
			needLines.push(card.job_card_id);
		}
	}

	// One batched GET when metadata.marks is empty — not N× per card.
	const linesByCard = new Map<string, ApsJobCardLineRow[]>();
	if (needLines.length > 0) {
		const lines = await listJobCardLineRowsForCards(needLines, signal);
		for (const line of lines) {
			const cardId = line.job_card_id?.trim();
			if (!cardId) continue;
			const bucket = linesByCard.get(cardId) ?? [];
			bucket.push(line);
			linesByCard.set(cardId, bucket);
		}
	}

	for (const card of liveCards) {
		const units = unitTasksOf(rows, card.job_card_id);
		byMarkId[card.job_card_id] = markingsDetail(
			formatJobCardLeafLabel(card),
			stepColor(units[0]?.step_code),
			flattenUnitTaskMarks(rows, card.job_card_id),
			linesByCard.get(card.job_card_id) ?? [],
			units
		);
	}

	for (const row of rows) {
		if (row.task_kind === 'unit') {
			const cardId = row.job_card_id?.trim();
			if (!cardId) {
				byTaskId[row.task_id] = detailFromTaskRow(row);
				continue;
			}
			const units = unitTasksOf(rows, cardId, row.task_id);
			byTaskId[row.task_id] = markingsDetail(
				formatScheduleTaskLabel(row),
				stepColor(row.step_code),
				flattenUnitTaskMarks(rows, cardId, row.task_id),
				linesByCard.get(cardId) ?? [],
				units
			);
			continue;
		}
		byTaskId[row.task_id] = detailFromTaskRow(row);
	}

	return { byMarkId, byTaskId };
}

/** Build hourly utilization series from run summary, falling back to task busy fractions. */
function buildUtilization(
	run: PlanRunRow,
	tasks: ScheduleTask[],
	hourCount: number,
	spanMin: number
): UtilizationSeries[] {
	const fromSummary = run.summary?.machine_utilization;
	if (Array.isArray(fromSummary) && fromSummary.length > 0) {
		const byGroup = new Map<string, number[]>();
		for (const row of fromSummary) {
			const group = (row.group ?? groupFromMachineId(row.machine_id)).toUpperCase();
			const pct = Math.min(1, Math.max(0, (row.utilization_pct ?? 0) / 100));
			const list = byGroup.get(group) ?? [];
			list.push(pct);
			byGroup.set(group, list);
		}
		return [...byGroup.entries()].map(([group, values]) => {
			const avg = values.reduce((a, b) => a + b, 0) / values.length;
			return {
				id: group.toLowerCase(),
				label: group,
				color: GROUP_COLORS[group] ?? '#94A3B8',
				points: Array.from({ length: hourCount }, () => avg),
				noLoad: avg <= 0
			};
		});
	}

	// ponytail: no summary util — derive coarse group busy ratio over the span
	const busyByGroup = new Map<string, number>();
	for (const task of tasks) {
		const group = groupFromMachineId(task.resourceId, task.stepId);
		busyByGroup.set(group, (busyByGroup.get(group) ?? 0) + task.durationMin);
	}
	const span = Math.max(spanMin, 1);
	return [...busyByGroup.entries()].map(([group, busyMin]) => {
		const ratio = Math.min(1, busyMin / span);
		return {
			id: group.toLowerCase(),
			label: group,
			color: GROUP_COLORS[group] ?? '#94A3B8',
			points: Array.from({ length: hourCount }, () => ratio),
			noLoad: ratio <= 0
		};
	});
}

async function mapRunToSchedule(
	planId: string,
	run: PlanRunRow,
	taskRows: ScheduledTaskRow[],
	releaseLabel: string,
	signal?: AbortSignal
): Promise<ProductionScheduleData> {
	const cards = await listJobCardRows(run.run_id, signal);
	const hasUnassigned = taskRows.some((row) => !row.job_card_id?.trim());
	const orderTree = buildJobCardOrderTree(cards, hasUnassigned, taskRows);

	const anchorIso =
		run.schedule_start?.trim() ||
		taskRows.find((t) => t.start_time)?.start_time ||
		new Date().toISOString();
	const anchorMs = new Date(anchorIso).getTime();
	const makespanS = run.makespan_s ?? 0;
	const spanMin = Math.max(60, Math.ceil(makespanS / 60) + 30);
	const hourCount = Math.max(4, Math.ceil(spanMin / 60) + 1);
	const cardsById = new Map(cards.map((card) => [card.job_card_id, card]));
	const tasks = buildTasks(taskRows, anchorMs, cardsById);
	const firstCard = cards.find((card) => card.status !== 'cancelled');
	const defaultSelectedMarkId = firstCard?.job_card_id ?? 'all';
	const nowMin = Math.round((Date.now() - anchorMs) / 60_000);
	const currentTimeMin = Number.isFinite(nowMin) ? Math.min(Math.max(0, nowMin), spanMin) : 0;
	const jobDetails = await buildJobDetails(taskRows, cards, signal);

	return {
		planId,
		runId: run.run_id,
		version: run.version ?? undefined,
		runType: run.run_type === 'replan' ? 'replan' : 'schedule',
		releaseLabel,
		publishedAt: run.published_at?.trim() || null,
		publishedBy: run.published_by?.trim() || null,
		isPublished:
			Boolean(run.published_at?.trim()) || cards.some((card) => card.status === 'published'),
		sourcesFrozen: run.sources_frozen !== false,
		startLabel: formatClock(anchorMs),
		makespanLabel: formatMakespan(makespanS),
		taskCount: taskRows.filter((row) => row.job_card_id?.trim()).length,
		scheduleStartIso: new Date(anchorMs).toISOString(),
		timelineStart: formatClock(anchorMs).slice(0, 10),
		timelineHours: timelineHoursFromStart(anchorMs, hourCount),
		currentTimeMin,
		timelineSpanMin: spanMin,
		orderTree,
		resources: buildResources(taskRows),
		tasks,
		dependencyEdges: buildDependencyEdges(taskRows),
		defaultSelectedMarkId,
		jobDetailsByMarkId: jobDetails.byMarkId,
		jobDetailsByTaskId: jobDetails.byTaskId,
		utilization: buildUtilization(run, tasks, hourCount, spanMin),
		confirmChange: {
			beforeMachine: '-',
			afterMachine: '-',
			beforeStart: '-',
			beforeEnd: '-',
			afterStart: '-',
			afterEnd: '-',
			changeover: '-',
			impacts: []
		},
		incompatibleResources: []
	};
}

export type LoadProductionScheduleResult = {
	planExists: boolean;
	schedule: ProductionScheduleData | null;
};

/** Load a completed schedule for a manufacturing plan (null schedule = no run yet). */
export async function loadProductionSchedule(
	planId: string,
	signal?: AbortSignal,
	runId?: string
): Promise<LoadProductionScheduleResult> {
	const plan = await getPlan(planId, signal);
	if (!plan) return { planExists: false, schedule: null };

	rememberManufacturingPlanLabel(plan.plan_id, plan.name?.trim() || plan.plan_id);

	const selectedRunId = runId?.trim();
	const [run, releaseLabel] = await Promise.all([
		selectedRunId
			? getCompletedRunById(planId, selectedRunId, signal)
			: getLatestCompletedRun(planId, plan.latest_run_id, signal),
		resolveDeliveryScheduleLabel(planId, signal)
	]);

	if (!run) return { planExists: true, schedule: null };

	const taskRows = await listTasks(run.run_id, signal);
	return {
		planExists: true,
		schedule: await mapRunToSchedule(planId, run, taskRows, releaseLabel, signal)
	};
}

export type ApsFixedTask = {
	/** Solver pin token (`metadata.order_id`). */
	order_id: string;
	node_id: string;
	machine_id: string;
	start: string;
	end: string;
};

async function stampApsRunRanBy(runId: string, ranBy: string, signal?: AbortSignal): Promise<void> {
	const envelope = await apiClient.get<
		ApiEnvelope<Array<{ run_id: string; metadata?: Record<string, unknown> | null }>>
	>(
		apiClient.datahub(
			`aps_schedule_runs?run_id=${encodeURIComponent(runId)}&select=run_id,metadata&limit=1`
		),
		{ signal }
	);
	const row = rowsFromEnvelope<{ run_id: string; metadata?: Record<string, unknown> | null }>(
		envelope.data
	)[0];
	if (!row) return;
	const existing = typeof row.metadata?.ran_by === 'string' ? row.metadata.ran_by.trim() : '';
	if (existing) return;
	await apiClient.patch(
		apiClient.datahub(`aps_schedule_runs/${encodeURIComponent(runId)}`),
		{ metadata: { ...(row.metadata ?? {}), ran_by: ranBy } },
		{ signal }
	);
}

async function runApsJob(
	planId: string,
	payload: Record<string, unknown>,
	signal?: AbortSignal,
	onProgress?: (progress: number | null) => void
): Promise<ProductionScheduleData> {
	broadcastApsScheduleStarted(planId);
	try {
		const ranBy = (typeof payload.ran_by === 'string' ? payload.ran_by : (user.email ?? '')).trim();
		const request = { request_id: planId, ...payload };
		if (ranBy) request.ran_by = ranBy;

		const triggered = await triggerJob('aps', request, signal);
		const job = await waitForJob(triggered.job_id, { signal, onProgress });

		const resultRef =
			job.result_ref && typeof job.result_ref === 'object'
				? (job.result_ref as { run_id?: string })
				: {};

		const plan = await getPlan(planId, signal);
		if (!plan) throw new Error('Schedule request not found after schedule job');

		const run = await getLatestCompletedRun(planId, resultRef.run_id ?? plan.latest_run_id, signal);
		if (!run) throw new Error('Schedule job completed but no completed run was found');

		// Orchestrator may not persist ran_by yet — stamp like CP so All Runs "Run by" fills in.
		if (ranBy) {
			try {
				await stampApsRunRanBy(run.run_id, ranBy, signal);
			} catch {
				/* run succeeded; don't fail the UI on metadata stamp */
			}
		}

		const [taskRows, releaseLabel] = await Promise.all([
			listTasks(run.run_id, signal),
			resolveDeliveryScheduleLabel(planId, signal)
		]);

		return mapRunToSchedule(planId, run, taskRows, releaseLabel, signal);
	} finally {
		broadcastApsScheduleEnded(planId);
	}
}

/** Trigger APS schedule job, wait for completion, then reload the Gantt payload. */
export type RunApsScheduleOptions = {
	solver?: ApsSchedulerUiSolver;
	signal?: AbortSignal;
	onProgress?: (progress: number | null) => void;
};

export function runApsSchedule(
	planId: string,
	options?: RunApsScheduleOptions
): Promise<ProductionScheduleData> {
	const solver = options?.solver ?? DEFAULT_APS_SOLVER;
	return runApsJob(planId, { op: 'schedule', solver }, options?.signal, options?.onProgress);
}

/** Persist edited tasks as fixed constraints, rerun APS, then load the new replan run. */
export function rerunApsSchedule(
	planId: string,
	runId: string,
	fixedTasks: ApsFixedTask[],
	scheduleStart: string,
	signal?: AbortSignal,
	onProgress?: (progress: number | null) => void
): Promise<ProductionScheduleData> {
	return runApsJob(
		planId,
		{
			op: 'replan',
			run_id: runId,
			schedule_start: scheduleStart,
			fixed_tasks: fixedTasks
		},
		signal,
		onProgress
	);
}
