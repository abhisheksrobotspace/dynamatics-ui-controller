import type { SectionRule } from '../../../project-management-app/lib/store.svelte.js';
import type { SectionWithLengths } from './stock-lengths-page';

export function formatStockLength(value: number): string {
	return value.toLocaleString();
}

export function getRuleDisplayIndex(
	rule: SectionRule | undefined,
	rules: SectionRule[],
	projectId: string
): number | null {
	if (!rule) return null;

	const projectRules = rules.filter((entry) => entry.projectId === projectId);
	const index = projectRules.findIndex((entry) => entry.id === rule.id);
	return index >= 0 ? index + 1 : null;
}

export function formatStockRuleDescription(
	rule: SectionRule | undefined,
	rules: SectionRule[],
	projectId: string
): string {
	if (!rule) {
		return 'No matching rule - configure section rules for this flange/thickness';
	}

	const min = rule.minLength ?? 0;
	const max = rule.maxLength ?? 0;
	const pitch = rule.pitch ?? 0;
	const ruleIndex = getRuleDisplayIndex(rule, rules, projectId);
	const ruleSuffix = ruleIndex ? ` · from Rule [${ruleIndex}]` : '';

	return `${formatStockLength(min)}–${formatStockLength(max)} mm · pitch ${pitch}${ruleSuffix}`;
}

export function stockLengthBadgeTone(
	selectedCount: number,
	totalCount: number
): 'primary' | 'success' {
	if (totalCount > 0 && selectedCount === totalCount) {
		return 'success';
	}

	return 'primary';
}

export function summarizeStockLengthsSelection(sections: SectionWithLengths[]) {
	const sectionsWithSelection = sections.filter(
		(section) => section.selectedLengths.length > 0
	).length;
	const totalStockLengths = sections.reduce(
		(sum, section) => sum + section.selectedLengths.length,
		0
	);

	return {
		sectionsWithSelection,
		totalStockLengths,
		totalSections: sections.length,
		hasSelection: totalStockLengths > 0,
		allSectionsHaveSelection:
			sections.length > 0 && sections.every((section) => section.selectedLengths.length > 0),
		allSectionsHaveMatchingRules:
			sections.length > 0 && sections.every((section) => section.generatedLengths.length > 0),
		allSectionsReadyForPlanner:
			sections.length > 0 &&
			sections.every(
				(section) => section.generatedLengths.length > 0 && section.selectedLengths.length > 0
			)
	};
}
