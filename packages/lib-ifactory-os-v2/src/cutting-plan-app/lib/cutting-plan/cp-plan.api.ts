/**
 * Core (ifactoryai-core) data layer for cutting-plan RUNS + RESULTS — Actions 5-8.
 *
 * A run is triggered with `POST /api/v2/datahub/jobs/cp { request }` and observed via the shared
 * `async_jobs` poll (`lib/api/jobs`). The CP bridge (`cutting-plan-orchestrator`) solves + persists
 * the Model-X rows: one `cp_plan_runs` header (summary cols + a `section_plan_ids` manifest) plus
 * immutable `cp_section_plans` (+ `cp_section_plan_bars`) for the sections solved that run. This
 * module reads those back and reassembles the exact `PlanResponse` shape the existing planner views
 * (`planner-results.ts`) already render — so no plan-view component changes.
 *
 * The payload carries only the user's CHOICES (selected marks, per-section stock, config, run_type,
 * optional base_run_id); the bridge resolves the FACTS (markings/geometry/end_trim) from
 * `proj_bom_items` + `cp_section_rules`. See docs/CUTTING_PLAN_SCHEMA_AND_API_DESIGN.md §3-4.
 */

import { apiClient } from '../../../lib/api/api-client.js';
import {
	datahubQuery,
	leftJoin,
	pickAlias,
	pickAliasString
} from '../../../lib/api/datahub-query.js';
import { rowsFromEnvelope, type ApiEnvelope } from '../../../lib/api/types.js';
import { triggerJob, waitForJob, type AsyncJobRow } from '../../../lib/api/jobs.js';
import { user } from '../../../lib/os/index.svelte.js';
import type { CpPlanRunRow, CpSectionPlanRow, CpSectionPlanBarRow } from './cp.rows.js';
import type {
	PlanResponse,
	PlanResultSummary,
	PlanSectionOutput,
	PlannerConfig,
	StockEntry
} from './types.js';

/** Coerce a datahub `numeric` (may arrive as a string) to `number | null`. */
function num(value: number | string | null | undefined): number | null {
	if (value === null || value === undefined || value === '') return null;
	const n = typeof value === 'number' ? value : Number(value);
	return Number.isFinite(n) ? n : null;
}

/**
 * All-Plans / hydrate list — only columns the Runs table (and existence checks) need.
 * Omits `request`, `section_plan_ids`, and unused KPI columns.
 */
const CP_PLAN_RUN_LIST_SELECT = [
	'run_id',
	'bom_id',
	'version',
	'run_type',
	'status',
	'sections_planned',
	'section_plan_ids',
	'total_bars',
	'total_sections',
	'waste_pct_weight',
	'published_at',
	'published_by',
	'metadata',
	'created_at'
].join(',');

/**
 * Single-run header for Summary/Planner assemble — includes `section_plan_ids` manifest + KPIs.
 * Still omits jsonb `request`.
 */
const CP_PLAN_RUN_HEADER_SELECT = [
	'run_id',
	'bom_id',
	'version',
	'run_type',
	'status',
	'sections_planned',
	'section_plan_ids',
	'total_bars',
	'total_sections',
	'total_stock_mm',
	'total_waste_mm',
	'total_required_mm',
	'total_stock_weight_kg',
	'total_waste_weight_kg',
	'total_required_weight_kg',
	'waste_pct_length',
	'waste_pct_weight',
	'optimal_sections',
	'feasible_sections',
	'published_at',
	'published_by',
	'metadata',
	'created_at'
].join(',');

const CP_SECTION_PLAN_SELECT = [
	'section_plan_id',
	'section',
	'status',
	'num_bars',
	'total_stock_length_mm',
	'waste_mm',
	'total_required_length_mm',
	'total_stock_weight_kg',
	'total_waste_weight_kg',
	'total_required_weight_kg'
].join(',');

/** How much bar nesting detail to load when reassembling a run. */
export type AssembleBarsMode = 'summary' | 'detail';

export type AssembleRunOutputOptions = {
	bars?: AssembleBarsMode;
};

export type RunPlanInput = {
	/** Per-section selected stock. Bare numbers = unlimited; `{length,quantity}` for register caps. */
	stock: Record<string, StockEntry[]>;
	config: PlannerConfig;
	/** Flat mark_no allowlist across the planned sections. */
	selectedMarks: string[];
	/**
	 * Marking-group split. Keys are the child-section identities used in `stock` (composite
	 * `"<base> <group>"` for a grouped child, base name for the residual/ungrouped child). Each entry
	 * gives the DB `base_section`, the `group` (omitted = ungrouped), and this child's selected
	 * `marks`. Present only when the user has grouped markings; the bridge then fans out one solver
	 * job per group (+ one ungrouped) and merges into one run. Absent = today's single request.
	 */
	sectionMap?: Record<string, { base_section: string; group?: string; marks: string[] }>;
	runType: 'full' | 'partial';
	/** Partial-replan merge base; when absent the bridge uses the latest completed run. */
	baseRunId?: string;
	/** Email of the user who ran the plan; defaults to the OS session user. */
	ranBy?: string;
};

export type RunPlanOptions = {
	onProgress?: (progress: number | null) => void;
	signal?: AbortSignal;
};

/** The bridge's `cp.plan` job result (`async_jobs.result_ref`): the durable `run_id` to read the
 * run back, plus whether it was served from the plan-result cache. `run_id` is set on every path —
 * fresh solve, identical-rerun cache hit, and dispatch-retry idempotency return. */
type CpPlanJobResult = { run_id: string; cached?: boolean };

/** Narrow the generic job `result_ref` to the cp.plan result shape, or null if absent/malformed. */
function planJobResult(ref: unknown): CpPlanJobResult | null {
	if (ref && typeof ref === 'object' && typeof (ref as { run_id?: unknown }).run_id === 'string') {
		return ref as CpPlanJobResult;
	}
	return null;
}

/** Action 5/8 — trigger a plan job, wait for it, and return the run row the bridge persisted. */
export async function runCorePlan(
	bomId: string,
	input: RunPlanInput,
	options: RunPlanOptions = {}
): Promise<CpPlanRunRow> {
	const request: Record<string, unknown> = {
		op: 'plan',
		bom_id: bomId,
		run_type: input.runType,
		stock: input.stock,
		config: input.config
	};
	// Only send the mark allowlist when non-empty: an empty `selected_marks` would make the bridge
	// filter out every row ("no plannable sections"). Absent = the bridge plans all marks in the sections.
	if (input.selectedMarks.length > 0) request.selected_marks = input.selectedMarks;
	if (input.sectionMap && Object.keys(input.sectionMap).length > 0)
		request.section_map = input.sectionMap;
	if (input.baseRunId) request.base_run_id = input.baseRunId;
	const ranBy = (input.ranBy ?? user.email ?? '').trim();
	if (ranBy) request.ran_by = ranBy;

	const { job_id } = await triggerJob('cp', request, options.signal);
	const job = await waitForJob(job_id, {
		onProgress: options.onProgress,
		timeoutMs: 30 * 60 * 1000,
		signal: options.signal
	});

	// Resolve the run by the run_id the bridge returns in the job result — NOT by plan_job_id. An
	// identical rerun is served from the plan-result cache: the bridge returns the PRIOR run (a
	// different plan_job_id, no new row), so a plan_job_id lookup would find nothing. run_id is the
	// durable result identity, set on every path (fresh solve, cache hit, dispatch-retry return).
	const result = planJobResult(job.result_ref);
	if (!result) throw new Error('Plan job completed but no run_id in result_ref');
	const env = await apiClient.get<ApiEnvelope<CpPlanRunRow[]>>(
		apiClient.datahub(`cp_plan_runs?run_id=${encodeURIComponent(result.run_id)}`),
		{ signal: options.signal }
	);
	const run = rowsFromEnvelope<CpPlanRunRow>(env.data)[0];
	if (!run) throw new Error('Plan job completed but no cp_plan_runs row was found');

	// Bridge may not yet persist ran_by (older sidecar builds). Stamp it here — metadata is
	// shallow-merged on PATCH so we don't clobber other keys.
	// Don't rewrite ran_by on a cache hit: the served run keeps its ORIGINAL author (no new run was
	// produced this time — the rerun's own ran_by lives on its async_jobs row).
	const existingRanBy = typeof run.metadata?.ran_by === 'string' ? run.metadata.ran_by.trim() : '';
	if (ranBy && !result.cached && existingRanBy !== ranBy) {
		await apiClient.patch(
			apiClient.datahub(`cp_plan_runs/${encodeURIComponent(run.run_id)}`),
			{ metadata: { ran_by: ranBy } },
			{ signal: options.signal }
		);
		return { ...run, metadata: { ...(run.metadata ?? {}), ran_by: ranBy } };
	}

	return run;
}

/** Domain statuses that mean the bridge is still working on the run (design §5). */
const CP_IN_FLIGHT_RUN_STATUSES = ['queued', 'solving'] as const;

/** `async_jobs` statuses while the CP sidecar is still working (mirrors APS resume). */
const CP_IN_FLIGHT_JOB_STATUSES = ['queued', 'dispatched', 'processing'] as const;

/** Status-only run shape for the Running badge / resume poll — no KPI, manifest or `request` cols. */
export type CpPlanRunProgressRow = Pick<CpPlanRunRow, 'run_id' | 'bom_id' | 'status'>;

const CP_PLAN_RUN_PROGRESS_SELECT = 'run_id,bom_id,status';

type CpPlanAsyncJobRow = Pick<AsyncJobRow, 'job_id' | 'status'> & {
	request?: { bom_id?: string; op?: string } | null;
};

export function isInFlightPlanStatus(status: CpPlanRunRow['status']): boolean {
	return status === 'queued' || status === 'solving';
}

export function isInFlightCpJobStatus(status: AsyncJobRow['status']): boolean {
	return status === 'queued' || status === 'dispatched' || status === 'processing';
}

/**
 * In-flight `cp.plan` jobs for these BOMs. The job row exists as soon as Run is clicked — often
 * before the bridge writes `cp_plan_runs` (APS uses the same split). Newest job per BOM wins.
 */
export async function listInFlightCpJobs(
	bomIds: string[],
	signal?: AbortSignal
): Promise<Array<{ bom_id: string; job_id: string }>> {
	if (bomIds.length === 0) return [];
	const bomSet = new Set(bomIds);
	const env = await apiClient.get<ApiEnvelope<CpPlanAsyncJobRow[]>>(
		apiClient.datahub(
			`async_jobs?feature=cp&status__in=${CP_IN_FLIGHT_JOB_STATUSES.join(',')}&orderBy=created_at:desc&select=job_id,status,request&limit=2500`
		),
		{ signal }
	);
	const seen = new Set<string>();
	const result: Array<{ bom_id: string; job_id: string }> = [];
	for (const row of rowsFromEnvelope<CpPlanAsyncJobRow>(env.data)) {
		if (row.request?.op !== 'plan') continue;
		const bomId = row.request.bom_id;
		if (!bomId || !bomSet.has(bomId) || seen.has(bomId)) continue;
		seen.add(bomId);
		result.push({ bom_id: bomId, job_id: row.job_id });
	}
	return result;
}

/**
 * Runs the bridge is still solving for these BOMs — server truth, so a plan started in another tab,
 * another browser or by another user is visible (a browser-local set can't know about those).
 */
export async function listInFlightPlanRuns(
	bomIds: string[],
	signal?: AbortSignal
): Promise<CpPlanRunProgressRow[]> {
	if (bomIds.length === 0) return [];
	const idList = bomIds.map((id) => encodeURIComponent(id)).join(',');
	const env = await apiClient.get<ApiEnvelope<CpPlanRunProgressRow[]>>(
		apiClient.datahub(
			`cp_plan_runs?limit=2500&bom_id__in=${idList}&status__in=${CP_IN_FLIGHT_RUN_STATUSES.join(',')}&select=${CP_PLAN_RUN_PROGRESS_SELECT}`
		),
		{ signal }
	);
	return rowsFromEnvelope<CpPlanRunProgressRow>(env.data);
}

/** One run's live status — the resume poller's tick. */
export async function getPlanRunProgress(
	runId: string,
	signal?: AbortSignal
): Promise<CpPlanRunProgressRow | null> {
	const env = await apiClient.get<ApiEnvelope<CpPlanRunProgressRow[]>>(
		apiClient.datahub(
			`cp_plan_runs?run_id=${encodeURIComponent(runId)}&select=${CP_PLAN_RUN_PROGRESS_SELECT}`
		),
		{ signal }
	);
	return rowsFromEnvelope<CpPlanRunProgressRow>(env.data)[0] ?? null;
}

/** Action 6 — all runs for a BOM, newest version first. List cols only (no `request` / manifest). */
export async function listCorePlanRuns(bomId: string): Promise<CpPlanRunRow[]> {
	const env = await apiClient.get<ApiEnvelope<CpPlanRunRow[]>>(
		apiClient.datahub(
			`cp_plan_runs?bom_id=${encodeURIComponent(bomId)}&orderBy=version:desc&select=${CP_PLAN_RUN_LIST_SELECT}`
		)
	);
	return rowsFromEnvelope<CpPlanRunRow>(env.data);
}

export async function getCorePlanRun(
	bomId: string,
	runId: string,
	signal?: AbortSignal
): Promise<CpPlanRunRow | null> {
	const rows = await datahubQuery<Record<string, unknown>>(
		'cp_plan_runs',
		{
			bom_id: bomId,
			run_id: runId,
			select: `${CP_PLAN_RUN_HEADER_SELECT},bom.bom_name`,
			limit: 1,
			joins: [leftJoin('proj_boms', 'bom', 'bom_id', 'bom.bom_id')]
		},
		signal
	);
	const raw = rows[0];
	if (!raw) return null;
	const bomName = pickAliasString(raw, 'bom', 'bom_name').trim();
	return {
		...(raw as unknown as CpPlanRunRow),
		bom_name: bomName || null
	};
}

/** `cp_plan_runs` summary columns → the UI's flattened `PlanResultSummary`. */
export function runSummary(row: CpPlanRunRow): PlanResultSummary {
	return {
		total_sections: row.total_sections ?? undefined,
		total_bars: row.total_bars ?? undefined,
		total_stock: num(row.total_stock_mm) ?? undefined,
		total_waste: num(row.total_waste_mm) ?? undefined,
		total_required_length: num(row.total_required_mm) ?? undefined,
		total_stock_weight_kg: num(row.total_stock_weight_kg),
		total_waste_weight_kg: num(row.total_waste_weight_kg),
		total_required_weight_kg: num(row.total_required_weight_kg),
		waste_pct_length: num(row.waste_pct_length) ?? undefined,
		waste_pct_weight: num(row.waste_pct_weight),
		optimal_sections: row.optimal_sections ?? undefined,
		feasible_sections: row.feasible_sections ?? undefined
	};
}

/** Action 7 — read the run's `cp_section_plans` + bars (by manifest) and rebuild `output`. */
export async function assembleRunOutput(
	row: CpPlanRunRow,
	options: AssembleRunOutputOptions = {}
): Promise<Record<string, PlanSectionOutput>> {
	const ids = row.section_plan_ids ?? [];
	if (ids.length === 0) return {};
	const barsMode: AssembleBarsMode = options.bars ?? 'detail';
	const barSelect =
		barsMode === 'summary'
			? ['b.section_plan_id', 'b.bar_index', 'b.rm_length_mm', 'b.quantity'].join(',')
			: [
					'b.bar_id',
					'b.section_plan_id',
					'b.bar_index',
					'b.rmid',
					'b.rm_length_mm',
					'b.quantity',
					'b.markings'
				].join(',');

	const joined = await datahubQuery<Record<string, unknown>>('cp_section_plans', {
		section_plan_id__in: ids.join(','),
		select: `${CP_SECTION_PLAN_SELECT},${barSelect}`,
		joins: [leftJoin('cp_section_plan_bars', 'b', 'section_plan_id', 'b.section_plan_id')],
		orderBy: 'b.bar_index:asc',
		limit: 10000
	});

	const plansById = new Map<string, CpSectionPlanRow>();
	const barsByPlan = new Map<string, CpSectionPlanBarRow[]>();
	for (const rowJoined of joined) {
		const planId = String(rowJoined.section_plan_id ?? '');
		if (!planId) continue;
		if (!plansById.has(planId)) {
			plansById.set(planId, {
				section_plan_id: planId,
				section: String(rowJoined.section ?? ''),
				status: String(rowJoined.status ?? ''),
				num_bars: num(rowJoined.num_bars) ?? 0,
				total_stock_length_mm: rowJoined.total_stock_length_mm as number | string | null,
				waste_mm: rowJoined.waste_mm as number | string | null,
				total_required_length_mm: rowJoined.total_required_length_mm as number | string | null,
				total_stock_weight_kg: rowJoined.total_stock_weight_kg as number | string | null,
				total_waste_weight_kg: rowJoined.total_waste_weight_kg as number | string | null,
				total_required_weight_kg: rowJoined.total_required_weight_kg as number | string | null
			} as CpSectionPlanRow);
		}

		const barIndex = pickAlias(rowJoined, 'b', 'bar_index');
		if (barIndex == null || barIndex === '') continue;
		const bar: CpSectionPlanBarRow = {
			bar_id: pickAliasString(rowJoined, 'b', 'bar_id'),
			section_plan_id: pickAliasString(rowJoined, 'b', 'section_plan_id') || planId,
			bar_index: num(barIndex as number | string | null) ?? 0,
			rmid: pickAliasString(rowJoined, 'b', 'rmid') || null,
			rm_length_mm: pickAlias(rowJoined, 'b', 'rm_length_mm') as number | string | null,
			quantity: num(pickAlias(rowJoined, 'b', 'quantity') as number | string | null) ?? 0,
			markings: (() => {
				const markings = pickAlias(rowJoined, 'b', 'markings');
				return Array.isArray(markings) ? markings : [];
			})()
		} as CpSectionPlanBarRow;
		const list = barsByPlan.get(planId) ?? [];
		list.push(bar);
		barsByPlan.set(planId, list);
	}

	const output: Record<string, PlanSectionOutput> = {};
	for (const plan of plansById.values()) {
		const planBars = (barsByPlan.get(plan.section_plan_id) ?? [])
			.slice()
			.sort((a, b) => a.bar_index - b.bar_index)
			.map((bar) => ({
				bar_id: bar.bar_id,
				rmid: bar.rmid ?? '',
				rm_length: num(bar.rm_length_mm) ?? 0,
				quantity: bar.quantity,
				// Summary mode omits markings from the select — keep an empty array for PlanBarRow.
				markings: Array.isArray(bar.markings) ? bar.markings : []
			}));
		output[plan.section] = {
			result: {
				status: plan.status,
				num_bars: plan.num_bars,
				total_stock_length: num(plan.total_stock_length_mm) ?? undefined,
				waste: num(plan.waste_mm) ?? undefined,
				total_required_length: num(plan.total_required_length_mm) ?? undefined,
				total_stock_weight_kg: num(plan.total_stock_weight_kg) ?? undefined,
				total_waste_weight_kg: num(plan.total_waste_weight_kg) ?? undefined,
				total_required_weight_kg: num(plan.total_required_weight_kg) ?? undefined
			},
			plan: planBars
		};
	}
	return output;
}

/** Full `PlanResponse` for a run: summary from the header + `output` reassembled from the manifest. */
export async function corePlanResponse(
	row: CpPlanRunRow,
	options: AssembleRunOutputOptions = {}
): Promise<PlanResponse> {
	return {
		bom_id: row.bom_id,
		result: runSummary(row),
		output: await assembleRunOutput(row, options)
	};
}
