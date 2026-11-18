import { parseSectionMetadata } from './section-rules';
import { formatDisplayWeight } from './display-units';
import type { MarkData, SectionData } from './types';

export function formatSectionDimensions(
	sectionName: string,
	flange: number,
	thickness: number
): string {
	const tripleMatch = sectionName.match(/(\d+)\s*[x×]\s*(\d+)\s*[x×]\s*(\d+)/i);
	if (tripleMatch) {
		return `${tripleMatch[1]}×${tripleMatch[2]}×${tripleMatch[3]}`;
	}

	const pairMatch = sectionName.match(/(\d+)\s*[x×]\s*(\d+)/i);
	if (pairMatch && thickness > 0) {
		return `${pairMatch[1]}×${pairMatch[2]}×${thickness}`;
	}

	const { size } = parseSectionMetadata(sectionName, flange);
	return `${size.replace(/x/gi, '×')}×${thickness}`;
}

export function countSectionMarks(marks: MarkData[]): number {
	return marks.length;
}

export function countSelectedMarks(marks: MarkData[], selectedMarkIds: string[]): number {
	return marks.filter((mark) => selectedMarkIds.includes(mark.id)).length;
}

export function isSectionIncluded(marks: MarkData[], selectedMarkIds: string[]): boolean {
	return marks.some((mark) => selectedMarkIds.includes(mark.id));
}

export function formatSectionWeightLabel(section: SectionData, selectedMarkIds: string[]): string {
	const unitWeightKgPerM = section.unitWeightKgPerM;
	if (!unitWeightKgPerM || unitWeightKgPerM <= 0) return '-';

	let totalLengthMm = 0;
	for (const mark of section.marks) {
		if (!selectedMarkIds.includes(mark.id)) continue;
		totalLengthMm += mark.length * mark.qty;
	}

	if (totalLengthMm <= 0) return '-';
	const weightKg = (totalLengthMm / 1000) * unitWeightKgPerM;
	return formatDisplayWeight(Math.round(weightKg), { kgDecimals: 0 });
}

/** Prefer BOM `total_weight`; fall back to length × qty × unit kg/m when missing. */
export function formatMarkWeightKg(mark: MarkData, unitWeightKgPerM?: number): string {
	if (mark.totalWeightKg != null && mark.totalWeightKg > 0) {
		return formatDisplayWeight(Math.round(mark.totalWeightKg), { kgDecimals: 0 });
	}
	if (!unitWeightKgPerM || unitWeightKgPerM <= 0) return '-';
	const weightKg = (mark.length / 1000) * mark.qty * unitWeightKgPerM;
	if (!Number.isFinite(weightKg) || weightKg <= 0) return '-';
	return formatDisplayWeight(Math.round(weightKg), { kgDecimals: 0 });
}

export function filterSections<T extends { name: string }>(sections: T[], query: string): T[] {
	const normalized = query.trim().toLowerCase();
	if (!normalized) return sections;
	return sections.filter((section) => section.name.toLowerCase().includes(normalized));
}

export type SectionsSelectionSummary = {
	includedSections: number;
	totalSections: number;
	selectedMarks: number;
	weightLabel: string;
};

export function summarizeSectionsSelection(
	sections: SectionData[],
	selectedMarkIds: string[]
): SectionsSelectionSummary {
	const includedSections = sections.filter((section) =>
		isSectionIncluded(section.marks, selectedMarkIds)
	);

	let totalWeightKg = 0;
	let hasWeight = false;

	for (const section of includedSections) {
		const unitWeightKgPerM = section.unitWeightKgPerM;
		if (!unitWeightKgPerM || unitWeightKgPerM <= 0) continue;

		for (const mark of section.marks) {
			if (!selectedMarkIds.includes(mark.id)) continue;
			totalWeightKg += (mark.length / 1000) * mark.qty * unitWeightKgPerM;
			hasWeight = true;
		}
	}

	return {
		includedSections: includedSections.length,
		totalSections: sections.length,
		selectedMarks: selectedMarkIds.length,
		weightLabel: hasWeight ? formatDisplayWeight(Math.round(totalWeightKg), { kgDecimals: 0 }) : '-'
	};
}
