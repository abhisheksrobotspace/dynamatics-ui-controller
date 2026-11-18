import { datahubQuery, leftJoin, pickAliasString } from '../../lib/api/datahub-query.js';
import { normalizeBomSectionName } from '../../cutting-plan-app/lib/cutting-plan/bom-csv-parser.js';
import { resolveSectionUnitWeight } from '../../cutting-plan-app/lib/cutting-plan/plan-section-weights.js';
import type {
	PlanResponse,
	PlanSectionOutput
} from '../../cutting-plan-app/lib/cutting-plan/types.js';
import { getCuttingPlanDetail } from './cutting-plan-detail.api.js';
import { getIndentRecord } from './indents.api.js';
import type {
	IndentDetail,
	IndentRecord,
	IndentSectionCategory,
	IndentSectionLine
} from './indents.types.js';
import { getStockRegisterRows } from './stock-register.store.js';
import type { StockRegisterRow } from './stock-register.types.js';

type ProjectRow = Record<string, unknown> & {
	project_id: string;
	customer_id: string;
};

function normalizeSectionKey(name: string): string {
	return normalizeBomSectionName(name).trim().toUpperCase();
}

function sectionCategory(sectionName: string): IndentSectionCategory {
	return sectionName.trim().toUpperCase().startsWith('HT ') ? 'HT' : 'MS';
}

function sectionBars(sectionData: PlanSectionOutput): number {
	const resultBars = sectionData.result?.num_bars;
	if (resultBars != null && Number.isFinite(resultBars)) return resultBars;

	return (sectionData.plan ?? []).reduce((sum, bar) => sum + (bar.quantity ?? 1), 0);
}

function sectionWeightMt(
	sectionName: string,
	sectionData: PlanSectionOutput,
	unitWeightBySection: Record<string, number>
): number {
	const weightKg = sectionData.result?.total_stock_weight_kg;
	if (weightKg != null && Number.isFinite(weightKg)) return weightKg / 1000;

	const totalMm = sectionData.result?.total_stock_length ?? 0;
	const unitWeight = resolveSectionUnitWeight(sectionName, unitWeightBySection);
	if (unitWeight && totalMm > 0) return ((totalMm / 1000) * unitWeight) / 1000;

	return 0;
}

function stockRowMatchesSection(row: StockRegisterRow, sectionKey: string): boolean {
	const candidates = [row.section, row.location_party, row.item, row.project]
		.filter(Boolean)
		.map((value) => normalizeSectionKey(String(value)));

	return candidates.some(
		(candidate) =>
			candidate === sectionKey || candidate.includes(sectionKey) || sectionKey.includes(candidate)
	);
}

function inStockBarsForSection(sectionName: string, stockRows: StockRegisterRow[]): number {
	const sectionKey = normalizeSectionKey(sectionName);
	return stockRows.reduce((sum, row) => {
		if (!stockRowMatchesSection(row, sectionKey)) return sum;
		return sum + Number(row.closing_summ_nos || 0);
	}, 0);
}

function buildSectionLines(
	planResponse: PlanResponse,
	unitWeightBySection: Record<string, number>,
	stockRows: StockRegisterRow[]
): IndentSectionLine[] {
	if (!planResponse.output) return [];

	return Object.entries(planResponse.output)
		.map(([sectionName, sectionData]) => {
			const qty = sectionBars(sectionData);
			const inStock = inStockBarsForSection(sectionName, stockRows);
			const requiredQty = Math.max(0, qty - inStock);

			return {
				sectionKey: normalizeSectionKey(sectionName),
				sectionName,
				category: sectionCategory(sectionName),
				unitWtMt: sectionWeightMt(sectionName, sectionData, unitWeightBySection),
				qty,
				inStock,
				requiredQty
			};
		})
		.sort((left, right) => {
			if (left.category !== right.category) {
				return left.category === 'HT' ? -1 : 1;
			}
			return left.sectionName.localeCompare(right.sectionName);
		});
}

export function formatIndentDateIn(value: string): string {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return '-';
	return new Intl.DateTimeFormat('en-IN', {
		day: '2-digit',
		month: '2-digit',
		year: 'numeric'
	}).format(date);
}

export async function getProjectCustomerName(
	projectId: string,
	signal?: AbortSignal
): Promise<string> {
	const rows = await datahubQuery<ProjectRow>(
		'proj_projects',
		{
			project_id: projectId,
			select: 'project_id,customer_id,c.name',
			limit: 1,
			joins: [leftJoin('proj_customers', 'c', 'customer_id', 'c.customer_id')]
		},
		signal
	);
	const name = pickAliasString(rows[0] ?? {}, 'c', 'name').trim();
	return name || '-';
}

export async function getIndentDetail(
	indentId: string,
	signal?: AbortSignal
): Promise<IndentDetail | null> {
	const indent = await getIndentRecord(indentId, signal);
	if (!indent) return null;

	const cuttingPlan = await getCuttingPlanDetail(indent.cutting_plan_id, signal);
	if (!cuttingPlan) {
		return {
			indent,
			sections: []
		};
	}

	const stockRows = getStockRegisterRows();
	const sections = buildSectionLines(
		cuttingPlan.planResponse,
		cuttingPlan.unitWeightBySection,
		stockRows
	);

	const htMt = sections
		.filter((section) => section.category === 'HT')
		.reduce((sum, section) => sum + section.unitWtMt, 0);
	const msMt = sections
		.filter((section) => section.category === 'MS')
		.reduce((sum, section) => sum + section.unitWtMt, 0);

	const enrichedIndent: IndentRecord = {
		...indent,
		ht_mt: htMt,
		ms_mt: msMt,
		total_mt: htMt + msMt
	};

	return {
		indent: enrichedIndent,
		sections
	};
}
