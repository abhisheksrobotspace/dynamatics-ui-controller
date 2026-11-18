import type { BomConfig } from './store.svelte.js';

/**
 * Release eligibility for a BOM.
 * OCR / Operations Count and cutting-plan status are not release gates —
 * quantities can be set regardless of those statuses.
 */
export function bomReleaseBlockReason(bom: BomConfig): string | null {
	void bom;
	return null;
}

export function isBomReleaseReady(bom: BomConfig): boolean {
	return bomReleaseBlockReason(bom) == null;
}
