import { getPlannerSettings } from './cp.api.js';
import type { PlannerSettings } from '../../../project-management-app/lib/store.svelte.js';

const loadInFlight = new Map<string, Promise<PlannerSettings | null>>();

/** Loads planner settings for a project page. Returns null when none are saved yet. */
export async function loadPlannerSettingsPageData(
	projectId: string,
	signal?: AbortSignal
): Promise<PlannerSettings | null> {
	const inFlight = loadInFlight.get(projectId);
	if (inFlight) return inFlight;

	const promise = getPlannerSettings(projectId, signal).finally(() => {
		loadInFlight.delete(projectId);
	});

	loadInFlight.set(projectId, promise);
	return promise;
}
