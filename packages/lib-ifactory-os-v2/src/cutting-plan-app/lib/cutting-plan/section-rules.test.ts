import { describe, expect, it } from 'vitest';
import { generateStockLengths, hasProjectSectionRules, matchSectionRule } from './section-rules';
import type { SectionRule } from '../../../project-management-app/lib/store.svelte.js';

const projectRules: SectionRule[] = [
	{
		id: '1',
		projectId: 'p1',
		fromFlg: 80,
		toFlg: 100,
		fromThk: 4,
		toThk: 8,
		minLength: 6000,
		maxLength: 6200,
		endTrim: 0,
		pitch: 100
	}
];

describe('section-rules', () => {
	it('requires configured project rules before matching', () => {
		expect(hasProjectSectionRules([], 'p1')).toBe(false);
		expect(matchSectionRule([], 'p1', 90, 5)).toBeUndefined();
		expect(generateStockLengths(undefined)).toEqual([]);
	});

	it('generates stock lengths only from a matched rule', () => {
		const rule = matchSectionRule(projectRules, 'p1', 90, 5);
		expect(generateStockLengths(rule)).toEqual([6000, 6100, 6200]);
	});
});
