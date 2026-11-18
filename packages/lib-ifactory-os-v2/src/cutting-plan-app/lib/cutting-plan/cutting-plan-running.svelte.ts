/**
 * In-flight cutting-plan runs (per BOM) for the BOM list Running badge.
 *
 * Two sources feed the same set:
 *  - `cutting-plan-background.ts`, for a run started in THIS tab — that module's promise owns the
 *    run's completion (toast + result mark), so no poller is needed here;
 *  - `resumeBackgroundCuttingPlans()`, for runs still in progress on the server — started in another
 *    tab/browser, by another user, or before a refresh. Those have no in-tab promise left, so this
 *    module polls them to a terminal status.
 *
 * Resume checks BOTH `async_jobs` (exists immediately on Run) and `cp_plan_runs` (domain status once
 * the bridge creates the row) — same split as APS schedule resume.
 */
import { SvelteMap, SvelteSet } from 'svelte/reactivity';
import {
	takeCuttingPlanResultsNav,
	withViewResultsAction
} from '../../../lib/background-job-toast.js';
import { ASYNC_STATUS_POLL_MS, getJob } from '../../../lib/api/jobs.js';
import { errorDescription } from '../../../lib/api/types.js';
import {
	cuttingPlanRunHash,
	cuttingPlanRunsHash
} from '../../../project-management-app/lib/bom-structure-routes.js';
import { cpPushErrorToast, cpPushSuccessToast } from '../toast.js';
import {
	getPlanRunProgress,
	isInFlightCpJobStatus,
	isInFlightPlanStatus,
	listInFlightCpJobs,
	listInFlightPlanRuns
} from './cp-plan.api.js';
import { markCuttingPlanResults } from './cutting-plan-results.svelte.js';
import type { CpPlanRunRow } from './cp.rows.js';

/** Consecutive poll failures tolerated before dropping the badge (run continues server-side). */
const POLL_FAILURE_LIMIT = 3;

const runningByBom = new SvelteSet<string>();
/** Only resumed runs get a timer. */
const timers = new SvelteMap<string, ReturnType<typeof setInterval>>();
let runningVersion = $state(0);

function bump(): void {
	runningVersion += 1;
}

/** Subscribe in `$derived` so Cutting Plan column refreshes while plans run. */
export function cuttingPlanRunningVersion(): number {
	void runningByBom;
	return runningVersion;
}

export function isCuttingPlanRunning(bomId: string): boolean {
	void runningByBom;
	return runningByBom.has(bomId);
}

function clearTimer(bomId: string): void {
	const timer = timers.get(bomId);
	if (timer !== undefined) clearInterval(timer);
	timers.delete(bomId);
}

export function beginCuttingPlanRun(bomId: string): void {
	runningByBom.add(bomId);
	bump();
}

export function endCuttingPlanRun(bomId: string): void {
	clearTimer(bomId);
	if (runningByBom.delete(bomId)) bump();
}

function finishResumedRun(
	bomId: string,
	outcome: 'completed' | 'failed' | 'cancelled' | 'unknown',
	runId?: string
): void {
	endCuttingPlanRun(bomId);

	if (outcome === 'completed') {
		markCuttingPlanResults(bomId);
		const nav = takeCuttingPlanResultsNav(bomId);
		const hash = nav
			? runId?.trim()
				? cuttingPlanRunHash(nav.projectId, nav.structure, bomId, runId, 'Summary', nav.appName)
				: cuttingPlanRunsHash(nav.projectId, nav.structure, bomId, nav.appName)
			: null;
		cpPushSuccessToast(
			withViewResultsAction(
				{
					title: 'Cutting plan complete',
					description: hash
						? 'Results are ready.'
						: 'Open Cutting Plan → View on the BOM to see results.'
				},
				hash
			)
		);
		return;
	}
	takeCuttingPlanResultsNav(bomId);
	if (outcome === 'failed') {
		cpPushErrorToast({
			title: 'Cutting plan failed',
			description: 'The planner could not finish this run. Open the BOM to replan.'
		});
	}
	// `cancelled` / `unknown`: drop the badge without a toast.
}

function runOutcomeFromStatus(
	status: CpPlanRunRow['status']
): 'completed' | 'failed' | 'cancelled' | 'unknown' {
	if (status === 'completed' || status === 'published') return 'completed';
	if (status === 'failed') return 'failed';
	if (status === 'cancelled') return 'cancelled';
	return 'unknown';
}

function pollResumedJob(bomId: string, jobId: string): void {
	let failures = 0;
	const interval = setInterval(() => {
		void (async () => {
			try {
				const job = await getJob(jobId);
				failures = 0;
				if (job && isInFlightCpJobStatus(job.status)) return;
				if (job?.status === 'completed') finishResumedRun(bomId, 'completed');
				else if (job?.status === 'failed') finishResumedRun(bomId, 'failed');
				else finishResumedRun(bomId, 'unknown');
			} catch {
				failures += 1;
				if (failures >= POLL_FAILURE_LIMIT) endCuttingPlanRun(bomId);
			}
		})();
	}, ASYNC_STATUS_POLL_MS);

	timers.set(bomId, interval);
}

function pollResumedRun(bomId: string, runId: string): void {
	let failures = 0;
	const interval = setInterval(() => {
		void (async () => {
			try {
				const run = await getPlanRunProgress(runId);
				failures = 0;
				if (run && isInFlightPlanStatus(run.status)) return;
				finishResumedRun(bomId, runOutcomeFromStatus(run?.status), runId);
			} catch {
				failures += 1;
				if (failures >= POLL_FAILURE_LIMIT) endCuttingPlanRun(bomId);
			}
		})();
	}, ASYNC_STATUS_POLL_MS);

	timers.set(bomId, interval);
}

/**
 * After BOM list load: show Running for every in-flight CP job/run and poll to completion.
 * Mirrors `resumeBackgroundExtractions` for OCR and APS schedule resume for async_jobs.
 */
export async function resumeBackgroundCuttingPlans(bomIds: string[]): Promise<void> {
	if (bomIds.length === 0) return;

	try {
		const [runs, jobs] = await Promise.all([
			listInFlightPlanRuns(bomIds),
			listInFlightCpJobs(bomIds)
		]);

		/** Prefer `async_jobs` polling when both exist — the job row appears first on Run. */
		const resumeByBom = new SvelteMap<string, { jobId?: string; runId?: string }>();
		for (const run of runs) {
			const entry = resumeByBom.get(run.bom_id) ?? {};
			entry.runId = run.run_id;
			resumeByBom.set(run.bom_id, entry);
		}
		for (const job of jobs) {
			const entry = resumeByBom.get(job.bom_id) ?? {};
			entry.jobId = job.job_id;
			resumeByBom.set(job.bom_id, entry);
		}

		for (const [bomId, refs] of resumeByBom) {
			if (runningByBom.has(bomId)) continue;
			beginCuttingPlanRun(bomId);
			if (refs.jobId) pollResumedJob(bomId, refs.jobId);
			else if (refs.runId) pollResumedRun(bomId, refs.runId);
		}
	} catch (error) {
		cpPushErrorToast({
			title: 'Could not resume cutting plans',
			description: errorDescription(error)
		});
	}
}
