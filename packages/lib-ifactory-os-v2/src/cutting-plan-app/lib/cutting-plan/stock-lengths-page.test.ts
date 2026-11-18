import { describe, expect, it } from 'vitest';
import {
	defaultSelectedStockLengths,
	formatAvailableStockLengthsDescription,
	lengthMmFromVariantKey,
	NO_AVAILABLE_STOCK_LENGTHS_MESSAGE,
	resolveGeneratedStockLengths
} from './stock-lengths-page';

describe('lengthMmFromVariantKey', () => {
	it('parses L= from variant_key', () => {
		expect(lengthMmFromVariantKey('L=6000')).toBe(6000);
		expect(lengthMmFromVariantKey('L=9650;W=100')).toBe(9650);
	});

	it('returns 0 when missing', () => {
		expect(lengthMmFromVariantKey('')).toBe(0);
		expect(lengthMmFromVariantKey('W=100')).toBe(0);
	});
});

describe('resolveGeneratedStockLengths', () => {
	it('prefers available stock lengths over the rule grid when inventory is supplied', () => {
		const resolved = resolveGeneratedStockLengths({
			ruleLengths: [6000, 6025, 6050],
			availableLengths: [9650, 6000, 6000],
			ruleDesc: '6,000–12,000 mm · pitch 25'
		});
		expect(resolved.fromStock).toBe(true);
		expect(resolved.lengths).toEqual([6000, 9650]);
		expect(resolved.ruleDesc).toBe(formatAvailableStockLengthsDescription([6000, 9650]));
	});

	it('falls back to rule lengths when no stock', () => {
		const resolved = resolveGeneratedStockLengths({
			ruleLengths: [6000, 6100],
			availableLengths: [],
			ruleDesc: 'from Rule [1]'
		});
		expect(resolved.fromStock).toBe(false);
		expect(resolved.lengths).toEqual([6000, 6100]);
		expect(resolved.ruleDesc).toBe('from Rule [1]');
	});

	it('does not fall back to the rule grid when requireAvailable and stock is empty', () => {
		const resolved = resolveGeneratedStockLengths({
			ruleLengths: [6000, 6100],
			availableLengths: [],
			ruleDesc: 'from Rule [1]',
			requireAvailable: true
		});
		expect(resolved.fromStock).toBe(true);
		expect(resolved.lengths).toEqual([]);
		expect(resolved.ruleDesc).toBe(NO_AVAILABLE_STOCK_LENGTHS_MESSAGE);
	});

	it('names the length floor when requireAvailable and only shorter stock exists', () => {
		const resolved = resolveGeneratedStockLengths({
			ruleLengths: [6000],
			availableLengths: [],
			ruleDesc: 'from Rule [1]',
			requireAvailable: true,
			minLengthExclusiveMm: 11600
		});
		expect(resolved.ruleDesc).toBe('No free stock lengths longer than 11,600 mm for this section');
	});
});

describe('defaultSelectedStockLengths', () => {
	it('selects all when nothing is excluded', () => {
		expect(defaultSelectedStockLengths([6324, 9000])).toEqual([6324, 9000]);
	});

	it('drops excluded Lock lengths when alternatives remain', () => {
		expect(defaultSelectedStockLengths([6324, 9000], [6324])).toEqual([9000]);
	});

	it('keeps all when exclude would empty the selection', () => {
		expect(defaultSelectedStockLengths([6324], [6324])).toEqual([6324]);
	});
});
