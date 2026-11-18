import { describe, expect, it } from 'vitest';
import type { LengthGroup } from '../../../project-management-app/lib/store.svelte.js';
import type { SectionData } from './types';
import {
	applyGroupsToAllSections,
	applyOneGroupToSections,
	baseNamesWithGroup,
	canSaveLengthGroupDraft,
	collapseToBaseSections,
	countMatchingMarksInSelection,
	formatGroupedSectionName,
	markInGroup,
	setGroupSectionMembership
} from './length-groups';

const shortGroup: LengthGroup = {
	id: 'g1',
	projectId: 'p1',
	name: 'Short',
	minLength: 0,
	maxLength: 3000,
	sortOrder: 0
};

const longGroup: LengthGroup = {
	id: 'g2',
	projectId: 'p1',
	name: 'Long',
	minLength: 3001,
	maxLength: 12000,
	sortOrder: 1
};

function section(name: string, marks: Array<{ id: string; length: number }>): SectionData {
	const id = `sec-${name}`;
	return {
		id,
		name,
		flange: 90,
		thickness: 5,
		marks: marks.map((mark) => ({
			id: mark.id,
			sectionId: id,
			markName: mark.id,
			length: mark.length,
			qty: 1
		}))
	};
}

describe('length-groups', () => {
	it('matches mark lengths inclusively (0 min is literal)', () => {
		expect(markInGroup(0, shortGroup)).toBe(true);
		expect(markInGroup(3000, shortGroup)).toBe(true);
		expect(markInGroup(3001, shortGroup)).toBe(false);
		expect(markInGroup(9000, longGroup)).toBe(true);
		expect(markInGroup(12001, longGroup)).toBe(false);
	});

	it('formats grouped section names', () => {
		expect(formatGroupedSectionName('HT ANGLE 90X90X5', 'Short')).toBe('HT ANGLE 90X90X5 Short');
		expect(formatGroupedSectionName('MS ANGLE 110X110X8', '2001 - 4000')).toBe(
			'MS ANGLE 110X110X8 2001 - 4000'
		);
	});

	it('applies all groups and keeps residual marks', () => {
		const input = [
			section('HT ANGLE 90X90X5', [
				{ id: 'm1', length: 2000 },
				{ id: 'm2', length: 5000 },
				{ id: 'm3', length: 100 }
			])
		];

		const result = applyGroupsToAllSections(input, [shortGroup, longGroup]);
		expect(result.map((entry) => entry.name)).toEqual([
			'HT ANGLE 90X90X5 Short',
			'HT ANGLE 90X90X5 Long'
		]);
		expect(result[0].marks.map((mark) => mark.id).sort()).toEqual(['m1', 'm3']);
		expect(result[1].marks.map((mark) => mark.id)).toEqual(['m2']);
		expect(result[0].baseName).toBe('HT ANGLE 90X90X5');
		expect(result[0].groupName).toBe('Short');
	});

	it('keeps residual base section when marks fall outside all groups', () => {
		const onlyShort: LengthGroup = { ...shortGroup, maxLength: 1000 };
		const input = [
			section('HT ANGLE 90X90X5', [
				{ id: 'm1', length: 500 },
				{ id: 'm2', length: 5000 }
			])
		];

		const result = applyGroupsToAllSections(input, [onlyShort]);
		expect(result.map((entry) => entry.name)).toEqual([
			'HT ANGLE 90X90X5 Short',
			'HT ANGLE 90X90X5'
		]);
	});

	it('applies one group to selected sections only', () => {
		const input = [
			section('A', [
				{ id: 'a1', length: 1000 },
				{ id: 'a2', length: 5000 }
			]),
			section('B', [{ id: 'b1', length: 1500 }])
		];

		const result = applyOneGroupToSections(input, shortGroup, ['A']);
		expect(result.map((entry) => entry.name)).toEqual(['A Short', 'A', 'B']);
		expect(result[0].marks.map((mark) => mark.id)).toEqual(['a1']);
		expect(result[1].marks.map((mark) => mark.id)).toEqual(['a2']);
	});

	it('setGroupSectionMembership preserves other groups and drops unchecked', () => {
		const allGrouped = applyGroupsToAllSections(
			[
				section('A', [
					{ id: 'a1', length: 1000 },
					{ id: 'a2', length: 5000 }
				]),
				section('B', [
					{ id: 'b1', length: 1000 },
					{ id: 'b2', length: 5000 }
				])
			],
			[shortGroup, longGroup]
		);

		const result = setGroupSectionMembership(allGrouped, shortGroup, ['A']);
		expect(result.map((entry) => entry.name).sort()).toEqual(
			['A Long', 'A Short', 'B', 'B Long'].sort()
		);
		expect(baseNamesWithGroup(result, 'Short')).toEqual(['A']);
	});

	it('clearing membership removes the group from all sections', () => {
		const allGrouped = applyGroupsToAllSections(
			[
				section('A', [
					{ id: 'a1', length: 1000 },
					{ id: 'a2', length: 5000 }
				])
			],
			[shortGroup, longGroup]
		);

		const result = setGroupSectionMembership(allGrouped, shortGroup, []);
		expect(result.map((entry) => entry.name).sort()).toEqual(['A', 'A Long'].sort());
		expect(baseNamesWithGroup(result, 'Short')).toEqual([]);
	});

	it('does not create a group when no marks fall in the length range', () => {
		const narrow: LengthGroup = {
			...shortGroup,
			name: 'Tiny',
			minLength: 10,
			maxLength: 50
		};
		const input = [
			section('A', [
				{ id: 'a1', length: 2000 },
				{ id: 'a2', length: 5000 }
			])
		];
		const result = setGroupSectionMembership(input, narrow, ['A']);
		expect(result.map((entry) => entry.name)).toEqual(['A']);
		expect(result[0].marks.map((mark) => mark.id).sort()).toEqual(['a1', 'a2']);
		expect(result[0].groupName).toBeUndefined();
	});

	it('counts matching marks for a selective selection', () => {
		const input = [
			section('A', [
				{ id: 'a1', length: 1000 },
				{ id: 'a2', length: 5000 }
			]),
			section('B', [{ id: 'b1', length: 1500 }])
		];
		expect(countMatchingMarksInSelection(input, shortGroup, ['A'])).toEqual({
			matchingMarks: 1,
			selectedSections: 1,
			sectionsWithMatches: 1
		});
		expect(countMatchingMarksInSelection(input, shortGroup, ['A', 'B'])).toEqual({
			matchingMarks: 2,
			selectedSections: 2,
			sectionsWithMatches: 2
		});
	});

	it('collapses grouped sections back to base', () => {
		const grouped = applyGroupsToAllSections(
			[
				section('HT ANGLE 90X90X5', [
					{ id: 'm1', length: 2000 },
					{ id: 'm2', length: 5000 }
				])
			],
			[shortGroup, longGroup]
		);
		const base = collapseToBaseSections(grouped);
		expect(base).toHaveLength(1);
		expect(base[0].name).toBe('HT ANGLE 90X90X5');
		expect(base[0].marks.map((mark) => mark.id).sort()).toEqual(['m1', 'm2']);
	});

	it('rejects overlapping or duplicate group drafts', () => {
		expect(
			canSaveLengthGroupDraft({ name: 'Mid', minLength: 2500, maxLength: 4000 }, [
				shortGroup,
				longGroup
			])
		).toBe(false);
		expect(
			canSaveLengthGroupDraft({ name: 'Short', minLength: 10000, maxLength: 12000 }, [shortGroup])
		).toBe(false);
		expect(
			canSaveLengthGroupDraft({ name: 'Mid', minLength: 4000, maxLength: 5000 }, [shortGroup])
		).toBe(true);
	});
});
