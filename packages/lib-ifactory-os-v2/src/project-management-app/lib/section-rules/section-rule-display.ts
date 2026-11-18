import type { SectionRule } from '../store.svelte';

export function formatRuleRange(from: number | null, to: number | null): string {
	const fromLabel = from && from > 0 ? String(from) : '-';
	const toLabel = to && to > 0 ? String(to) : '-';
	return `${fromLabel}–${toLabel}`;
}

export function formatRuleStockLengths(rule: SectionRule): string {
	const min = rule.minLength ?? 0;
	const max = rule.maxLength ?? 0;
	if (min <= 0 && max <= 0) return '-';
	return `${min.toLocaleString()}–${max.toLocaleString()}`;
}

export function formatRuleCoversSections(rule: SectionRule): string {
	const minFlg = rule.fromFlg && rule.fromFlg > 0 ? rule.fromFlg : '-';
	const maxFlg =
		rule.toFlg && rule.toFlg > 0
			? rule.toFlg
			: rule.fromFlg && rule.fromFlg > 0
				? rule.fromFlg
				: '-';
	const minThk = rule.fromThk && rule.fromThk > 0 ? rule.fromThk : '-';
	const maxThk =
		rule.toThk && rule.toThk > 0
			? rule.toThk
			: rule.fromThk && rule.fromThk > 0
				? rule.fromThk
				: '-';

	return `${minFlg}×${minFlg}×${minThk} → ${maxFlg}×${maxFlg}×${maxThk}`;
}

export function formatRuleCoversSectionsFromDraft(draft: {
	fromFlg: number;
	toFlg: number;
	fromThk: number;
	toThk: number;
}): string {
	return formatRuleCoversSections({
		id: '',
		projectId: '',
		fromFlg: draft.fromFlg,
		toFlg: draft.toFlg,
		fromThk: draft.fromThk,
		toThk: draft.toThk,
		minLength: null,
		maxLength: null,
		endTrim: null,
		pitch: null
	});
}

export function formatRuleFlangeTitle(fromFlg: number, toFlg: number): string {
	const from = fromFlg > 0 ? fromFlg : '-';
	const to = toFlg > 0 ? toFlg : fromFlg > 0 ? fromFlg : '-';
	return `Flange ${from}–${to} mm`;
}

export function getProjectRuleIndex(
	rules: SectionRule[],
	projectId: string,
	ruleId: string
): number {
	const projectRules = rules.filter((rule) => rule.projectId === projectId);
	return projectRules.findIndex((rule) => rule.id === ruleId) + 1;
}
