import type { ReleaseLineWrite } from './projects/releases.api.js';
import type { ProjReleaseLineRow } from './projects/types.js';
import type {
	BomConfig,
	ReleaseLineItem,
	ReleaseStructureKind,
	ReleaseTowerEntry
} from './store.svelte.js';

function structureIdOf(bom: BomConfig, kind: ReleaseStructureKind): string | undefined {
	return kind === 'tower' ? bom.towerId : bom.stubId;
}

/** Normalize a release quantity input to a non-negative integer. */
export function parseReleaseQty(value: number | string | undefined): number {
	const n = typeof value === 'number' ? value : Number(value);
	if (!Number.isFinite(n) || n < 0) return 0;
	return Math.floor(n);
}

export function createLineItemsFromBoms(
	structureId: string,
	bomConfigs: BomConfig[],
	alreadyReleasedByBom: Map<string, number> = new Map(),
	kind: ReleaseStructureKind = 'tower'
): ReleaseLineItem[] {
	const boms = bomConfigs
		.filter((b) => structureIdOf(b, kind) === structureId)
		.slice()
		.sort((a, b) => a.sNo - b.sNo);

	return boms.map((bom, index) => ({
		id: bom.id,
		bomId: bom.id,
		description: bom.bomName,
		unit: 'Set',
		alreadyReleased: alreadyReleasedByBom.get(bom.id) ?? 0,
		thisRelease: 0,
		bold: index === 0
	}));
}

/** Sum quantities from other project releases for each bom_id, excluding the current release. */
export function alreadyReleasedByBomId(
	projectReleaseBundles: { releaseId: string; lines: ProjReleaseLineRow[] }[],
	excludeReleaseId: string
): Map<string, number> {
	const totals = new Map<string, number>();
	for (const bundle of projectReleaseBundles) {
		if (bundle.releaseId === excludeReleaseId) continue;
		for (const line of bundle.lines) {
			totals.set(line.bom_id, (totals.get(line.bom_id) ?? 0) + (line.quantity ?? 0));
		}
	}
	return totals;
}

/** Sum release-line quantities for each bom_id across all release bundles. */
export function releaseQtyByBomIdFromBundles(
	bundles: { lines: ProjReleaseLineRow[] }[]
): Map<string, number> {
	const totals = new Map<string, number>();
	for (const bundle of bundles) {
		for (const line of bundle.lines) {
			totals.set(line.bom_id, (totals.get(line.bom_id) ?? 0) + (line.quantity ?? 0));
		}
	}
	return totals;
}

export function groupLinesIntoTowerEntries(
	releaseId: string,
	lines: ProjReleaseLineRow[],
	boms: BomConfig[],
	structures: { id: string }[],
	alreadyReleasedByBom: Map<string, number> = new Map(),
	kind: ReleaseStructureKind = 'tower'
): ReleaseTowerEntry[] {
	const bomById = new Map(boms.map((bom) => [bom.id, bom]));
	const structureOrder = new Map(structures.map((structure, index) => [structure.id, index]));
	const linesByStructure = new Map<string, ProjReleaseLineRow[]>();

	for (const line of lines) {
		const bom = bomById.get(line.bom_id);
		const structureId = bom ? structureIdOf(bom, kind) : undefined;
		if (!structureId) continue;
		const bucket = linesByStructure.get(structureId) ?? [];
		bucket.push(line);
		linesByStructure.set(structureId, bucket);
	}

	const structureIds = [...linesByStructure.keys()].sort(
		(a, b) => (structureOrder.get(a) ?? 0) - (structureOrder.get(b) ?? 0)
	);

	return structureIds.map((structureId, index) => {
		const structureLines = linesByStructure.get(structureId) ?? [];
		const structureBoms = boms
			.filter((bom) => structureIdOf(bom, kind) === structureId)
			.slice()
			.sort((a, b) => a.sNo - b.sNo);
		const lineByBom = new Map(structureLines.map((line) => [line.bom_id, line]));

		const lineItems: ReleaseLineItem[] = structureBoms.map((bom, bomIndex) => {
			const line = lineByBom.get(bom.id);
			return {
				id: line?.release_line_id ?? bom.id,
				bomId: bom.id,
				releaseLineId: line?.release_line_id,
				description: line?.description?.trim() || bom.bomName,
				unit: line?.unit ?? 'Set',
				alreadyReleased: alreadyReleasedByBom.get(bom.id) ?? 0,
				thisRelease: line?.quantity ?? 0,
				bold: bomIndex === 0
			};
		});

		for (const line of structureLines) {
			if (lineItems.some((item) => item.bomId === line.bom_id)) continue;
			lineItems.push({
				id: line.release_line_id,
				bomId: line.bom_id,
				releaseLineId: line.release_line_id,
				description: line.description?.trim() || line.bom_id,
				unit: line.unit ?? 'Set',
				alreadyReleased: alreadyReleasedByBom.get(line.bom_id) ?? 0,
				thisRelease: line.quantity ?? 0
			});
		}

		const thisRelease = lineItems[0]?.thisRelease ?? 0;

		return {
			id: `${releaseId}-${kind}-${structureId}`,
			releaseId,
			towerTypeId: structureId,
			kind,
			sNo: index + 1,
			thisRelease,
			lineItems
		};
	});
}

/** One entry per configured structure; merges persisted release lines when present. */
export function buildAllStructureEntries(
	releaseId: string,
	lines: ProjReleaseLineRow[],
	boms: BomConfig[],
	structures: { id: string }[],
	alreadyReleasedByBom: Map<string, number> = new Map(),
	kind: ReleaseStructureKind = 'tower'
): ReleaseTowerEntry[] {
	const persistedByStructureId = new Map(
		groupLinesIntoTowerEntries(releaseId, lines, boms, structures, alreadyReleasedByBom, kind).map(
			(entry) => [entry.towerTypeId, entry]
		)
	);

	return structures.map((structure, index) => {
		const existing = persistedByStructureId.get(structure.id);
		if (existing) {
			return { ...existing, sNo: index + 1 };
		}

		const lineItems = createLineItemsFromBoms(structure.id, boms, alreadyReleasedByBom, kind);

		return {
			id: `${releaseId}-${kind}-${structure.id}`,
			releaseId,
			towerTypeId: structure.id,
			kind,
			sNo: index + 1,
			thisRelease: 0,
			lineItems
		};
	});
}

export function flattenTowerEntriesToLineWrites(entries: ReleaseTowerEntry[]): ReleaseLineWrite[] {
	const writes: ReleaseLineWrite[] = [];
	const seenBomIds = new Set<string>();

	for (const entry of entries) {
		for (const item of entry.lineItems) {
			if (!item.bomId || seenBomIds.has(item.bomId)) continue;
			if (item.thisRelease <= 0 && !item.releaseLineId) continue;
			seenBomIds.add(item.bomId);
			writes.push({
				releaseLineId: item.releaseLineId,
				bomId: item.bomId,
				quantity: item.thisRelease,
				unit: item.unit ?? 'Set',
				description: item.description
			});
		}
	}

	return writes;
}

export function summarizeTowerEntries(
	entries: ReleaseTowerEntry[],
	getStructureName: (structureId: string) => string
): { towerTypes: string; totalQty: number } {
	const withQty = entries.filter((entry) => entry.lineItems.some((item) => item.thisRelease > 0));
	const towerTypes = withQty.map((entry) => getStructureName(entry.towerTypeId)).join(', ');
	const totalQty = withQty.reduce((sum, entry) => sum + entry.thisRelease, 0);
	return { towerTypes, totalQty };
}
