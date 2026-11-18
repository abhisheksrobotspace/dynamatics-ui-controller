import { listBomSummariesByStructureIds } from './boms.api.js';
import {
	removeTowerBreadcrumb,
	syncTowerBreadcrumbs,
	towerToBreadcrumb,
	upsertTowerBreadcrumb
} from './breadcrumb-registry.js';
import { getTowerById, listTowers } from './structures.api.js';
import { projectStore, type TowerBreadcrumb, type TowerType } from '../store.svelte.js';

export type TowerBomSummary = {
	id: string;
	bomName: string;
};

export type TowersPageData = {
	towers: TowerType[];
	bomsByTowerId: Record<string, TowerBomSummary[]>;
};

const loadTowersPageInFlight = new Map<string, Promise<TowersPageData>>();

function groupBomSummariesByStructureId(
	structureIds: string[],
	summaries: Awaited<ReturnType<typeof listBomSummariesByStructureIds>>
): Record<string, TowerBomSummary[]> {
	const byId: Record<string, TowerBomSummary[]> = Object.fromEntries(
		structureIds.map((id) => [id, [] as TowerBomSummary[]])
	);

	for (const summary of summaries) {
		const list = byId[summary.structureId];
		if (!list) continue;
		list.push({ id: summary.id, bomName: summary.bomName });
	}

	return byId;
}

/** Fetches a single tower label when missing from the breadcrumb registry (deep-links). */
export async function ensureTowerLoaded(
	towerId: string,
	projectId: string,
	signal?: AbortSignal
): Promise<TowerBreadcrumb | null> {
	const existing = projectStore.towerTypes.find((tower) => tower.id === towerId);
	if (existing) return existing;

	const tower = await getTowerById(towerId, projectId, signal);
	if (!tower) return null;

	upsertTowerBreadcrumb(tower);
	return towerToBreadcrumb(tower);
}

/**
 * Loads tower types for the Towers page and syncs breadcrumb labels only.
 * Target: slim proj_structures + one slim proj_boms (structure_id__in). No project/customers.
 */
export async function loadTowersPageData(
	projectId: string,
	signal?: AbortSignal
): Promise<TowersPageData> {
	const inFlight = loadTowersPageInFlight.get(projectId);
	if (inFlight) return inFlight;

	const promise = (async () => {
		const towers = await listTowers(projectId, signal);
		const summaries = await listBomSummariesByStructureIds(
			towers.map((tower) => tower.id),
			signal
		);
		const bomsByTowerId = groupBomSummariesByStructureId(
			towers.map((tower) => tower.id),
			summaries
		);

		syncTowerBreadcrumbs(towers);

		return { towers, bomsByTowerId };
	})().finally(() => {
		loadTowersPageInFlight.delete(projectId);
	});

	loadTowersPageInFlight.set(projectId, promise);
	return promise;
}

export { removeTowerBreadcrumb, syncTowerBreadcrumbs, towerToBreadcrumb, upsertTowerBreadcrumb };
