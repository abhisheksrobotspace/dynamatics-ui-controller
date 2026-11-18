import { describe, expect, it } from 'vitest';
import { normalizeBomSectionName } from './bom-csv-parser';
import { resolveSectionUnitWeight } from './plan-section-weights';

describe('resolveSectionUnitWeight', () => {
	const map = {
		[normalizeBomSectionName('MS ANGLE 60X60X4')]: 3.71,
		[normalizeBomSectionName('HT ANGLE 80X80X6')]: 7.34
	};

	it('resolves an exact base section name', () => {
		expect(resolveSectionUnitWeight('MS ANGLE 60X60X4', map)).toBe(3.71);
	});

	it('resolves a length-grouped plan key via base-name prefix', () => {
		expect(resolveSectionUnitWeight('MS ANGLE 60X60X4 3001-6000', map)).toBe(3.71);
		expect(resolveSectionUnitWeight('HT ANGLE 80X80X6 0-500', map)).toBe(7.34);
	});

	it('returns undefined when no base matches', () => {
		expect(resolveSectionUnitWeight('UNKNOWN SECTION 0-500', map)).toBeUndefined();
	});
});
