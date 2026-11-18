import { describe, expect, it } from 'vitest';
import { variantKeyForLengthMm } from './assign-and-lock.detail';

describe('variantKeyForLengthMm', () => {
	it('encodes length as L=<mm>', () => {
		expect(variantKeyForLengthMm(9650)).toBe('L=9650');
		expect(variantKeyForLengthMm(9650.4)).toBe('L=9650');
	});
});
