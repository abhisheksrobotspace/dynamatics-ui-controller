import { formatUtcAsIst } from '../../lib/datetime/format-ist.js';
import { apiClient } from '../../lib/api/api-client.js';
import { rowsFromEnvelope, type ApiEnvelope } from '../../lib/api/types.js';

export type ApsScheduleRunType = 'schedule' | 'replan';

export type ApsScheduleRun = {
	runId: string;
	planId: string;
	version: number;
	baseRunId: string | null;
	runType: ApsScheduleRunType;
	status: string;
	createdAt: string;
	makespanS: number | null;
	numTasks: number | null;
	onTimeCount: number | null;
	totalOrders: number | null;
	totalWeightMt: number | null;
	machinesUsed: number | null;
	ranBy: string;
	sourcesFrozen: boolean;
};

type RunListRow = {
	run_id: string;
	request_id: string;
	version?: number | null;
	base_run_id?: string | null;
	run_type?: string | null;
	status: string;
	schedule_start?: string | null;
	makespan_s?: number | null;
	num_tasks?: number | null;
	on_time_count?: number | null;
	total_orders?: number | null;
	sources_frozen?: boolean | null;
	summary?: Record<string, unknown> | null;
	metadata?: Record<string, unknown> | null;
	created_at?: string | null;
};

const RUN_LIST_SELECT = [
	'run_id',
	'request_id',
	'version',
	'base_run_id',
	'run_type',
	'status',
	'schedule_start',
	'makespan_s',
	'num_tasks',
	'on_time_count',
	'total_orders',
	'sources_frozen',
	'summary',
	'metadata',
	'created_at'
].join(',');

function ranByFromMetadata(metadata: Record<string, unknown> | null | undefined): string {
	const value = metadata?.ran_by;
	return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function numberOrNull(value: unknown): number | null {
	return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * `machines_used` may be absent on older runs; fall back to the machine_utilization
 * row count - the same source the machines report uses for its "Machines Used" KPI.
 */
function machinesUsedFromSummary(
	summary: Record<string, unknown> | null | undefined
): number | null {
	const direct = numberOrNull(summary?.machines_used);
	if (direct != null) return direct;
	const utilization = summary?.machine_utilization;
	return Array.isArray(utilization) && utilization.length > 0 ? utilization.length : null;
}

function toScheduleRun(row: RunListRow): ApsScheduleRun {
	return {
		runId: row.run_id,
		planId: row.request_id,
		version: row.version ?? 0,
		baseRunId: row.base_run_id?.trim() || null,
		runType: row.run_type === 'replan' ? 'replan' : 'schedule',
		status: row.status,
		createdAt: row.created_at ?? '',
		makespanS: row.makespan_s ?? null,
		numTasks: row.num_tasks ?? null,
		onTimeCount: row.on_time_count ?? null,
		totalOrders: row.total_orders ?? null,
		totalWeightMt: numberOrNull(row.summary?.total_weight_mt),
		machinesUsed: machinesUsedFromSummary(row.summary),
		ranBy: ranByFromMetadata(row.metadata),
		sourcesFrozen: row.sources_frozen !== false
	};
}

/** DB stores UTC; display IST on run labels. */
export function formatScheduleRunTimestamp(iso: string): string {
	return formatUtcAsIst(iso);
}

export function formatScheduleRunStatus(status: string): string {
	const trimmed = status.trim();
	if (!trimmed) return '-';
	return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

/** Plain number (no unit) so the DataTable's numeric sort works; unit lives in the header. */
export function formatScheduleRunTonnage(totalWeightMt: number | null): string {
	if (totalWeightMt == null || totalWeightMt <= 0) return '-';
	return totalWeightMt.toFixed(2);
}

export function formatScheduleRunPlantUtilization(
	machinesUsed: number | null,
	totalMachines: number | null
): string {
	if (machinesUsed == null || totalMachines == null || totalMachines <= 0) return '-';
	const pct = (machinesUsed / totalMachines) * 100;
	return `${pct.toFixed(2)}%`;
}

export function formatScheduleRunOnTimePct(
	onTimeCount: number | null,
	totalOrders: number | null
): string {
	if (totalOrders == null || totalOrders <= 0) return '-';
	const pct = ((onTimeCount ?? 0) / totalOrders) * 100;
	return `${pct.toFixed(1)}%`;
}

export function scheduleRunsHash(planId: string): string {
	return `#/ShopFloorPlanning/Aps/${encodeURIComponent(planId)}/Runs`;
}

export function productionScheduleRunHash(planId: string, runId: string): string {
	return `#/ShopFloorPlanning/Aps/${encodeURIComponent(planId)}/ProductionSchedule/${encodeURIComponent(runId)}`;
}

const runLabelById = new Map<string, string>();

/** Prefer `v{N}` for breadcrumbs; fall back to run id. */
export function getScheduleRunLabel(runId: string): string {
	return runLabelById.get(runId) ?? runId;
}

export function rememberScheduleRunLabel(runId: string, version: number | null | undefined): void {
	if (!runId) return;
	if (version != null && Number.isFinite(version) && version > 0) {
		runLabelById.set(runId, `v${version}`);
	}
}

export function rememberScheduleRunLabels(runs: ApsScheduleRun[]): void {
	for (const run of runs) {
		rememberScheduleRunLabel(run.runId, run.version);
	}
}

/**
 * Resolve `v{N}` for breadcrumbs on deep-link / reload when the in-memory map is cold.
 */
export async function ensureScheduleRunLabel(
	runId: string,
	planId?: string,
	signal?: AbortSignal
): Promise<string> {
	if (runLabelById.has(runId)) return getScheduleRunLabel(runId);

	const planFilter = planId?.trim() ? `request_id=${encodeURIComponent(planId.trim())}&` : '';
	const envelope = await apiClient.get<
		ApiEnvelope<Array<{ run_id: string; version?: number | null }>>
	>(
		apiClient.datahub(
			`aps_schedule_runs?${planFilter}run_id=${encodeURIComponent(runId)}&select=run_id,version&limit=1`
		),
		{ signal }
	);
	const row = rowsFromEnvelope(envelope.data)[0];
	if (row) rememberScheduleRunLabel(row.run_id, row.version);
	return getScheduleRunLabel(runId);
}

/** All schedule runs for a request (newest version first). */
export async function listScheduleRuns(
	planId: string,
	signal?: AbortSignal
): Promise<ApsScheduleRun[]> {
	const envelope = await apiClient.get<ApiEnvelope<RunListRow[]>>(
		apiClient.datahub(
			`aps_schedule_runs?request_id=${encodeURIComponent(planId)}&orderBy=version:desc&select=${RUN_LIST_SELECT}&limit=5000`
		),
		{ signal }
	);
	const runs = rowsFromEnvelope<RunListRow>(envelope.data).map(toScheduleRun);
	rememberScheduleRunLabels(runs);
	return runs;
}
