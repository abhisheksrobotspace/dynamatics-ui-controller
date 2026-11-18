import { describe, expect, it } from 'vitest';
import { lineIdFromAssetClass } from './line-from-class';

describe('lineIdFromAssetClass', () => {
	it('maps angle_cnc to angle', () => {
		expect(lineIdFromAssetClass('angle_cnc')).toBe('angle');
	});

	it('maps plate_cnc and plate_manual to plate', () => {
		expect(lineIdFromAssetClass('plate_cnc')).toBe('plate');
		expect(lineIdFromAssetClass('plate_manual')).toBe('plate');
	});

	it('maps manual job-card classes to manual', () => {
		expect(lineIdFromAssetClass('angle_manual')).toBe('manual');
		expect(lineIdFromAssetClass('punching')).toBe('manual');
		expect(lineIdFromAssetClass('notching')).toBe('manual');
		expect(lineIdFromAssetClass('stamping')).toBe('manual');
	});

	it('blocks missing or unknown class', () => {
		expect(lineIdFromAssetClass(null)).toBeNull();
		expect(lineIdFromAssetClass(undefined)).toBeNull();
		expect(lineIdFromAssetClass('')).toBeNull();
		expect(lineIdFromAssetClass('  ')).toBeNull();
		expect(lineIdFromAssetClass('future_thing')).toBeNull();
	});
});
