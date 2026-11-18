import { BOM_MATCH_STATUS } from './ocr.constants.js';
import { displaySketchMark } from './ocr-mark-edit.js';
import type { OcrResultRow, PdfJob } from './ocr.types';

/** Minimal BOM item fields needed for Operations Count CSV export. */
export type OcrCsvBomItem = {
	mark_no: string;
	material_grade?: string | null;
	section?: string | null;
	width_mm?: number | null;
	length_mm?: number | null;
	unit_weight?: number | null;
	weight_per_piece?: number | null;
	num_pieces?: number | null;
	total_weight?: number | null;
};

export const OPERATIONS_COUNT_CSV_HEADERS = [
	'Page No',
	'BoM Mark No',
	'Sketch Mark No',
	'HT/MS',
	'Section',
	'Width',
	'Length',
	'Operations',
	'Unit Wt kg/Mtr',
	'Wt/Pc Black (Kgs)',
	'No of Pcs',
	'Weight in Kgs(black)',
	'Status'
] as const;

type CsvValue = string | number | null | undefined;

function csvCell(value: CsvValue): string {
	const text = value == null ? '' : String(value);
	return `"${text.replace(/"/g, '""')}"`;
}

function resolvedBomMark(row: OcrResultRow): string | null {
	const mark = row.bom_mark_number?.trim();
	if (!mark || mark === '-' || mark === '-') return null;
	return mark;
}

function sketchMark(row: OcrResultRow): string {
	const label = displaySketchMark(row);
	return label === '-' ? '' : label;
}

function bomValue(value: CsvValue): CsvValue {
	return value ?? '';
}

export function buildOperationsCountCsv(pdfs: PdfJob[], bomItems: OcrCsvBomItem[]): string {
	const bomItemByMark = new Map<string, OcrCsvBomItem>();
	for (const item of bomItems) {
		const mark = item.mark_no.trim();
		if (mark && !bomItemByMark.has(mark)) bomItemByMark.set(mark, item);
	}

	const lines = [OPERATIONS_COUNT_CSV_HEADERS.map(csvCell).join(',')];
	for (const pdf of pdfs) {
		for (const row of pdf.results ?? []) {
			const mark = resolvedBomMark(row);
			const item = mark ? bomItemByMark.get(mark) : undefined;
			const cells: CsvValue[] = [
				row.bom_match_status === BOM_MATCH_STATUS.MISSING_IN_SKETCH ? '' : row.page,
				mark ?? '',
				sketchMark(row),
				bomValue(item?.material_grade),
				bomValue(item?.section),
				bomValue(item?.width_mm),
				bomValue(item?.length_mm),
				row.hole_count ?? 0,
				bomValue(item?.unit_weight),
				bomValue(item?.weight_per_piece),
				bomValue(item?.num_pieces),
				bomValue(item?.total_weight),
				row.bom_match_status ?? ''
			];
			lines.push(cells.map(csvCell).join(','));
		}
	}

	return lines.join('\r\n');
}
