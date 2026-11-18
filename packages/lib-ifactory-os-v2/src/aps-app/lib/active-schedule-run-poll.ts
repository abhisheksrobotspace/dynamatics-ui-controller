import { ASYNC_STATUS_POLL_MS } from '../../lib/api/jobs.js';
import { subscribeApsScheduleBus } from './aps-schedule-bus.js';
import { isPlanScheduleActive } from './production-schedule.api.js';

export type ActiveScheduleRunWatcher = {
	/** Latest poll result — true when a schedule/replan is in progress for the plan. */
	readonly active: boolean;
	dispose: () => void;
};

/**
 * Poll shared DB state + same-browser tab bus so any tab/user sees an in-flight APS run.
 *
 * Intentionally does NOT listen to `window` `focus`: AppShell mousedown / DevTools↔page
 * focus churn would re-hit `aps_schedule_runs` + `async_jobs` on every click.
 * Tab return uses `visibilitychange`; in-flight runs keep the timer; BroadcastChannel
 * covers same-browser starts/ends.
 */
export function watchActiveScheduleRun(
	planId: string,
	onChange: (active: boolean) => void
): ActiveScheduleRunWatcher {
	let active = false;
	let cancelled = false;
	let pollTimer: ReturnType<typeof setTimeout> | null = null;
	let inFlight: Promise<void> | null = null;
	const controller = new AbortController();

	function applyActive(next: boolean) {
		if (next === active) return;
		active = next;
		onChange(next);
	}

	function clearPollTimer() {
		if (pollTimer) {
			clearTimeout(pollTimer);
			pollTimer = null;
		}
	}

	function armPollTimer() {
		clearPollTimer();
		if (cancelled || !active) return;
		pollTimer = setTimeout(() => void tick(), ASYNC_STATUS_POLL_MS);
	}

	async function tick() {
		if (cancelled || controller.signal.aborted) return;
		if (inFlight) return inFlight;
		inFlight = (async () => {
			try {
				const next = await isPlanScheduleActive(planId, controller.signal);
				if (cancelled || controller.signal.aborted) return;
				applyActive(next);
			} catch (error) {
				if (error instanceof DOMException && error.name === 'AbortError') return;
				// Ignore transient poll errors — keep the last known state.
			} finally {
				inFlight = null;
				armPollTimer();
			}
		})();
		return inFlight;
	}

	function dispose() {
		if (cancelled) return;
		cancelled = true;
		clearPollTimer();
		controller.abort();
		unsubscribeBus();
		document.removeEventListener('visibilitychange', onVisibilityChange);
	}

	function onVisibilityChange() {
		// Only recheck when returning to the tab — not on every UI click/focus.
		if (document.visibilityState === 'visible') void tick();
	}

	if (!planId.trim()) {
		onChange(false);
		return {
			get active() {
				return false;
			},
			dispose: () => {}
		};
	}

	const unsubscribeBus = subscribeApsScheduleBus(planId, (message) => {
		if (message.type === 'started') {
			applyActive(true);
			armPollTimer();
			return;
		}
		void tick();
	});

	document.addEventListener('visibilitychange', onVisibilityChange);
	void tick();

	return {
		get active() {
			return active;
		},
		dispose
	};
}
