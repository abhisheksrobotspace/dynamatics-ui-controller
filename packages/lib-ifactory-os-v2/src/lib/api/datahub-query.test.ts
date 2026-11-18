import { describe, expect, it } from 'vitest';
import { leftJoin, pickAlias, pickAliasString } from './datahub-query.js';

describe('datahub-query helpers', () => {
	it('leftJoin builds a left equi-join', () => {
		expect(leftJoin('proj_boms', 'b', 'bom_id', 'b.bom_id')).toEqual({
			entity: 'proj_boms',
			alias: 'b',
			type: 'left',
			on: [{ leftField: 'bom_id', op: 'eq', rightField: 'b.bom_id' }]
		});
	});

	it('pickAlias reads namespaced then bare keys', () => {
		expect(pickAlias({ 'i.item_code': 'ABC', item_code: 'fallback' }, 'i', 'item_code')).toBe(
			'ABC'
		);
		expect(pickAlias({ item_code: 'bare' }, 'i', 'item_code')).toBe('bare');
	});

	it('pickAliasString stringifies and falls back', () => {
		expect(pickAliasString({ 'c.name': 'Acme' }, 'c', 'name')).toBe('Acme');
		expect(pickAliasString({}, 'c', 'name', '-')).toBe('-');
	});
});
