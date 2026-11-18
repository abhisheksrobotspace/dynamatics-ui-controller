import { describe, expect, it } from 'vitest';
import { formatWeightMt } from './bom-set-weight.js';

describe('formatWeightMt', () => {
	it('converts kg × qty to MT with two decimals', () => {
		expect(formatWeightMt(2500, 2)).toBe('5.00');
		expect(formatWeightMt(1234.5, 1)).toBe('1.23');
	});

	it('returns dash when kg is missing or qty is not positive', () => {
		expect(formatWeightMt(undefined, 4)).toBe('-');
		expect(formatWeightMt(1000, 0)).toBe('-');
		expect(formatWeightMt(1000, -1)).toBe('-');
		expect(formatWeightMt(Number.NaN, 1)).toBe('-');
	});
});
