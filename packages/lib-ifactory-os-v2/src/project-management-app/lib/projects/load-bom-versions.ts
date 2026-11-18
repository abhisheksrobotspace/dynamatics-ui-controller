import { listBomsByLineageId } from './boms.api.js';
import {
	upsertBomBreadcrumb,
	upsertStubBreadcrumb,
	upsertTowerBreadcrumb
} from './breadcrumb-registry.js';
import { getStubById, getTowerById } from './structures.api.js';
import type { BomConfig, StubType, TowerType } from '../store.svelte.js';

export type BomVersionsPageData = {
	entity: TowerType | StubType | null;
	versions: BomConfig[];
};

const loadInFlight = new Map<string, Promise<BomVersionsPageData>>();

function cacheKey(
	projectId: string,
	structureId: string,
	lineageId: string,
	kind: 'tower' | 'stub'
): string {
	return `${kind}:${projectId}:${structureId}:${lineageId}`;
}

function toBomBreadcrumb(bom: BomConfig) {
	return {
		id: bom.id,
		towerId: bom.towerId,
		stubId: bom.stubId,
		bomName: bom.bomName,
		bomLineageId: bom.bomLineageId,
		version: bom.version,
		bomFileId: bom.bomFileId ?? null,
		bomFile: bom.bomFile ?? null
	};
}

function seedVersionBreadcrumbs(versions: BomConfig[]) {
	for (const bom of versions) upsertBomBreadcrumb(toBomBreadcrumb(bom));
}

async function loadBomVersionsPageData(
	projectId: string,
	structureId: string,
	lineageId: string,
	kind: 'tower' | 'stub',
	signal?: AbortSignal
): Promise<BomVersionsPageData> {
	const key = cacheKey(projectId, structureId, lineageId, kind);
	const inFlight = loadInFlight.get(key);
	if (inFlight) return inFlight;

	const promise = (async () => {
		const [entity, versions] = await Promise.all([
			kind === 'tower'
				? getTowerById(structureId, projectId, signal)
				: getStubById(structureId, projectId, signal),
			listBomsByLineageId(structureId, lineageId, signal)
		]);

		const mapped =
			kind === 'stub'
				? versions.map((bom) => ({ ...bom, towerId: undefined, stubId: structureId }))
				: versions.map((bom) => ({ ...bom, stubId: undefined, towerId: structureId }));

		if (entity) {
			if (kind === 'tower') upsertTowerBreadcrumb(entity as TowerType);
			else upsertStubBreadcrumb(entity as StubType);
		}
		seedVersionBreadcrumbs(mapped);

		return { entity, versions: mapped };
	})().finally(() => {
		loadInFlight.delete(key);
	});

	loadInFlight.set(key, promise);
	return promise;
}

export function loadTowerBomVersionsPageData(
	projectId: string,
	towerId: string,
	lineageId: string,
	signal?: AbortSignal
): Promise<BomVersionsPageData> {
	return loadBomVersionsPageData(projectId, towerId, lineageId, 'tower', signal);
}

export function loadStubBomVersionsPageData(
	projectId: string,
	stubId: string,
	lineageId: string,
	signal?: AbortSignal
): Promise<BomVersionsPageData> {
	return loadBomVersionsPageData(projectId, stubId, lineageId, 'stub', signal);
}

export function patchVersionInList(boms: BomConfig[], bom: BomConfig): BomConfig[] {
	const existing = boms.find((entry) => entry.id === bom.id);
	if (existing) {
		return boms.map((entry) => (entry.id === bom.id ? bom : entry));
	}
	return [...boms, bom].sort((a, b) => a.version - b.version || a.sNo - b.sNo);
}

export function removeVersionFromList(boms: BomConfig[], bomId: string): BomConfig[] {
	return boms.filter((bom) => bom.id !== bomId).map((bom, index) => ({ ...bom, sNo: index + 1 }));
}
