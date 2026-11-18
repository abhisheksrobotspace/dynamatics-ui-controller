import { listBomSummariesByStructureIds } from './boms.api.js';
import { syncStubBreadcrumbs, upsertStubBreadcrumb } from './breadcrumb-registry.js';
import { getStubById, listStubs } from './structures.api.js';
import { projectStore, type StubBreadcrumb, type StubType } from '../store.svelte.js';

export type StubBomSummary = {
	id: string;
	bomName: string;
};

export type StubsPageData = {
	stubs: StubType[];
	bomsByStubId: Record<string, StubBomSummary[]>;
};

const loadStubsPageInFlight = new Map<string, Promise<StubsPageData>>();

function groupBomSummariesByStructureId(
	structureIds: string[],
	summaries: Awaited<ReturnType<typeof listBomSummariesByStructureIds>>
): Record<string, StubBomSummary[]> {
	const byId: Record<string, StubBomSummary[]> = Object.fromEntries(
		structureIds.map((id) => [id, [] as StubBomSummary[]])
	);

	for (const summary of summaries) {
		const list = byId[summary.structureId];
		if (!list) continue;
		list.push({ id: summary.id, bomName: summary.bomName });
	}

	return byId;
}

/** Fetches a single stub label when missing from the breadcrumb registry (deep-links). */
export async function ensureStubLoaded(
	stubId: string,
	projectId: string,
	signal?: AbortSignal
): Promise<StubBreadcrumb | null> {
	const existing = projectStore.stubTypes.find((stub) => stub.id === stubId);
	if (existing) return existing;

	const stub = await getStubById(stubId, projectId, signal);
	if (!stub) return null;

	upsertStubBreadcrumb(stub);
	return { id: stub.id, projectId: stub.projectId, stubTypeName: stub.stubTypeName };
}

/**
 * Loads stub types for the Stubs page and syncs breadcrumb labels only.
 * Target: slim proj_structures + one slim proj_boms (structure_id__in). No project/customers.
 */
export async function loadStubsPageData(
	projectId: string,
	signal?: AbortSignal
): Promise<StubsPageData> {
	const inFlight = loadStubsPageInFlight.get(projectId);
	if (inFlight) return inFlight;

	const promise = (async () => {
		const stubs = await listStubs(projectId, signal);
		const summaries = await listBomSummariesByStructureIds(
			stubs.map((stub) => stub.id),
			signal
		);
		const bomsByStubId = groupBomSummariesByStructureId(
			stubs.map((stub) => stub.id),
			summaries
		);

		syncStubBreadcrumbs(stubs);

		return { stubs, bomsByStubId };
	})().finally(() => {
		loadStubsPageInFlight.delete(projectId);
	});

	loadStubsPageInFlight.set(projectId, promise);
	return promise;
}

export {
	removeStubBreadcrumb,
	syncStubBreadcrumbs,
	upsertStubBreadcrumb
} from './breadcrumb-registry.js';
