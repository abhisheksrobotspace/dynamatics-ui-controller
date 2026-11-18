const REQUIRED_BOM_COLUMNS = [
	'Mark No',
	'HT/MS',
	'Section',
	'Width',
	'Length',
	'Unit Wt kg/Mtr',
	'Wt/Pc Black (Kgs)',
	'No of Pcs',
	'Weight in Kgs(black)',
	'Remark'
] as const;

const REQUIRED_COLUMN_KEYS = new Map(
	REQUIRED_BOM_COLUMNS.map((column) => [normalizeHeader(column), column])
);

function normalizeHeader(header: string): string {
	return header
		.replace(/^\uFEFF/, '')
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]/g, '');
}

function splitCsvLine(line: string): string[] {
	const columns: string[] = [];
	let current = '';
	let insideQuotes = false;

	for (let index = 0; index < line.length; index += 1) {
		const char = line[index];
		const nextChar = line[index + 1];

		if (char === '"') {
			if (insideQuotes && nextChar === '"') {
				current += '"';
				index += 1;
				continue;
			}
			insideQuotes = !insideQuotes;
			continue;
		}

		if (char === ',' && !insideQuotes) {
			columns.push(current.trim());
			current = '';
			continue;
		}

		current += char;
	}

	columns.push(current.trim());
	return columns;
}

function firstNonEmptyLine(csvText: string): string | null {
	const lines = csvText.split(/\r?\n/);
	for (const line of lines) {
		if (line.trim()) return line;
	}
	return null;
}

export type BomCsvValidationResult = {
	valid: boolean;
	missingColumns: string[];
};

export const BOM_CSV_FILE_ACCEPT = '.csv,text/csv';

export const BOM_CSV_MULTIPLE_FILES_ERROR = 'Only one BOM CSV file can be uploaded at a time.';

/** Read exactly one file from a BOM CSV file input; clears the input when multiple are chosen. */
export function readSingleBomCsvFromInput(
	input: HTMLInputElement
): { ok: true; file: File } | { ok: false; reason: 'empty' | 'multiple' } {
	const files = input.files;
	if (!files || files.length === 0) return { ok: false, reason: 'empty' };
	if (files.length > 1) {
		input.value = '';
		return { ok: false, reason: 'multiple' };
	}
	return { ok: true, file: files[0] };
}

export async function validateBomCsvHeaders(file: File): Promise<BomCsvValidationResult> {
	const text = await file.text();
	const headerLine = firstNonEmptyLine(text);
	if (!headerLine) {
		return { valid: false, missingColumns: [...REQUIRED_BOM_COLUMNS] };
	}

	const normalizedHeaders = new Set(splitCsvLine(headerLine).map(normalizeHeader).filter(Boolean));

	const missingColumns = [...REQUIRED_COLUMN_KEYS.entries()]
		.filter(([key]) => !normalizedHeaders.has(key))
		.map(([, label]) => label);

	return { valid: missingColumns.length === 0, missingColumns };
}
