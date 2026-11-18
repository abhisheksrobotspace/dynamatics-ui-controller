import type { OcrResultRow, PdfJob } from './ocr.types';
import { BOM_MATCH_STATUS } from './ocr.constants.js';

export type BomMark = {
	numeric: string;
	suffix: string;
	full: string;
};

export type BomNumericMap = Record<string, string[]> & {
	_suffixMap?: Record<string, string>;
};

export function buildBomNumericMap(
	marks: BomMark[],
	suffixMap: Record<string, string> = {}
): BomNumericMap {
	const map: BomNumericMap = {};
	for (const mark of marks) {
		if (!map[mark.numeric]) map[mark.numeric] = [];
		map[mark.numeric].push(mark.full);
	}
	map._suffixMap = suffixMap;
	return map;
}

/** BOM mark options for a duplicate-suffix row (PoC sets this; core mode derives from the numeric map). */
export function bomSuggestionsForRow(row: OcrResultRow, bomNumericMap: BomNumericMap): string[] {
	if (row.bom_suggestions?.length) return [...row.bom_suggestions];
	if (row.bom_match_status !== 'DUPLICATE_SUFFIX') return [];

	return bomSuggestionsForNumeric(row.extracted_number, bomNumericMap);
}

/** Trailing digit run from a mark (`JA34 KNA 602H` → `602`). */
export function numericFromMark(mark: string | null | undefined): string | null {
	const trimmed = mark?.trim();
	if (!trimmed) return null;
	const match = /([0-9]+)[A-Za-z]*$/i.exec(trimmed);
	return match?.[1] ?? null;
}

export function bomSuggestionsForNumeric(
	numeric: string | null | undefined,
	bomNumericMap: BomNumericMap
): string[] {
	const key = numeric?.trim();
	if (!key) return [];
	const candidates = bomNumericMap[key];
	return Array.isArray(candidates) ? [...candidates] : [];
}

export function enrichPdfResultsWithBomSuggestions(
	pdfs: PdfJob[],
	bomNumericMap: BomNumericMap
): PdfJob[] {
	return pdfs.map((pdf) => ({
		...pdf,
		results: (pdf.results ?? []).map((row) => {
			const suggestions = bomSuggestionsForRow(row, bomNumericMap);
			if (!suggestions.length) return row;
			return { ...row, bom_suggestions: suggestions };
		})
	}));
}

export function ensureResultRowIds(pdfs: PdfJob[]): PdfJob[] {
	return pdfs.map((pdf) => ({
		...pdf,
		results: (pdf.results || []).map((row) => ({
			...row,
			id: row.id ?? crypto.randomUUID()
		}))
	}));
}

function cloneRow(row: OcrResultRow): OcrResultRow {
	return {
		...row,
		bom_suggestions: row.bom_suggestions ? [...row.bom_suggestions] : undefined
	};
}

function clonePdfs(pdfs: PdfJob[]): PdfJob[] {
	return pdfs.map((pdf) => ({
		...pdf,
		samples: pdf.samples.map((sample) => ({ ...sample })),
		roi: pdf.roi ? { ...pdf.roi } : null,
		results: (pdf.results || []).map(cloneRow)
	}));
}

export function findResultRow(
	pdfs: PdfJob[],
	rowId: string
): { pdf: PdfJob | null; row: OcrResultRow | null } {
	for (const pdf of pdfs) {
		const row = (pdf.results || []).find((entry) => entry.id === rowId);
		if (row) return { pdf, row };
	}
	return { pdf: null, row: null };
}

/** Remove one result row from in-memory PdfJob[] (after DB delete or PoC session edit). */
export function removeResultRow(pdfs: PdfJob[], rowId: string): PdfJob[] {
	return pdfs.map((pdf) => ({
		...pdf,
		results: (pdf.results ?? []).filter((row) => row.id !== rowId)
	}));
}

function collectMatchedBomMarks(pdfs: PdfJob[], excludeRowId?: string): Set<string> {
	const matched = new Set<string>();
	for (const pdf of pdfs) {
		for (const row of pdf.results || []) {
			if (excludeRowId && row.id === excludeRowId) continue;
			if (
				row.bom_match_status === 'MATCHED' &&
				row.bom_mark_number &&
				row.bom_mark_number !== '-'
			) {
				matched.add(row.bom_mark_number);
			}
		}
	}
	return matched;
}

export function validateBomMarkNotAlreadyMatched(
	pdfs: PdfJob[],
	excludeRowId: string,
	bomMark: string
): string | null {
	if (collectMatchedBomMarks(pdfs, excludeRowId).has(bomMark)) {
		return `BOM marking "${bomMark}" is already matched`;
	}
	return null;
}

function isKnownBomMark(bomMark: string, bomNumericMap: BomNumericMap): boolean {
	const needle = bomMark.trim();
	if (!needle) return false;
	const needleUpper = needle.toUpperCase();
	const suffixMap = bomNumericMap._suffixMap || {};
	for (const value of Object.values(suffixMap)) {
		if (value === needle || value.toUpperCase() === needleUpper) return true;
	}
	for (const [key, candidates] of Object.entries(bomNumericMap)) {
		if (key === '_suffixMap') continue;
		if (!Array.isArray(candidates)) continue;
		if (candidates.some((mark) => mark === needle || mark.toUpperCase() === needleUpper)) {
			return true;
		}
	}
	return false;
}

export function validateBomMarkEntry(
	pdfs: PdfJob[],
	rowId: string,
	bomMark: string,
	bomNumericMap: BomNumericMap
): string | null {
	const trimmed = bomMark.trim();
	if (!trimmed) return null;

	const { row } = findResultRow(pdfs, rowId);
	if (!row) return null;

	// Accept any mark that exists on the BOM. `bom_suggestions` is a shortcut for
	// duplicate-suffix rows; it must not block typing a different full mark after the
	// user corrects the sketch (e.g. OCR read "26", sketch is "602H").
	if (!isKnownBomMark(trimmed, bomNumericMap)) {
		return `BOM marking "${trimmed}" was not found in the BOM`;
	}

	return validateBomMarkNotAlreadyMatched(pdfs, rowId, trimmed);
}

export function validateManualMarkEntry(
	pdfs: PdfJob[],
	rowId: string,
	newMark: string,
	bomNumericMap: BomNumericMap
): string | null {
	return validateBomMarkEntry(pdfs, rowId, newMark, bomNumericMap);
}

function cascadeResolution(
	pdf: PdfJob,
	numericKey: string,
	resolvedBomMark: string,
	excludeRowId: string
) {
	for (const sibling of pdf.results || []) {
		if (sibling.id === excludeRowId) continue;
		if (sibling.extracted_number !== numericKey) continue;
		if (sibling.bom_match_status !== 'DUPLICATE_SUFFIX') continue;

		if (sibling.bom_suggestions) {
			sibling.bom_suggestions = sibling.bom_suggestions.filter((s) => s !== resolvedBomMark);
			if (sibling.bom_suggestions.length === 1) {
				const autoMatch = sibling.bom_suggestions[0];
				sibling.bom_match_status = 'MATCHED';
				sibling.bom_mark_number = autoMatch;
				sibling.bom_suggestions = [];
			}
		}
	}
}

export function pickBomSuggestion(
	pdfs: PdfJob[],
	rowId: string,
	bomFullMark: string
): PdfJob[] | null {
	const conflict = validateBomMarkNotAlreadyMatched(pdfs, rowId, bomFullMark);
	if (conflict) return null;

	const next = clonePdfs(pdfs);
	const { pdf, row } = findResultRow(next, rowId);
	if (!pdf || !row) return pdfs;

	const numericKey = row.extracted_number;
	row.bom_match_status = 'MATCHED';
	row.bom_mark_number = bomFullMark;

	if (numericKey) {
		cascadeResolution(pdf, numericKey, bomFullMark, rowId);
	}

	return next;
}

export function saveMarkEdit(
	pdfs: PdfJob[],
	rowId: string,
	sketchMark: string,
	bomMark: string,
	bomNumericMap: BomNumericMap
): PdfJob[] | null {
	const sketchTrim = sketchMark.trim();
	const bomTrim = bomMark.trim();

	if (bomTrim) {
		const conflict = validateBomMarkEntry(pdfs, rowId, bomTrim, bomNumericMap);
		if (conflict) return null;
	}

	const next = clonePdfs(pdfs);
	const { pdf, row } = findResultRow(next, rowId);
	if (!pdf || !row) return pdfs;

	if (!sketchTrim) {
		row.corrected_mark = null;
		row.mark_number = 'NOT_FOUND';
		row.extracted_number = null;
		row.bom_match_status = 'OCR NOT FOUND';
		row.bom_mark_number = '-';
		return next;
	}

	row.corrected_mark = sketchTrim;
	row.mark_number = sketchTrim;
	const numMatch = sketchTrim.match(/([0-9]+)[A-Za-z]*$/i);
	row.extracted_number = numMatch ? numMatch[1] : null;

	if (!bomTrim) {
		row.bom_match_status = 'MISSING IN BOM';
		row.bom_mark_number = '-';
		return next;
	}

	row.bom_match_status = 'MATCHED';
	row.bom_mark_number = bomTrim;
	if (row.extracted_number) {
		cascadeResolution(pdf, row.extracted_number, bomTrim, rowId);
	}

	return next;
}

export function isOcrNotFoundStatus(row: OcrResultRow): boolean {
	const status = row.bom_match_status ?? '';
	return status === 'NOT FOUND' || status === 'OCR NOT FOUND';
}

/** Table sort: NOT FOUND first, then duplicate, then other issues, then matched. */
export function operationsCountStatusSortPriority(row: OcrResultRow): number {
	if (isOcrNotFoundStatus(row)) return 0;
	if (row.bom_match_status === 'DUPLICATE_SUFFIX') return 1;
	if (row.bom_match_status === 'MATCHED') return 3;
	return 2;
}

export function isNotFoundMark(row: OcrResultRow): boolean {
	return isOcrNotFoundStatus(row) || row.bom_match_status === BOM_MATCH_STATUS.MISSING_IN_SKETCH;
}

function sketchDisplayCandidate(
	value: string | null | undefined,
	rawText: string | undefined
): string | null {
	const trimmed = value?.trim();
	if (!trimmed) return null;
	const raw = rawText?.trim();
	if (raw && trimmed === raw) return null;
	return trimmed;
}

/** Sketch mark for table/export - prefers user correction over OCR sketch_mark; never ocr_raw. */
export function displaySketchMark(row: OcrResultRow): string {
	if (isNotFoundMark(row)) return '-';
	const corrected = sketchDisplayCandidate(row.corrected_mark, row.raw_text);
	if (corrected) return corrected;
	const sketch = sketchDisplayCandidate(row.sketch_mark, row.raw_text);
	if (sketch) return sketch;
	const mark = sketchDisplayCandidate(row.mark_number, row.raw_text);
	if (mark && mark !== 'NOT_FOUND') return mark;
	return '-';
}

/** Initial sketch field value for the mark-edit dialog. */
export function initialSketchMarkValue(row: OcrResultRow): string {
	if (isNotFoundMark(row)) return '';
	const label = displaySketchMark(row);
	return label === '-' ? '' : label;
}

/** Initial BOM field value for the mark-edit dialog. */
export function initialBomMarkValue(row: OcrResultRow): string {
	const bom = row.bom_mark_number?.trim();
	return bom && bom !== '-' ? bom : '';
}

/** Full OCR readout when it differs from the displayed sketch mark. */
export function ocrSketchReadLabel(row: OcrResultRow): string | null {
	const raw = row.raw_text?.trim();
	if (!raw) return null;
	const shown = displaySketchMark(row);
	if (shown === '-' || raw === shown) return null;
	return raw;
}

export function isMarkEditable(row: OcrResultRow): boolean {
	const status = row.bom_match_status ?? '';
	return (
		status === 'MATCHED' ||
		status === 'DUPLICATE_SUFFIX' ||
		status === 'OCR NOT FOUND' ||
		status === 'MISSING IN BOM'
	);
}

function rowMatchFingerprint(row: OcrResultRow): string {
	return [
		row.bom_match_status ?? '',
		row.bom_mark_number ?? '',
		(row.corrected_mark ?? '').trim(),
		(row.mark_number ?? '').trim()
	].join('\0');
}

/** Rows whose mark-match fields changed (includes duplicate-suffix cascade siblings). */
export function findMarkMatchChangedRows(before: PdfJob[], after: PdfJob[]): OcrResultRow[] {
	const beforeById = new Map<string, OcrResultRow>();
	for (const pdf of before) {
		for (const row of pdf.results ?? []) {
			if (row.id) beforeById.set(row.id, row);
		}
	}

	const changed: OcrResultRow[] = [];
	for (const pdf of after) {
		for (const row of pdf.results ?? []) {
			if (!row.id) continue;
			const prev = beforeById.get(row.id);
			if (!prev || rowMatchFingerprint(prev) !== rowMatchFingerprint(row)) {
				changed.push(row);
			}
		}
	}
	return changed;
}
