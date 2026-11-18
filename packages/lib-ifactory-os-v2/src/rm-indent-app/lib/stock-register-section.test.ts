import { describe, expect, it } from 'vitest';
import {
	formatApplyUploadSummaryParts,
	formatBomSectionLabel,
	NO_BOM_SECTION_LABEL
} from './stock-register.api';

describe('formatBomSectionLabel', () => {
	it('returns the BOM section as stored on the line', () => {
		expect(formatBomSectionLabel('HT ANGLE 75X75X5')).toBe('HT ANGLE 75X75X5');
	});

	it('labels null/blank as No BOM section', () => {
		expect(formatBomSectionLabel(null)).toBe(NO_BOM_SECTION_LABEL);
		expect(formatBomSectionLabel('')).toBe(NO_BOM_SECTION_LABEL);
		expect(formatBomSectionLabel('   ')).toBe(NO_BOM_SECTION_LABEL);
	});
});

describe('formatApplyUploadSummaryParts', () => {
	it('surfaces rows_without_bom_section from the apply result', () => {
		const parts = formatApplyUploadSummaryParts({
			result: {
				rows_imported: 10,
				rows_rejected: 0,
				lines_zeroed: 0,
				locks_released: 0,
				projects: [{ rows_without_bom_section: 3 }, { rows_without_bom_section: 1 }]
			},
			projectMapSize: 2
		});
		expect(parts).toContain('4 rows imported with no BOM section');
	});
});
