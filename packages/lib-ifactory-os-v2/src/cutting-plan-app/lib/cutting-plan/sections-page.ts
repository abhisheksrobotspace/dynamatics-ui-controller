import { normalizeBomSectionName } from './bom-csv-parser';
import { loadBomSections } from './bom-sections';
import { loadCuttingPlanDraft, saveCuttingPlanDraft } from './draft-cache';
import { applyGroupsToAllSections, collapseToBaseSections } from './length-groups.js';
import type { LengthGroup } from '../../../project-management-app/lib/store.svelte.js';
import type { CuttingPlanDraft } from './types';
import type { SectionData } from './types';

export type SectionsPageData = {
	/** Visible list (may include length-group splits from the draft). */
	sections: SectionData[];
	/** Flat BOM sections for Remove / Apply-groups-to-all. */
	baseSections: SectionData[];
	selectedMarkIds: string[];
	loadError: string;
	/** True when section list was restored from a saved cutting-plan draft. */
	restoredFromDraft: boolean;
};

/**
 * On a fresh sections step (no draft), apply configured length groups by default.
 * Skips when a draft was restored so explicit "Remove groups" survives Back navigation.
 */
export function applyDefaultLengthGroupsIfNeeded(
	sections: SectionData[],
	baseSections: SectionData[],
	lengthGroups: LengthGroup[],
	restoredFromDraft: boolean
): SectionData[] {
	if (restoredFromDraft || lengthGroups.length === 0) return sections;
	if (sections.some((section) => Boolean(section.groupName))) return sections;

	const base = baseSections.length > 0 ? baseSections : sections;
	return applyGroupsToAllSections(base, lengthGroups);
}

export function allMarkIdsFromSections(sections: SectionData[]): string[] {
	return sections.flatMap((section) => section.marks).map((mark) => mark.id);
}

export async function initializeSelectAllDraft(bomId: string): Promise<void> {
	const bomResult = await loadBomSections(bomId);
	if (bomResult.sections.length === 0) return;

	await saveCuttingPlanDraft(bomId, {
		sections: bomResult.sections,
		selectedMarks: allMarkIdsFromSections(bomResult.sections),
		replanSectionsOnly: false
	});
}

function sectionBaseKey(section: SectionData): string {
	return normalizeBomSectionName(section.baseName ?? section.name);
}

function filterSectionsForReplan(
	allSections: SectionData[],
	replanSections: SectionData[]
): SectionData[] {
	const replanNames = new Set(replanSections.map(sectionBaseKey));
	return allSections.filter((section) => replanNames.has(normalizeBomSectionName(section.name)));
}

/**
 * Display list: prefer the draft so length-group splits survive Select Sections ↔ Stock Lengths.
 * Fall back to BOM when there is no draft yet.
 */
export function resolveVisibleSections(
	bomSections: SectionData[],
	cachedDraft: CuttingPlanDraft | null
): SectionData[] {
	if (cachedDraft?.sections?.length) {
		return cachedDraft.sections;
	}

	return bomSections;
}

/** Ungrouped BOM snapshot; for partial replan, limited to the replan base names. */
export function resolveBaseSections(
	bomSections: SectionData[],
	cachedDraft: CuttingPlanDraft | null
): SectionData[] {
	if (bomSections.length > 0) {
		if (cachedDraft?.replanSectionsOnly && cachedDraft.sections.length > 0) {
			return filterSectionsForReplan(bomSections, cachedDraft.sections);
		}
		return bomSections;
	}

	if (cachedDraft?.sections?.length) {
		return collapseToBaseSections(cachedDraft.sections);
	}

	return [];
}

function resolveSelectedMarkIds(
	sections: SectionData[],
	cachedMarkIds: string[] | undefined
): string[] {
	const allMarkIds = allMarkIdsFromSections(sections);
	if (allMarkIds.length === 0) return [];

	if (!cachedMarkIds?.length) return allMarkIds;

	const validMarkIds = cachedMarkIds.filter((id) => allMarkIds.includes(id));
	return validMarkIds.length > 0 ? validMarkIds : allMarkIds;
}

export async function loadSectionsPageData(bomId: string): Promise<SectionsPageData> {
	const { applyPendingSectionReplanIfAny } = await import('./replan-sections.js');

	// One BOM fetch for both pending Stock-Assignment replan and the page itself.
	const bomResult = await loadBomSections(bomId);
	await applyPendingSectionReplanIfAny(bomId, bomResult.sections);

	const cachedDraft = await loadCuttingPlanDraft(bomId);

	const baseSections = resolveBaseSections(bomResult.sections, cachedDraft);
	const sections = resolveVisibleSections(bomResult.sections, cachedDraft);
	const selectedMarkIds = resolveSelectedMarkIds(sections, cachedDraft?.selectedMarks);

	const restoredFromDraft = Boolean(cachedDraft?.sections?.length);

	return {
		sections,
		baseSections,
		selectedMarkIds,
		restoredFromDraft,
		loadError:
			bomResult.error ??
			(sections.length === 0 ? 'Upload a BOM CSV for this tower and try again.' : '')
	};
}
