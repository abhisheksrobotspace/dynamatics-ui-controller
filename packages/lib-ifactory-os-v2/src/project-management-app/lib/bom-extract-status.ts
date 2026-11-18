import type { BomConfig } from './store.svelte';

export type BomExtractStatus = 'pending' | 'extracting' | 'extracted' | 'failed';

export function parseBomExtractStatus(value: unknown): BomExtractStatus {
	if (value === 'extracting' || value === 'extracted' || value === 'failed') return value;
	return 'pending';
}

export function isBomExtractInProgress(status: BomExtractStatus): boolean {
	return status === 'extracting';
}

export function isBomExtractReady(bom: BomConfig): boolean {
	return bom.extractStatus === 'extracted';
}

/** BOM list Cutting Plan column — same gates as the Plan/Replan buttons. */
export function canStartCuttingPlan(bom: BomConfig, hasSectionRules: boolean): boolean {
	return hasSectionRules && Boolean(bom.bomFileId ?? bom.bomFile) && isBomExtractReady(bom);
}

/** BOM has a CSV on the server but extraction never finished or failed. */
export function needsBomExtractAction(bom: BomConfig): boolean {
	if (!bom.bomFileId) return false;
	return bom.extractStatus === 'pending' || bom.extractStatus === 'failed';
}
