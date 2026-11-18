import type { BomConfig, ProjectProductionPlan, StubType, TowerType } from '../store.svelte.js';
import { formatApiErrorMessage } from '../../../lib/api/types.js';
import { listBomSetWeightKgByBomIds } from './bom-set-weight.js';
import { listTreeBomsByStructureIds } from './boms.api.js';
import { replaceProductionPlanBreadcrumbs } from './breadcrumb-registry.js';
import {
	listPlanLinesByPlanIds,
	listProductionPlans,
	PRODUCTION_PLAN_MOCK
} from './production-plans.api.js';
import { mockEnsureDemoLines, mockQtyByPlanAndBom } from './production-plans.mock.js';
import { listProjectTowersAndStubs } from './structures.api.js';

/** `planId -> bomId -> quantity` for the production-plan matrix columns. */
export type ProductionPlanQtyByPlanAndBom = Map<string, Map<string, number>>;

export type ProductionPlanQrcPageData = {
	towers: TowerType[];
	stubs: StubType[];
	towerBoms: BomConfig[];
	stubBoms: BomConfig[];
	productionPlans: ProjectProductionPlan[];
	qtyByPlanAndBom: ProductionPlanQtyByPlanAndBom;
	setKgByBomId: Map<string, number>;
	planLoadError?: string;
};

/**
 * Loads production-plan matrix data with batched `__in` queries.
 * No project fetch — shell breadcrumbs own project label via `ensureProjectBreadcrumb`.
 */
export async function loadProductionPlanQrcPageData(
	projectId: string,
	signal?: AbortSignal
): Promise<ProductionPlanQrcPageData> {
	const [structures, productionPlansResult] = await Promise.all([
		listProjectTowersAndStubs(projectId, signal),
		loadProductionPlansWithQty(projectId, signal)
	]);

	const { towers, stubs } = structures;
	const towerIds = new Set(towers.map((tower) => tower.id));
	const stubIds = new Set(stubs.map((stub) => stub.id));

	const allBoms = await listTreeBomsByStructureIds([...towerIds, ...stubIds], signal);
	const towerBoms = allBoms.filter((bom) => bom.towerId != null && towerIds.has(bom.towerId));
	const stubBoms = allBoms
		.filter((bom) => bom.towerId != null && stubIds.has(bom.towerId))
		.map((bom) => ({
			...bom,
			towerId: undefined,
			stubId: bom.towerId
		}));

	const setKgByBomId = await listBomSetWeightKgByBomIds(
		allBoms.map((bom) => bom.id),
		signal
	);

	if (PRODUCTION_PLAN_MOCK) {
		mockEnsureDemoLines(
			projectId,
			allBoms.map((bom) => bom.id)
		);
	}

	return {
		towers,
		stubs,
		towerBoms,
		stubBoms,
		productionPlans: productionPlansResult.productionPlans,
		qtyByPlanAndBom: productionPlansResult.qtyByPlanAndBom,
		setKgByBomId,
		planLoadError: productionPlansResult.planLoadError
	};
}

async function loadProductionPlansWithQty(
	projectId: string,
	signal?: AbortSignal
): Promise<{
	productionPlans: ProjectProductionPlan[];
	qtyByPlanAndBom: ProductionPlanQtyByPlanAndBom;
	planLoadError?: string;
}> {
	let productionPlans: ProjectProductionPlan[] = [];
	let planLoadError: string | undefined;

	try {
		productionPlans = await listProductionPlans(projectId, signal);
		replaceProductionPlanBreadcrumbs(
			projectId,
			productionPlans.map((plan) => ({
				id: plan.id,
				projectId: plan.projectId,
				name: plan.name
			}))
		);
	} catch (error) {
		if (error instanceof DOMException && error.name === 'AbortError') throw error;
		planLoadError = formatApiErrorMessage(error);
	}

	let qtyByPlanAndBom: ProductionPlanQtyByPlanAndBom = new Map();
	if (PRODUCTION_PLAN_MOCK) {
		qtyByPlanAndBom = mockQtyByPlanAndBom(projectId);
	} else if (productionPlans.length > 0) {
		const allLines = await listPlanLinesByPlanIds(
			productionPlans.map((plan) => plan.id),
			signal
		);
		qtyByPlanAndBom = new Map(productionPlans.map((plan) => [plan.id, new Map<string, number>()]));
		for (const line of allLines) {
			const byBom = qtyByPlanAndBom.get(line.production_plan_id);
			if (!byBom) continue;
			byBom.set(line.bom_id, (byBom.get(line.bom_id) ?? 0) + (line.quantity ?? 0));
		}
	}

	return { productionPlans, qtyByPlanAndBom, planLoadError };
}

/** @deprecated Use {@link loadProductionPlanQrcPageData}. */
export const loadProductionPlanPageData = loadProductionPlanQrcPageData;

/** @deprecated Use {@link ProductionPlanQrcPageData}. */
export type ProductionPlanPageData = ProductionPlanQrcPageData;
