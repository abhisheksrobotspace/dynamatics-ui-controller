import { deleteCachedData, getCachedData } from '../../../lib/customScripts/cache-manager.js';
import { STORAGE_TYPES } from '../../../lib/customScripts/constants.js';
import { CUTTING_PLAN_RESULT_KEY, CUTTING_PLAN_RUNS_KEY } from './constants';

export function hasStoredPlanResults(bomId: string): Promise<boolean> {
	return Promise.all([
		getCachedData(
			CUTTING_PLAN_RUNS_KEY(bomId),
			STORAGE_TYPES.INDEXED_DB,
			CUTTING_PLAN_RUNS_KEY(bomId)
		),
		getCachedData(
			CUTTING_PLAN_RESULT_KEY(bomId),
			STORAGE_TYPES.INDEXED_DB,
			CUTTING_PLAN_RESULT_KEY(bomId)
		)
	]).then(([runsStore, legacyResult]) => {
		const runs = (runsStore as { runs?: unknown[] } | null)?.runs ?? [];
		if (runs.length > 0) return true;
		const legacy = legacyResult as { output?: Record<string, unknown> } | null;
		return Boolean(legacy?.output && Object.keys(legacy.output).length > 0);
	});
}

/** Clears legacy IndexedDB plan result/run caches for a BOM. */
export async function clearLegacyPlanCache(bomId: string): Promise<void> {
	await Promise.all([
		deleteCachedData(CUTTING_PLAN_RUNS_KEY(bomId), STORAGE_TYPES.INDEXED_DB),
		deleteCachedData(CUTTING_PLAN_RESULT_KEY(bomId), STORAGE_TYPES.INDEXED_DB)
	]);
}
