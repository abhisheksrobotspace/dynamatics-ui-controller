import { markBomExtractPending } from '../bom-extract-poll.svelte.js';
import { clearCuttingPlanDraft } from '../../../cutting-plan-app/lib/cutting-plan/draft-cache';
import { clearCuttingPlanResults } from '../../../cutting-plan-app/lib/cutting-plan/cutting-plan-results.svelte';
import { clearLegacyPlanCache } from '../../../cutting-plan-app/lib/cutting-plan/plan-results-storage';
import { deleteBomCsvDerivedRows, deleteUploadedFile, setBomExtractStatus } from './boms.api.js';

/** Client-side caches and in-flight extract state before BOM CSV replace/delete. */
export async function clearBomCsvClientState(bomId: string): Promise<void> {
	markBomExtractPending(bomId);
	clearCuttingPlanResults(bomId);
	await Promise.all([clearCuttingPlanDraft(bomId), clearLegacyPlanCache(bomId)]);
}

/** Clears extracted BOM data and related client caches before replacing a CSV. */
export async function cleanupBeforeBomCsvReupload(
	bomId: string,
	signal?: AbortSignal
): Promise<void> {
	await clearBomCsvClientState(bomId);
	await Promise.all([
		setBomExtractStatus(bomId, 'pending', signal),
		deleteBomCsvDerivedRows(bomId, signal)
	]);
}

/** Deletes the previous file-service object after a successful replacement upload. */
export async function removeReplacedUploadedFile(
	previousFileId: string | null | undefined,
	nextFileId: string | null | undefined,
	signal?: AbortSignal
): Promise<void> {
	if (!previousFileId || !nextFileId || previousFileId === nextFileId) return;
	await deleteUploadedFile(previousFileId, signal);
}
