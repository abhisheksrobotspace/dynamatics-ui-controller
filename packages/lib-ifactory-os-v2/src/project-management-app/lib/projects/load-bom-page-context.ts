import { getBomById } from './boms.api.js';
import {
	upsertBomBreadcrumb,
	upsertStubBreadcrumb,
	upsertTowerBreadcrumb
} from './breadcrumb-registry.js';
import { fetchProjectForPage } from './load-project.js';
import { getStubById, getTowerById } from './structures.api.js';
import type { BomConfig, Project, StubType, TowerType } from '../store.svelte.js';

export type TowerBomPageContext = {
	project: Project | null;
	tower: TowerType | null;
	bom: BomConfig | null;
};

export type StubBomPageContext = {
	project: Project | null;
	stub: StubType | null;
	bom: BomConfig | null;
};

export type BomPageContext = {
	project: Project | null;
	tower: TowerType | null;
	stub: StubType | null;
	bom: BomConfig | null;
};

export async function loadTowerBomPageContext(
	projectId: string,
	towerId: string,
	bomId: string,
	signal?: AbortSignal
): Promise<TowerBomPageContext> {
	const [project, tower, bom] = await Promise.all([
		fetchProjectForPage(projectId, signal),
		getTowerById(towerId, projectId, signal),
		getBomById(projectId, towerId, bomId, signal)
	]);

	if (tower) upsertTowerBreadcrumb(tower);
	if (bom) upsertBomBreadcrumb(bom);

	return { project, tower, bom };
}

export async function loadStubBomPageContext(
	projectId: string,
	stubId: string,
	bomId: string,
	signal?: AbortSignal
): Promise<StubBomPageContext> {
	const [project, stub, bom] = await Promise.all([
		fetchProjectForPage(projectId, signal),
		getStubById(stubId, projectId, signal),
		getBomById(projectId, stubId, bomId, signal)
	]);

	if (stub) upsertStubBreadcrumb(stub);
	if (bom) {
		const stubBom = { ...bom, towerId: undefined, stubId };
		upsertBomBreadcrumb(stubBom);
	}

	return {
		project,
		stub,
		bom: bom ? { ...bom, towerId: undefined, stubId } : null
	};
}

export async function loadBomPageContext(
	projectId: string,
	params: Record<string, string>,
	bomId: string,
	signal?: AbortSignal
): Promise<BomPageContext> {
	if (params.stubId) {
		const context = await loadStubBomPageContext(projectId, params.stubId, bomId, signal);
		return { project: context.project, tower: null, stub: context.stub, bom: context.bom };
	}

	const context = await loadTowerBomPageContext(projectId, params.towerId, bomId, signal);
	return { project: context.project, tower: context.tower, stub: null, bom: context.bom };
}
