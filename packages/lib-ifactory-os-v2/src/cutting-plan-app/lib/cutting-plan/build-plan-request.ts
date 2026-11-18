import type {
	PlannerSettings,
	SectionRule
} from '../../../project-management-app/lib/store.svelte.js';
import { DEFAULT_PLANNER_SETTINGS, maxTimeLimitPerSection } from './constants';
import { matchSectionRule, parseSectionMetadata } from './section-rules';
import type { PlanMarking, PlanRequest, PlannerConfig, SectionData, StockEntry } from './types';

type SectionStockSelection = SectionData & {
	selectedLengths: number[];
	/** When set (register-fed), emit capped `{length,quantity}` instead of unlimited bare numbers. */
	stockQtyByLength?: Record<number, number>;
};

function toPositiveInt(value: number): number {
	return Math.max(1, Math.round(value));
}

function toNonNegativeInt(value: number): number {
	return Math.max(0, Math.round(value));
}

function stockEntriesForSection(sec: SectionStockSelection): StockEntry[] {
	const entries: StockEntry[] = [];
	for (const raw of sec.selectedLengths) {
		const length = toPositiveInt(raw);
		const qty = sec.stockQtyByLength?.[length] ?? sec.stockQtyByLength?.[raw];
		if (qty == null) {
			entries.push(length);
			continue;
		}
		const quantity = Math.max(0, Math.floor(qty));
		if (quantity <= 0) continue;
		entries.push({ length, quantity });
	}
	return entries;
}

function normalizeMarkName(markName: string): string | null {
	const trimmed = markName.trim();
	return trimmed.length > 0 ? trimmed : null;
}

function normalizeSectionThickness(thickness: number): number | null {
	if (!Number.isFinite(thickness)) return null;
	const rounded = Math.round(thickness);
	return rounded >= 0 ? rounded : null;
}

export function normalizePlannerConfig(settings: PlannerSettings): PlannerConfig {
	const timeLimit = Number(settings.timeLimit);
	const maxUniquePerBar = Number(settings.maxUniqueLengthsPerBar);
	const maxUniqueStockLengths = Number(settings.maxUniqueStockLengthsPerSection);
	const maxPerSection = maxTimeLimitPerSection();

	return {
		time_limit_per_section:
			Number.isFinite(timeLimit) && timeLimit > 0
				? Math.min(timeLimit, maxPerSection)
				: DEFAULT_PLANNER_SETTINGS.timeLimit,
		max_unique_lengths_per_bar: Math.max(
			1,
			Math.min(64, Math.round(maxUniquePerBar) || DEFAULT_PLANNER_SETTINGS.maxUniqueLengthsPerBar)
		),
		max_unique_stock_lengths: Math.max(
			0,
			Math.min(
				64,
				Number.isFinite(maxUniqueStockLengths)
					? Math.round(maxUniqueStockLengths)
					: DEFAULT_PLANNER_SETTINGS.maxUniqueStockLengthsPerSection
			)
		),
		enforce_mark_cohesion: Boolean(settings.enforceMarkCohesion)
	};
}

export function buildPlanRequest(
	bomId: string,
	sections: SectionStockSelection[],
	selectedMarks: string[],
	settings: PlannerSettings,
	rules: SectionRule[],
	projectId: string
): PlanRequest {
	const parts_by_section: PlanRequest['parts_by_section'] = {};
	const stock: PlanRequest['stock'] = {};

	for (const sec of sections) {
		const marksForSection = sec.marks.filter((m) => selectedMarks.includes(m.id));
		if (marksForSection.length === 0) continue;

		const selectedStock = stockEntriesForSection(sec);
		if (selectedStock.length === 0) {
			throw new Error(`Select at least one stock length for ${sec.name}.`);
		}

		const { type, shape, size } = parseSectionMetadata(sec.name, sec.flange);
		const rule = matchSectionRule(rules, projectId, sec.flange, sec.thickness);
		if (!rule) {
			throw new Error(`No section rule matches ${sec.name}. Configure rules before planning.`);
		}

		const markings: PlanMarking[] = marksForSection.map((m) => ({
			mark: normalizeMarkName(m.markName),
			length: toPositiveInt(m.length),
			quantity: toPositiveInt(m.qty)
		}));

		const sectionParts: PlanRequest['parts_by_section'][string] = {
			size,
			type,
			shape,
			thickness: normalizeSectionThickness(sec.thickness),
			end_trim: toNonNegativeInt(rule.endTrim ?? 0),
			markings
		};

		if (sec.unitWeightKgPerM != null && sec.unitWeightKgPerM > 0) {
			sectionParts.unit_weight = sec.unitWeightKgPerM;
		}

		parts_by_section[sec.name] = sectionParts;
		stock[sec.name] = selectedStock;
	}

	if (Object.keys(parts_by_section).length === 0) {
		throw new Error('Select at least one marking before sending to the planner.');
	}

	return {
		bom_id: bomId,
		parts_by_section,
		stock,
		config: normalizePlannerConfig(settings)
	};
}
