import type { LengthGroup } from '../../../project-management-app/lib/store.svelte.js';
import type { MarkData, SectionData } from './types.js';

export type LengthGroupDraft = {
	name: string;
	minLength: number;
	maxLength: number;
};

export type LengthGroupFieldErrors = Partial<Record<keyof LengthGroupDraft, boolean>>;

export type LengthGroupOverlap = {
	groupIndex: number;
	name: string;
	minLength: number;
	maxLength: number;
};

function rangesOverlap(minA: number, maxA: number, minB: number, maxB: number): boolean {
	return minA <= maxB && minB <= maxA;
}

export function emptyLengthGroupDraft(): LengthGroupDraft {
	return { name: '', minLength: 0, maxLength: 0 };
}

export function markInGroup(
	length: number,
	group: Pick<LengthGroup, 'minLength' | 'maxLength'>
): boolean {
	return length >= group.minLength && length <= group.maxLength;
}

export function formatGroupedSectionName(baseName: string, groupName: string): string {
	const suffix = groupName.trim();
	if (!suffix) return baseName;
	return `${baseName} ${suffix}`;
}

export function sectionBaseName(section: SectionData): string {
	return section.baseName ?? section.name;
}

function cloneMarksForSection(marks: MarkData[], sectionId: string): MarkData[] {
	return marks.map((mark) => ({ ...mark, sectionId }));
}

function buildSection(
	base: SectionData,
	name: string,
	marks: MarkData[],
	groupName?: string
): SectionData {
	const id = crypto.randomUUID();
	return {
		id,
		name,
		flange: base.flange,
		thickness: base.thickness,
		unitWeightKgPerM: base.unitWeightKgPerM,
		baseName: sectionBaseName(base),
		groupName,
		marks: cloneMarksForSection(marks, id)
	};
}

/**
 * Collapse any previously grouped view back to a flat list of base sections
 * by merging marks that share the same baseName.
 */
export function collapseToBaseSections(sections: SectionData[]): SectionData[] {
	const byBase = new Map<string, SectionData>();

	for (const section of sections) {
		const base = sectionBaseName(section);
		const existing = byBase.get(base);
		if (!existing) {
			const id = crypto.randomUUID();
			byBase.set(base, {
				id,
				name: base,
				flange: section.flange,
				thickness: section.thickness,
				unitWeightKgPerM: section.unitWeightKgPerM,
				marks: cloneMarksForSection(section.marks, id)
			});
			continue;
		}

		existing.marks.push(...cloneMarksForSection(section.marks, existing.id));
	}

	return [...byBase.values()];
}

/** Apply every length group to every base section (marks split by length). */
export function applyGroupsToAllSections(
	sections: SectionData[],
	groups: LengthGroup[]
): SectionData[] {
	const baseSections = collapseToBaseSections(sections);
	const orderedGroups = [...groups].sort((a, b) => a.sortOrder - b.sortOrder);
	const result: SectionData[] = [];

	for (const base of baseSections) {
		const assigned = new Set<string>();
		const children: SectionData[] = [];

		for (const group of orderedGroups) {
			const matching = base.marks.filter((mark) => markInGroup(mark.length, group));
			if (matching.length === 0) continue;
			for (const mark of matching) assigned.add(mark.id);
			children.push(
				buildSection(base, formatGroupedSectionName(base.name, group.name), matching, group.name)
			);
		}

		const residual = base.marks.filter((mark) => !assigned.has(mark.id));
		if (residual.length > 0) {
			children.push(buildSection(base, base.name, residual));
		}

		result.push(...(children.length > 0 ? children : [base]));
	}

	return result;
}

/**
 * Base section names that currently have this group applied.
 */
export function baseNamesWithGroup(sections: SectionData[], groupName: string): string[] {
	const names = new Set<string>();
	for (const section of sections) {
		if (section.groupName === groupName) names.add(sectionBaseName(section));
	}
	return [...names].sort((a, b) => a.localeCompare(b));
}

/**
 * Set which base sections belong to `group`.
 * - Checked names get in-range marks under `Name Group` (other groups kept).
 * - If a checked base has no in-range marks, no grouped child is created.
 * - Unchecked names lose this group (marks return to residual); other groups kept.
 * - Empty `memberBaseNames` removes the group from every section.
 */
export function setGroupSectionMembership(
	sections: SectionData[],
	group: LengthGroup,
	memberBaseNames: string[]
): SectionData[] {
	const members = new Set(memberBaseNames);
	const result: SectionData[] = [];
	const processedBases = new Set<string>();

	for (const section of sections) {
		const base = sectionBaseName(section);
		if (processedBases.has(base)) continue;
		processedBases.add(base);

		const related = sections.filter((entry) => sectionBaseName(entry) === base);
		const collapsed = collapseToBaseSections(related)[0];
		if (!collapsed) continue;

		const otherGrouped = related.filter(
			(entry) => entry.groupName && entry.groupName !== group.name
		);
		const otherMarkIds = new Set(
			otherGrouped.flatMap((entry) => entry.marks.map((mark) => mark.id))
		);
		const freeMarks = collapsed.marks.filter((mark) => !otherMarkIds.has(mark.id));

		for (const other of otherGrouped) {
			result.push(buildSection(collapsed, other.name, other.marks, other.groupName));
		}

		if (members.has(base)) {
			const matching = freeMarks.filter((mark) => markInGroup(mark.length, group));
			const residual = freeMarks.filter((mark) => !markInGroup(mark.length, group));
			// Only in-range marks join the group (same rule as applyGroupsToAllSections).
			// No matches → no grouped child; marks stay on the residual base section.
			if (matching.length > 0) {
				result.push(
					buildSection(
						collapsed,
						formatGroupedSectionName(collapsed.name, group.name),
						matching,
						group.name
					)
				);
			}
			if (residual.length > 0) {
				result.push(buildSection(collapsed, collapsed.name, residual));
			}
		} else if (freeMarks.length > 0) {
			result.push(buildSection(collapsed, collapsed.name, freeMarks));
		}
	}

	return result;
}

/**
 * Set membership for one group to exactly `selectedBaseNames`
 * (unchecked / omitted bases lose this group; other groups are preserved).
 */
export function applyOneGroupToSections(
	sections: SectionData[],
	group: LengthGroup,
	selectedBaseNames: string[]
): SectionData[] {
	return setGroupSectionMembership(sections, group, selectedBaseNames);
}

/** How many marks in the selected base sections fall inside the group's length range. */
export function countMatchingMarksInSelection(
	sections: SectionData[],
	group: Pick<LengthGroup, 'minLength' | 'maxLength'>,
	selectedBaseNames: string[]
): { matchingMarks: number; selectedSections: number; sectionsWithMatches: number } {
	const selected = new Set(selectedBaseNames);
	const processed = new Set<string>();
	let matchingMarks = 0;
	let selectedSections = 0;
	let sectionsWithMatches = 0;

	for (const section of sections) {
		const base = sectionBaseName(section);
		if (!selected.has(base) || processed.has(base)) continue;
		processed.add(base);
		selectedSections += 1;

		const related = sections.filter((entry) => sectionBaseName(entry) === base);
		const marks = related.flatMap((entry) => entry.marks);
		const matched = marks.filter((mark) => markInGroup(mark.length, group)).length;
		matchingMarks += matched;
		if (matched > 0) sectionsWithMatches += 1;
	}

	return { matchingMarks, selectedSections, sectionsWithMatches };
}

export function getLengthGroupFieldErrors(draft: LengthGroupDraft): LengthGroupFieldErrors {
	const errors: LengthGroupFieldErrors = {};
	if (!draft.name.trim()) errors.name = true;
	if (draft.minLength < 0) errors.minLength = true;
	if (draft.maxLength < 0) errors.maxLength = true;
	if (draft.maxLength < draft.minLength) errors.maxLength = true;
	return errors;
}

export function findOverlappingLengthGroup(
	draft: LengthGroupDraft,
	groups: LengthGroup[],
	excludeGroupId?: string | null
): LengthGroupOverlap | null {
	for (let index = 0; index < groups.length; index += 1) {
		const group = groups[index];
		if (excludeGroupId && group.id === excludeGroupId) continue;
		if (rangesOverlap(draft.minLength, draft.maxLength, group.minLength, group.maxLength)) {
			return {
				groupIndex: index + 1,
				name: group.name,
				minLength: group.minLength,
				maxLength: group.maxLength
			};
		}
	}
	return null;
}

export function findDuplicateLengthGroupName(
	name: string,
	groups: LengthGroup[],
	excludeGroupId?: string | null
): boolean {
	const normalized = name.trim().toLowerCase();
	if (!normalized) return false;
	return groups.some(
		(group) => group.id !== excludeGroupId && group.name.trim().toLowerCase() === normalized
	);
}

export function canSaveLengthGroupDraft(
	draft: LengthGroupDraft,
	groups: LengthGroup[],
	excludeGroupId?: string | null
): boolean {
	if (Object.keys(getLengthGroupFieldErrors(draft)).length > 0) return false;
	if (findDuplicateLengthGroupName(draft.name, groups, excludeGroupId)) return false;
	if (findOverlappingLengthGroup(draft, groups, excludeGroupId)) return false;
	return true;
}

export function formatLengthRange(minLength: number, maxLength: number): string {
	return `${minLength}–${maxLength}`;
}

export function formatLengthGroupOverlapMessage(overlap: LengthGroupOverlap): string {
	return `Overlaps group “${overlap.name}” (${formatLengthRange(overlap.minLength, overlap.maxLength)})`;
}
