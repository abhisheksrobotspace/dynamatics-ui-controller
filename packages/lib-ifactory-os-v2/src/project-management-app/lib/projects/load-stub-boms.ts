import { getBomById, listBoms, type ListBomsOptions } from './boms.api.js';
import type { BomsPageLoadOptions } from './load-boms.js';
import {
	syncStubBomBreadcrumbs,
	upsertBomBreadcrumb,
	upsertStubBreadcrumb
} from './breadcrumb-registry.js';
import { hasSectionRules } from '../../../cutting-plan-app/lib/cutting-plan/cp.api.js';
import { getStubById } from './structures.api.js';
import {
	projectStore,
	type BomBreadcrumb,
	type BomConfig,
	type StubType
} from '../store.svelte.js';

export type StubBomsPageData = {
	stub: StubType | null;
	boms: BomConfig[];
	hasSectionRules: boolean;
};

const loadStubBomsInFlight = new Map<string, Promise<StubBomsPageData>>();

function key(projectId: string, stubId: string): string {
	return `${projectId}:${stubId}`;
}

function renumberStubBoms(boms: BomConfig[]): BomConfig[] {
	return boms.map((bom, index) => ({ ...bom, sNo: index + 1 }));
}

/** Fetches a single stub BOM label when missing from the breadcrumb registry (deep-links). */
export async function ensureStubBomLoaded(
	projectId: string,
	stubId: string,
	bomId: string,
	signal?: AbortSignal
): Promise<BomBreadcrumb | null> {
	const existing = projectStore.bomConfigs.find((bom) => bom.id === bomId);
	if (existing?.bomName) return existing;

	const bom = await getBomById(projectId, stubId, bomId, signal);
	if (!bom) return existing ?? null;

	const mapped = { ...bom, towerId: undefined, stubId };
	const crumb: BomBreadcrumb = {
		id: mapped.id,
		towerId: mapped.towerId,
		stubId: mapped.stubId,
		bomName: mapped.bomName,
		bomLineageId: mapped.bomLineageId,
		version: mapped.version,
		bomFileId: mapped.bomFileId ?? null,
		bomFile: mapped.bomFile ?? null
	};
	upsertBomBreadcrumb(crumb);
	return crumb;
}

/**
 * Loads BOMs for a stub page — same slim contract as tower BOMs (no project/customers/drawings N+1).
 * Seeds default section rules when the project has none.
 */
export async function loadStubBomsPageData(
	projectId: string,
	stubId: string,
	signal?: AbortSignal,
	options: BomsPageLoadOptions = {}
): Promise<StubBomsPageData> {
	const includeSectionRules = options.includeSectionRules !== false;
	const includePublishedCp = options.includePublishedCp !== false;
	const listOptions: ListBomsOptions = { includePublishedCp };
	const cacheKey = `${key(projectId, stubId)}:${includeSectionRules}:${includePublishedCp}`;
	const inFlight = loadStubBomsInFlight.get(cacheKey);
	if (inFlight) return inFlight;

	const promise = (async () => {
		const [stub, rows, sectionRulesExist] = await Promise.all([
			getStubById(stubId, projectId, signal),
			listBoms(projectId, stubId, signal, listOptions),
			includeSectionRules ? hasSectionRules(projectId, signal) : Promise.resolve(false)
		]);

		if (stub) upsertStubBreadcrumb(stub);

		const boms = rows.map((bom, index) => ({
			...bom,
			sNo: index + 1,
			towerId: undefined,
			stubId
		}));

		syncStubBomBreadcrumbs(boms);

		return {
			stub,
			boms,
			hasSectionRules: sectionRulesExist
		};
	})().finally(() => {
		loadStubBomsInFlight.delete(cacheKey);
	});

	loadStubBomsInFlight.set(cacheKey, promise);
	return promise;
}

export function patchStubBomInList(boms: BomConfig[], bom: BomConfig): BomConfig[] {
	const existing = boms.find((entry) => entry.id === bom.id);
	if (existing) {
		return boms.map((entry) => (entry.id === bom.id ? bom : entry));
	}
	return [...boms, bom];
}

export function removeStubBomFromList(boms: BomConfig[], bomId: string): BomConfig[] {
	return renumberStubBoms(boms.filter((bom) => bom.id !== bomId));
}

export function removeStubBomsByLineageFromList(boms: BomConfig[], lineageId: string): BomConfig[] {
	return renumberStubBoms(boms.filter((bom) => bom.bomLineageId !== lineageId));
}

export {
	removeBomBreadcrumb,
	syncStubBomBreadcrumbs,
	upsertBomBreadcrumb
} from './breadcrumb-registry.js';
