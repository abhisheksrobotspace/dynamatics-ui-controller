import {
	STOCK_REGISTER_CSV_COLUMNS,
	STOCK_REGISTER_CSV_FILE_COLUMNS,
	STOCK_REGISTER_CSV_SCHEMA,
	type StockRegisterColumn,
	type StockRegisterRow
} from './stock-register.types';

function headerToSnake(header: string): string {
	return header
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_|_$/g, '');
}

const COLUMN_ALIASES = new Map<string, StockRegisterColumn>([
	...STOCK_REGISTER_CSV_SCHEMA.flatMap(
		({ key, header }) =>
			[
				[key, key],
				[header, key],
				[header.toUpperCase(), key],
				[header.toLowerCase(), key],
				[key.replace(/_/g, ' '), key],
				[headerToSnake(header), key]
			] as const
	),
	// Legacy / Excel source headers → new schema keys
	['project #', 'project'],
	['project_no', 'project'],
	['description', 'section'],
	['name', 'section'],
	['bundle no', 'bundle_no'],
	['bundle no.', 'bundle_no']
]);

function normalizeHeader(header: string): string {
	return header.replace(/^\uFEFF/, '').trim();
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

function resolveColumn(header: string): StockRegisterColumn | null {
	const normalized = normalizeHeader(header);
	const upper = normalized.toUpperCase();

	return (
		COLUMN_ALIASES.get(normalized) ??
		COLUMN_ALIASES.get(upper) ??
		COLUMN_ALIASES.get(normalized.toLowerCase()) ??
		COLUMN_ALIASES.get(headerToSnake(normalized)) ??
		null
	);
}

function emptyRow(): Record<StockRegisterColumn, string> {
	return Object.fromEntries(STOCK_REGISTER_CSV_COLUMNS.map((column) => [column, ''])) as Record<
		StockRegisterColumn,
		string
	>;
}

function rowId(row: Record<StockRegisterColumn, string>, lineIndex: number): string {
	const section = row.section.trim();
	const bundleNo = row.bundle_no.trim();
	if (section && bundleNo) return `${section}-${bundleNo}`;
	if (section) return `${section}-${lineIndex}`;
	return `row-${lineIndex}`;
}

export class StockRegisterCsvError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'StockRegisterCsvError';
	}
}

export function parseStockRegisterCsv(csvText: string): StockRegisterRow[] {
	const lines = csvText.split(/\r?\n/).filter((line) => line.trim());
	if (lines.length === 0) {
		throw new StockRegisterCsvError('CSV file is empty.');
	}

	const headerCells = splitCsvLine(lines[0]);
	const columnIndexes = new Map<StockRegisterColumn, number>();

	for (let index = 0; index < headerCells.length; index += 1) {
		const column = resolveColumn(headerCells[index]);
		if (column && !columnIndexes.has(column)) {
			columnIndexes.set(column, index);
		}
	}

	const missingColumns = STOCK_REGISTER_CSV_FILE_COLUMNS.filter(
		(column) => !columnIndexes.has(column)
	);
	if (missingColumns.length > 0) {
		const labels = missingColumns.map(
			(column) => STOCK_REGISTER_CSV_SCHEMA.find((entry) => entry.key === column)?.header ?? column
		);
		throw new StockRegisterCsvError(`Missing required columns: ${labels.join(', ')}`);
	}

	const rows: StockRegisterRow[] = [];

	for (let lineIndex = 1; lineIndex < lines.length; lineIndex += 1) {
		const cells = splitCsvLine(lines[lineIndex]);
		if (cells.every((cell) => !cell.trim())) continue;

		const row = emptyRow();
		for (const column of STOCK_REGISTER_CSV_COLUMNS) {
			const cellIndex = columnIndexes.get(column);
			row[column] = cellIndex === undefined ? '' : (cells[cellIndex] ?? '').trim();
		}

		rows.push({
			...row,
			id: rowId(row, lineIndex)
		});
	}

	return rows;
}

export async function parseStockRegisterCsvFile(file: File): Promise<StockRegisterRow[]> {
	const text = await file.text();
	return parseStockRegisterCsv(text);
}
