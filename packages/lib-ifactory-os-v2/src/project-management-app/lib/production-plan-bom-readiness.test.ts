import { describe, expect, it } from 'vitest';
import {
	bomProductionPlanConfirmBlockReasons,
	collectProductionPlanLineBlockAlerts,
	formatProductionPlanLineBlockAlert,
	findProductionPlanConfirmBlockers
} from './production-plan-bom-readiness.js';
import type { ReleaseTowerEntry } from './store.svelte.js';
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
		publishedCpRunId: 'run-1',
		...partial
	};
}

describe('bomProductionPlanConfirmBlockReasons', () => {
	it('returns no blockers when Operations Count and Cutting Plan are complete', () => {
		expect(bomProductionPlanConfirmBlockReasons(bom())).toEqual([]);
		expect(bomProductionPlanConfirmBlockReasons(bom({ ocrStatus: 'action_needed' }))).toEqual([]);
	});

	it('blocks when Operations Count is incomplete', () => {
		expect(bomProductionPlanConfirmBlockReasons(bom({ ocrStatus: 'not_verified' }))).toEqual([
			'Basic Body: complete Operations Count before confirming this plan.'
		]);
	});

	it('blocks when Cutting Plan is incomplete', () => {
		expect(bomProductionPlanConfirmBlockReasons(bom({ cpStatus: 'none' }))).toEqual([
			'Basic Body: complete Cutting Plan before confirming this plan.'
		]);
	});

	it('blocks when no cutting plan version is published', () => {
		expect(bomProductionPlanConfirmBlockReasons(bom({ publishedCpRunId: null }))).toEqual([
			'Basic Body: publish a cutting plan version on All Runs before confirming this plan.'
		]);
	});

	it('reports both blockers when OCR and Cutting Plan are incomplete', () => {
		expect(
			bomProductionPlanConfirmBlockReasons(bom({ ocrStatus: 'not_verified', cpStatus: 'none' }))
		).toEqual([
			'Basic Body: complete Operations Count before confirming this plan.',
			'Basic Body: complete Cutting Plan before confirming this plan.'
		]);
	});
});

describe('formatProductionPlanLineBlockAlert', () => {
	it('includes tower type and BOM in the alert copy', () => {
		expect(
			formatProductionPlanLineBlockAlert('HA', bom({ publishedCpRunId: null }), 'Basic Body 2')
		).toBe(
			'HA / Basic Body: publish a cutting plan version on All Runs before confirming this plan.'
		);
	});
});

describe('collectProductionPlanLineBlockAlerts', () => {
	it('lists blocked lines with structure and BOM names', () => {
		const entries: ReleaseTowerEntry[] = [
			{
				id: 'e1',
				releaseId: 'p1',
				sNo: 1,
				towerTypeId: 'tower-ha',
				kind: 'tower',
				thisRelease: 0,
				lineItems: [
					{
						id: 'l1',
						bomId: 'b1',
						description: 'Basic Body',
						unit: 'Set',
						alreadyReleased: 0,
						thisRelease: 0
					}
				]
			}
		];

		expect(
			collectProductionPlanLineBlockAlerts(
				entries,
				new Map([['b1', bom({ id: 'b1', publishedCpRunId: null })]]),
				() => 'HA'
			)
		).toEqual([
			'HA / Basic Body: publish a cutting plan version on All Runs before confirming this plan.'
		]);
	});
});

describe('findProductionPlanConfirmBlockers', () => {
	it('collects blockers across multiple BOMs', () => {
		const blockers = findProductionPlanConfirmBlockers([
			bom({ id: 'b1', bomName: 'Tower A', cpStatus: 'none' }),
			bom({ id: 'b2', bomName: 'Tower B', ocrStatus: 'not_verified' })
		]);
		expect(blockers).toEqual([
			'Tower A: complete Cutting Plan before confirming this plan.',
			'Tower B: complete Operations Count before confirming this plan.'
		]);
	});
});
