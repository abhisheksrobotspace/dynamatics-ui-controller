import { createSectionRule, listSectionRules, type SectionRuleInput } from './cp.api.js';
import { DEFAULT_SECTION_RULES } from './constants.js';
import type { SectionRule } from '../../../project-management-app/lib/store.svelte.js';

const loadInFlight = new Map<string, Promise<SectionRule[]>>();
const seedInFlight = new Map<string, Promise<void>>();

async function ensureDefaultSectionRules(
	projectId: string,
	signal?: AbortSignal
): Promise<SectionRule[]> {
	// One list GET; seed defaults only when empty (avoids hasSectionRules + list round-trip).
	const rules = await listSectionRules(projectId, signal);
	if (rules.length > 0) return rules;

	const inFlight = seedInFlight.get(projectId);
	if (inFlight) {
		await inFlight;
		return listSectionRules(projectId, signal);
	}

	const promise = (async () => {
		for (let index = 0; index < DEFAULT_SECTION_RULES.length; index++) {
			const rule = DEFAULT_SECTION_RULES[index] as SectionRuleInput;
			await createSectionRule(projectId, rule, index, signal);
		}
	})().finally(() => {
		seedInFlight.delete(projectId);
	});

	seedInFlight.set(projectId, promise);
	await promise;
	return listSectionRules(projectId, signal);
}

/** Loads section rules for a project page (dedupes concurrent loads). Seeds defaults when none exist. */
export async function loadSectionRulesPageData(
	projectId: string,
	signal?: AbortSignal
): Promise<SectionRule[]> {
	const inFlight = loadInFlight.get(projectId);
	if (inFlight) return inFlight;

	const promise = ensureDefaultSectionRules(projectId, signal).finally(() => {
		loadInFlight.delete(projectId);
	});

	loadInFlight.set(projectId, promise);
	return promise;
}

export function upsertSectionRuleInList(rules: SectionRule[], rule: SectionRule): SectionRule[] {
	const existing = rules.find((entry) => entry.id === rule.id);
	return existing ? rules.map((entry) => (entry.id === rule.id ? rule : entry)) : [...rules, rule];
}

export function removeSectionRuleFromList(rules: SectionRule[], ruleId: string): SectionRule[] {
	return rules.filter((rule) => rule.id !== ruleId);
}
