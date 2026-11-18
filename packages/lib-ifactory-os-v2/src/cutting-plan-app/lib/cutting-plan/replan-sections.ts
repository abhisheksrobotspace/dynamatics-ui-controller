import { normalizeBomSectionName } from './bom-csv-parser';
import { loadBomSections } from './bom-sections';
import { loadCuttingPlanDraft, saveCuttingPlanDraft } from './draft-cache';
import { allMarkIdsFromSections } from './sections-page';
import type { CuttingPlanDraft, SectionData } from './types';

const PENDING_SECTION_REPLAN_KEY = 'ifactory.cuttingPlan.pendingSectionReplan';

type PendingSectionReplan = {
	bomId: string;
	sectionNames: string[];
	sourceRunId?: string;
	/** Lengths to leave unselected on Stock Lengths (the short Lock row being left). */
	excludeStockLengths?: number[];
};

export type StashPendingSectionReplanOptions = {
	sourceRunId?: string;
	excludeStockLengths?: number[];
};

/** Stash section replan intent so the host can navigate immediately; applied on Sections load. */
export function stashPendingSectionReplan(
	bomId: string,
	sectionNames: string[],
	options?: StashPendingSectionReplanOptions
): void {
	try {
		const payload: PendingSectionReplan = {
			bomId,
			sectionNames,
			...(options?.sourceRunId ? { sourceRunId: options.sourceRunId } : {}),
			...(options?.excludeStockLengths?.length
				? { excludeStockLengths: options.excludeStockLengths }
				: {})
		};
		sessionStorage.setItem(PENDING_SECTION_REPLAN_KEY, JSON.stringify(payload));
	} catch {
		// private mode / quota
	}
}

/** If Lock navigated first, prepare the partial-replan draft before the Sections page reads it. */
export async function applyPendingSectionReplanIfAny(
	bomId: string,
	preloadedSections?: SectionData[]
): Promise<void> {
	let raw: string | null;
	try {
		raw = sessionStorage.getItem(PENDING_SECTION_REPLAN_KEY);
	} catch {
		return;
	}
	if (!raw) return;

	let pending: PendingSectionReplan;
	try {
		pending = JSON.parse(raw) as PendingSectionReplan;
	} catch {
		try {
			sessionStorage.removeItem(PENDING_SECTION_REPLAN_KEY);
		} catch {
			/* ignore */
		}
		return;
	}

	if (pending.bomId !== bomId || !Array.isArray(pending.sectionNames)) return;

	try {
		sessionStorage.removeItem(PENDING_SECTION_REPLAN_KEY);
	} catch {
		/* ignore */
	}

	await prepareReplanDraft(bomId, pending.sectionNames, {
		sourceRunId: pending.sourceRunId,
		excludeStockLengths: pending.excludeStockLengths,
		preloadedSections
	});
}

function sectionNamesMatch(left: string, right: string): boolean {
	return normalizeBomSectionName(left) === normalizeBomSectionName(right);
}

async function resolveAllSections(
	bomId: string,
	preloadedSections?: SectionData[]
): Promise<SectionData[]> {
	if (preloadedSections && preloadedSections.length > 0) return preloadedSections;

	const draft = await loadCuttingPlanDraft(bomId);
	const bom = await loadBomSections(bomId);

	if (bom.sections.length > 0) return bom.sections;
	if (draft?.sections?.length) return draft.sections;
	return [];
}

function sectionBaseKey(section: SectionData): string {
	return normalizeBomSectionName(section.baseName ?? section.name);
}

function uniqueBaseSectionKeys(sections: SectionData[]): Set<string> {
	return new Set(sections.map(sectionBaseKey));
}

/** Sections with at least one selected mark. */
export function sectionsWithSelectedMarks(
	sections: SectionData[],
	selectedMarkIds: string[]
): SectionData[] {
	const selected = new Set(selectedMarkIds);
	return sections.filter((section) => section.marks.some((mark) => selected.has(mark.id)));
}

/**
 * When replanning an existing plan with a strict subset of BOM sections selected,
 * upgrade the draft to partial replan (same as Assign & Lock / planner Replan selected).
 */
export function buildSectionsStepDraft(input: {
	existingDraft: CuttingPlanDraft | null;
	sections: SectionData[];
	baseSections: SectionData[];
	selectedMarkIds: string[];
}): CuttingPlanDraft {
	const includedSections = sectionsWithSelectedMarks(input.sections, input.selectedMarkIds);
	const includedBases = uniqueBaseSectionKeys(includedSections);
	const allBases = uniqueBaseSectionKeys(
		input.baseSections.length > 0 ? input.baseSections : input.sections
	);
	const isSubsetReplan =
		Boolean(input.existingDraft?.replanFromExisting) &&
		includedBases.size > 0 &&
		includedBases.size < allBases.size;

	return {
		selectedMarks: input.selectedMarkIds,
		sections: isSubsetReplan ? includedSections : input.sections,
		replanSectionsOnly: isSubsetReplan || Boolean(input.existingDraft?.replanSectionsOnly),
		replanFromExisting: input.existingDraft?.replanFromExisting,
		replanSourceRunId: input.existingDraft?.replanSourceRunId,
		replanExcludeStockLengths: input.existingDraft?.replanExcludeStockLengths,
		useAvailableStockLengths: input.existingDraft?.useAvailableStockLengths
	};
}

export async function prepareReplanAllDraft(
	bomId: string,
	options?: { sourceRunId?: string }
): Promise<void> {
	const sections = await resolveAllSections(bomId);
	if (sections.length === 0) {
		throw new Error('No BOM sections available for replan.');
	}

	await saveCuttingPlanDraft(bomId, {
		sections,
		selectedMarks: allMarkIdsFromSections(sections),
		replanSectionsOnly: false,
		replanFromExisting: true,
		replanSourceRunId: options?.sourceRunId,
		useAvailableStockLengths: false
	});
}

export async function prepareReplanDraft(
	bomId: string,
	sectionNames: string[],
	options?: {
		sourceRunId?: string;
		excludeStockLengths?: number[];
		preloadedSections?: SectionData[];
	}
): Promise<void> {
	const sections = await resolveAllSections(bomId, options?.preloadedSections);
	if (sections.length === 0) {
		throw new Error('No BOM sections available for replan.');
	}

	if (sectionNames.length === 0) {
		throw new Error('Select at least one section to replan.');
	}

	const selectedSections = sections.filter((section) =>
		sectionNames.some((target) => sectionNamesMatch(section.name, target))
	);

	if (selectedSections.length === 0) {
		throw new Error('Selected sections were not found in the BOM.');
	}

	const selectedMarks = selectedSections.flatMap((section) => section.marks.map((mark) => mark.id));
	const exclude = [
		...new Set(
			(options?.excludeStockLengths ?? [])
				.filter((n) => Number.isFinite(n) && n > 0)
				.map(Math.round)
		)
	];

	await saveCuttingPlanDraft(bomId, {
		sections: selectedSections,
		selectedMarks,
		replanSectionsOnly: true,
		replanFromExisting: true,
		replanSourceRunId: options?.sourceRunId,
		useAvailableStockLengths: true,
		...(exclude.length ? { replanExcludeStockLengths: exclude } : {})
	});
}

export async function completePartialReplanDraft(bomId: string): Promise<void> {
	const draft = await loadCuttingPlanDraft(bomId);
	const sections = await resolveAllSections(bomId);
	if (sections.length === 0) return;

	const allMarkIds = allMarkIdsFromSections(sections);
	const selectedMarks =
		draft?.selectedMarks?.filter((markId) => allMarkIds.includes(markId)) ?? allMarkIds;

	await saveCuttingPlanDraft(bomId, {
		sections,
		selectedMarks: selectedMarks.length > 0 ? selectedMarks : allMarkIds,
		replanSectionsOnly: false,
		replanFromExisting: false,
		replanSourceRunId: undefined,
		replanExcludeStockLengths: undefined,
		useAvailableStockLengths: false
	});
}
