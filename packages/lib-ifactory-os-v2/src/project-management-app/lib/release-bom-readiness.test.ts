import { describe, expect, it } from 'vitest';
import { bomReleaseBlockReason, isBomReleaseReady } from './release-bom-readiness.js';
import type { BomConfig } from './store.svelte.js';

function bom(partial: Partial<BomConfig> = {}): BomConfig {
	return {
		id: 'b1',
		towerId: 't1',
		sNo: 1,
		bomName: 'Basic Body',
		bomLineageId: 'b1',
		version: 1,
		stage: 'proto',
		bomFile: null,
		drawingsFile: null,
		extractStatus: 'extracted',
		ocrStatus: 'verified',
		cpStatus: 'planned',
		...partial
	};
}

describe('bomReleaseBlockReason', () => {
	it('does not gate on Operations Count or cutting plan status', () => {
		expect(bomReleaseBlockReason(bom({}))).toBeNull();
		expect(bomReleaseBlockReason(bom({ ocrStatus: 'not_verified' }))).toBeNull();
		expect(bomReleaseBlockReason(bom({ ocrStatus: 'action_needed' }))).toBeNull();
		expect(bomReleaseBlockReason(bom({ cpStatus: 'none' }))).toBeNull();
		expect(isBomReleaseReady(bom({ ocrStatus: 'not_verified', cpStatus: 'none' }))).toBe(true);
	});
});
