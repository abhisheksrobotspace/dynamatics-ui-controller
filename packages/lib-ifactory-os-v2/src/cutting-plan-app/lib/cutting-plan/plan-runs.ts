/**
 * Plan-run access — core mode. Runs are persisted server-side by the CP bridge in `cp_plan_runs`
 * (+ `cp_section_plans`/`cp_section_plan_bars`); this module reads them back and maps to the
 * `CuttingPlanRun` shape the run/summary/planner screens already consume. The old IndexedDB run
 * store + `savePlanRun` are gone: a run is created by triggering a job (see
 * `cp-plan.api.ts::runCorePlan`), not written from the browser.
 */

import { formatUtcAsIst } from '$lib/datetime/format-ist.js';
import {
	corePlanResponse,
	getCorePlanRun,
	listCorePlanRuns,
	runSummary,
	type AssembleBarsMode
} from './cp-plan.api';
import type { CpPlanRunRow } from './cp.rows';
import type { PlanRequest, PlanResponse } from './types';

export type CuttingPlanRunType = 'full' | 'partial';

export type CuttingPlanRun = {
	id: string;
	version: number;
	createdAt: string;
	type: CuttingPlanRunType;
	status: CpPlanRunRow['status'];
	sectionPlanIds: string[];
	sectionsPlanned: string[];
	/** Email from cp_plan_runs.metadata.ran_by when present. */
	ranBy: string;
	/** From cp_plan_runs.published_at when this run is the published version. */
	publishedAt: string;
	/** From cp_plan_runs.published_by when this run is the published version. */
	publishedBy: string;
	/** From `proj_boms` join on single-run header fetch. */
	bomName: string;
	response: PlanResponse;
	request?: PlanRequest;
};

export type GetPlanRunOptions = {
	/** `summary` omits bar markings; `detail` loads nesting for the Planner. Default `detail`. */
	bars?: AssembleBarsMode;
};

function ranByFromMetadata(metadata: Record<string, unknown> | undefined): string {
	const value = metadata?.ran_by;
	return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function publishedByFromRow(row: CpPlanRunRow): string {
	const value = row.published_by;
	return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function toRun(row: CpPlanRunRow, response: PlanResponse): CuttingPlanRun {
	return {
		id: row.run_id,
		version: row.version,
		createdAt: row.created_at ?? '',
		type: row.run_type === 'partial' ? 'partial' : 'full',
		status: row.status,
		sectionPlanIds: row.section_plan_ids ?? [],
		sectionsPlanned: row.sections_planned ?? [],
		ranBy: ranByFromMetadata(row.metadata),
		publishedAt: row.published_at?.trim() || '',
		publishedBy: publishedByFromRow(row),
		bomName: row.bom_name?.trim() || '',
		response,
		// `request` is omitted from header selects; only present if a full-row fetch ever returns it.
		request: (row.request as PlanRequest | undefined) ?? undefined
	};
}

/** All runs for a BOM (newest first). Header + summary only — section bars load on demand. */
export async function listPlanRuns(bomId: string): Promise<CuttingPlanRun[]> {
	const rows = await listCorePlanRuns(bomId);
	return rows.map((row) => toRun(row, { bom_id: row.bom_id, result: runSummary(row) }));
}

/** One run with its reassembled `PlanResponse` (summary + per-section bars). */
export async function getPlanRun(
	bomId: string,
	runId: string,
	options: GetPlanRunOptions = {}
): Promise<CuttingPlanRun | null> {
	const row = await getCorePlanRun(bomId, runId);
	if (!row) return null;
	return toRun(row, await corePlanResponse(row, { bars: options.bars ?? 'detail' }));
}

/**
 * Highest-version run header for a BOM (no section/bar assemble).
 * Used for redirects that only need `id`.
 */
export async function getLatestPlanRun(bomId: string): Promise<CuttingPlanRun | null> {
	const rows = await listCorePlanRuns(bomId);
	const latest = rows[0];
	if (!latest) return null;
	return toRun(latest, { bom_id: latest.bom_id, result: runSummary(latest) });
}

/** True when this BOM version already has a completed/published plan (unlocks section picking). */
export async function bomHasPriorCompletedPlanRun(bomId: string): Promise<boolean> {
	const rows = await listCorePlanRuns(bomId);
	return rows.some((row) => row.status === 'completed' || row.status === 'published');
}

/** DB stores UTC; always display IST on All Plans / run labels. */
export function formatPlanRunTimestamp(iso: string): string {
	return formatUtcAsIst(iso);
}

export function formatPlanRunType(type: CuttingPlanRunType): string {
	return type === 'partial' ? 'Partial replan' : 'Full plan';
}

export {
	cuttingPlanRunHash,
	cuttingPlanRunsHash
} from '../../../project-management-app/lib/bom-structure-routes.js';
