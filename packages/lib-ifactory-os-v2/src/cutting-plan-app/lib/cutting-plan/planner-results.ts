import type { AccordionWithTableItem } from '@ifactory/ui-v2';
import { normalizeBomSectionName } from './bom-csv-parser';
import { formatDisplayLength, formatDisplayWeight } from './display-units';
import { resolveSectionUnitWeight } from './plan-section-weights';
import { formatSectionDimensions } from './section-display';
import type {
	PlanBarRow,
	PlanMarking,
	PlanResponse,
	PlanSectionOutput,
	PlanSectionResult
} from './types';

export const WASTE_TARGET_PERCENT = 4;
/** Waste % above this shows the red Badge on the summary accordion. */
export const WASTE_BADGE_ERROR_PERCENT = 10;
/** Set to true to highlight Waste % against WASTE_TARGET_PERCENT and show the target sublabel in KPI strip. */
export const SHOW_WASTE_TARGET_IN_KPI = false;

export type PlanSummaryMetric = {
	label: string;
	value: string;
	highlight?: 'success';
	sublabel?: string;
};

export function formatPlanNumber(num: number | undefined, decimals = 3): string {
	if (num === undefined || num === null || !Number.isFinite(num)) return '-';
	return num.toFixed(decimals);
}

export function formatPlanLengthMeters(lengthMm: number | undefined, decimals = 2): string {
	return formatDisplayLength(lengthMm, { mDecimals: decimals });
}

export function formatPlanWeightKg(weightKg: number | undefined | null, decimals = 1): string {
	return formatDisplayWeight(weightKg, { kgDecimals: decimals });
}

/** Numeric kg for CSV export - no unit suffix, never auto-converts to MT. */
export function formatExportWeightKg(weightKg: number | undefined | null, decimals = 1): string {
	if (weightKg == null || !Number.isFinite(weightKg)) return '';
	return weightKg.toFixed(decimals);
}

/** Waste % of stock length for CSV export: (wasteMm / stockMm) × 100. */
export function formatExportWastePercent(
	wasteMm: number | undefined | null,
	stockMm: number | undefined | null,
	decimals = 2
): string {
	if (
		wasteMm == null ||
		stockMm == null ||
		!Number.isFinite(wasteMm) ||
		!Number.isFinite(stockMm) ||
		stockMm <= 0
	) {
		return '';
	}
	return ((wasteMm / stockMm) * 100).toFixed(decimals);
}

export type PlanWeightTotals = {
	rmWeightKg: number | null;
	requiredWeightKg: number | null;
	wasteWeightKg: number | null;
	partial: boolean;
};

function sectionNamesMatch(left: string, right: string): boolean {
	return normalizeBomSectionName(left) === normalizeBomSectionName(right);
}

function resolveSectionRequiredLengthMm(sectionData: PlanSectionOutput): number {
	const fromResult = sectionData.result?.total_required_length;
	if (fromResult != null && Number.isFinite(fromResult)) return fromResult;

	return (sectionData.plan ?? []).reduce(
		(sum, bar) => sum + sumMarkingsLengthMm(bar.markings) * (bar.quantity ?? 1),
		0
	);
}

export function computePlanResultSummary(
	output: Record<string, PlanSectionOutput>
): PlanResponse['result'] {
	let totalBars = 0;
	let totalStock = 0;
	let totalWaste = 0;
	let totalRequiredLength = 0;
	let totalStockWeight = 0;
	let totalWasteWeight = 0;
	let totalRequiredWeight = 0;
	let optimalSections = 0;
	let feasibleSections = 0;
	let hasStockWeight = false;
	let hasWasteWeight = false;
	let hasRequiredWeight = false;

	for (const sectionData of Object.values(output)) {
		const result = sectionData.result ?? {};
		totalBars += result.num_bars ?? 0;
		totalStock += result.total_stock_length ?? 0;
		totalWaste += result.waste ?? 0;
		totalRequiredLength += resolveSectionRequiredLengthMm(sectionData);

		if (result.total_stock_weight_kg != null && Number.isFinite(result.total_stock_weight_kg)) {
			totalStockWeight += result.total_stock_weight_kg;
			hasStockWeight = true;
		}

		if (result.total_waste_weight_kg != null && Number.isFinite(result.total_waste_weight_kg)) {
			totalWasteWeight += result.total_waste_weight_kg;
			hasWasteWeight = true;
		}

		if (
			result.total_required_weight_kg != null &&
			Number.isFinite(result.total_required_weight_kg)
		) {
			totalRequiredWeight += result.total_required_weight_kg;
			hasRequiredWeight = true;
		}

		if (result.status === 'optimal') optimalSections += 1;
		else if (result.status === 'feasible') feasibleSections += 1;
	}

	return {
		total_sections: Object.keys(output).length,
		total_bars: totalBars,
		total_stock: totalStock,
		total_waste: totalWaste,
		total_required_length: totalRequiredLength,
		total_stock_weight_kg: hasStockWeight ? totalStockWeight : null,
		total_waste_weight_kg: hasWasteWeight ? totalWasteWeight : null,
		total_required_weight_kg: hasRequiredWeight ? totalRequiredWeight : null,
		waste_pct_length: totalStock > 0 ? (totalWaste / totalStock) * 100 : undefined,
		waste_pct_weight:
			hasStockWeight && totalStockWeight > 0 && hasWasteWeight
				? (totalWasteWeight / totalStockWeight) * 100
				: null,
		optimal_sections: optimalSections,
		feasible_sections: feasibleSections
	};
}

function mergePlanOutput(
	previous: Record<string, PlanSectionOutput>,
	incoming: Record<string, PlanSectionOutput>
): Record<string, PlanSectionOutput> {
	const merged = { ...previous };

	for (const [sectionName, sectionOutput] of Object.entries(incoming)) {
		const existingKey = Object.keys(merged).find((key) => sectionNamesMatch(key, sectionName));
		if (existingKey && existingKey !== sectionName) {
			delete merged[existingKey];
		}

		merged[sectionName] = sectionOutput;
	}

	return merged;
}

export function mergePlanResults(
	previous: PlanResponse | null,
	incoming: PlanResponse
): PlanResponse {
	if (!previous?.output || Object.keys(previous.output).length === 0) {
		return incoming;
	}

	if (!incoming.output || Object.keys(incoming.output).length === 0) {
		return previous;
	}

	const mergedOutput = mergePlanOutput(previous.output, incoming.output);

	return {
		bom_id: incoming.bom_id ?? previous.bom_id,
		result: computePlanResultSummary(mergedOutput),
		output: mergedOutput
	};
}

export function computePlanWeightTotals(
	data: PlanResponse,
	unitWeightBySection: Record<string, number> = {}
): PlanWeightTotals {
	const summary = data.result;
	if (
		summary?.total_stock_weight_kg != null ||
		summary?.total_required_weight_kg != null ||
		summary?.total_waste_weight_kg != null
	) {
		return {
			rmWeightKg: summary.total_stock_weight_kg ?? null,
			requiredWeightKg: summary.total_required_weight_kg ?? null,
			wasteWeightKg: summary.total_waste_weight_kg ?? null,
			partial: false
		};
	}

	if (!data.output) {
		return {
			rmWeightKg: null,
			requiredWeightKg: data.result?.total_required_weight_kg ?? null,
			wasteWeightKg: null,
			partial: false
		};
	}

	let rmWeightKg = 0;
	let requiredWeightKg = 0;
	let wasteWeightKg = 0;
	let hasRmWeight = false;
	let hasRequiredWeight = false;
	let hasWasteWeight = false;
	let partial = false;

	for (const [sectionName, sectionData] of Object.entries(data.output)) {
		const unitWeight = resolveSectionUnitWeight(sectionName, unitWeightBySection);
		const result = sectionData.result ?? {};
		const stockMm = result.total_stock_length ?? 0;
		const wasteMm = result.waste ?? 0;
		const requiredMm = (sectionData.plan ?? []).reduce(
			(sum, bar) => sum + sumMarkingsLengthMm(bar.markings),
			0
		);

		if (!unitWeight) {
			if (stockMm > 0 || wasteMm > 0 || requiredMm > 0) partial = true;
			continue;
		}

		if (stockMm > 0) {
			rmWeightKg += (stockMm / 1000) * unitWeight;
			hasRmWeight = true;
		}

		if (requiredMm > 0) {
			requiredWeightKg += (requiredMm / 1000) * unitWeight;
			hasRequiredWeight = true;
		}

		if (wasteMm > 0) {
			wasteWeightKg += (wasteMm / 1000) * unitWeight;
			hasWasteWeight = true;
		}
	}

	const apiRequiredWeight = data.result?.total_required_weight_kg;
	const resolvedRequiredWeight =
		apiRequiredWeight != null && Number.isFinite(apiRequiredWeight)
			? apiRequiredWeight
			: hasRequiredWeight
				? requiredWeightKg
				: null;

	return {
		rmWeightKg: hasRmWeight ? rmWeightKg : null,
		requiredWeightKg: resolvedRequiredWeight,
		wasteWeightKg: hasWasteWeight ? wasteWeightKg : null,
		partial
	};
}

export function formatSectionWeightKg(
	result: PlanSectionResult,
	unitWeightKgPerM?: number
): string {
	if (result.total_stock_weight_kg != null && Number.isFinite(result.total_stock_weight_kg)) {
		return formatPlanWeightKg(result.total_stock_weight_kg);
	}

	const stockMm = result.total_stock_length ?? 0;
	if (!unitWeightKgPerM || stockMm <= 0) return '-';

	return formatPlanWeightKg((stockMm / 1000) * unitWeightKgPerM);
}

export function formatMetricTons(weightKg: number | undefined): string {
	return formatDisplayWeight(weightKg);
}

export function sumMarkingsLengthMm(markings: PlanMarking[] | undefined | null): number {
	if (!Array.isArray(markings)) return 0;

	return markings.reduce((sum, marking) => {
		const length = Number(marking?.length);
		const quantity = Number(marking?.quantity);
		if (!Number.isFinite(length) || !Number.isFinite(quantity)) return sum;
		return sum + length * quantity;
	}, 0);
}

export function computeBarWasteMm(row: PlanBarRow): number {
	const usedMm = sumMarkingsLengthMm(row.markings);
	return Math.max(0, (row.rm_length || 0) - usedMm);
}

export function isHighWasteBar(row: PlanBarRow): boolean {
	const rmLength = row.rm_length || 0;
	if (rmLength <= 0) return false;

	return computeBarWasteMm(row) / rmLength > WASTE_TARGET_PERCENT / 100;
}

export function sumRequiredLengthMm(data: PlanResponse): number {
	if (!data.output) return 0;

	return Object.values(data.output).reduce((total, section) => {
		const sectionTotal = (section.plan ?? []).reduce(
			(sum, bar) => sum + sumMarkingsLengthMm(bar.markings),
			0
		);
		return total + sectionTotal;
	}, 0);
}

export function countSectionsWithPlan(data: PlanResponse): number {
	if (!data.output) return 0;
	return Object.values(data.output).filter((section) => (section.plan?.length ?? 0) > 0).length;
}

export function formatSectionResultSummary(
	result: PlanSectionResult,
	unitWeightKgPerM?: number
): string {
	const bars = result.num_bars ?? 0;
	const stockLabel = formatDisplayLength(result.total_stock_length ?? 0, { mDecimals: 3 });
	const weightLabel = formatSectionWeightKg(result, unitWeightKgPerM);
	const wasteLabel = formatDisplayLength(result.waste ?? 0, { mDecimals: 1 });

	return `Bars ${bars} · Stock ${stockLabel} · Weight ${weightLabel} · Waste ${wasteLabel}`;
}

function resolveRequiredLengthMm(data: PlanResponse): number | undefined {
	const fromApi = data.result?.total_required_length;
	if (fromApi != null && Number.isFinite(fromApi)) return fromApi;

	const computed = sumRequiredLengthMm(data);
	return computed > 0 ? computed : undefined;
}

function resolveWastePercentWeight(data: PlanResponse): number | null {
	const fromApi = data.result?.waste_pct_weight;
	if (fromApi != null && Number.isFinite(fromApi)) return fromApi;

	const totalStockWeight = data.result?.total_stock_weight_kg;
	const totalWasteWeight = data.result?.total_waste_weight_kg;
	if (
		totalStockWeight != null &&
		totalStockWeight > 0 &&
		totalWasteWeight != null &&
		Number.isFinite(totalWasteWeight)
	) {
		return (totalWasteWeight / totalStockWeight) * 100;
	}

	return null;
}

function formatSectionsSummary(result: PlanResponse['result']): string {
	if (!result) return '-';

	const totalSections = result.total_sections;
	if (totalSections != null) return String(totalSections);

	const optimal = result.optimal_sections ?? 0;
	const feasible = result.feasible_sections ?? 0;
	const combined = optimal + feasible;
	return combined > 0 ? String(combined) : '-';
}

function formatSectionsSublabel(result: PlanResponse['result']): string | undefined {
	if (!result) return undefined;

	const optimal = result.optimal_sections;
	const feasible = result.feasible_sections;
	if (optimal == null && feasible == null) return undefined;

	return `${optimal ?? 0} optimal · ${feasible ?? 0} feasible`;
}

function wastePercentKpiExtras(
	wastePercent: number | null
): Pick<PlanSummaryMetric, 'highlight' | 'sublabel'> {
	if (!SHOW_WASTE_TARGET_IN_KPI || wastePercent == null) {
		return {};
	}

	return {
		highlight: wastePercent < WASTE_TARGET_PERCENT ? 'success' : undefined,
		sublabel: wastePercent < WASTE_TARGET_PERCENT ? `${WASTE_TARGET_PERCENT}% target` : undefined
	};
}

export function buildPlanSummaryMetrics(
	data: PlanResponse,
	unitWeightBySection: Record<string, number> = {}
): PlanSummaryMetric[] {
	const result = data.result ?? {};
	const totalStockMm = result.total_stock ?? 0;
	const requiredMm = resolveRequiredLengthMm(data);
	const wastePercent = resolveWastePercentWeight(data);
	const weightTotals = computePlanWeightTotals(data, unitWeightBySection);
	const partialWeightLabel = weightTotals.partial ? 'partial weight' : undefined;

	return [
		{ label: 'Total bars', value: String(result.total_bars ?? '-') },
		{
			label: 'Sections',
			value: formatSectionsSummary(result),
			sublabel: formatSectionsSublabel(result)
		},
		{ label: 'RM length', value: formatPlanLengthMeters(totalStockMm) },
		{ label: 'Required', value: formatPlanLengthMeters(requiredMm) },
		{
			label: 'RM weight',
			value: formatMetricTons(weightTotals.rmWeightKg ?? undefined),
			sublabel: partialWeightLabel
		},
		{
			label: 'Required weight',
			value: formatMetricTons(weightTotals.requiredWeightKg ?? undefined),
			sublabel: partialWeightLabel
		},
		{
			label: 'Waste wt',
			value: formatPlanWeightKg(weightTotals.wasteWeightKg),
			sublabel: partialWeightLabel
		},
		{
			label: 'Waste %',
			value: wastePercent != null ? formatPlanNumber(wastePercent, 2) : '-',
			...wastePercentKpiExtras(wastePercent)
		}
	];
}

export function buildPlanKpiStripMetrics(
	data: PlanResponse,
	unitWeightBySection: Record<string, number> = {}
): PlanSummaryMetric[] {
	return buildPlanSummaryMetrics(data, unitWeightBySection).filter(
		(metric) => metric.label !== 'Sections'
	);
}

function buildPlanSectionAccordionTriggerFields(
	sectionName: string,
	sectionData: PlanSectionOutput,
	unitWeightBySection: Record<string, number>
): Pick<AccordionWithTableItem<PlanBarRow>, 'description' | 'stats' | 'progress'> {
	const result = sectionData.result ?? {};
	const plan = sectionData.plan ?? [];
	const { wasteWeightKg, weightKg } = resolveSectionSummaryWeights(
		sectionName,
		sectionData,
		unitWeightBySection
	);
	const utilization = sectionUtilizationPercent(result);
	const utilizationRounded = utilization != null ? Math.round(utilization) : null;
	const wastePercent = sectionWastePercent(result);

	return {
		description: formatSectionDimensions(sectionName, 0, 0),
		stats: [
			{ label: 'Stock lengths', value: formatSectionStockLengthsSummary(plan) },
			{ label: 'Bars', value: String(result.num_bars ?? plan.length) },
			{ label: 'Weight', value: formatPlanWeightKg(weightKg) },
			{
				label: 'Waste',
				value: wastePercent != null ? `${formatPlanNumber(wastePercent, 2)}%` : '-',
				sublabel: formatPlanWeightKg(wasteWeightKg),
				badgeVariant:
					wastePercent == null
						? undefined
						: wastePercent > WASTE_BADGE_ERROR_PERCENT
							? 'error'
							: 'online'
			}
		],
		progress:
			utilizationRounded != null
				? {
						label: 'Utilisation',
						value: utilizationRounded,
						valueLabel: `${utilizationRounded}% used`,
						fillTone: 'online',
						remainderTone: 'error'
					}
				: undefined
	};
}

export function buildPlanAccordionItems(
	data: PlanResponse,
	unitWeightBySection: Record<string, number> = {}
): AccordionWithTableItem<PlanBarRow>[] {
	if (!data.output) return [];

	return Object.entries(data.output).map(([sectionName, sectionData]) => ({
		value: sectionName,
		label: sectionName,
		...buildPlanSectionAccordionTriggerFields(sectionName, sectionData, unitWeightBySection),
		rowLabel: 'bars',
		rows: sectionData.plan ?? []
	}));
}

export type PlanSummaryTableRow = {
	id: string;
	section: string;
	bars: number;
	stockLengthBadges: string[];
	wasteWeightKg: number | null;
	weightKg: number | null;
};

export type PlanSummaryStockLengthRow = {
	id: string;
	lengthMm: number;
	lengthLabel: string;
	quantity: number;
	/** Stock-length weight: (lengthMm/1000) × qty × unitWeightKgPerM when unit weight is known. */
	weightKg: number | null;
};

export type PlanSummaryTableTotals = {
	bars: number;
	wasteWeightKg: number | null;
	weightKg: number | null;
};

/** Weight of a stock-length line: metres × qty × kg/m. */
export function stockLengthWeightKg(
	lengthMm: number,
	quantity: number,
	unitWeightKgPerM: number | null | undefined
): number | null {
	if (unitWeightKgPerM == null || !Number.isFinite(unitWeightKgPerM) || unitWeightKgPerM <= 0) {
		return null;
	}
	if (!Number.isFinite(lengthMm) || lengthMm <= 0 || !Number.isFinite(quantity) || quantity <= 0) {
		return null;
	}
	return (lengthMm / 1000) * quantity * unitWeightKgPerM;
}

function resolveSectionSummaryWeights(
	sectionName: string,
	sectionData: PlanSectionOutput,
	unitWeightBySection: Record<string, number>
): { wasteWeightKg: number | null; weightKg: number | null } {
	const result = sectionData.result ?? {};
	const totalMm = result.total_stock_length ?? 0;
	const unitWeight = resolveSectionUnitWeight(sectionName, unitWeightBySection);

	const weightKg =
		result.total_stock_weight_kg ??
		(unitWeight && totalMm > 0 ? (totalMm / 1000) * unitWeight : null);

	let wasteWeightKg = result.total_waste_weight_kg ?? null;
	if (wasteWeightKg == null) {
		const wasteMm = result.waste ?? 0;
		if (unitWeight && wasteMm > 0) {
			wasteWeightKg = (wasteMm / 1000) * unitWeight;
		}
	}

	return { wasteWeightKg, weightKg };
}

export function aggregateStockLengthRows(
	plan: PlanBarRow[],
	unitWeightKgPerM: number | null = null
): PlanSummaryStockLengthRow[] {
	const counts = new Map<number, number>();

	for (const bar of plan) {
		const lengthMm = bar.rm_length ?? 0;
		const qty = bar.quantity ?? 1;
		counts.set(lengthMm, (counts.get(lengthMm) ?? 0) + qty);
	}

	return [...counts.entries()]
		.sort((left, right) => right[0] - left[0])
		.map(([lengthMm, quantity]) => ({
			id: String(lengthMm),
			lengthMm,
			lengthLabel: formatDisplayLength(lengthMm, { mDecimals: 3 }),
			quantity,
			weightKg: stockLengthWeightKg(lengthMm, quantity, unitWeightKgPerM)
		}));
}

export function aggregateStockLengthBadges(plan: PlanBarRow[]): string[] {
	return aggregateStockLengthRows(plan).map((row) => `${row.lengthLabel} ×${row.quantity}`);
}

/** Unique stock lengths for accordion trigger, e.g. `7600 / 7475 mm`. */
export function formatSectionStockLengthsSummary(plan: PlanBarRow[]): string {
	const uniqueLengths = [
		...new Set(
			plan
				.map((bar) => bar.rm_length ?? 0)
				.filter((lengthMm) => Number.isFinite(lengthMm) && lengthMm > 0)
		)
	].sort((left, right) => right - left);

	if (uniqueLengths.length === 0) return '-';

	return `${uniqueLengths.map((lengthMm) => Math.round(lengthMm)).join(' / ')} mm`;
}

/** Utilisation % from stock − waste; null when stock length is missing/zero. */
export function sectionUtilizationPercent(result: PlanSectionResult): number | null {
	const stockMm = result.total_stock_length ?? 0;
	if (!Number.isFinite(stockMm) || stockMm <= 0) return null;

	const wasteMm = result.waste ?? 0;
	const usedMm = Math.max(0, stockMm - (Number.isFinite(wasteMm) ? wasteMm : 0));
	return (usedMm / stockMm) * 100;
}

/** Waste % of stock length; null when stock length is missing/zero. */
export function sectionWastePercent(result: PlanSectionResult): number | null {
	const stockMm = result.total_stock_length ?? 0;
	if (!Number.isFinite(stockMm) || stockMm <= 0) return null;

	const wasteMm = result.waste ?? 0;
	if (!Number.isFinite(wasteMm) || wasteMm < 0) return null;
	return (wasteMm / stockMm) * 100;
}

export function buildPlanSummaryTableRows(
	data: PlanResponse,
	unitWeightBySection: Record<string, number> = {}
): PlanSummaryTableRow[] {
	if (!data.output) return [];

	return Object.entries(data.output).map(([sectionName, sectionData]) => {
		const result = sectionData.result ?? {};
		const plan = sectionData.plan ?? [];
		const { wasteWeightKg, weightKg } = resolveSectionSummaryWeights(
			sectionName,
			sectionData,
			unitWeightBySection
		);

		return {
			id: sectionName,
			section: sectionName,
			bars: result.num_bars ?? plan.length,
			stockLengthBadges: aggregateStockLengthBadges(plan),
			wasteWeightKg,
			weightKg
		};
	});
}

export type PlanSummaryExportRow = {
	sec: string;
	/**
	 * Grouped planned name when length-grouped; otherwise the base section name
	 * (same as `sec`) - never blank / `-`.
	 */
	secGroup: string;
	/** Bar stock length in mm (qty is a separate column). */
	lengthMm: number;
	/** Bar quantity (Bars count for this stock-length pattern). */
	qty: number;
	/**
	 * Total waste length (mm) across qty for this stock length.
	 * Null when markings were not available for any bar in the group.
	 */
	wasteMm: number | null;
	/** Waste kg for this bar pattern: (rm_length − markings) × qty × kg/m. */
	wasteKg: number | null;
	/** RM stock weight for this length × qty. */
	weightKg: number | null;
};

/** Format a length/mark with qty: `11400 x6` / `470 x1`. */
export function formatExportQtyLabel(value: string | number, qty: number): string {
	return `${value} x${qty}`;
}

/**
 * Resolve Sec / Sec Group for export.
 * `Sec` = longest matching BOM/base name.
 * `Sec Group` = full planned name when length-grouped; otherwise the base section name.
 */
export function splitSectionExportIdentity(
	sectionName: string,
	knownBaseNames: readonly string[] = []
): { sec: string; secGroup: string } {
	const normalizedSection = normalizeBomSectionName(sectionName);
	let bestBase: string | null = null;

	for (const base of knownBaseNames) {
		const normalizedBase = normalizeBomSectionName(base);
		if (
			normalizedSection === normalizedBase ||
			normalizedSection.startsWith(`${normalizedBase} `)
		) {
			if (!bestBase || base.length > bestBase.length) bestBase = base;
		}
	}

	if (!bestBase) {
		return { sec: sectionName, secGroup: sectionName };
	}

	const isGrouped = normalizeBomSectionName(bestBase) !== normalizedSection;
	return {
		sec: bestBase,
		secGroup: isGrouped ? sectionName : bestBase
	};
}

/**
 * One CSV row per stock length within a section - same grain as the Summary UI
 * (`aggregateStockLengthRows`): identical lengths are merged into a single Qty.
 * Waste is summed from per-bar markings (stock − used). Requires detail bars.
 */
export function buildPlanSummaryExportRows(
	data: PlanResponse,
	unitWeightBySection: Record<string, number> = {},
	knownBaseNames: readonly string[] = []
): PlanSummaryExportRow[] {
	if (!data.output) return [];

	const rows: PlanSummaryExportRow[] = [];
	for (const [sectionName, sectionData] of Object.entries(data.output)) {
		const { sec, secGroup } = splitSectionExportIdentity(sectionName, knownBaseNames);
		const unitWeight = resolveSectionUnitWeight(sectionName, unitWeightBySection) ?? null;

		type LengthAggregate = {
			qty: number;
			wasteMm: number | null;
			wasteKg: number | null;
		};
		const byLength = new Map<number, LengthAggregate>();

		for (const bar of sectionData.plan ?? []) {
			const lengthMm = bar.rm_length ?? 0;
			const qty = bar.quantity ?? 1;
			const existing = byLength.get(lengthMm) ?? { qty: 0, wasteMm: null, wasteKg: null };
			existing.qty += qty;

			const hasMarkings = Array.isArray(bar.markings) && bar.markings.length > 0;
			if (hasMarkings) {
				const barWasteMm = computeBarWasteMm(bar);
				existing.wasteMm = (existing.wasteMm ?? 0) + barWasteMm * qty;
				const barWasteKg = stockLengthWeightKg(barWasteMm, qty, unitWeight);
				if (barWasteKg != null) {
					existing.wasteKg = (existing.wasteKg ?? 0) + barWasteKg;
				}
			}

			byLength.set(lengthMm, existing);
		}

		const lengthRows = [...byLength.entries()]
			.sort((left, right) => right[0] - left[0])
			.map(([lengthMm, aggregate]) => ({
				sec,
				secGroup,
				lengthMm,
				qty: aggregate.qty,
				wasteMm: aggregate.wasteMm,
				wasteKg: aggregate.wasteKg,
				weightKg: stockLengthWeightKg(lengthMm, aggregate.qty, unitWeight)
			}));

		rows.push(...lengthRows);
	}

	return rows;
}

export type PlanBarDetailExportRow = {
	sec: string;
	secGroup: string;
	rmId: string;
	lengthMm: number;
	qty: number;
	/** Comma-separated `mark (length) xqty` list, e.g. `470 (5000 mm) x1, 472 (4719 mm) x1`. */
	markings: string;
	usedMm: number;
	wasteMm: number;
	wasteKg: number | null;
	weightKg: number | null;
};

/** UI-style markings list: `mark (length) xqty, mark (length) xqty`. */
export function formatBarMarkingsForExport(markings: PlanMarking[] | undefined | null): string {
	if (!Array.isArray(markings) || markings.length === 0) return '';
	return markings
		.map((marking) => {
			const mark = (marking.mark ?? '').trim() || 'Unmarked';
			const quantity = Number(marking.quantity);
			const qtyLabel = Number.isFinite(quantity) ? quantity : 0;
			const lengthLabel = formatDisplayLength(marking.length);
			return formatExportQtyLabel(`${mark} (${lengthLabel})`, qtyLabel);
		})
		.join(', ');
}

/** One CSV row per bar pattern - markings as comma-separated `mark (length) xqty`. */
export function buildPlanBarDetailExportRows(
	data: PlanResponse,
	unitWeightBySection: Record<string, number> = {},
	knownBaseNames: readonly string[] = []
): PlanBarDetailExportRow[] {
	if (!data.output) return [];

	const rows: PlanBarDetailExportRow[] = [];
	for (const [sectionName, sectionData] of Object.entries(data.output)) {
		const { sec, secGroup } = splitSectionExportIdentity(sectionName, knownBaseNames);
		const unitWeight = resolveSectionUnitWeight(sectionName, unitWeightBySection) ?? null;

		for (const bar of sectionData.plan ?? []) {
			const lengthMm = bar.rm_length || 0;
			const qty = bar.quantity ?? 1;
			const usedMm = sumMarkingsLengthMm(bar.markings);
			const wasteMm = computeBarWasteMm(bar);
			rows.push({
				sec,
				secGroup,
				rmId: bar.rmid || '',
				lengthMm,
				qty,
				markings: formatBarMarkingsForExport(bar.markings),
				usedMm,
				wasteMm,
				wasteKg: stockLengthWeightKg(wasteMm, qty, unitWeight),
				weightKg: stockLengthWeightKg(lengthMm, qty, unitWeight)
			});
		}
	}

	return rows;
}

/** Safe download basename from a BOM / plan label (strips filesystem-illegal chars). */
export function sanitizeCuttingPlanExportFilename(name: string): string {
	const cleaned = name
		.trim()
		.replace(/[/\\?%*:|"<>]/g, '-')
		.replace(/\s+/g, '-')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '');
	return cleaned || 'cutting-plan';
}

export function buildPlanSummaryAccordionItems(
	data: PlanResponse,
	unitWeightBySection: Record<string, number> = {}
): AccordionWithTableItem<PlanSummaryStockLengthRow>[] {
	if (!data.output) return [];

	return Object.entries(data.output).map(([sectionName, sectionData]) => {
		const plan = sectionData.plan ?? [];
		const unitWeight = resolveSectionUnitWeight(sectionName, unitWeightBySection);

		return {
			value: sectionName,
			label: sectionName,
			...buildPlanSectionAccordionTriggerFields(sectionName, sectionData, unitWeightBySection),
			rowLabel: 'lengths',
			rows: aggregateStockLengthRows(plan, unitWeight)
		};
	});
}

export function buildPlanSummaryTableTotals(rows: PlanSummaryTableRow[]): PlanSummaryTableTotals {
	return rows.reduce<PlanSummaryTableTotals>(
		(totals, row) => ({
			bars: totals.bars + row.bars,
			wasteWeightKg:
				row.wasteWeightKg != null
					? (totals.wasteWeightKg ?? 0) + row.wasteWeightKg
					: totals.wasteWeightKg,
			weightKg: row.weightKg != null ? (totals.weightKg ?? 0) + row.weightKg : totals.weightKg
		}),
		{
			bars: 0,
			wasteWeightKg: null,
			weightKg: null
		}
	);
}
