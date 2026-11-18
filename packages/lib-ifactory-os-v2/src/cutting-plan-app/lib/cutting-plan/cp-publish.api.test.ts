import { describe, expect, it } from 'vitest';
import { assessCpRunPublishEligibility, missingSectionsForRun } from './cp-publish.api.js';

describe('missingSectionsForRun', () => {
	it('returns sections absent from the run manifest', () => {
		expect(missingSectionsForRun(['Angle A', 'Plate B'], ['angle a'])).toEqual(['Plate B']);
	});

	it('treats length-grouped plan sections as covering the BOM base section', () => {
		expect(
			missingSectionsForRun(['HT ANGLE 75X75X4', 'HT ANGLE 75X75X13'], ['HT ANGLE 75X75X4 0-500'])
		).toEqual(['HT ANGLE 75X75X13']);
	});
});

describe('assessCpRunPublishEligibility', () => {
	it('allows publish when run is completed and covers all sections', () => {
		expect(
			assessCpRunPublishEligibility({
				run: { run_id: 'r1', status: 'completed', section_plan_ids: ['s1'] },
				bomSectionNames: ['Angle A'],
				runSectionNames: ['Angle A']
			})
		).toEqual({ canPublish: true });
	});

	it('blocks incomplete runs', () => {
		expect(
			assessCpRunPublishEligibility({
				run: { run_id: 'r1', status: 'solving', section_plan_ids: ['s1'] },
				bomSectionNames: ['Angle A'],
				runSectionNames: ['Angle A']
			})
		).toEqual({ canPublish: false, reason: 'Only completed runs can be published.' });
	});

	it('blocks already published runs', () => {
		expect(
			assessCpRunPublishEligibility({
				run: { run_id: 'r1', status: 'published', section_plan_ids: ['s1'] },
				bomSectionNames: ['Angle A'],
				runSectionNames: ['Angle A']
			})
		).toEqual({ canPublish: false, reason: 'This run is already published.' });
	});

	it('blocks partial section coverage', () => {
		const result = assessCpRunPublishEligibility({
			run: { run_id: 'r1', status: 'completed', section_plan_ids: ['s1'] },
			bomSectionNames: ['Angle A', 'Plate B'],
			runSectionNames: ['Angle A']
		});
		expect(result.canPublish).toBe(false);
		expect(result.missingSections).toEqual(['Plate B']);
	});
});
