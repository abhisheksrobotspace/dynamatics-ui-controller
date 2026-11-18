import type { SectionRule } from '../store.svelte';
import type { RuleDraft } from './rule-draft';
import { formatRuleRange } from './section-rule-display';

export type RuleFieldKey = keyof RuleDraft;

export type RuleFieldErrors = Partial<Record<RuleFieldKey, boolean>>;

export type RuleOverlap = {
	ruleIndex: number;
	fromFlg: number | null;
	toFlg: number | null;
	fromThk: number | null;
	toThk: number | null;
};

function effectiveMin(value: number): number {
	return value > 0 ? value : Number.NEGATIVE_INFINITY;
}

function effectiveMax(value: number): number {
	return value > 0 ? value : Number.POSITIVE_INFINITY;
}

function rangesOverlap(fromA: number, toA: number, fromB: number, toB: number): boolean {
	return effectiveMin(fromA) <= effectiveMax(toB) && effectiveMin(fromB) <= effectiveMax(toA);
}

export function isBoundedRangeInvalid(from: number, to: number): boolean {
	if (from <= 0 || to <= 0) return false;
	return to < from;
}

export function draftsOverlap(a: RuleDraft, b: RuleDraft): boolean {
	const flangeOverlaps = rangesOverlap(a.fromFlg, a.toFlg, b.fromFlg, b.toFlg);
	const thicknessOverlaps = rangesOverlap(a.fromThk, a.toThk, b.fromThk, b.toThk);
	return flangeOverlaps && thicknessOverlaps;
}

export function findOverlappingRule(
	draft: RuleDraft,
	rules: SectionRule[],
	projectId: string,
	excludeRuleId?: string | null
): RuleOverlap | null {
	const projectRules = rules.filter((rule) => rule.projectId === projectId);

	for (let index = 0; index < projectRules.length; index += 1) {
		const rule = projectRules[index];
		if (excludeRuleId && rule.id === excludeRuleId) continue;

		const otherDraft: RuleDraft = {
			fromFlg: rule.fromFlg ?? 0,
			toFlg: rule.toFlg ?? 0,
			fromThk: rule.fromThk ?? 0,
			toThk: rule.toThk ?? 0,
			minLength: rule.minLength ?? 0,
			maxLength: rule.maxLength ?? 0,
			endTrim: rule.endTrim ?? 0,
			pitch: rule.pitch ?? 0
		};

		if (draftsOverlap(draft, otherDraft)) {
			return {
				ruleIndex: index + 1,
				fromFlg: rule.fromFlg,
				toFlg: rule.toFlg,
				fromThk: rule.fromThk,
				toThk: rule.toThk
			};
		}
	}

	return null;
}

export function getRuleFieldErrors(draft: RuleDraft): RuleFieldErrors {
	const errors: RuleFieldErrors = {};

	if (isBoundedRangeInvalid(draft.fromFlg, draft.toFlg)) {
		errors.toFlg = true;
	}

	if (isBoundedRangeInvalid(draft.fromThk, draft.toThk)) {
		errors.toThk = true;
	}

	if (isBoundedRangeInvalid(draft.minLength, draft.maxLength)) {
		errors.maxLength = true;
	}

	if (draft.pitch <= 0) {
		errors.pitch = true;
	}

	return errors;
}

export function formatOverlapMessage(overlap: RuleOverlap): string {
	const flange = formatRuleRange(overlap.fromFlg, overlap.toFlg);
	const thickness = formatRuleRange(overlap.fromThk, overlap.toThk);
	return `Overlaps Rule ${overlap.ruleIndex} (flange ${flange}, thickness ${thickness})`;
}

export function canSaveRuleDraft(
	draft: RuleDraft,
	rules: SectionRule[],
	projectId: string,
	excludeRuleId?: string | null
): boolean {
	if (Object.keys(getRuleFieldErrors(draft)).length > 0) return false;
	if (findOverlappingRule(draft, rules, projectId, excludeRuleId)) return false;
	return true;
}
