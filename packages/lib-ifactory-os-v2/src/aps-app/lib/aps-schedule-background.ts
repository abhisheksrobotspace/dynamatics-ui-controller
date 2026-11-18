/**
 * Foreground/background APS schedule runs.
 * Server job keeps going after navigation; this module owns completion toast when detached.
 */
import { withViewResultsAction } from '../../lib/background-job-toast.js';
import { formatApiErrorMessage } from '../../lib/api/types.js';
import { DEFAULT_APS_SOLVER, type ApsSchedulerUiSolver } from './aps-scheduler.js';
import {
	rerunApsSchedule,
	runApsSchedule,
	type ApsFixedTask,
	type RunApsScheduleOptions
} from './production-schedule.api.js';
import type { ProductionScheduleData } from './production-schedule.types.js';
import { productionScheduleHash } from './production-schedule.types.js';
import { productionScheduleRunHash } from './schedule-runs.js';
import { apsPushErrorToast, apsPushSuccessToast } from './toast.js';

export type ApsScheduleRunHandle = {
	promise: Promise<ProductionScheduleData>;
	/**
	 * Hand off to background: no in-page navigate/adopt; toast on complete/fail.
	 * `sticky` — user chose Run in background; do not reattach when the app is focused again.
	 */
	detach: (opts?: { sticky?: boolean }) => void;
	/** Resume foreground completion after returning to this app. */
	reattach: () => void;
	get detached(): boolean;
};

function resultsHash(planId: string, runId?: string): string {
	if (runId?.trim()) return productionScheduleRunHash(planId, runId);
	return productionScheduleHash(planId);
}

export type StartApsScheduleOptions = {
	planId: string;
	kind: 'schedule';
	solver?: ApsSchedulerUiSolver;
	onProgress?: (progress: number | null) => void;
	signal?: AbortSignal;
};

export type StartApsReplanOptions = {
	planId: string;
	kind: 'replan';
	runId: string;
	fixedTasks: ApsFixedTask[];
	scheduleStart: string;
	onProgress?: (progress: number | null) => void;
	signal?: AbortSignal;
};

export function startApsScheduleRun(
	options: StartApsScheduleOptions | StartApsReplanOptions
): ApsScheduleRunHandle {
	let detached = false;
	let stickyDetach = false;

	const promise = (async (): Promise<ProductionScheduleData> => {
		try {
			const data =
				options.kind === 'replan'
					? await rerunApsSchedule(
							options.planId,
							options.runId,
							options.fixedTasks,
							options.scheduleStart,
							options.signal,
							options.onProgress
						)
					: await runApsSchedule(options.planId, {
							solver: options.solver ?? DEFAULT_APS_SOLVER,
							signal: options.signal,
							onProgress: options.onProgress
						} satisfies RunApsScheduleOptions);

			if (detached) {
				apsPushSuccessToast(
					withViewResultsAction(
						{
							title: 'Schedule completed',
							description: 'Production schedule results are ready.'
						},
						resultsHash(options.planId, data.runId)
					)
				);
			}
			return data;
		} catch (error) {
			if (detached) {
				apsPushErrorToast({
					title: 'Schedule failed',
					description: formatApiErrorMessage(error)
				});
			}
			throw error;
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
