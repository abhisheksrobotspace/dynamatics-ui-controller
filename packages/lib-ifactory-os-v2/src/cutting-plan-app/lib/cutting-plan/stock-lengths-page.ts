import { formatStockRuleDescription } from './stock-length-display';
import { generateStockLengths, matchSectionRule } from './section-rules';
import { loadCuttingPlanDraft } from './draft-cache';
import { normalizeBomSectionName } from './bom-csv-parser';
import { apiClient } from '../../../lib/api/api-client.js';
import { datahubQuery, leftJoin, pickAliasString } from '../../../lib/api/datahub-query.js';
import { rowsFromEnvelope, type ApiEnvelope } from '../../../lib/api/types.js';
import type { SectionRule } from '../../../project-management-app/lib/store.svelte.js';
import type { SectionData } from './types';

export type SectionWithLengths = SectionData & {
	generatedLengths: number[];
	selectedLengths: number[];
	ruleDesc: string;
	/** Free pcs by length when lengths came from `inv_stock_available_lengths`. */
	stockQtyByLength?: Record<number, number>;
};

export type StockLengthsPageData = {
	sections: SectionWithLengths[];
	selectedMarks: string[];
};

function num(value: number | string | null | undefined): number {
	if (value === null || value === undefined || value === '') return 0;
	const n = typeof value === 'number' ? value : Number(value);
	return Number.isFinite(n) ? n : 0;
}

/** Parse `L=` from inv_stock_lines.variant_key (e.g. `L=6000` or `L=6000;W=…`). */
export function lengthMmFromVariantKey(variantKey: string): number {
	const match = variantKey.match(/(?:^|;)L=([0-9.]+)/i);
	if (!match) return 0;
	const mm = Number(match[1]);
	return Number.isFinite(mm) ? Math.round(mm) : 0;
}

export function formatAvailableStockLengthsDescription(lengths: number[]): string {
	const n = lengths.length;
	return `Available in stock · ${n} length${n === 1 ? '' : 's'}`;
}

/** Lock replan when the section has no free inventory lengths. */
export const NO_AVAILABLE_STOCK_LENGTHS_MESSAGE = 'No available stock lengths for this section';

/** Empty-state copy when Lock replan has a current-length floor (only longer bars are offered). */
export function noAvailableStockLengthsMessage(minLengthExclusiveMm?: number): string {
	if (minLengthExclusiveMm != null && minLengthExclusiveMm > 0) {
		return `No free stock lengths longer than ${minLengthExclusiveMm.toLocaleString('en-IN')} mm for this section`;
	}
	return NO_AVAILABLE_STOCK_LENGTHS_MESSAGE;
}

export function isNoAvailableStockLengthsMessage(ruleDesc: string): boolean {
	return (
		ruleDesc === NO_AVAILABLE_STOCK_LENGTHS_MESSAGE ||
		ruleDesc.startsWith('No free stock lengths longer than ')
	);
}

/**
 * Prefer inventory lengths when `availableLengths` is non-empty.
 * - `requireAvailable: true` (Lock replan): empty inventory → no lengths + message (no rule fallback).
 * - otherwise (Cutting Plan): empty inventory → section-rule pitch grid.
 */
export function resolveGeneratedStockLengths(input: {
	ruleLengths: number[];
	availableLengths: number[];
	ruleDesc: string;
	requireAvailable?: boolean;
	/** Current Lock row length — empty-state copy only (filtering is done by the caller). */
	minLengthExclusiveMm?: number;
}): { lengths: number[]; ruleDesc: string; fromStock: boolean } {
	const available = [
		...new Set(input.availableLengths.filter((length) => Number.isFinite(length) && length > 0))
	].sort((a, b) => a - b);

	if (available.length > 0) {
		return {
			lengths: available,
			ruleDesc: formatAvailableStockLengthsDescription(available),
			fromStock: true
		};
	}

	if (input.requireAvailable) {
		return {
			lengths: [],
			ruleDesc: noAvailableStockLengthsMessage(input.minLengthExclusiveMm),
			fromStock: true
		};
	}

	return {
		lengths: input.ruleLengths,
		ruleDesc: input.ruleDesc,
		fromStock: false
	};
}

/** Default selected lengths: all generated, minus any Lock-replan exclude list (if any remain). */
export function defaultSelectedStockLengths(
	generatedLengths: number[],
	excludeLengths?: number[] | null
): number[] {
	if (!excludeLengths?.length) return [...generatedLengths];
	const exclude = new Set(excludeLengths.map((n) => Math.round(n)));
	const kept = generatedLengths.filter((length) => !exclude.has(Math.round(length)));
	return kept.length > 0 ? kept : [...generatedLengths];
}

type LengthQty = { length_mm: number; free_qty_base: number };

function addLengthQty(map: Map<string, Map<number, number>>, key: string, entry: LengthQty) {
	const normalized = normalizeBomSectionName(key);
	if (!normalized || entry.length_mm <= 0 || entry.free_qty_base <= 0) return;
	let byLength = map.get(normalized);
	if (!byLength) {
		byLength = new Map();
		map.set(normalized, byLength);
	}
	byLength.set(entry.length_mm, (byLength.get(entry.length_mm) ?? 0) + entry.free_qty_base);
}

async function listEntityRows<T extends Record<string, unknown>>(
	path: string,
	signal?: AbortSignal
): Promise<T[]> {
	const envelope = await apiClient.get<ApiEnvelope<T[]>>(apiClient.datahub(path), { signal });
	return rowsFromEnvelope<T>(envelope.data);
}

/**
 * Free stock lengths on the project, keyed by normalized BOM section name.
 * Prefers `inv_stock_lines.bom_section` (D5b — same label as Stock Register / Lock).
 * Falls back to item name / code / bom aliases when `bom_section` is null.
 */
export async function loadAvailableStockLengthsBySection(
	projectId: string,
	signal?: AbortSignal
): Promise<Map<string, LengthQty[]>> {
	const lines = await listEntityRows<{
		item_id?: string;
		bom_section?: string | null;
		variant_key?: string | null;
		free_base?: string | number | null;
	}>(
		`inv_stock_lines?project_id=${encodeURIComponent(projectId)}&select=item_id,bom_section,variant_key,free_base&limit=5000`,
		signal
	);

	const bySection = new Map<string, Map<number, number>>();
	const freeByItem = new Map<string, LengthQty[]>();

	for (const line of lines) {
		const freeQty = num(line.free_base);
		const lengthMm = lengthMmFromVariantKey(String(line.variant_key ?? ''));
		if (freeQty <= 0 || lengthMm <= 0) continue;
		const entry: LengthQty = { length_mm: lengthMm, free_qty_base: freeQty };

		const bomSection = String(line.bom_section ?? '').trim();
		if (bomSection) {
			addLengthQty(bySection, bomSection, entry);
			continue;
		}

		const itemId = String(line.item_id ?? '').trim();
		if (!itemId) continue;
		const list = freeByItem.get(itemId) ?? [];
		list.push(entry);
		freeByItem.set(itemId, list);
	}

	if (freeByItem.size > 0) {
		const itemIds = [...freeByItem.keys()];
		const joined = await datahubQuery<Record<string, unknown>>(
			'inv_items',
			{
				item_id__in: itemIds.join(','),
				select: 'item_id,item_code,name,a.alias,a.source',
				joins: [leftJoin('inv_item_aliases', 'a', 'item_id', 'a.item_id')]
			},
			signal
		);

		const itemById = new Map<string, { item_code?: string; name?: string }>();
		const aliasesByItem = new Map<string, string[]>();
		for (const row of joined) {
			const itemId = String(row.item_id ?? '').trim();
			if (!itemId) continue;
			if (!itemById.has(itemId)) {
				itemById.set(itemId, {
					item_code: typeof row.item_code === 'string' ? row.item_code : undefined,
					name: typeof row.name === 'string' ? row.name : undefined
				});
			}
			const source = pickAliasString(row, 'a', 'source').trim();
			const alias = pickAliasString(row, 'a', 'alias').trim();
			if (source !== 'bom' || !alias) continue;
			const bucket = aliasesByItem.get(itemId) ?? [];
			bucket.push(alias);
			aliasesByItem.set(itemId, bucket);
		}

		for (const [itemId, lengths] of freeByItem) {
			const item = itemById.get(itemId);
			for (const entry of lengths) {
				if (item?.name) addLengthQty(bySection, String(item.name), entry);
				if (item?.item_code) addLengthQty(bySection, String(item.item_code), entry);
			}
			for (const alias of aliasesByItem.get(itemId) ?? []) {
				for (const entry of lengths) {
					addLengthQty(bySection, alias, entry);
				}
			}
		}
	}

	const out = new Map<string, LengthQty[]>();
	for (const [key, byLength] of bySection) {
		out.set(
			key,
			[...byLength.entries()]
				.map(([length_mm, free_qty_base]) => ({ length_mm, free_qty_base }))
				.sort((a, b) => a.length_mm - b.length_mm)
		);
	}
	return out;
}

function availableForSection(
	section: SectionData,
	bySection: Map<string, LengthQty[]>
): LengthQty[] {
	const keys = [
		normalizeBomSectionName(section.baseName ?? section.name),
		normalizeBomSectionName(section.name)
	];
	for (const key of keys) {
		const lengths = bySection.get(key);
		if (lengths?.length) return lengths;
	}
	return [];
}

export async function loadStockLengthsPageData(
	bomId: string,
	projectId: string,
	sectionRules: SectionRule[],
	signal?: AbortSignal
): Promise<StockLengthsPageData | null> {
	const data = await loadCuttingPlanDraft(bomId);
	if (!data) return null;

	const selected = new Set(data.selectedMarks);
	const preferAvailable = data.useAvailableStockLengths === true;
	const availableBySection = preferAvailable
		? await loadAvailableStockLengthsBySection(projectId, signal).catch(
				() => new Map<string, LengthQty[]>()
			)
		: new Map<string, LengthQty[]>();

	return {
		selectedMarks: data.selectedMarks,
		sections: data.sections
			.filter((sec) => sec.marks.some((mark) => selected.has(mark.id)))
			.map((sec) => {
				const rule = matchSectionRule(sectionRules, projectId, sec.flange, sec.thickness);
				const floor = Math.max(0, ...(data.replanExcludeStockLengths ?? []));
				const availableAll = preferAvailable ? availableForSection(sec, availableBySection) : [];
				const available = availableAll.filter((entry) => floor <= 0 || entry.length_mm > floor);
				const resolved = resolveGeneratedStockLengths({
					ruleLengths: generateStockLengths(rule),
					availableLengths: available.map((entry) => entry.length_mm),
					ruleDesc: formatStockRuleDescription(rule, sectionRules, projectId),
					requireAvailable: preferAvailable,
					minLengthExclusiveMm:
						preferAvailable && availableAll.length > 0 && available.length === 0 ? floor : undefined
				});
				const stockQtyByLength =
					resolved.fromStock && available.length > 0
						? Object.fromEntries(available.map((entry) => [entry.length_mm, entry.free_qty_base]))
						: undefined;
				return {
					...sec,
					generatedLengths: resolved.lengths,
					selectedLengths: defaultSelectedStockLengths(
						resolved.lengths,
						data.replanExcludeStockLengths
					),
					ruleDesc: resolved.ruleDesc,
					...(stockQtyByLength ? { stockQtyByLength } : {})
				};
			})
	};
}
