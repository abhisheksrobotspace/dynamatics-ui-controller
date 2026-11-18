import type { SectionRule } from '../../../project-management-app/lib/store.svelte.js';

export function hasProjectSectionRules(rules: SectionRule[], projectId: string): boolean {
	return rules.some((rule) => rule.projectId === projectId);
}

export function matchSectionRule(
	rules: SectionRule[],
	projectId: string,
	flange: number,
	thickness: number
): SectionRule | undefined {
	if (!hasProjectSectionRules(rules, projectId)) {
		return undefined;
	}

	const projectRules = rules.filter((rule) => rule.projectId === projectId);
	return projectRules.find((rule) => {
		const fMatch =
			(rule.fromFlg == null || rule.fromFlg === 0 || flange >= rule.fromFlg) &&
			(rule.toFlg == null || rule.toFlg === 0 || flange <= rule.toFlg);
		const tMatch =
			(rule.fromThk == null || rule.fromThk === 0 || thickness >= rule.fromThk) &&
			(rule.toThk == null || rule.toThk === 0 || thickness <= rule.toThk);
		return fMatch && tMatch;
	});
}

export function generateStockLengths(rule: SectionRule | undefined): number[] {
	if (!rule) return [];

	const min = rule.minLength ?? 0;
	const max = rule.maxLength ?? 0;
	const pitch = rule.pitch ?? 0;
	const lengths: number[] = [];
	if (pitch <= 0 || min <= 0 || max <= 0 || min > max) return lengths;

	for (let length = min; length <= max; length += pitch) {
		lengths.push(length);
	}

	return lengths;
}

export function describeStockRule(rule: SectionRule | undefined): string {
	if (!rule) {
		return 'No matching rule';
	}

	return `${rule.minLength}-${rule.maxLength} mm, pitch ${rule.pitch} mm`;
}

export function parseSectionMetadata(sectionName: string, flange: number) {
	const match = sectionName.match(/^([A-Z]+)(ANGLE|BEAM|CHANNEL|TUBE|PLATE)/i);
	const type = match ? match[1] : 'HT';
	const shape = match ? match[2] : 'ANGLE';
	const sizeMatch = sectionName.match(/\d+X\d+/i);
	const size = sizeMatch ? sizeMatch[0].toLowerCase() : `${flange}x${flange}`;
	return { type, shape, size };
}
