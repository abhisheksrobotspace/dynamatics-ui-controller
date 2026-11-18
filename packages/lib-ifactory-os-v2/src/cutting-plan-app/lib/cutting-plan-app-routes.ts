/** Structure + hash helpers for Cutting Plan browse + CP wizard routes. */

import {
	bomLineageVersionsHash as pmBomLineageVersionsHash,
	bomSectionsHash as pmBomSectionsHash,
	bomStockLengthsHash as pmBomStockLengthsHash,
	cuttingPlanRunHash as pmCuttingPlanRunHash,
	cuttingPlanRunsHash as pmCuttingPlanRunsHash,
	type BomStructureRef
} from '../../project-management-app/lib/bom-structure-routes.js';

export type { BomStructureRef };

export function bomStructureFromParams(params: Record<string, string>): BomStructureRef {
	if (params.stubId) return { kind: 'stub', stubId: params.stubId };
	return { kind: 'tower', towerId: params.towerId };
}

export function structureId(ref: BomStructureRef): string {
	return ref.kind === 'tower' ? ref.towerId : ref.stubId;
}

function structureSegment(ref: BomStructureRef): string {
	return ref.kind === 'tower' ? `Towers/${ref.towerId}` : `Stubs/${ref.stubId}`;
}

export const APP = 'CuttingPlan';

function structureRoot(projectId: string, structure: BomStructureRef): string {
	return `#/${APP}/Home/${projectId}/${structureSegment(structure)}`;
}

function bomRoot(projectId: string, structure: BomStructureRef): string {
	return `${structureRoot(projectId, structure)}/Boms`;
}

export function cpHomeHash(): string {
	return `#/${APP}/Home`;
}

export function cpProjectHomeHash(projectId: string): string {
	return `#/${APP}/Home/${projectId}`;
}

export function cpTowersHash(projectId: string): string {
	return `#/${APP}/Home/${projectId}/Towers`;
}

export function cpStubsHash(projectId: string): string {
	return `#/${APP}/Home/${projectId}/Stubs`;
}

export function cpBomsListHash(projectId: string, structure: BomStructureRef): string {
	return bomRoot(projectId, structure);
}

export function cpLineageVersionsHash(
	projectId: string,
	structure: BomStructureRef,
	lineageId: string
): string {
	return pmBomLineageVersionsHash(projectId, structure, lineageId, APP);
}

export function cpSectionsHash(
	projectId: string,
	structure: BomStructureRef,
	bomId: string
): string {
	return pmBomSectionsHash(projectId, structure, bomId, APP);
}

export function cpStockLengthsHash(
	projectId: string,
	structure: BomStructureRef,
	bomId: string
): string {
	return pmBomStockLengthsHash(projectId, structure, bomId, APP);
}

export function cpRunsHash(projectId: string, structure: BomStructureRef, bomId: string): string {
	return pmCuttingPlanRunsHash(projectId, structure, bomId, APP);
}

export function cpRunHash(
	projectId: string,
	structure: BomStructureRef,
	bomId: string,
	runId: string,
	page: 'Summary' | 'Plan'
): string {
	return pmCuttingPlanRunHash(projectId, structure, bomId, runId, page, APP);
}
