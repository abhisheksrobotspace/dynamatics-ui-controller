/** Structure + hash helpers for OCR browse / Mark Region / Results routes. */

import {
	bomDrawingSetHash as pmBomDrawingSetHash,
	bomItemsHash as pmBomItemsHash,
	bomLineageVersionsHash as pmBomLineageVersionsHash,
	bomVersionDetailHash as pmBomVersionDetailHash,
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

const APP = 'OCR';

function structureRoot(projectId: string, structure: BomStructureRef): string {
	return `#/${APP}/Home/${projectId}/${structureSegment(structure)}`;
}

function bomRoot(projectId: string, structure: BomStructureRef): string {
	return `${structureRoot(projectId, structure)}/Boms`;
}

export function ocrDrawingsHomeHash(): string {
	return `#/${APP}/Home`;
}

export function ocrProjectHomeHash(projectId: string): string {
	return `#/${APP}/Home/${projectId}`;
}

export function ocrTowersHash(projectId: string): string {
	return `#/${APP}/Home/${projectId}/Towers`;
}

export function ocrStubsHash(projectId: string): string {
	return `#/${APP}/Home/${projectId}/Stubs`;
}

export function ocrBomsListHash(projectId: string, structure: BomStructureRef): string {
	return bomRoot(projectId, structure);
}

export function ocrLineageVersionsHash(
	projectId: string,
	structure: BomStructureRef,
	lineageId: string
): string {
	return pmBomLineageVersionsHash(projectId, structure, lineageId, APP);
}

export function ocrBomDetailHash(
	projectId: string,
	structure: BomStructureRef,
	bomId: string
): string {
	return pmBomVersionDetailHash(projectId, structure, bomId, APP);
}

export function ocrBomItemsHash(
	projectId: string,
	structure: BomStructureRef,
	bomId: string
): string {
	return pmBomItemsHash(projectId, structure, bomId, APP);
}

export function ocrDrawingSetHash(
	projectId: string,
	structure: BomStructureRef,
	bomId: string,
	drawingSetName: string
): string {
	return pmBomDrawingSetHash(projectId, structure, bomId, drawingSetName, APP);
}

export function ocrMarkRegionHash(
	projectId: string,
	structure: BomStructureRef,
	bomId: string
): string {
	return `${bomRoot(projectId, structure)}/${bomId}/MarkRegion`;
}

export function ocrResultsHash(
	projectId: string,
	structure: BomStructureRef,
	bomId: string
): string {
	return `${bomRoot(projectId, structure)}/${bomId}/Results`;
}
