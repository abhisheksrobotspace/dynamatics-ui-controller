import {
	hostAppFromLocation,
	peekCuttingPlanReturnHash
} from '../../cutting-plan-app/lib/cutting-plan/cutting-plan-host.js';

export type BomStructureRef = { kind: 'tower'; towerId: string } | { kind: 'stub'; stubId: string };

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

function resolveAppName(appName?: string): string {
	return appName ?? hostAppFromLocation();
}

function bomRoot(projectId: string, structure: BomStructureRef, appName?: string): string {
	return `#/${resolveAppName(appName)}/Home/${projectId}/${structureSegment(structure)}/Boms`;
}

/**
 * BOMs list under Project Management. Under planning shells (no BOMs list), returns the
 * stashed Assign & Lock hash or the host app Home.
 */
export function bomBomsListHash(
	projectId: string,
	structure: BomStructureRef,
	appName?: string
): string {
	const app = resolveAppName(appName);
	if (app === 'ProjectManagement' || app === 'CuttingPlan') {
		return bomRoot(projectId, structure, app);
	}
	return peekCuttingPlanReturnHash() ?? `#/${app}/Home`;
}

/** Subtype (lineage) versions list — `lineageId` is `proj_boms.bom_lineage_id`. */
export function bomLineageVersionsHash(
	projectId: string,
	structure: BomStructureRef,
	lineageId: string,
	appName?: string
): string {
	return `${bomRoot(projectId, structure, appName)}/lineage/${lineageId}/Versions`;
}

export function bomItemsHash(
	projectId: string,
	structure: BomStructureRef,
	bomId: string,
	appName?: string
): string {
	return `${bomRoot(projectId, structure, appName)}/${bomId}/Items`;
}

export function bomVersionDetailHash(
	projectId: string,
	structure: BomStructureRef,
	bomId: string,
	appName?: string
): string {
	return `${bomRoot(projectId, structure, appName)}/${bomId}/Detail`;
}

export function bomDrawingSetHash(
	projectId: string,
	structure: BomStructureRef,
	bomId: string,
	drawingSetName: string,
	appName?: string
): string {
	return `${bomRoot(projectId, structure, appName)}/${bomId}/DrawingSets/${encodeURIComponent(drawingSetName)}`;
}

export function bomSectionsHash(
	projectId: string,
	structure: BomStructureRef,
	bomId: string,
	appName?: string
): string {
	return `${bomRoot(projectId, structure, appName)}/${bomId}/Sections`;
}

export function bomStockLengthsHash(
	projectId: string,
	structure: BomStructureRef,
	bomId: string,
	appName?: string
): string {
	return `${bomRoot(projectId, structure, appName)}/${bomId}/StockLengths`;
}

export function cuttingPlanRunsHash(
	projectId: string,
	structure: BomStructureRef,
	bomId: string,
	appName?: string
): string {
	return `${bomRoot(projectId, structure, appName)}/${bomId}/Runs`;
}

export function cuttingPlanRunHash(
	projectId: string,
	structure: BomStructureRef,
	bomId: string,
	runId: string,
	page: 'Summary' | 'Plan',
	appName?: string
): string {
	return `${bomRoot(projectId, structure, appName)}/${bomId}/Runs/${runId}/${page}`;
}
