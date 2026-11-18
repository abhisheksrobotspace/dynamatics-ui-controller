import { parseSectionMetadata } from './section-rules';
import type { MarkData, SectionData } from './types';

export type BomCsvRow = Record<string, unknown>;

const COLUMN_ALIASES = {
	section: ['section', 'section name', 'cross section', 'profile'],
	partLength: ['part length mm', 'part length', 'length mm', 'length', 'part length in mm'],
	qty: ['qty', 'quantity', 'no of pcs', 'no of pieces', 'number of pcs', 'number of pieces'],
	mark: ['mark number', 'mark no', 'mark no.', 'mark no', 'mark'],
	unitWeight: ['unit wt kg mtr', 'unit wt kg/mtr', 'unit weight kg mtr', 'unit weight', 'unit wt'],
	weightPerPiece: [
		'wt pc black kgs',
		'wt/pc black (kgs)',
		'wt pc black',
		'weight per piece',
		'wt pc'
	]
} as const;

function normHeader(value: unknown): string {
	return String(value ?? '')
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

function resolveColumn(headers: string[], accepted: readonly string[]): string | null {
	for (const candidate of accepted) {
		const normalized = normHeader(candidate);
		const exact = headers.find((header) => header === normalized);
		if (exact) return exact;
	}

	for (const header of headers) {
		for (const candidate of accepted) {
			if (header.includes(normHeader(candidate))) return header;
		}
	}

	return null;
}

export function normalizeBomSectionName(section: string): string {
	const tokens = section.trim().replace(/\s+/g, ' ').split(' ');
	if (tokens.length >= 5 && tokens[0] === tokens[2] && tokens[1] === tokens[3]) {
		tokens.splice(0, 2);
	} else if (tokens.length >= 3 && tokens[0] === tokens[1]) {
		tokens.splice(0, 1);
	}

	return tokens.join(' ').toUpperCase().replace(/X/g, 'x');
}

/** True when a plan/run section key covers a BOM base section (exact or length-group suffix). */
export function planSectionCoversBomSection(
	bomSectionName: string,
	planSectionName: string
): boolean {
	const normalizedBom = normalizeBomSectionName(bomSectionName);
	const normalizedPlan = normalizeBomSectionName(planSectionName);
	if (!normalizedBom || !normalizedPlan) return false;
	return normalizedPlan === normalizedBom || normalizedPlan.startsWith(`${normalizedBom} `);
}

function parseThicknessMm(section: string): number {
	const match = section.trim().match(/x\s*(\d+)\s*$/i);
	return match ? Number(match[1]) : 0;
}

function parseFlangeMm(section: string): number {
	const match = section.match(/(\d+)\s*[x×]\s*(\d+)/i);
	return match ? Number(match[1]) : 0;
}

function slugify(value: string): string {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

function parseNumber(value: unknown): number | null {
	if (value == null || value === '') return null;
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : null;
}

function rowValue(row: BomCsvRow, header: string | null): unknown {
	if (!header) return null;
	return row[header] ?? row[Object.keys(row).find((key) => normHeader(key) === header) ?? ''];
}

function resolveUnitWeightKgPerM(
	unitWeightRaw: unknown,
	lengthMm: number,
	weightPerPieceRaw: unknown
): number | null {
	const unitWeight = parseNumber(unitWeightRaw);
	if (unitWeight != null && unitWeight > 0) return unitWeight;

	const weightPerPiece = parseNumber(weightPerPieceRaw);
	if (weightPerPiece != null && weightPerPiece > 0 && lengthMm > 0) {
		return weightPerPiece / (lengthMm / 1000);
	}

	return null;
}

function rememberSectionUnitWeight(
	unitWeightBySection: Map<string, number>,
	sectionName: string,
	unitWeight: number | null
) {
	if (unitWeight == null || unitWeight <= 0) return;

	const existing = unitWeightBySection.get(sectionName);
	if (existing == null || unitWeight > existing) {
		unitWeightBySection.set(sectionName, unitWeight);
	}
}

export function parseBomCsvRows(rows: BomCsvRow[]): { sections: SectionData[]; error?: string } {
	if (!rows.length) {
		return { sections: [], error: 'CSV file is empty.' };
	}

	const headers = Object.keys(rows[0]).map((key) => normHeader(key));
	const headerMap = Object.fromEntries(Object.keys(rows[0]).map((key) => [normHeader(key), key]));
	const sectionKey = resolveColumn(headers, COLUMN_ALIASES.section);
	const lengthKey = resolveColumn(headers, COLUMN_ALIASES.partLength);
	const qtyKey = resolveColumn(headers, COLUMN_ALIASES.qty);
	const markKey = resolveColumn(headers, COLUMN_ALIASES.mark);
	const unitWeightKey = resolveColumn(headers, COLUMN_ALIASES.unitWeight);
	const weightPerPieceKey = resolveColumn(headers, COLUMN_ALIASES.weightPerPiece);

	if (!sectionKey || !lengthKey || !markKey) {
		return {
			sections: [],
			error: 'CSV is missing required columns (Section, Length, Mark No).'
		};
	}

	const sectionHeader = headerMap[sectionKey];
	const lengthHeader = headerMap[lengthKey];
	const qtyHeader = qtyKey ? headerMap[qtyKey] : null;
	const markHeader = headerMap[markKey];
	const unitWeightHeader = unitWeightKey ? headerMap[unitWeightKey] : null;
	const weightPerPieceHeader = weightPerPieceKey ? headerMap[weightPerPieceKey] : null;

	const marksBySection = new Map<string, MarkData[]>();
	const unitWeightBySection = new Map<string, number>();

	for (const [rowIndex, row] of rows.entries()) {
		const sectionRaw = rowValue(row, sectionHeader);
		const lengthRaw = rowValue(row, lengthHeader);
		const qtyRaw = qtyHeader ? rowValue(row, qtyHeader) : 1;
		const markRaw = rowValue(row, markHeader);

		if (sectionRaw == null || lengthRaw == null) continue;

		const sectionName = normalizeBomSectionName(String(sectionRaw));
		if (!sectionName.includes('ANGLE')) continue;

		const length = parseNumber(lengthRaw);
		const qty = parseNumber(qtyRaw) ?? 1;
		if (!length || length <= 0 || qty <= 0) continue;

		const sectionId = slugify(sectionName);
		const markName = String(markRaw ?? '').trim() || 'Unmarked';
		const markId = `${sectionId}-${slugify(markName)}-${length}-${rowIndex}`;

		const marks = marksBySection.get(sectionName) ?? [];
		marks.push({
			id: markId,
			sectionId,
			markName,
			length: Math.round(length),
			qty: Math.round(qty)
		});
		marksBySection.set(sectionName, marks);

		if (unitWeightHeader || weightPerPieceHeader) {
			const unitWeight = resolveUnitWeightKgPerM(
				unitWeightHeader ? rowValue(row, unitWeightHeader) : null,
				Math.round(length),
				weightPerPieceHeader ? rowValue(row, weightPerPieceHeader) : null
			);
			rememberSectionUnitWeight(unitWeightBySection, sectionName, unitWeight);
		}
	}

	if (marksBySection.size === 0) {
		return { sections: [], error: 'No angle sections found in CSV.' };
	}

	const sections = [...marksBySection.entries()]
		.map(([name, marks]) => {
			const sortedMarks = [...marks].sort((a, b) => b.length - a.length);
			parseSectionMetadata(name, parseFlangeMm(name));
			return {
				id: slugify(name),
				name,
				flange: parseFlangeMm(name),
				thickness: parseThicknessMm(name),
				unitWeightKgPerM: unitWeightBySection.get(name),
				marks: sortedMarks
			} satisfies SectionData;
		})
		.sort((a, b) => a.name.localeCompare(b.name));

	return { sections };
}
