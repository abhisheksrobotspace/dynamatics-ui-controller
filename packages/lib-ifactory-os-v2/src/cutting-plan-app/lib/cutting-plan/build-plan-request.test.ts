import { describe, expect, it } from 'vitest';
import { buildPlanRequest, normalizePlannerConfig } from './build-plan-request';
import type { SectionData } from './types';
import type {
	PlannerSettings,
	SectionRule
} from '../../../project-management-app/lib/store.svelte.js';

const projectRules: SectionRule[] = [
	{
		id: 'rule-1',
		projectId: 'project-1',
		fromFlg: 80,
		toFlg: 100,
		fromThk: 4,
		toThk: 8,
		minLength: 6000,
		maxLength: 12000,
		endTrim: 0,
		pitch: 100
	}
];

const baseSettings: PlannerSettings = {
	projectId: 'project-1',
	timeLimit: 30,
	maxUniqueLengthsPerBar: 4,
	maxUniqueStockLengthsPerSection: 0,
	enforceMarkCohesion: false
};

const baseSection: SectionData = {
	id: 'ht-angle-90x90x5',
	name: 'HT ANGLE 90x90x5',
	flange: 90,
	thickness: 5,
	unitWeightKgPerM: 6.97,
	marks: [
		{
			id: 'mark-1',
			sectionId: 'ht-angle-90x90x5',
			markName: 'JA40 HA 1163AH',
			length: 8431,
			qty: 2
		}
	]
};

describe('buildPlanRequest', () => {
	it('builds a schema-compliant request with unit_weight', () => {
		const request = buildPlanRequest(
			'bom-1',
			[{ ...baseSection, selectedLengths: [6000, 12000] }],
			['mark-1'],
			{ ...baseSettings, timeLimit: 5, enforceMarkCohesion: true },
			projectRules,
			'project-1'
		);

		expect(request.bom_id).toBe('bom-1');
		expect(request.config).toEqual({
			time_limit_per_section: 5,
			max_unique_lengths_per_bar: 4,
			max_unique_stock_lengths: 0,
			enforce_mark_cohesion: true
		});

		const section = request.parts_by_section['HT ANGLE 90x90x5'];
		expect(section.unit_weight).toBe(6.97);
		expect(section.thickness).toBe(5);
		expect(section.end_trim).toBe(0);
		expect(section.markings).toEqual([{ mark: 'JA40 HA 1163AH', length: 8431, quantity: 2 }]);
		expect(request.stock['HT ANGLE 90x90x5']).toEqual([6000, 12000]);
	});

	it('emits capped {length,quantity} when stockQtyByLength is provided', () => {
		const request = buildPlanRequest(
			'bom-1',
			[
				{
					...baseSection,
					selectedLengths: [6000, 12000],
					stockQtyByLength: { 6000: 6, 12000: 0 }
				}
			],
			['mark-1'],
			baseSettings,
			projectRules,
			'project-1'
		);
		expect(request.stock['HT ANGLE 90x90x5']).toEqual([{ length: 6000, quantity: 6 }]);
	});

	it('omits unit_weight when section has no unit weight', () => {
		const request = buildPlanRequest(
			'bom-1',
			[
				{
					...baseSection,
					unitWeightKgPerM: undefined,
					selectedLengths: [6000]
				}
			],
			['mark-1'],
			baseSettings,
			projectRules,
			'project-1'
		);

		expect(request.parts_by_section['HT ANGLE 90x90x5'].unit_weight).toBeUndefined();
	});

	it('normalizes blank mark names to null and rounds numeric fields', () => {
		const request = buildPlanRequest(
			'bom-1',
			[
				{
					...baseSection,
					marks: [
						{
							...baseSection.marks[0],
							markName: '   ',
							length: 8431.4,
							qty: 2.2
						}
					],
					selectedLengths: [6000.8]
				}
			],
			['mark-1'],
			baseSettings,
			projectRules,
			'project-1'
		);

		expect(request.parts_by_section['HT ANGLE 90x90x5'].markings[0]).toEqual({
			mark: null,
			length: 8431,
			quantity: 2
		});
		expect(request.stock['HT ANGLE 90x90x5']).toEqual([6001]);
	});

	it('throws when no section rule matches the section', () => {
		expect(() =>
			buildPlanRequest(
				'bom-1',
				[{ ...baseSection, selectedLengths: [6000] }],
				['mark-1'],
				baseSettings,
				[],
				'project-1'
			)
		).toThrow(/No section rule matches/);
	});
});

describe('normalizePlannerConfig', () => {
	it('clamps config values to schema bounds', () => {
		expect(
			normalizePlannerConfig({
				projectId: 'p1',
				timeLimit: 999,
				maxUniqueLengthsPerBar: 100,
				maxUniqueStockLengthsPerSection: -5,
				enforceMarkCohesion: true
			})
		).toEqual({
			time_limit_per_section: 5,
			max_unique_lengths_per_bar: 64,
			max_unique_stock_lengths: 0,
			enforce_mark_cohesion: true
		});
	});

	it('caps per-section time at 5s regardless of section count', () => {
		expect(
			normalizePlannerConfig({
				projectId: 'p1',
				timeLimit: 60,
				maxUniqueLengthsPerBar: 10,
				maxUniqueStockLengthsPerSection: 10,
				enforceMarkCohesion: false
			}).time_limit_per_section
		).toBe(5);
	});
});
