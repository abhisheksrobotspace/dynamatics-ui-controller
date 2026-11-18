import { SvelteSet } from 'svelte/reactivity';
import { errorDescription } from '../../../lib/api/types.js';
import { listCorePlanRuns } from './cp-plan.api.js';
import { cpPushErrorToast } from '../toast.js';

const resultsByBom = new SvelteSet<string>();
let resultsVersion = $state(0);

export function markCuttingPlanResults(bomId: string) {
	if (!resultsByBom.has(bomId)) {
		resultsByBom.add(bomId);
		resultsVersion++;
	}
}

/** Subscribe in `$derived` so BOM list View buttons refresh after async hydration. */
export function cuttingPlanResultsVersion(): number {
	return resultsVersion;
}

export function hasCuttingPlanResults(bomId: string): boolean {
	void resultsVersion;
	return resultsByBom.has(bomId);
}

export function clearCuttingPlanResults(bomId: string) {
	if (resultsByBom.delete(bomId)) {
		resultsVersion++;
	}
}

/** Sync View-button state from server `cp_plan_runs` only (no legacy IndexedDB fallback). */
export async function hydrateCuttingPlanResults(bomIds: string[]): Promise<void> {
	if (bomIds.length === 0) return;

	let hydrationError: unknown;
	const resolved = await Promise.all(
		bomIds.map(async (bomId) => {
			try {
				const runs = await listCorePlanRuns(bomId);
				return { bomId, hasRuns: runs.length > 0 };
			} catch (error) {
				hydrationError ??= error;
				return { bomId, hasRuns: false };
			}
		})
	);

	if (hydrationError) {
		cpPushErrorToast({
			title: 'Could not refresh cutting plan status',
			description: errorDescription(hydrationError)
		});
	}

	let changed = false;
	for (const { bomId, hasRuns } of resolved) {
		if (hasRuns) {
			if (!resultsByBom.has(bomId)) {
				resultsByBom.add(bomId);
				changed = true;
			}
		} else if (resultsByBom.delete(bomId)) {
			changed = true;
		}
	}
	if (changed) resultsVersion++;
}
