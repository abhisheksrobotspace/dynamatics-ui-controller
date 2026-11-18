/**
 * Foreground/background cutting-plan runs.
 * Server job keeps going after navigation; this module owns completion (toast + result mark).
 * Per-BOM Running UI is tracked in `cutting-plan-running.svelte.ts`.
 */
import {
	stashCuttingPlanResultsNav,
	takeCuttingPlanResultsNav,
	withViewResultsAction,
	type BomResultsNav
} from '../../../lib/background-job-toast.js';
import { cpPushErrorToast, cpPushSuccessToast } from '../toast.js';
import {
	cuttingPlanRunHash,
	cuttingPlanRunsHash
} from '../../../project-management-app/lib/bom-structure-routes.js';
import { markCuttingPlanResults } from './cutting-plan-results.svelte.js';
import { beginCuttingPlanRun, endCuttingPlanRun } from './cutting-plan-running.svelte.js';
import { runCorePlan, type RunPlanInput } from './cp-plan.api.js';
import { completePartialReplanDraft } from './replan-sections.js';
import type { CpPlanRunRow } from './cp.rows.js';

export type CuttingPlanRunHandle = {
	/** Await while staying on the stock-lengths page; resolves with the run row. */
	promise: Promise<CpPlanRunRow>;
	/**
	 * Hand off to background: no Summary redirect; toast on complete/fail.
	 * `sticky` — user chose Run in background; do not reattach when the app is focused again.
	 */
	detach: (opts?: { sticky?: boolean }) => void;
	/** Resume foreground completion (in-page Summary) after returning to this app. */
	reattach: () => void;
	get detached(): boolean;
};

function cuttingPlanResultsHash(nav: BomResultsNav, bomId: string, runId?: string): string {
	if (runId?.trim()) {
		return cuttingPlanRunHash(nav.projectId, nav.structure, bomId, runId, 'Summary', nav.appName);
	}
	return cuttingPlanRunsHash(nav.projectId, nav.structure, bomId, nav.appName);
}

export function startCuttingPlanRun(options: {
	bomId: string;
	input: RunPlanInput;
	replanSectionsOnly: boolean;
	/** Needed so background completion toast can deep-link to Summary. */
	resultsNav: BomResultsNav;
	onProgress?: (progress: number | null) => void;
}): CuttingPlanRunHandle {
	let detached = false;
	let stickyDetach = false;
	beginCuttingPlanRun(options.bomId);
	stashCuttingPlanResultsNav(options.bomId, options.resultsNav);

	const promise = (async (): Promise<CpPlanRunRow> => {
		try {
			const run = await runCorePlan(options.bomId, options.input, {
				onProgress: (progress) => {
					// Keep updating so progress is current if the user returns mid-run.
					options.onProgress?.(progress);
				}
			});
			markCuttingPlanResults(options.bomId);
			if (options.replanSectionsOnly) {
				await completePartialReplanDraft(options.bomId);
			}
			if (detached) {
				const nav = takeCuttingPlanResultsNav(options.bomId) ?? options.resultsNav;
				cpPushSuccessToast(
					withViewResultsAction(
						{
							title: 'Cutting plan complete',
							description: 'Results are ready.'
						},
						cuttingPlanResultsHash(nav, options.bomId, run.run_id)
					)
				);
			} else {
				takeCuttingPlanResultsNav(options.bomId);
			}
			return run;
		} catch (error) {
			takeCuttingPlanResultsNav(options.bomId);
			if (detached) {
				cpPushErrorToast({
					title: 'Cutting plan failed',
					description: error instanceof Error ? error.message : 'Unknown planner error'
				});
			}
			throw error;
		} finally {
			endCuttingPlanRun(options.bomId);
		}
	})();

	return {
		promise,
		detach: (opts) => {
			detached = true;
			if (opts?.sticky) stickyDetach = true;
		},
		reattach: () => {
			if (stickyDetach) return;
			detached = false;
		},
		get detached() {
			return detached;
		}
	};
}
