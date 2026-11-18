import { describe, expect, it } from 'vitest';
import { buildSectionsStepDraft } from './replan-sections';
import type { SectionData } from './types';

function section(name: string, markId: string): SectionData {
	return {
		id: markId,
		name,
		flange: 75,
		thickness: 4,
		marks: [{ id: markId, sectionId: markId, markName: 'M1', length: 100, qty: 1 }]
	};
}

describe('buildSectionsStepDraft', () => {
	const allSections = [section('HT ANGLE 75X75X4', 'm1'), section('HT ANGLE 90X90X5', 'm2')];

	it('upgrades BOM-list replan with one section selected to partial replan', () => {
		const draft = buildSectionsStepDraft({
			existingDraft: {
				replanFromExisting: true,
				sections: allSections,
				selectedMarks: ['m1', 'm2']
			},
			sections: allSections,
			baseSections: allSections,
			selectedMarkIds: ['m1']
		});

		expect(draft.replanSectionsOnly).toBe(true);
		expect(draft.sections).toHaveLength(1);
		expect(draft.sections[0]?.name).toBe('HT ANGLE 75X75X4');
	});

	it('keeps full replan when every BOM section stays selected', () => {
		const draft = buildSectionsStepDraft({
			existingDraft: {
				replanFromExisting: true,
				sections: allSections,
				selectedMarks: ['m1', 'm2']
			},
			sections: allSections,
			baseSections: allSections,
			selectedMarkIds: ['m1', 'm2']
		});

		expect(draft.replanSectionsOnly).toBe(false);
		expect(draft.sections).toHaveLength(2);
	});

	it('does not upgrade a fresh plan with subset selection', () => {
		const draft = buildSectionsStepDraft({
			existingDraft: null,
			sections: allSections,
			baseSections: allSections,
			selectedMarkIds: ['m1']
		});

		expect(draft.replanSectionsOnly).toBe(false);
		expect(draft.sections).toHaveLength(2);
	});

	it('preserves useAvailableStockLengths from Lock single-section replan', () => {
		const draft = buildSectionsStepDraft({
			existingDraft: {
				replanFromExisting: true,
				replanSectionsOnly: true,
				useAvailableStockLengths: true,
				sections: [allSections[0]!],
				selectedMarks: ['m1']
			},
			sections: [allSections[0]!],
			baseSections: [allSections[0]!],
			selectedMarkIds: ['m1']
		});

		expect(draft.useAvailableStockLengths).toBe(true);
	});
});
