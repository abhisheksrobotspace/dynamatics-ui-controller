import { describe, expect, it } from 'vitest';
import {
	applyDefaultLengthGroupsIfNeeded,
	resolveBaseSections,
	resolveVisibleSections
} from './sections-page';
import type { LengthGroup } from '../../../project-management-app/lib/store.svelte.js';
import type { CuttingPlanDraft, SectionData } from './types';

function section(name: string, opts?: Partial<SectionData>): SectionData {
	const id = `sec-${name}`;
	return {
		id,
		name,
		flange: 90,
		thickness: 5,
		marks: [
			{
				id: `${id}-m1`,
				sectionId: id,
				markName: 'M1',
				length: 1000,
				qty: 1
			}
		],
		...opts
	};
}

describe('sections-page draft restore', () => {
	const bom = [section('HT ANGLE 90X90X5'), section('HT ANGLE 100X100X8')];

	it('uses BOM when there is no draft', () => {
		expect(resolveVisibleSections(bom, null)).toEqual(bom);
		expect(resolveBaseSections(bom, null)).toEqual(bom);
	});

	it('restores draft sections so length groups survive round-trip', () => {
		const draft: CuttingPlanDraft = {
			selectedMarks: ['a'],
			sections: [
				section('HT ANGLE 90X90X5 0-500', {
					baseName: 'HT ANGLE 90X90X5',
					groupName: '0-500'
				}),
				section('HT ANGLE 90X90X5 501-3000', {
					baseName: 'HT ANGLE 90X90X5',
					groupName: '501-3000'
				})
			]
		};

		const visible = resolveVisibleSections(bom, draft);
		expect(visible).toHaveLength(2);
		expect(visible[0].groupName).toBe('0-500');
		expect(visible[1].groupName).toBe('501-3000');

		const base = resolveBaseSections(bom, draft);
		expect(base.map((entry) => entry.name)).toEqual(['HT ANGLE 90X90X5', 'HT ANGLE 100X100X8']);
	});

	it('applies length groups by default on a fresh load', () => {
		const bom = [
			section('HT ANGLE 90X90X5', {
				marks: [
					{
						id: 'm-short',
						sectionId: 'sec-HT ANGLE 90X90X5',
						markName: 'M1',
						length: 400,
						qty: 1
					},
					{
						id: 'm-long',
						sectionId: 'sec-HT ANGLE 90X90X5',
						markName: 'M2',
						length: 2000,
						qty: 1
					}
				]
			})
		];
		const groups: LengthGroup[] = [
			{
				id: 'g1',
				projectId: 'p1',
				name: '0-500',
				minLength: 0,
				maxLength: 500,
				sortOrder: 0
			},
			{
				id: 'g2',
				projectId: 'p1',
				name: '501-3000',
				minLength: 501,
				maxLength: 3000,
				sortOrder: 1
			}
		];

		const grouped = applyDefaultLengthGroupsIfNeeded(bom, bom, groups, false);
		expect(grouped).toHaveLength(2);
		expect(grouped[0].groupName).toBe('0-500');
		expect(grouped[1].groupName).toBe('501-3000');
	});

	it('skips default grouping when a draft was restored', () => {
		const bom = [section('HT ANGLE 90X90X5')];
		const groups: LengthGroup[] = [
			{
				id: 'g1',
				projectId: 'p1',
				name: '0-500',
				minLength: 0,
				maxLength: 500,
				sortOrder: 0
			}
		];

		expect(applyDefaultLengthGroupsIfNeeded(bom, bom, groups, true)).toEqual(bom);
	});

	it('limits base sections for partial replan using baseName', () => {
		const draft: CuttingPlanDraft = {
			selectedMarks: ['a'],
			replanSectionsOnly: true,
			sections: [
				section('HT ANGLE 90X90X5 0-500', {
					baseName: 'HT ANGLE 90X90X5',
					groupName: '0-500'
				})
			]
		};

		expect(resolveBaseSections(bom, draft).map((entry) => entry.name)).toEqual([
			'HT ANGLE 90X90X5'
		]);
		expect(resolveVisibleSections(bom, draft)).toEqual(draft.sections);
	});
});
