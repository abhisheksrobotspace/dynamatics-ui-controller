import { getBomById, listBoms } from './boms.api.js';
import {
	syncTowerBomBreadcrumbs,
	upsertBomBreadcrumb,
	upsertTowerBreadcrumb
} from './breadcrumb-registry.js';
import { hasSectionRules } from '../../../cutting-plan-app/lib/cutting-plan/cp.api.js';
import { getTowerById } from './structures.api.js';
import {
	projectStore,
	type BomBreadcrumb,
	type BomConfig,
	type TowerType
} from '../store.svelte.js';

export type BomsPageLoadOptions = {
	/** Default true — Versions page needs CP gating. */
	includeSectionRules?: boolean;
	/** Default true — Versions page needs published run id. */
	includePublishedCp?: boolean;
};

/** Subtypes list: structure + BOM rows only (no CP/OCR side data). */
export const SUBTYPES_PAGE_LOAD_OPTIONS: BomsPageLoadOptions = {
	includeSectionRules: false,
	includePublishedCp: false
};

export type BomsPageData = {
	tower: TowerType | null;
	boms: BomConfig[];
	hasSectionRules: boolean;
};

const loadBomsInFlight = new Map<string, Promise<BomsPageData>>();

function key(projectId: string, towerId: string): string {
	return `${projectId}:${towerId}`;
}

function renumberTowerBoms(boms: BomConfig[]): BomConfig[] {
	return boms.map((bom, index) => ({ ...bom, sNo: index + 1 }));
}

/** Fetches a single BOM label when missing from the breadcrumb registry (deep-links). */
export async function ensureBomLoaded(
	projectId: string,
	towerId: string,
	bomId: string,
	signal?: AbortSignal
): Promise<BomBreadcrumb | null> {
	const existing = projectStore.bomConfigs.find((bom) => bom.id === bomId);
	if (existing?.bomName) return existing;

	const bom = await getBomById(projectId, towerId, bomId, signal);
	if (!bom) return existing ?? null;

	const crumb: BomBreadcrumb = {
		id: bom.id,
		towerId: bom.towerId,
		stubId: bom.stubId,
		bomName: bom.bomName,
		bomLineageId: bom.bomLineageId,
		version: bom.version,
		bomFileId: bom.bomFileId ?? null,
		bomFile: bom.bomFile ?? null
	};
	upsertBomBreadcrumb(crumb);
	return crumb;
}

/**
 * Loads BOMs for a tower page.
 * Target: proj_boms (projected) + section-rules existence (+ tower if needed). No project/customers
 * or drawings N+1. Seeds default section rules when the project has none.
 */
export async function loadBomsPageData(
	projectId: string,
	towerId: string,
	signal?: AbortSignal,
	options: BomsPageLoadOptions = {}
): Promise<BomsPageData> {
	const includeSectionRules = options.includeSectionRules !== false;
	const includePublishedCp = options.includePublishedCp !== false;
	const cacheKey = `${key(projectId, towerId)}:${includeSectionRules}:${includePublishedCp}`;
	const inFlight = loadBomsInFlight.get(cacheKey);
	if (inFlight) return inFlight;

	const promise = (async () => {
		const [tower, boms, sectionRulesExist] = await Promise.all([
			getTowerById(towerId, projectId, signal),
			listBoms(projectId, towerId, signal, { includePublishedCp }),
			includeSectionRules ? hasSectionRules(projectId, signal) : Promise.resolve(false)
		]);

		if (tower) upsertTowerBreadcrumb(tower);
		syncTowerBomBreadcrumbs(boms);

		return {
			tower,
			boms,
			hasSectionRules: sectionRulesExist
		};
	})().finally(() => {
		loadBomsInFlight.delete(cacheKey);
	});

	loadBomsInFlight.set(cacheKey, promise);
	return promise;
}

export function patchTowerBomInList(boms: BomConfig[], bom: BomConfig): BomConfig[] {
	const existing = boms.find((entry) => entry.id === bom.id);
	if (existing) {
		return boms.map((entry) => (entry.id === bom.id ? bom : entry));
	}
	return [...boms, bom];
}

export function removeTowerBomFromList(boms: BomConfig[], bomId: string): BomConfig[] {
	return renumberTowerBoms(boms.filter((bom) => bom.id !== bomId));
}

export function removeTowerBomsByLineageFromList(
	boms: BomConfig[],
	lineageId: string
): BomConfig[] {
	return renumberTowerBoms(boms.filter((bom) => bom.bomLineageId !== lineageId));
}

export {
	removeBomBreadcrumb,
	syncTowerBomBreadcrumbs,
	upsertBomBreadcrumb
} from './breadcrumb-registry.js';
