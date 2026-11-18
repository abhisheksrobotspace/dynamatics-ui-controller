import { apiClient } from '../../lib/api/api-client.js';
import { datahubQuery, leftJoin, pickAliasString } from '../../lib/api/datahub-query.js';
import { rowsFromEnvelope, type ApiEnvelope } from '../../lib/api/types.js';
import { projectSetupFromMetadata } from '../../project-management-app/lib/projects/types.js';
import { datahubList } from './core-api.js';

/** Display label for a project in OCR: work order no, else name, else id. */
export function ocrProjectDisplayLabel(row: {
	project_id: string;
	name?: string;
	metadata?: Record<string, unknown>;
}): string {
	const wo = projectSetupFromMetadata(row.metadata).workOrderNo;
	if (wo) return wo;
	return (row.name ?? '').trim() || row.project_id;
}

export type OcrProjectOption = { projectId: string; workOrderNo: string };
export type OcrStructureOption = { structureId: string; name: string; type: 'tower' | 'stub' };
export type OcrBomLineageOption = {
	bomLineageId: string;
	bomName: string;
	latestVersion: number;
	stage: 'proto' | 'mass';
	createdAt: string | null;
};
export type OcrBomVersionOption = {
	bomId: string;
	bomLineageId: string;
	bomName: string;
	version: number;
	stage: string;
	label: string;
	createdAt: string | null;
};
export type OcrDrawingSetOption = {
	drawingSet: string;
	setSortOrder: number;
	fileCount: number;
};
export type OcrFileOcrStatus = 'not_verified' | 'action_needed' | 'verified';

export type OcrDrawingFileRow = {
	bomDrawingId: string;
	bomId: string;
	fileId: string;
	drawingSet: string;
	setSortOrder: number;
	sortOrder: number;
	filename: string;
	createdAt: string | null;
	/** File has extract results (or legacy whole-BOM results). */
	hasResults: boolean;
	/** From `proj_boms.ocr_status` for this version. */
	ocrStatus: OcrFileOcrStatus;
	/** True when generate is blocked (e.g. missing BOM extract) — rare on listed drawing rows. */
	statusBlocked: boolean;
};

type ProjBomDrawingRow = {
	bom_drawing_id: string;
	bom_id: string;
	file_id: string;
	drawing_set?: string;
	set_sort_order?: number;
	sort_order: number;
	created_at?: string | null;
	/** From `files` join. */
	file_name?: string | null;
};

type ProjBomRow = {
	bom_id: string;
	structure_id: string;
	bom_name: string;
	bom_lineage_id?: string;
	version?: number;
	stage?: string | null;
	sort_order: number;
	created_at?: string | null;
};

type ProjProjectRow = {
	project_id: string;
	name: string;
	metadata?: Record<string, unknown>;
};
type ProjStructureRow = { structure_id: string; name: string; type: 'tower' | 'stub' };

const DRAWING_SELECT = [
	'bom_drawing_id',
	'bom_id',
	'file_id',
	'drawing_set',
	'set_sort_order',
	'sort_order',
	'created_at',
	'f.file_name'
].join(',');
const BOM_VERSION_SELECT =
	'bom_id,structure_id,bom_name,bom_lineage_id,version,stage,sort_order,ocr_status,created_at';

export async function listDrawingRowsForBom(
	bomId: string,
	signal?: AbortSignal
): Promise<ProjBomDrawingRow[]> {
	const rows = await datahubQuery<Record<string, unknown>>(
		'proj_bom_drawings',
		{
			bom_id: bomId,
			orderBy: 'sort_order:asc',
			select: DRAWING_SELECT,
			limit: 2500,
			joins: [leftJoin('files', 'f', 'file_id', 'f.file_id')]
		},
		signal
	);

	return rows
		.map((row) => {
			const fileName = pickAliasString(row, 'f', 'file_name').trim();
			return {
				bom_drawing_id: String(row.bom_drawing_id ?? ''),
				bom_id: String(row.bom_id ?? bomId),
				file_id: String(row.file_id ?? ''),
				drawing_set: typeof row.drawing_set === 'string' ? row.drawing_set : undefined,
				set_sort_order: typeof row.set_sort_order === 'number' ? row.set_sort_order : undefined,
				sort_order: typeof row.sort_order === 'number' ? row.sort_order : 0,
				created_at: typeof row.created_at === 'string' ? row.created_at : null,
				file_name: fileName || null
			} satisfies ProjBomDrawingRow;
		})
		.sort((a, b) => {
			const setDelta = (a.set_sort_order ?? 0) - (b.set_sort_order ?? 0);
			if (setDelta !== 0) return setDelta;
			return a.sort_order - b.sort_order;
		});
}

export async function listOcrProjects(signal?: AbortSignal): Promise<OcrProjectOption[]> {
	const envelope = await apiClient.get<ApiEnvelope<ProjProjectRow[]>>(
		apiClient.datahub(
			'proj_projects?active=true&orderBy=name:asc&select=project_id,name,metadata&limit=500'
		),
		{ signal }
	);
	return rowsFromEnvelope(envelope.data).map((row) => ({
		projectId: row.project_id,
		workOrderNo: ocrProjectDisplayLabel(row)
	}));
}

export async function listOcrStructures(
	projectId: string,
	type: 'tower' | 'stub',
	signal?: AbortSignal
): Promise<OcrStructureOption[]> {
	const envelope = await apiClient.get<ApiEnvelope<ProjStructureRow[]>>(
		apiClient.datahub(
			`proj_structures?project_id=${encodeURIComponent(projectId)}&type=${type}&orderBy=sort_order:asc&select=structure_id,name,type&limit=500`
		),
		{ signal }
	);
	return rowsFromEnvelope(envelope.data).map((row) => ({
		structureId: row.structure_id,
		name: row.name,
		type: row.type === 'stub' ? 'stub' : 'tower'
	}));
}

export async function listOcrBomVersions(
	structureId: string,
	signal?: AbortSignal
): Promise<OcrBomVersionOption[]> {
	const envelope = await apiClient.get<ApiEnvelope<ProjBomRow[]>>(
		apiClient.datahub(
			`proj_boms?structure_id=${encodeURIComponent(structureId)}&orderBy=sort_order:asc&select=${BOM_VERSION_SELECT}&limit=500`
		),
		{ signal }
	);
	return rowsFromEnvelope(envelope.data).map((row) => {
		const version = row.version ?? 1;
		const stage = (row.stage ?? 'proto').trim() || 'proto';
		const lineageId = row.bom_lineage_id ?? row.bom_id;
		return {
			bomId: row.bom_id,
			bomLineageId: lineageId,
			bomName: row.bom_name,
			version,
			stage,
			label: `${row.bom_name} v${version} · ${stage}`,
			createdAt: row.created_at ?? null
		};
	});
}

export function lineagesFromVersions(versions: OcrBomVersionOption[]): OcrBomLineageOption[] {
	const seen = new Map<string, OcrBomLineageOption>();
	for (const v of versions) {
		const prev = seen.get(v.bomLineageId);
		if (!prev || v.version > prev.latestVersion) {
			seen.set(v.bomLineageId, {
				bomLineageId: v.bomLineageId,
				bomName: v.bomName,
				latestVersion: v.version,
				stage: v.stage === 'mass' ? 'mass' : 'proto',
				createdAt: v.createdAt
			});
		}
	}
	return [...seen.values()].sort((a, b) => a.bomName.localeCompare(b.bomName));
}

export function versionsForLineage(
	versions: OcrBomVersionOption[],
	bomLineageId: string
): OcrBomVersionOption[] {
	return versions
		.filter((v) => v.bomLineageId === bomLineageId)
		.sort((a, b) => a.version - b.version);
}

export function drawingSetsFromRows(rows: ProjBomDrawingRow[]): OcrDrawingSetOption[] {
	const map = new Map<string, OcrDrawingSetOption>();
	for (const row of rows) {
		const drawingSet = (row.drawing_set ?? 'Drawings').trim() || 'Drawings';
		const existing = map.get(drawingSet);
		if (existing) {
			existing.fileCount += 1;
			existing.setSortOrder = Math.min(existing.setSortOrder, row.set_sort_order ?? 0);
		} else {
			map.set(drawingSet, {
				drawingSet,
				setSortOrder: row.set_sort_order ?? 0,
				fileCount: 1
			});
		}
	}
	return [...map.values()].sort(
		(a, b) => a.setSortOrder - b.setSortOrder || a.drawingSet.localeCompare(b.drawingSet)
	);
}

async function getBomOcrStatus(bomId: string, signal?: AbortSignal): Promise<string | null> {
	const envelope = await apiClient.get<ApiEnvelope<Array<{ ocr_status?: string | null }>>>(
		apiClient.datahub(`proj_boms?bom_id=${encodeURIComponent(bomId)}&select=ocr_status&limit=1`),
		{ signal }
	);
	return rowsFromEnvelope(envelope.data)[0]?.ocr_status ?? null;
}

async function listExtractedDrawingFileIds(bomId: string): Promise<Set<string>> {
	const extracted = new Set<string>();
	const verifications = await datahubList<{
		verification_id: string;
		found_count?: number | null;
		status?: string;
		created_at?: string | null;
	}>('ocr_verifications', { bom_id: bomId });
	const verification = verifications[0];
	if (!verification) return extracted;

	// Per-file extract rows are authoritative when present.
	const drawings = await datahubList<{
		drawing_file_id: string;
		extracted_at?: string | null;
	}>('ocr_verification_drawings', { verification_id: verification.verification_id });
	for (const d of drawings) {
		if (d.extracted_at) extracted.add(d.drawing_file_id);
	}
	if (drawings.some((d) => d.extracted_at)) return extracted;

	const extractReady =
		verification.status === 'action_needed' ||
		verification.status === 'verified' ||
		(verification.found_count ?? 0) > 0;
	if (!extractReady) return extracted;

	// Extract results (not ocr_pages): rasterize alone must not flip Ready/Verified.
	const results = await datahubList<{ drawing_file_id?: string | null }>('ocr_results', {
		verification_id: verification.verification_id
	});
	const fromResults = new Set(
		results.map((r) => r.drawing_file_id).filter((id): id is string => Boolean(id))
	);
	if (fromResults.size > 0) {
		for (const id of fromResults) extracted.add(id);
		return extracted;
	}

	// Legacy whole-BOM extract (results with null drawing_file_id): only credit drawing
	// rows that existed at/before this verification. Re-uploads are newer → Not started yet.
	if (results.length === 0) return extracted;

	const verCreatedMs = verification.created_at ? Date.parse(verification.created_at) : NaN;
	const all = await listDrawingRowsForBom(bomId);
	for (const row of all) {
		const drawnMs = row.created_at ? Date.parse(row.created_at) : NaN;
		if (!Number.isFinite(verCreatedMs) || !Number.isFinite(drawnMs)) continue;
		if (drawnMs > verCreatedMs) continue;
		extracted.add(row.file_id);
	}

	return extracted;
}

export async function listOcrDrawingFiles(
	bomId: string,
	drawingSet: string,
	signal?: AbortSignal
): Promise<OcrDrawingFileRow[]> {
	const [allRows, extractedIds, bomOcrStatusRaw] = await Promise.all([
		listDrawingRowsForBom(bomId, signal),
		listExtractedDrawingFileIds(bomId),
		getBomOcrStatus(bomId, signal)
	]);
	const ocrStatus =
		bomOcrStatusRaw === 'verified' || bomOcrStatusRaw === 'action_needed'
			? bomOcrStatusRaw
			: 'not_verified';
	const filtered = allRows.filter(
		(row) => ((row.drawing_set ?? 'Drawings').trim() || 'Drawings') === drawingSet
	);

	const withNames = filtered.map((row, index) => {
		const fallback = `Drawing ${index + 1}.pdf`;
		return {
			bomDrawingId: row.bom_drawing_id,
			bomId: row.bom_id,
			fileId: row.file_id,
			drawingSet: (row.drawing_set ?? 'Drawings').trim() || 'Drawings',
			setSortOrder: row.set_sort_order ?? 0,
			sortOrder: row.sort_order,
			filename: row.file_name?.trim() || fallback,
			createdAt: row.created_at ?? null,
			hasResults: extractedIds.has(row.file_id),
			ocrStatus,
			statusBlocked: false
		} satisfies OcrDrawingFileRow;
	});

	return withNames.sort((a, b) => a.sortOrder - b.sortOrder);
}
