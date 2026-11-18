import type { BomConfig, ProjectDeliverySchedule, StubType, TowerType } from '../store.svelte.js';
import { listBomSetWeightKgByBomIds } from './bom-set-weight.js';
import { listTreeBomsByStructureIds } from './boms.api.js';
import { replaceDeliveryScheduleBreadcrumbs } from './breadcrumb-registry.js';
import { listDeliveryScheduleLinesByIds, listDeliverySchedules } from './delivery-schedules.api.js';
import { listProjectTowersAndStubs } from './structures.api.js';

export type DeliveryScheduleStructuresWithBoms = {
	towers: TowerType[];
	stubs: StubType[];
	towerBoms: BomConfig[];
	stubBoms: BomConfig[];
};

/** Towers/stubs plus tree-only BOM fields (`bom_id`, name, structure, sort). */
export async function listDeliveryScheduleStructuresWithBoms(
	projectId: string,
	signal?: AbortSignal
): Promise<DeliveryScheduleStructuresWithBoms> {
	const { towers, stubs } = await listProjectTowersAndStubs(projectId, signal);
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

	return { towers, stubs, towerBoms, stubBoms };
}

/** `scheduleId -> bomId -> quantity` for Delivery Schedule matrix columns. */
export type DeliveryScheduleQtyByScheduleAndBom = Map<string, Map<string, number>>;

export type DeliveryScheduleMatrixData = {
	towers: TowerType[];
	stubs: StubType[];
	towerBoms: BomConfig[];
	stubBoms: BomConfig[];
	schedules: ProjectDeliverySchedule[];
	qtyByScheduleAndBom: DeliveryScheduleQtyByScheduleAndBom;
	setKgByBomId: Map<string, number>;
};

/**
 * Loads Delivery Schedule matrix data with batched `__in` queries.
 * No project fetch — shell breadcrumbs own project label via `ensureProjectBreadcrumb`.
 */
export async function loadDeliveryScheduleMatrixData(
	projectId: string,
	signal?: AbortSignal
): Promise<DeliveryScheduleMatrixData> {
	const [structuresWithBoms, schedules] = await Promise.all([
		listDeliveryScheduleStructuresWithBoms(projectId, signal),
		listDeliverySchedules(projectId, signal)
	]);

	const { towers, stubs, towerBoms, stubBoms } = structuresWithBoms;
	const allBoms = [...towerBoms, ...stubBoms];

	const allLines = await listDeliveryScheduleLinesByIds(
		schedules.map((schedule) => schedule.id),
		signal
	);

	replaceDeliveryScheduleBreadcrumbs(
		projectId,
		schedules.map((schedule) => ({
			id: schedule.id,
			projectId: schedule.projectId,
			name: schedule.name,
			date: schedule.date
		}))
	);

	const qtyByScheduleAndBom: DeliveryScheduleQtyByScheduleAndBom = new Map(
		schedules.map((schedule) => [schedule.id, new Map<string, number>()])
	);
	for (const line of allLines) {
		const byBom = qtyByScheduleAndBom.get(line.delivery_schedule_id);
		if (!byBom) continue;
		byBom.set(line.bom_id, (byBom.get(line.bom_id) ?? 0) + (line.quantity ?? 0));
	}

	const setKgByBomId = await listBomSetWeightKgByBomIds(
		allBoms.map((bom) => bom.id),
		signal
	);

	return {
		towers,
		stubs,
		towerBoms,
		stubBoms,
		schedules,
		qtyByScheduleAndBom,
		setKgByBomId
	};
}
