import { describe, expect, it } from 'vitest';
import {
	buildBomNumericMap,
	numericFromMark,
	validateBomMarkEntry,
	type BomNumericMap
} from './ocr-mark-edit';
import type { OcrResultRow, PdfJob } from './ocr.types';

function pdfWithRow(row: OcrResultRow): PdfJob[] {
	return [
		{
			id: 'pdf-1',
			filename: 'd.pdf',
			status: 'completed',
			samples: [],
			roi: null,
			results: [row]
		}
	];
}

describe('validateBomMarkEntry', () => {
	const map: BomNumericMap = buildBomNumericMap(
		[
			{ numeric: '26', suffix: '26', full: 'JA34 KNA 26' },
			{ numeric: '26', suffix: '26H', full: 'JA34 KNA 26H' },
			{ numeric: '602', suffix: '602H', full: 'JA34 KNA 602H' }
		],
		{ '26': 'JA34 KNA 26', '26H': 'JA34 KNA 26H', '602H': 'JA34 KNA 602H' }
	);

	it('accepts a known BOM mark even when row suggestions are for a different numeric', () => {
		const row: OcrResultRow = {
			id: 'r1',
			page: 12,
			operations: 1,
			mark_number: 'A38 KNA 26',
			extracted_number: '26',
			bom_match_status: 'DUPLICATE_SUFFIX',
			bom_mark_number: '-',
			bom_suggestions: ['JA34 KNA 26', 'JA34 KNA 26H']
		};

		expect(validateBomMarkEntry(pdfWithRow(row), 'r1', 'JA34 KNA 602H', map)).toBeNull();
	});

	it('rejects a mark that is not on the BOM', () => {
		const row: OcrResultRow = {
			id: 'r1',
			page: 1,
			operations: 1,
			mark_number: 'X',
			extracted_number: '26',
			bom_match_status: 'DUPLICATE_SUFFIX',
			bom_mark_number: '-',
			bom_suggestions: ['JA34 KNA 26']
		};

		expect(validateBomMarkEntry(pdfWithRow(row), 'r1', 'JA34 KNA 999H', map)).toBe(
			'BOM marking "JA34 KNA 999H" was not found in the BOM'
		);
	});
});

describe('numericFromMark', () => {
	it('reads the trailing digit run', () => {
		expect(numericFromMark('JA34 KNA 602H')).toBe('602');
		expect(numericFromMark('A38 KNA 26')).toBe('26');
	});
});
