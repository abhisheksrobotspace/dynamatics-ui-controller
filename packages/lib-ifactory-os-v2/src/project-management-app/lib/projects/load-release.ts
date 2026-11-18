import type {
	BomConfig,
	ProjectRelease,
	ReleaseBreadcrumb,
	ReleaseTowerEntry,
	StubType,
	TowerType
} from '../store.svelte.js';
import { projectStore } from '../store.svelte.js';
import { alreadyReleasedByBomId, buildAllStructureEntries } from '../release.utils.js';
import { listBomSetWeightKgByBomIds } from './bom-set-weight.js';
import { listBomsByStructureIds } from './boms.api.js';
import { releaseToBreadcrumb, upsertReleaseBreadcrumb } from './breadcrumb-registry.js';
import {
	getReleaseById,
	getReleaseWithLines,
	listProjectReleaseLinesForProject
} from './releases.api.js';
import { listProjectTowersAndStubs } from './structures.api.js';
import type { ProjReleaseLineRow } from './types.js';

export type ProjectStructuresWithBoms = {
	towers: TowerType[];
	stubs: StubType[];
	towerBoms: BomConfig[];
	stubBoms: BomConfig[];
};

/** One structures call (`type__in`) + one BOMs call (`structure_id__in`). */
export async function listProjectStructuresWithBoms(
	projectId: string,
	signal?: AbortSignal
): Promise<ProjectStructuresWithBoms> {
	const { towers, stubs } = await listProjectTowersAndStubs(projectId, signal);

	const towerIds = new Set(towers.map((tower) => tower.id));
	const stubIds = new Set(stubs.map((stub) => stub.id));
	const allBoms = await listBomsByStructureIds([...towerIds, ...stubIds], signal);

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

/**
 * Fetches a single release label when missing from the breadcrumb registry (deep-links / reload).
 */
export async function ensureReleaseBreadcrumb(
	releaseId: string,
	projectId: string,
	signal?: AbortSignal
): Promise<ReleaseBreadcrumb | null> {
	const existing = projectStore.releases.find((release) => release.id === releaseId);
	if (existing) return existing;

	const release = await getReleaseById(releaseId, projectId, signal);
	if (!release) return null;

	upsertReleaseBreadcrumb(release);
	return releaseToBreadcrumb(release);
}

export type ReleasePageData = {
	release: ProjectRelease;
	towers: TowerType[];
	stubs: StubType[];
	towerBoms: BomConfig[];
	stubBoms: BomConfig[];
	persistedLines: ProjReleaseLineRow[];
	alreadyReleasedByBom: Map<string, number>;
	draftTowerEntries: ReleaseTowerEntry[];
	draftStubEntries: ReleaseTowerEntry[];
	setKgByBomId: Map<string, number>;
};

/**
 * Load release editor data with batched `__in` queries.
 * No project / customer fetch — shell breadcrumbs own the project label.
 */
export async function loadReleasePageData(
	projectId: string,
	releaseId: string,
	signal?: AbortSignal
): Promise<ReleasePageData> {
	const [structuresWithBoms, releaseBundle, projectReleaseBundles] = await Promise.all([
		listProjectStructuresWithBoms(projectId, signal),
		getReleaseWithLines(releaseId, projectId, signal),
		listProjectReleaseLinesForProject(projectId, signal)
	]);

	if (!releaseBundle) {
		throw new Error('Release not found');
	}

	const { towers, stubs, towerBoms, stubBoms } = structuresWithBoms;
	const { release, lines: persistedLines } = releaseBundle;

	upsertReleaseBreadcrumb(release);

	const alreadyReleasedByBom = alreadyReleasedByBomId(
		projectReleaseBundles.map((bundle) => ({
			releaseId: bundle.release.release_id,
			lines: bundle.lines
		})),
		releaseId
	);

	const draftTowerEntries = buildAllStructureEntries(
		releaseId,
		persistedLines,
		towerBoms,
		towers,
		alreadyReleasedByBom,
		'tower'
	);
	const draftStubEntries = buildAllStructureEntries(
		releaseId,
		persistedLines,
		stubBoms,
		stubs,
		alreadyReleasedByBom,
		'stub'
	);

	const setKgByBomId = await listBomSetWeightKgByBomIds(
		[...towerBoms, ...stubBoms].map((bom) => bom.id),
		signal
	);

	return {
		release,
		towers,
		stubs,
		towerBoms,
		stubBoms,
		persistedLines,
		alreadyReleasedByBom,
		draftTowerEntries,
		draftStubEntries,
		setKgByBomId
	};
}
