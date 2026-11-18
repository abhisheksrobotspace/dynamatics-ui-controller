import { normalizeBomSectionName } from './bom-csv-parser';
import { loadBomSections, loadBomUnitWeights } from './bom-sections';
import type { SectionData } from './types';

function buildUnitWeightMap(sections: SectionData[]): Record<string, number> {
	const map: Record<string, number> = {};
	for (const section of sections) {
		if (!section.unitWeightKgPerM || section.unitWeightKgPerM <= 0) continue;
		const unitWeight = section.unitWeightKgPerM;
		// Index both the display name (may be grouped) and the BOM base name so lookups
		// work for plan output keys like "MS ANGLE 60X60X4 3001-6000".
		map[normalizeBomSectionName(section.name)] = unitWeight;
		map[normalizeBomSectionName(section.baseName ?? section.name)] = unitWeight;
	}
	return map;
}

/** Index slim section→kg/m rows the same way as full SectionData maps. */
export function unitWeightBySectionFromNames(
	unitWeightBySection: Record<string, number>
): Record<string, number> {
	const map: Record<string, number> = {};
	for (const [name, weight] of Object.entries(unitWeightBySection)) {
		if (weight <= 0) continue;
		map[normalizeBomSectionName(name)] = weight;
		map[name] = weight;
	}
	return map;
}

/** Build kg/m map from already-loaded BOM sections (avoids a second `proj_bom_items` fetch). */
export function unitWeightBySectionFromBom(
	bomSections: readonly SectionData[] = []
): Record<string, number> {
	return buildUnitWeightMap([...bomSections]);
}

export async function loadUnitWeightBySection(bomId: string): Promise<Record<string, number>> {
	const bom = await loadBomUnitWeights(bomId);
	if (Object.keys(bom.unitWeightBySection).length > 0) {
		return unitWeightBySectionFromNames(bom.unitWeightBySection);
	}
	// Fallback to full sections loader if slim select is empty/unavailable.
	const full = await loadBomSections(bomId);
	return unitWeightBySectionFromBom(full.sections);
}

/**
 * Look up kg/m for a plan section key. Exact match first; if the key is a length-grouped
 * child (`BASE GROUP`), fall back to the longest matching base-name prefix in the map.
 */
export function resolveSectionUnitWeight(
	sectionName: string,
	unitWeightBySection: Record<string, number>
): number | undefined {
	const normalized = normalizeBomSectionName(sectionName);
	const direct =
		unitWeightBySection[normalized] ??
		unitWeightBySection[sectionName] ??
		Object.entries(unitWeightBySection).find(
			([key]) => normalizeBomSectionName(key) === normalized
		)?.[1];
	if (direct != null) return direct;

	let best: { length: number; weight: number } | null = null;
	for (const [key, weight] of Object.entries(unitWeightBySection)) {
		const normalizedKey = normalizeBomSectionName(key);
		if (!normalized.startsWith(`${normalizedKey} `)) continue;
		if (!best || normalizedKey.length > best.length) {
			best = { length: normalizedKey.length, weight };
		}
	}
	return best?.weight;
}
