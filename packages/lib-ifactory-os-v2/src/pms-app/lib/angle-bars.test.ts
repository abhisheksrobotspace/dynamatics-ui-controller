import { describe, expect, it } from 'vitest';
import { barsToConfirmKeys, wholeBarsFromMarks } from './jobs.js';

describe('wholeBarsFromMarks', () => {
	const count = (mark: { produced?: number }) => mark.produced;

	it('takes the least whole bars across marks', () => {
		expect(
			wholeBarsFromMarks(
				[
					{ pcsPerBar: 2, produced: 4 },
					{ pcsPerBar: 1, produced: 2 }
				],
				count
			)
		).toBe(2);
		expect(
			wholeBarsFromMarks(
				[
					{ pcsPerBar: 2, produced: 5 },
					{ pcsPerBar: 2, produced: 6 }
				],
				count
			)
		).toBe(2);
	});

	it('ignores marks without a bar size', () => {
		expect(
			wholeBarsFromMarks(
				[
					{ pcsPerBar: 0, produced: 0 },
					{ pcsPerBar: null, produced: 0 },
					{ pcsPerBar: 2, produced: 6 }
				],
				count
			)
		).toBe(3);
	});

	it('returns null when no mark has a bar size', () => {
		expect(wholeBarsFromMarks([], count)).toBeNull();
		expect(wholeBarsFromMarks([{ pcsPerBar: null, produced: 4 }], count)).toBeNull();
	});

	it('treats a negative or missing count as zero', () => {
		expect(wholeBarsFromMarks([{ pcsPerBar: 2, produced: -3 }], count)).toBe(0);
		expect(wholeBarsFromMarks([{ pcsPerBar: 2, produced: undefined }], count)).toBe(0);
	});
});

describe('barsToConfirmKeys', () => {
	it('lists each parked RM that must ask which bar is on the machine', () => {
		expect(
			barsToConfirmKeys({
				J1: { progress: { barsToConfirm: ['RM-1'] } },
				J2: { progress: {} },
				error: 'x'
			})
		).toEqual(['J1::RM-1']);
	});

	it('ignores non-array and non-string entries', () => {
		expect(
			barsToConfirmKeys({
				J1: { progress: { barsToConfirm: 'RM-1' } },
				J2: { progress: { barsToConfirm: [42, null, ' RM-2 ', ''] } }
			})
		).toEqual(['J2::RM-2']);
	});

	it('returns nothing for a runtime error payload', () => {
		expect(barsToConfirmKeys({ error: 'missing' })).toEqual([]);
		expect(barsToConfirmKeys(undefined)).toEqual([]);
	});
});
