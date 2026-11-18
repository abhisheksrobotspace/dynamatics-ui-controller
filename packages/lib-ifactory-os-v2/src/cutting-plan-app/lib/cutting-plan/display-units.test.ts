import { describe, expect, it } from 'vitest';
import {
	formatDisplayLength,
	formatDisplayWeight,
	LENGTH_METERS_THRESHOLD_MM,
	WEIGHT_MT_THRESHOLD_KG
} from './display-units';

describe('formatDisplayLength', () => {
	it('shows mm below 20 m', () => {
		expect(formatDisplayLength(19_999)).toBe('19999 mm');
		expect(formatDisplayLength(12_000)).toBe('12000 mm');
	});

	it('shows m at and above 20 m', () => {
		expect(formatDisplayLength(LENGTH_METERS_THRESHOLD_MM)).toBe('20.00 m');
		expect(formatDisplayLength(25_500, { mDecimals: 1 })).toBe('25.5 m');
	});

	it('returns em dash for invalid values', () => {
		expect(formatDisplayLength(undefined)).toBe('-');
		expect(formatDisplayLength(Number.NaN)).toBe('-');
	});
});

describe('formatDisplayWeight', () => {
	it('shows kg below 500 kg', () => {
		expect(formatDisplayWeight(499.4)).toBe('499.4 kg');
		expect(formatDisplayWeight(218, { kgDecimals: 0 })).toBe('218 kg');
	});

	it('shows MT at and above 500 kg', () => {
		expect(formatDisplayWeight(WEIGHT_MT_THRESHOLD_KG)).toBe('0.50 MT');
		expect(formatDisplayWeight(1250)).toBe('1.25 MT');
	});

	it('returns em dash for invalid values', () => {
		expect(formatDisplayWeight(null)).toBe('-');
		expect(formatDisplayWeight(Number.NaN)).toBe('-');
	});
});
