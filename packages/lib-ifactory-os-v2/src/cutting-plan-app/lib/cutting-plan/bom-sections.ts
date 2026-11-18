import { apiClient } from '../../../lib/api/api-client.js';
import { rowsFromEnvelope, type ApiEnvelope } from '../../../lib/api/types.js';
import { projBomItemsListPath } from '../../../project-management-app/lib/projects/proj-bom-items.constants.js';
import type { MarkData, SectionData } from './types';

export type LoadBomSectionsResult = {
	sections: SectionData[];
	error?: string;
};

/** Subset of `proj_bom_items` the cutting-plan sections view needs (numeric cols arrive as strings). */
type ProjBomItemRow = {
	bom_item_id: string;
	bom_id: string;
	section: string | null;
	mark_no: string | null;
	section_length_mm: number | string | null; // flange
	section_thickness_mm: number | string | null;
	length_mm: number | string | null;
	num_pieces: number | string | null;
	unit_weight: number | string | null;
	total_weight: number | string | null;
};

function num(value: number | string | null | undefined): number {
	if (value === null || value === undefined || value === '') return 0;
	const n = typeof value === 'number' ? value : Number(value);
	return Number.isFinite(n) ? n : 0;
}

/** Group `proj_bom_items` rows into the per-section shape the CP screens render. */
function buildSections(rows: ProjBomItemRow[]): SectionData[] {
	const bySection = new Map<string, SectionData>();

	for (const row of rows) {
		const name = (row.section ?? '').trim();
		if (!name) continue;

		let section = bySection.get(name);
		if (!section) {
			section = {
				id: name,
				name,
				flange: num(row.section_length_mm),
				thickness: num(row.section_thickness_mm),
				unitWeightKgPerM: num(row.unit_weight),
				marks: []
			};
			bySection.set(name, section);
		} else {
			// The UI uses the max unit weight per section (matches the bridge's plan-builder).
			section.unitWeightKgPerM = Math.max(section.unitWeightKgPerM ?? 0, num(row.unit_weight));
		}

		const mark: MarkData = {
			id: row.bom_item_id,
			sectionId: name,
			markName: row.mark_no ?? '',
			length: num(row.length_mm),
			qty: num(row.num_pieces),
			totalWeightKg: num(row.total_weight) || undefined
		};
		section.marks.push(mark);
	}

	return [...bySection.values()];
}

/**
 * Loads the BOM's sections + marks from core (`proj_bom_items`, the shared OCR+CP spine), grouped by
 * `section`. Fetches on each call — call when the page needs sections / kg/m.
 */
export async function loadBomSections(
	bomId: string,
	signal?: AbortSignal
): Promise<LoadBomSectionsResult> {
	try {
		const envelope = await apiClient.get<ApiEnvelope<ProjBomItemRow[]>>(
			apiClient.datahub(
				projBomItemsListPath({ bom_id: bomId, type: 'angle' }, { orderBy: 'row_number:asc' })
			),
			{ signal }
		);
		const rows = rowsFromEnvelope<ProjBomItemRow>(envelope.data);
		const sections = buildSections(rows);
		return {
			sections,
			error:
				sections.length === 0
					? 'No BOM items found for this BOM. Extract the BOM first, then try again.'
					: undefined
		};
	} catch (error) {
		return {
			sections: [],
			error: error instanceof Error ? error.message : 'Failed to load BOM items from core.'
		};
	}
}

export type LoadBomSectionNamesResult = {
	sectionNames: string[];
	error?: string;
};

/**
 * Slim fetch for publish eligibility — only `section` column, unique names.
 * Avoids pulling mark/weight payload used by the sections planner.
 */
export async function loadBomSectionNames(
	bomId: string,
	signal?: AbortSignal
): Promise<LoadBomSectionNamesResult> {
	try {
		const envelope = await apiClient.get<ApiEnvelope<Array<{ section?: string | null }>>>(
			apiClient.datahub(
				projBomItemsListPath(
					{ bom_id: bomId, type: 'angle' },
					{ select: 'section', orderBy: 'row_number:asc' }
				)
			),
			{ signal }
		);
		const names: string[] = [];
		const seen = new Set<string>();
		for (const row of rowsFromEnvelope(envelope.data)) {
			const name = (row.section ?? '').trim();
			if (!name || seen.has(name)) continue;
			seen.add(name);
			names.push(name);
		}
		return {
			sectionNames: names,
			error:
				names.length === 0
					? 'No BOM items found for this BOM. Extract the BOM first, then try again.'
					: undefined
		};
	} catch (error) {
		return {
			sectionNames: [],
			error: error instanceof Error ? error.message : 'Failed to load BOM sections from core.'
		};
	}
}

/**
 * Slim fetch for Summary / RM Required weight KPIs — `section` + `unit_weight` only.
 */
export async function loadBomUnitWeights(
	bomId: string,
	signal?: AbortSignal
): Promise<{
	unitWeightBySection: Record<string, number>;
	sectionNames: string[];
	error?: string;
}> {
	try {
		const envelope = await apiClient.get<
			ApiEnvelope<Array<{ section?: string | null; unit_weight?: number | string | null }>>
		>(
			apiClient.datahub(
				projBomItemsListPath(
					{ bom_id: bomId, type: 'angle' },
					{ select: 'section,unit_weight', orderBy: 'row_number:asc' }
				)
			),
			{ signal }
		);

		const unitWeightBySection: Record<string, number> = {};
		const sectionNames: string[] = [];
		const seen = new Set<string>();

		for (const row of rowsFromEnvelope(envelope.data)) {
			const name = (row.section ?? '').trim();
			if (!name) continue;
			const weight = num(row.unit_weight);
			if (!seen.has(name)) {
				seen.add(name);
				sectionNames.push(name);
			}
			if (weight > 0) {
				unitWeightBySection[name] = Math.max(unitWeightBySection[name] ?? 0, weight);
			}
		}

		return {
			unitWeightBySection,
			sectionNames,
			error:
				sectionNames.length === 0
					? 'No BOM items found for this BOM. Extract the BOM first, then try again.'
					: undefined
		};
	} catch (error) {
		return {
			unitWeightBySection: {},
			sectionNames: [],
			error: error instanceof Error ? error.message : 'Failed to load BOM unit weights from core.'
		};
	}
}
