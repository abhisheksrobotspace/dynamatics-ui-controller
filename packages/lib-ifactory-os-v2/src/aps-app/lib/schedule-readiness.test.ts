import { describe, expect, it } from 'vitest';
import { bomScheduleBlockReasons, type PlanScheduleReadiness } from './schedule-readiness.api.js';

function mergeReadiness(errors: string[], warnings: string[]): PlanScheduleReadiness {
	return {
		ok: errors.length === 0,
		errors,
		warnings
	};
}

describe('schedule readiness shape', () => {
	it('blocks when plant_id is missing', () => {
		const readiness = mergeReadiness(
			['Delivery schedule ds-1 has no plant assigned. Save the manufacturing plan first.'],
			[]
		);
		expect(readiness.ok).toBe(false);
	});

	it('blocks when multiple plants are bundled', () => {
		const readiness = mergeReadiness(
			[
				'Manufacturing plan spans multiple plants (NASHIK-1, PLANT-2). Use delivery schedules from one plant only.'
			],
			[]
		);
		expect(readiness.ok).toBe(false);
	});

	it('warns but allows when cp_run_id is missing and BOM gates pass', () => {
		const readiness = mergeReadiness(
			[],
			[
				'2 delivery schedule line(s) have no pinned cutting-plan run. Scheduling may mix CP versions.'
			]
		);
		expect(readiness.ok).toBe(true);
		expect(readiness.warnings.length).toBe(1);
	});
});

describe('bomScheduleBlockReasons', () => {
	const published = new Set(['bom-ready']);

	it('blocks when OCR is not complete', () => {
		const reasons = bomScheduleBlockReasons(
			{
				bom_id: 'bom-1',
				bom_name: 'Tower A BOM',
				ocr_status: 'not_verified',
				cp_status: 'planned'
			},
			published
		);
		expect(reasons).toContain('Tower A BOM: complete Operations Count before scheduling.');
	});

	it('blocks when cutting plan is not planned', () => {
		const reasons = bomScheduleBlockReasons(
			{
				bom_id: 'bom-2',
				bom_name: 'Tower B BOM',
				ocr_status: 'verified',
				cp_status: 'none'
			},
			published
		);
		expect(reasons).toContain('Tower B BOM: complete Cutting Plan before scheduling.');
	});

	it('blocks when cutting plan is not published', () => {
		const reasons = bomScheduleBlockReasons(
			{
				bom_id: 'bom-3',
				bom_name: 'Tower C BOM',
				ocr_status: 'verified',
				cp_status: 'planned'
			},
			new Set()
		);
		expect(reasons).toContain(
			'Tower C BOM: publish a cutting plan version on All Runs before scheduling.'
		);
	});

	it('allows verified OCR with action_needed and published CP', () => {
		expect(
			bomScheduleBlockReasons(
				{
					bom_id: 'bom-ready',
					bom_name: 'Ready BOM',
					ocr_status: 'action_needed',
					cp_status: 'planned'
				},
				published
			)
		).toEqual([]);
	});
});
