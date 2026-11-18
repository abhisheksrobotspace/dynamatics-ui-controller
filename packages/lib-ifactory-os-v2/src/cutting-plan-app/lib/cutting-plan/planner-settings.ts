import { DEFAULT_PLANNER_SETTINGS } from './constants';
import type { PlannerSettings } from '../../../project-management-app/lib/store.svelte.js';

/** Always returns a fresh object so dialog edits do not mutate the source until confirmed. */
export function createPlannerSettingsDraft(
	projectId: string,
	settings?: PlannerSettings | null
): PlannerSettings {
	return {
		projectId: settings?.projectId ?? projectId,
		timeLimit: settings?.timeLimit ?? DEFAULT_PLANNER_SETTINGS.timeLimit,
		maxUniqueLengthsPerBar:
			settings?.maxUniqueLengthsPerBar ?? DEFAULT_PLANNER_SETTINGS.maxUniqueLengthsPerBar,
		maxUniqueStockLengthsPerSection:
			settings?.maxUniqueStockLengthsPerSection ??
			DEFAULT_PLANNER_SETTINGS.maxUniqueStockLengthsPerSection,
		enforceMarkCohesion:
			settings?.enforceMarkCohesion ?? DEFAULT_PLANNER_SETTINGS.enforceMarkCohesion
	};
}
