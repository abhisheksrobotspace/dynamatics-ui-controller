import { describe, expect, it } from 'vitest';
import { indentLineMatchesRow } from './indent-routes';

describe('indentLineMatchesRow', () => {
	it('matches unresolved stash rows to auto-created draft lines by section + length', () => {
		expect(
			indentLineMatchesRow(
				{ item_id: 'new-item', section: 'HT ANGLE 75X75X5', length_mm: 6000 },
				{ itemId: '', section: 'HT ANGLE 75X75X5', lengthMm: 6000 }
			)
		).toBe(true);
	});

	it('does not match a different section at the same length', () => {
		expect(
			indentLineMatchesRow(
				{ item_id: 'other', section: 'MS ANGLE 50X50X6', length_mm: 6000 },
				{ itemId: '', section: 'HT ANGLE 75X75X5', lengthMm: 6000 }
			)
		).toBe(false);
	});

	it('still matches resolved rows by item id + length', () => {
		expect(
			indentLineMatchesRow(
				{ item_id: 'item-1', section: 'HT ANGLE 75X75X5', variant_key: 'L=6000' },
				{ itemId: 'item-1', section: 'HT ANGLE 75X75X5', lengthMm: 6000 }
			)
		).toBe(true);
	});
});
