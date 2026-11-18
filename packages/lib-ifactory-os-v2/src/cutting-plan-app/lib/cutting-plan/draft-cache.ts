import {
	deleteCachedData,
	getCachedData,
	setCachedData
} from '../../../lib/customScripts/cache-manager.js';
import { STORAGE_TYPES } from '../../../lib/customScripts/constants.js';
import { CUTTING_PLAN_DRAFT_KEY } from './constants';
import type { CuttingPlanDraft } from './types';

/** Plain-object clone safe for IndexedDB structured clone. */
export function toStorableDraft(draft: CuttingPlanDraft): CuttingPlanDraft {
	return JSON.parse(JSON.stringify(draft)) as CuttingPlanDraft;
}

export async function loadCuttingPlanDraft(bomId: string): Promise<CuttingPlanDraft | null> {
	const key = CUTTING_PLAN_DRAFT_KEY(bomId);
	return (await getCachedData(key, STORAGE_TYPES.INDEXED_DB, key)) as CuttingPlanDraft | null;
}

export async function saveCuttingPlanDraft(bomId: string, draft: CuttingPlanDraft): Promise<void> {
	await setCachedData(
		CUTTING_PLAN_DRAFT_KEY(bomId),
		toStorableDraft(draft),
		STORAGE_TYPES.INDEXED_DB
	);
}

export async function clearCuttingPlanDraft(bomId: string): Promise<void> {
	await deleteCachedData(CUTTING_PLAN_DRAFT_KEY(bomId), STORAGE_TYPES.INDEXED_DB);
}
