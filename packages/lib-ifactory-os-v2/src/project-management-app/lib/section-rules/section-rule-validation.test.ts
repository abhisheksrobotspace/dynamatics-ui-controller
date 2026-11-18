import { describe, expect, it } from 'vitest';
import type { SectionRule } from '../store.svelte';
import { emptyRuleDraft } from './rule-draft';
import {
	draftsOverlap,
	findOverlappingRule,
	getRuleFieldErrors,
	isBoundedRangeInvalid
} from './section-rule-validation';

describe('section-rule-validation', () => {
	it('flags invalid bounded ranges', () => {
		expect(isBoundedRangeInvalid(100, 50)).toBe(true);
		expect(isBoundedRangeInvalid(100, 0)).toBe(false);
		expect(isBoundedRangeInvalid(0, 50)).toBe(false);
	});

	it('detects overlap when flange and thickness both overlap', () => {
		const a = { ...emptyRuleDraft(), fromFlg: 100, toFlg: 200, fromThk: 2, toThk: 6 };
		const b = { ...emptyRuleDraft(), fromFlg: 150, toFlg: 250, fromThk: 5, toThk: 10 };
		expect(draftsOverlap(a, b)).toBe(true);
	});

	it('does not overlap when flange ranges are disjoint', () => {
		const a = { ...emptyRuleDraft(), fromFlg: 100, toFlg: 200, fromThk: 2, toThk: 6 };
		const b = { ...emptyRuleDraft(), fromFlg: 201, toFlg: 250, fromThk: 2, toThk: 6 };
		expect(draftsOverlap(a, b)).toBe(false);
	});

	it('does not overlap when flange overlaps but thickness is disjoint', () => {
		const a = { ...emptyRuleDraft(), fromFlg: 70, toFlg: 175, fromThk: 16.1, toThk: 100 };
		const b = { ...emptyRuleDraft(), fromFlg: 91, toFlg: 149, fromThk: 3, toThk: 16 };
		expect(draftsOverlap(a, b)).toBe(false);
	});

	it('finds an overlapping existing rule', () => {
		const rules: SectionRule[] = [
			{
				id: '1',
				projectId: 'p1',
				fromFlg: 1,
				toFlg: 10,
				fromThk: 2,
				toThk: 6,
				minLength: 6000,
				maxLength: 12000,
				endTrim: 0,
				pitch: 500
			}
		];

		const draft = { ...emptyRuleDraft(), fromFlg: 5, toFlg: 15, fromThk: 4, toThk: 8 };
		const overlap = findOverlappingRule(draft, rules, 'p1');
		expect(overlap?.ruleIndex).toBe(1);
	});

	it('allows existing flange overlap when thickness does not overlap', () => {
		const rules: SectionRule[] = [
			{
				id: '1',
				projectId: 'p1',
				fromFlg: 70,
				toFlg: 175,
				fromThk: 16.1,
				toThk: 100,
				minLength: 6000,
				maxLength: 12000,
				endTrim: 0,
				pitch: 500
			}
		];

		const draft = { ...emptyRuleDraft(), fromFlg: 91, toFlg: 149, fromThk: 3, toThk: 16 };
		const overlap = findOverlappingRule(draft, rules, 'p1');
		expect(overlap).toBeNull();
	});

	it('returns field errors for invalid draft values', () => {
		const draft = {
			...emptyRuleDraft(),
			fromFlg: 100,
			toFlg: 50,
			minLength: 12000,
			maxLength: 6000,
			pitch: 0
		};

		expect(getRuleFieldErrors(draft)).toEqual({
			toFlg: true,
			maxLength: true,
			pitch: true
		});
	});
});
