import type { ProjectProductionPlan } from '../store.svelte.js';
import type {
	ProductionPlanSummaryMetadata,
	ProjProductionPlanLineRow,
	ProjProductionPlanRow
} from './types.js';
import { isoDateToDdMmYyyy, releaseStatusToUi } from './releases.api.js';

type CreateProductionPlanInput = {
	projectId: string;
	name: string;
	planDateIso: string;
	notes?: string;
};

type UpdateProductionPlanInput = {
	planId: string;
	name?: string;
	planDateIso?: string;
	status?: 'draft' | 'confirmed';
	notes?: string | null;
	confirmedAt?: string | null;
	metadata?: Record<string, unknown>;
	sNo: number;
};

type PlanLineWrite = {
	planLineId?: string;
	bomId: string;
	quantity: number;
	unit: string;
	description: string;
	tentativeOrderQty?: number | null;
};

function summaryFromMetadata(
	metadata: Record<string, unknown> | undefined
): ProductionPlanSummaryMetadata {
	const summary = metadata?.summary;
	if (!summary || typeof summary !== 'object' || Array.isArray(summary)) return {};
	const record = summary as Record<string, unknown>;
	return {
		releases: typeof record.releases === 'string' ? record.releases : undefined,
		total_qty: typeof record.total_qty === 'number' ? record.total_qty : undefined
	};
}

function mapRow(row: ProjProductionPlanRow, sNo: number): ProjectProductionPlan {
	const summary = summaryFromMetadata(row.metadata);
	return {
		id: row.production_plan_id,
		projectId: row.project_id,
		sNo,
		name: row.plan_name,
		date: isoDateToDdMmYyyy(row.plan_date),
		status: releaseStatusToUi(row.status),
		releases: summary.releases ?? '',
		totalQty: summary.total_qty ?? 0,
		notes: row.notes ?? ''
	};
}

type ProjectMockStore = {
	plans: ProjProductionPlanRow[];
	linesByPlanId: Map<string, ProjProductionPlanLineRow[]>;
};

const stores = new Map<string, ProjectMockStore>();

const SEED_PLAN_IDS = {
	q3: 'mock-plan-q3',
	august: 'mock-plan-august'
} as const;

function newPlanId(): string {
	return crypto.randomUUID();
}

function newLineId(): string {
	return crypto.randomUUID();
}

function getStore(projectId: string): ProjectMockStore {
	let store = stores.get(projectId);
	if (store) return store;

	store = {
		plans: [
			{
				production_plan_id: SEED_PLAN_IDS.q3,
				project_id: projectId,
				plan_name: 'Q3 Production Batch',
				plan_date: '2026-07-15',
				status: 'draft',
				notes: 'Mock draft plan',
				metadata: {
					summary: { releases: 'Tower A, Tower B', total_qty: 12 }
				}
			},
			{
				production_plan_id: SEED_PLAN_IDS.august,
				project_id: projectId,
				plan_name: 'August Run',
				plan_date: '2026-08-01',
				status: 'confirmed',
				notes: 'Mock confirmed plan',
				metadata: {
					summary: { releases: 'Tower A', total_qty: 8 }
				},
				confirmed_at: '2026-07-01T10:00:00.000Z'
			}
		],
		linesByPlanId: new Map()
	};
	stores.set(projectId, store);
	return store;
}

export function mockListProductionPlans(projectId: string): ProjectProductionPlan[] {
	const store = getStore(projectId);
	return store.plans.map((row, index) => mapRow(row, index + 1));
}

export function mockGetProductionPlanById(
	planId: string,
	projectId: string
): ProjectProductionPlan | null {
	const row = getStore(projectId).plans.find(
		(plan) => plan.production_plan_id === planId && plan.project_id === projectId
	);
	return row ? mapRow(row, 1) : null;
}

export function mockGetProductionPlanRow(planId: string): ProjProductionPlanRow | null {
	for (const store of stores.values()) {
		const row = store.plans.find((plan) => plan.production_plan_id === planId);
		if (row) return row;
	}
	return null;
}

export function mockCreateProductionPlan(
	input: CreateProductionPlanInput,
	sNo: number
): ProjectProductionPlan {
	const store = getStore(input.projectId);
	const row: ProjProductionPlanRow = {
		production_plan_id: newPlanId(),
		project_id: input.projectId,
		plan_name: input.name,
		plan_date: input.planDateIso,
		status: 'draft',
		notes: input.notes ?? null,
		metadata: { summary: { releases: '', total_qty: 0 } }
	};
	store.plans = [...store.plans, row];
	store.linesByPlanId.set(row.production_plan_id, []);
	return mapRow(row, sNo);
}

export function mockUpdateProductionPlan(input: UpdateProductionPlanInput): ProjectProductionPlan {
	const row = mockGetProductionPlanRow(input.planId);
	if (!row) throw new Error('Production plan not found');

	const updated: ProjProductionPlanRow = {
		...row,
		plan_name: input.name ?? row.plan_name,
		plan_date: input.planDateIso ?? row.plan_date,
		status: input.status ?? row.status,
		notes: input.notes !== undefined ? input.notes : row.notes,
		confirmed_at: input.confirmedAt !== undefined ? input.confirmedAt : row.confirmed_at,
		metadata: input.metadata ?? row.metadata,
		updated_at: new Date().toISOString()
	};

	for (const store of stores.values()) {
		store.plans = store.plans.map((plan) =>
			plan.production_plan_id === input.planId ? updated : plan
		);
	}

	return mapRow(updated, input.sNo);
}

export function mockListPlanLines(planId: string): ProjPlanLineRow[] {
	for (const store of stores.values()) {
		const lines = store.linesByPlanId.get(planId);
		if (lines) return lines.map((line) => ({ ...line }));
	}
	return [];
}

export function mockListConfirmedPlanLinesForProject(
	projectId: string
): { plan: ProjProductionPlanRow; lines: ProjProductionPlanLineRow[] }[] {
	const store = getStore(projectId);
	return store.plans
		.filter((plan) => plan.status === 'confirmed')
		.map((plan) => ({
			plan,
			lines: [...(store.linesByPlanId.get(plan.production_plan_id) ?? [])]
		}));
}

export function mockSavePlanLines(
	planId: string,
	desired: PlanLineWrite[],
	existing: ProjProductionPlanLineRow[]
): ProjProductionPlanLineRow[] {
	for (const store of stores.values()) {
		if (!store.plans.some((plan) => plan.production_plan_id === planId)) continue;

		const existingByBom = new Map(existing.map((line) => [line.bom_id, line]));
		const result: ProjProductionPlanLineRow[] = [];

		for (const line of desired) {
			const current = existingByBom.get(line.bomId);
			if (!current) {
				result.push({
					production_plan_line_id: newLineId(),
					production_plan_id: planId,
					bom_id: line.bomId,
					quantity: line.quantity,
					unit: line.unit,
					description: line.description,
					tentative_order_qty: line.tentativeOrderQty ?? null,
					metadata: {}
				});
				continue;
			}
			result.push({
				...current,
				quantity: line.quantity,
				unit: line.unit,
				description: line.description,
				tentative_order_qty: line.tentativeOrderQty ?? null
			});
		}

		store.linesByPlanId.set(planId, result);
		return result.map((line) => ({ ...line }));
	}

	throw new Error('Production plan not found');
}

export function mockCreatePlanLine(planId: string, line: PlanLineWrite): ProjProductionPlanLineRow {
	for (const store of stores.values()) {
		if (!store.plans.some((plan) => plan.production_plan_id === planId)) continue;

		const row: ProjProductionPlanLineRow = {
			production_plan_line_id: newLineId(),
			production_plan_id: planId,
			bom_id: line.bomId,
			quantity: line.quantity,
			unit: line.unit,
			description: line.description,
			tentative_order_qty: line.tentativeOrderQty ?? null,
			metadata: {}
		};
		const lines = store.linesByPlanId.get(planId) ?? [];
		store.linesByPlanId.set(planId, [...lines, row]);
		return { ...row };
	}

	throw new Error('Production plan not found');
}

export function mockUpdatePlanLine(
	planLineId: string,
	line: Omit<PlanLineWrite, 'planLineId' | 'bomId'>
): ProjProductionPlanLineRow {
	for (const store of stores.values()) {
		for (const [planId, lines] of store.linesByPlanId.entries()) {
			const index = lines.findIndex((row) => row.production_plan_line_id === planLineId);
			if (index < 0) continue;

			const updated: ProjProductionPlanLineRow = {
				...lines[index],
				quantity: line.quantity,
				unit: line.unit,
				description: line.description,
				tentative_order_qty: line.tentativeOrderQty ?? null
			};
			lines[index] = updated;
			store.linesByPlanId.set(planId, [...lines]);
			return { ...updated };
		}
	}

	throw new Error('Plan line not found');
}

export function mockDeletePlanLine(planLineId: string): void {
	for (const store of stores.values()) {
		for (const [planId, lines] of store.linesByPlanId.entries()) {
			const next = lines.filter((row) => row.production_plan_line_id !== planLineId);
			if (next.length === lines.length) continue;
			store.linesByPlanId.set(planId, next);
			return;
		}
	}
}

/** Seed demo matrix quantities once real BOM ids are known. */
export function mockEnsureDemoLines(projectId: string, bomIds: string[]): void {
	if (bomIds.length === 0) return;

	const store = getStore(projectId);
	const planId = SEED_PLAN_IDS.august;
	if ((store.linesByPlanId.get(planId) ?? []).length > 0) return;

	store.linesByPlanId.set(
		planId,
		bomIds.slice(0, 4).map((bomId, index) => ({
			production_plan_line_id: newLineId(),
			production_plan_id: planId,
			bom_id: bomId,
			quantity: (index + 1) * 2,
			unit: 'Set',
			description: `Mock BOM ${index + 1}`,
			metadata: {}
		}))
	);

	const q3Lines = bomIds.slice(0, 2).map((bomId, index) => ({
		production_plan_line_id: newLineId(),
		production_plan_id: SEED_PLAN_IDS.q3,
		bom_id: bomId,
		quantity: index + 1,
		unit: 'Set',
		description: `Mock BOM ${index + 1}`,
		metadata: {}
	}));
	store.linesByPlanId.set(SEED_PLAN_IDS.q3, q3Lines);
}

export function mockQtyByPlanAndBom(projectId: string): Map<string, Map<string, number>> {
	const store = getStore(projectId);
	const result = new Map<string, Map<string, number>>();

	for (const plan of store.plans) {
		const byBom = new Map<string, number>();
		for (const line of store.linesByPlanId.get(plan.production_plan_id) ?? []) {
			byBom.set(line.bom_id, line.quantity);
		}
		result.set(plan.production_plan_id, byBom);
	}

	return result;
}

export function mockDeleteProductionPlan(planId: string): void {
	for (const store of stores.values()) {
		store.plans = store.plans.filter((plan) => plan.production_plan_id !== planId);
		store.linesByPlanId.delete(planId);
	}
}
