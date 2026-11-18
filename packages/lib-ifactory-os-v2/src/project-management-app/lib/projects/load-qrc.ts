import type { BomConfig, ProjectRelease, StubType, TowerType } from '../store.svelte.js';
import { listBomSetWeightKgByBomIds } from './bom-set-weight.js';
import { listTreeBomsByStructureIds } from './boms.api.js';
import { replaceReleaseBreadcrumbs } from './breadcrumb-registry.js';
import {
	listReleaseLinesByReleaseIds,
	listAllReleaseLinesForProject,
	listReleases
} from './releases.api.js';
import { listProjectTowersAndStubs } from './structures.api.js';
import { releaseQtyByBomIdFromBundles } from '../release.utils.js';

/** `releaseId -> bomId -> quantity` for QRC matrix columns. */
export type QrcQtyByReleaseAndBom = Map<string, Map<string, number>>;

export type QrcPageData = {
	towers: TowerType[];
	stubs: StubType[];
	towerBoms: BomConfig[];
	stubBoms: BomConfig[];
	releases: ProjectRelease[];
	qtyByReleaseAndBom: QrcQtyByReleaseAndBom;
	setKgByBomId: Map<string, number>;
};

/**
 * Per-BOM fabrication release (field survey) quantities summed across all releases.
 */
export async function loadReleaseQtyByBom(
	projectId: string,
	signal?: AbortSignal
): Promise<Map<string, number>> {
	const bundles = await listAllReleaseLinesForProject(projectId, signal);
	return releaseQtyByBomIdFromBundles(bundles);
}

/**
 * Loads QRC matrix data with batched `__in` queries.
 * No project / customer fetches — shell breadcrumbs own project label via `ensureProjectBreadcrumb`.
 */
export async function loadQrcPageData(
	projectId: string,
	signal?: AbortSignal
): Promise<QrcPageData> {
	const [structures, releases] = await Promise.all([
		listProjectTowersAndStubs(projectId, signal),
		listReleases(projectId, signal)
	]);

	const { towers, stubs } = structures;
	const towerIds = new Set(towers.map((tower) => tower.id));
	const stubIds = new Set(stubs.map((stub) => stub.id));

	const [allBoms, allLines] = await Promise.all([
		listTreeBomsByStructureIds([...towerIds, ...stubIds], signal),
		listReleaseLinesByReleaseIds(
			releases.map((release) => release.id),
			signal
		)
	]);

	const towerBoms = allBoms.filter((bom) => bom.towerId != null && towerIds.has(bom.towerId));
	const stubBoms = allBoms
		.filter((bom) => bom.towerId != null && stubIds.has(bom.towerId))
		.map((bom) => ({
			...bom,
			towerId: undefined,
			stubId: bom.towerId
		}));

	replaceReleaseBreadcrumbs(
		projectId,
		releases.map((release) => ({
			id: release.id,
			projectId: release.projectId,
			name: release.name,
			date: release.date
		}))
	);

	const qtyByReleaseAndBom: QrcQtyByReleaseAndBom = new Map(
		releases.map((release) => [release.id, new Map<string, number>()])
	);
	for (const line of allLines) {
		const byBom = qtyByReleaseAndBom.get(line.release_id);
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
		releases,
		qtyByReleaseAndBom,
		setKgByBomId
	};
}
