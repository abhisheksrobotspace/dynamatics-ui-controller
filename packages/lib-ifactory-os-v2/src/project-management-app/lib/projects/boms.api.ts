import { apiClient } from '../../../lib/api/api-client.js';
import { rowsFromEnvelope, type ApiEnvelope } from '../../../lib/api/types.js';
import { parseBomExtractStatus, type BomExtractStatus } from '../bom-extract-status.js';
import type { BomConfig, BomOcrStatus } from '../store.svelte.js';
import { listPublishedCpByBomIds } from '../../../cutting-plan-app/lib/cutting-plan/cp-publish.api.js';
import { projBomItemsListPath } from './proj-bom-items.constants.js';
import type { ProjBomDrawingRow, ProjBomRow } from './types.js';

/** Fields the BOM list/table needs (omits unused length columns). */
const PROJ_BOM_LIST_SELECT = [
	'bom_id',
	'structure_id',
	'bom_name',
	'bom_lineage_id',
	'version',
	'stage',
	'bom_file_id',
	'extract_status',
	'ocr_status',
	'cp_status',
	'sort_order',
	'metadata',
	'created_at'
].join(',');

const PROJ_BOM_EXTRACT_STATUS_SELECT = 'bom_id,extract_status';

const PROJ_BOM_DRAWING_SELECT =
	'bom_drawing_id,bom_id,file_id,drawing_set,set_sort_order,sort_order,created_at';

/** Existence only — extract hydrate when denormalized `extract_status` lags. */
async function hasBomItems(bomId: string, signal?: AbortSignal): Promise<boolean> {
	const envelope = await apiClient.get<ApiEnvelope<Array<{ bom_item_id: string }>>>(
		apiClient.datahub(projBomItemsListPath({ bom_id: bomId }, { limit: 1, select: 'bom_item_id' })),
		{ signal }
	);
	return rowsFromEnvelope(envelope.data).length > 0;
}

type BomFileMetadata = {
	bom_file_name?: string;
	bom_file_uploaded_at?: string;
	drawings_file_name?: string;
	published_cp_run_id?: string;
	published_cp_version?: number;
	/** Manual MT per set — UI-owned; extract writes `computed_weight_mt_per_set` separately. */
	bom_wt?: number;
	operations_count_roi?: {
		x: number;
		y: number;
		w: number;
		h: number;
	} | null;
};

function parseBomWt(value: unknown): number | undefined {
	if (typeof value === 'number' && Number.isFinite(value)) return value;
	if (typeof value === 'string' && value.trim() !== '') {
		const n = Number(value);
		if (Number.isFinite(n)) return n;
	}
	return undefined;
}

function parsePublishedCpFromMetadata(metadata: Record<string, unknown> | undefined): {
	runId: string | null;
	version: number | null;
} {
	if (!metadata || typeof metadata !== 'object') return { runId: null, version: null };
	const runId =
		typeof metadata.published_cp_run_id === 'string' && metadata.published_cp_run_id.length > 0
			? metadata.published_cp_run_id
			: null;
	const version =
		typeof metadata.published_cp_version === 'number' && metadata.published_cp_version >= 1
			? metadata.published_cp_version
			: null;
	return { runId, version };
}

function getBomMetadata(metadata: Record<string, unknown> | undefined): BomFileMetadata {
	if (!metadata || typeof metadata !== 'object') return {};

	const bomFileName =
		typeof metadata.bom_file_name === 'string' ? metadata.bom_file_name : undefined;
	const bomFileUploadedAt =
		typeof metadata.bom_file_uploaded_at === 'string' ? metadata.bom_file_uploaded_at : undefined;
	const drawingsFileName =
		typeof metadata.drawings_file_name === 'string' ? metadata.drawings_file_name : undefined;
	const roi =
		typeof metadata.operations_count_roi === 'object' && metadata.operations_count_roi !== null
			? (metadata.operations_count_roi as BomFileMetadata['operations_count_roi'])
			: null;
	const bomWt = parseBomWt(metadata.bom_wt);

	return {
		bom_file_name: bomFileName,
		bom_file_uploaded_at: bomFileUploadedAt,
		drawings_file_name: drawingsFileName,
		bom_wt: bomWt,
		operations_count_roi: roi ?? undefined
	};
}

function withBomMetadata(
	existing: Record<string, unknown> | undefined,
	patch: {
		bomFileName?: string | null;
		bomFileUploadedAt?: string | null;
		drawingsFileName?: string | null;
		bomWt?: number | null;
		operationsCountRoi?: BomConfig['operationsCountRoi'];
	}
): Record<string, unknown> {
	const next = { ...(existing ?? {}) };

	if (patch.bomFileName === null) next.bom_file_name = null;
	else if (typeof patch.bomFileName === 'string') next.bom_file_name = patch.bomFileName;

	if (patch.bomFileUploadedAt === null) next.bom_file_uploaded_at = null;
	else if (typeof patch.bomFileUploadedAt === 'string')
		next.bom_file_uploaded_at = patch.bomFileUploadedAt;

	if (patch.drawingsFileName === null) next.drawings_file_name = null;
	else if (typeof patch.drawingsFileName === 'string')
		next.drawings_file_name = patch.drawingsFileName;

	if (patch.bomWt === null) next.bom_wt = null;
	else if (typeof patch.bomWt === 'number' && Number.isFinite(patch.bomWt))
		next.bom_wt = patch.bomWt;

	if (patch.operationsCountRoi === null) next.operations_count_roi = null;
	else if (patch.operationsCountRoi !== undefined)
		next.operations_count_roi = patch.operationsCountRoi;

	return next;
}

function parseCpStatus(value: string | null | undefined): 'none' | 'planned' {
	return value === 'planned' ? 'planned' : 'none';
}

function parseOcrStatus(value: string | null | undefined): BomOcrStatus {
	if (value === 'verified' || value === 'action_needed') return value;
	return 'not_verified';
}

function parseBomStage(value: string | null | undefined): 'proto' | 'mass' {
	return value === 'mass' ? 'mass' : 'proto';
}

function mapBomRow(
	row: ProjBomRow,
	towerId: string,
	sNo: number,
	primaryDrawing: ProjBomDrawingRow | null
): BomConfig {
	const metadata = getBomMetadata(row.metadata);
	const publishedCp = parsePublishedCpFromMetadata(row.metadata);
	const bomLineageId =
		typeof row.bom_lineage_id === 'string' && row.bom_lineage_id.length > 0
			? row.bom_lineage_id
			: row.bom_id;

	return {
		id: row.bom_id,
		towerId,
		sNo,
		bomName: row.bom_name,
		bomLineageId,
		version: typeof row.version === 'number' && row.version >= 1 ? row.version : 1,
		stage: parseBomStage(row.stage),
		bomFileId: row.bom_file_id ?? null,
		bomFile: metadata.bom_file_name ?? (row.bom_file_id ? 'BOM file' : null),
		bomFileUploadedAt: metadata.bom_file_uploaded_at ?? null,
		bomWt: metadata.bom_wt ?? null,
		drawingsFile: metadata.drawings_file_name ?? (primaryDrawing?.file_id ? 'Drawings file' : null),
		drawingsPdfId: primaryDrawing?.file_id ?? null,
		extractStatus: parseBomExtractStatus(row.extract_status),
		ocrStatus: parseOcrStatus(row.ocr_status),
		cpStatus: parseCpStatus(row.cp_status),
		publishedCpRunId: publishedCp.runId,
		publishedCpVersion: publishedCp.version,
		operationsCountRoi: metadata.operations_count_roi ?? null,
		createdAt: row.created_at ?? null
	};
}

/** One row per lineage — the highest `version` (for the Subtypes list). */
export function latestBomPerLineage(boms: BomConfig[]): BomConfig[] {
	const byLineage = new Map<string, BomConfig>();
	for (const bom of boms) {
		const prev = byLineage.get(bom.bomLineageId);
		if (!prev || bom.version > prev.version) byLineage.set(bom.bomLineageId, bom);
	}
	return [...byLineage.values()]
		.sort((a, b) => {
			const aTime = a.createdAt ? Date.parse(a.createdAt) : 0;
			const bTime = b.createdAt ? Date.parse(b.createdAt) : 0;
			if (bTime !== aTime) return bTime - aTime;
			return a.bomName.localeCompare(b.bomName);
		})
		.map((bom, index) => ({ ...bom, sNo: index + 1 }));
}

/** PM list status from `proj_boms.stage`: Proto | Published. */
export function bomPublishStatusLabel(bom: Pick<BomConfig, 'stage'>): 'Proto' | 'Published' {
	return bom.stage === 'mass' ? 'Published' : 'Proto';
}

export function getPublishedCpRunIdFromBom(bom: BomConfig): string | null {
	return bom.publishedCpRunId ?? null;
}

async function withPublishedCpRuns(boms: BomConfig[], signal?: AbortSignal): Promise<BomConfig[]> {
	if (boms.length === 0) return boms;
	const published = await listPublishedCpByBomIds(
		boms.map((bom) => bom.id),
		signal
	);
	if (published.size === 0) return boms;
	return boms.map((bom) => {
		const pub = published.get(bom.id);
		if (!pub) return bom;
		return {
			...bom,
			publishedCpRunId: pub.runId,
			publishedCpVersion: pub.version
		};
	});
}

async function listDrawingsForBom(
	bomId: string,
	signal?: AbortSignal
): Promise<ProjBomDrawingRow | null> {
	const rows = await listAllDrawingsForBom(bomId, signal);
	return rows[0] ?? null;
}

async function listAllDrawingsForBom(
	bomId: string,
	signal?: AbortSignal
): Promise<ProjBomDrawingRow[]> {
	const envelope = await apiClient.get<ApiEnvelope<ProjBomDrawingRow[]>>(
		apiClient.datahub(
			`proj_bom_drawings?bom_id=${encodeURIComponent(bomId)}&orderBy=sort_order:asc&select=${PROJ_BOM_DRAWING_SELECT}`
		),
		{ signal }
	);
	return rowsFromEnvelope<ProjBomDrawingRow>(envelope.data);
}

type OcrPageFileRow = {
	page_image_file_id: string;
	drawing_file_id?: string | null;
};

type OcrResultFileRow = {
	roi_crop_file_id?: string | null;
};

async function listOcrFileIdsForBom(bomId: string, signal?: AbortSignal): Promise<string[]> {
	const verificationEnvelope = await apiClient.get<ApiEnvelope<Array<{ verification_id: string }>>>(
		apiClient.datahub(
			`ocr_verifications?bom_id=${encodeURIComponent(bomId)}&select=verification_id`
		),
		{ signal }
	);
	const verification = rowsFromEnvelope(verificationEnvelope.data)[0];
	if (!verification) return [];

	const verificationId = encodeURIComponent(verification.verification_id);
	const [pagesEnvelope, resultsEnvelope] = await Promise.all([
		apiClient.get<ApiEnvelope<OcrPageFileRow[]>>(
			apiClient.datahub(
				`ocr_pages?verification_id=${verificationId}&limit=5000&select=page_image_file_id,drawing_file_id`
			),
			{ signal }
		),
		apiClient.get<ApiEnvelope<OcrResultFileRow[]>>(
			apiClient.datahub(
				`ocr_results?verification_id=${verificationId}&limit=5000&select=roi_crop_file_id`
			),
			{ signal }
		)
	]);

	const ids = new Set<string>();
	for (const page of rowsFromEnvelope(pagesEnvelope.data)) {
		if (page.page_image_file_id) ids.add(page.page_image_file_id);
		if (page.drawing_file_id) ids.add(page.drawing_file_id);
	}
	for (const result of rowsFromEnvelope(resultsEnvelope.data)) {
		if (result.roi_crop_file_id) ids.add(result.roi_crop_file_id);
	}
	return [...ids];
}

/** Collect every file-service id linked to a BOM before the row (and cascades) are removed. */
async function listUploadedFileIdsForBom(bomId: string, signal?: AbortSignal): Promise<string[]> {
	const bomEnvelope = await apiClient.get<ApiEnvelope<Array<{ bom_file_id?: string | null }>>>(
		apiClient.datahub(`proj_boms?bom_id=${encodeURIComponent(bomId)}&select=bom_file_id`),
		{ signal }
	);
	const bomRow = rowsFromEnvelope(bomEnvelope.data)[0];

	const ids = new Set<string>();
	if (bomRow?.bom_file_id) ids.add(bomRow.bom_file_id);

	const [drawings, ocrFileIds] = await Promise.all([
		listAllDrawingsForBom(bomId, signal),
		listOcrFileIdsForBom(bomId, signal)
	]);
	for (const drawing of drawings) {
		if (drawing.file_id) ids.add(drawing.file_id);
	}
	for (const fileId of ocrFileIds) ids.add(fileId);

	return [...ids];
}

export type ListBomsOptions = {
	/**
	 * When true, N+1-fetch primary drawing per BOM (`drawingsPdfId`).
	 * List pages default to false — filenames come from `metadata`.
	 */
	includeDrawings?: boolean;
	/** When false, skip published `cp_plan_runs` lookup (Subtypes list). Default true. */
	includePublishedCp?: boolean;
};

export async function listBoms(
	projectId: string,
	towerId: string,
	signal?: AbortSignal,
	options: ListBomsOptions = {}
): Promise<BomConfig[]> {
	const envelope = await apiClient.get<ApiEnvelope<ProjBomRow[]>>(
		apiClient.datahub(
			`proj_boms?structure_id=${encodeURIComponent(towerId)}&orderBy=sort_order:asc&select=${PROJ_BOM_LIST_SELECT}`
		),
		{ signal }
	);
	const rows = rowsFromEnvelope<ProjBomRow>(envelope.data);

	const includeDrawings = options.includeDrawings === true;
	const drawings = includeDrawings
		? await Promise.all(rows.map((row) => listDrawingsForBom(row.bom_id, signal)))
		: rows.map(() => null);

	const mapped = rows.map((row, index) =>
		mapBomRow(row, towerId, index + 1, drawings[index] ?? null)
	);
	if (options.includePublishedCp === false) return mapped;
	return withPublishedCpRuns(mapped, signal);
}

/** Versions page + Send to CP/OCR — one lineage, no OCR/ROI columns. */
const PROJ_BOM_VERSIONS_SELECT = [
	'bom_id',
	'bom_name',
	'bom_lineage_id',
	'version',
	'stage',
	'bom_file_id',
	'extract_status',
	'cp_status',
	'sort_order',
	'metadata',
	'created_at'
].join(',');

/** All version rows for one subtype lineage (`bom_lineage_id`). */
export async function listBomsByLineageId(
	structureId: string,
	lineageId: string,
	signal?: AbortSignal
): Promise<BomConfig[]> {
	const envelope = await apiClient.get<ApiEnvelope<ProjBomRow[]>>(
		apiClient.datahub(
			`proj_boms?structure_id=${encodeURIComponent(structureId)}&bom_lineage_id=${encodeURIComponent(lineageId)}&orderBy=version:asc&select=${PROJ_BOM_VERSIONS_SELECT}`
		),
		{ signal }
	);
	const rows = rowsFromEnvelope<ProjBomRow>(envelope.data);
	return rows.map((row, index) => mapBomRow(row, structureId, index + 1, null));
}

/** Next `sort_order` when appending a version row to a structure. */
export async function getMaxSortOrderForStructure(
	structureId: string,
	signal?: AbortSignal
): Promise<number> {
	const envelope = await apiClient.get<ApiEnvelope<Array<{ sort_order: number }>>>(
		apiClient.datahub(
			`proj_boms?structure_id=${encodeURIComponent(structureId)}&orderBy=sort_order:desc&limit=1&select=sort_order`
		),
		{ signal }
	);
	const row = rowsFromEnvelope(envelope.data)[0];
	return typeof row?.sort_order === 'number' ? row.sort_order : 0;
}

/** Full BOM rows for many structures via `structure_id__in` (no per-structure N+1). */
export async function listBomsByStructureIds(
	structureIds: string[],
	signal?: AbortSignal
): Promise<BomConfig[]> {
	if (structureIds.length === 0) return [];

	const idList = structureIds.map((id) => encodeURIComponent(id)).join(',');
	const envelope = await apiClient.get<ApiEnvelope<ProjBomRow[]>>(
		apiClient.datahub(
			`proj_boms?limit=2500&structure_id__in=${idList}&orderBy=sort_order:asc&select=${PROJ_BOM_LIST_SELECT}`
		),
		{ signal }
	);

	const rows = rowsFromEnvelope<ProjBomRow>(envelope.data);
	const order = new Map(structureIds.map((id, index) => [id, index]));
	const counts = new Map<string, number>();

	return withPublishedCpRuns(
		rows
			.slice()
			.sort((a, b) => {
				const structureDelta = (order.get(a.structure_id) ?? 0) - (order.get(b.structure_id) ?? 0);
				if (structureDelta !== 0) return structureDelta;
				return a.sort_order - b.sort_order;
			})
			.map((row) => {
				const sNo = (counts.get(row.structure_id) ?? 0) + 1;
				counts.set(row.structure_id, sNo);
				return mapBomRow(row, row.structure_id, sNo, null);
			}),
		signal
	);
}

const PROJ_BOM_SUMMARY_SELECT =
	'bom_id,structure_id,bom_name,bom_lineage_id,version,stage,sort_order';

export type BomStructureSummary = {
	id: string;
	structureId: string;
	bomName: string;
	bomLineageId: string;
	version: number;
	stage: 'proto' | 'mass';
	sortOrder: number;
};

/** One summary per lineage per structure — highest `version` (Towers/Stubs badge counts). */
export function latestBomSummaryPerLineage(
	summaries: BomStructureSummary[]
): BomStructureSummary[] {
	const byLineage = new Map<string, BomStructureSummary>();
	for (const summary of summaries) {
		const key = `${summary.structureId}:${summary.bomLineageId}`;
		const prev = byLineage.get(key);
		if (!prev || summary.version > prev.version) {
			byLineage.set(key, summary);
		}
	}
	return [...byLineage.values()].sort(
		(a, b) =>
			a.structureId.localeCompare(b.structureId) ||
			a.sortOrder - b.sortOrder ||
			a.bomName.localeCompare(b.bomName)
	);
}

/** Slim BOM labels for Towers/Stubs badge columns — one request for many structures. */
export async function listBomSummariesByStructureIds(
	structureIds: string[],
	signal?: AbortSignal
): Promise<BomStructureSummary[]> {
	if (structureIds.length === 0) return [];

	const idList = structureIds.map((id) => encodeURIComponent(id)).join(',');
	const envelope = await apiClient.get<ApiEnvelope<ProjBomRow[]>>(
		apiClient.datahub(
			`proj_boms?limit=2500&structure_id__in=${idList}&orderBy=sort_order:asc&select=${PROJ_BOM_SUMMARY_SELECT}`
		),
		{ signal }
	);

	return latestBomSummaryPerLineage(
		rowsFromEnvelope<ProjBomRow>(envelope.data).map((row) => ({
			id: row.bom_id,
			structureId: row.structure_id,
			bomName: row.bom_name,
			bomLineageId:
				typeof row.bom_lineage_id === 'string' && row.bom_lineage_id.length > 0
					? row.bom_lineage_id
					: row.bom_id,
			version: typeof row.version === 'number' && row.version >= 1 ? row.version : 1,
			stage: parseBomStage(row.stage),
			sortOrder: row.sort_order
		}))
	);
}

/** Tree tables only need id, name, structure, sort — not extract/OCR/CP/metadata. */
export async function listTreeBomsByStructureIds(
	structureIds: string[],
	signal?: AbortSignal
): Promise<BomConfig[]> {
	const summaries = await listBomSummariesByStructureIds(structureIds, signal);
	const order = new Map(structureIds.map((id, index) => [id, index]));
	const counts = new Map<string, number>();

	return summaries
		.slice()
		.sort((a, b) => {
			const structureDelta = (order.get(a.structureId) ?? 0) - (order.get(b.structureId) ?? 0);
			if (structureDelta !== 0) return structureDelta;
			return a.sortOrder - b.sortOrder;
		})
		.map((summary) => {
			const sNo = (counts.get(summary.structureId) ?? 0) + 1;
			counts.set(summary.structureId, sNo);
			return {
				id: summary.id,
				towerId: summary.structureId,
				sNo,
				bomName: summary.bomName,
				bomLineageId: summary.bomLineageId,
				version: summary.version,
				stage: summary.stage,
				bomFile: null,
				drawingsFile: null,
				extractStatus: 'pending' as const
			};
		});
}

export type GetBomByIdOptions = {
	/** Default true — Version detail loads drawings separately. */
	includeDrawings?: boolean;
	/** Default true — skip on pages that do not gate CP. */
	includePublishedCp?: boolean;
};

export async function getBomById(
	projectId: string,
	towerId: string,
	bomId: string,
	signal?: AbortSignal,
	options: GetBomByIdOptions = {}
): Promise<BomConfig | null> {
	const includeDrawings = options.includeDrawings !== false;
	const includePublishedCp = options.includePublishedCp !== false;

	const envelope = await apiClient.get<ApiEnvelope<ProjBomRow[]>>(
		apiClient.datahub(
			`proj_boms?bom_id=${encodeURIComponent(bomId)}&structure_id=${encodeURIComponent(towerId)}&select=${PROJ_BOM_LIST_SELECT}`
		),
		{ signal }
	);
	const row = rowsFromEnvelope<ProjBomRow>(envelope.data)[0];
	if (!row) return null;
	const drawing = includeDrawings ? await listDrawingsForBom(row.bom_id, signal) : null;
	const mapped = mapBomRow(row, towerId, 1, drawing);
	if (!includePublishedCp) return mapped;
	const [bom] = await withPublishedCpRuns([mapped], signal);
	return bom ?? null;
}

/** BOM display name only — no drawings / file metadata (e.g. cutting-plan export filenames). */
export async function getBomNameById(
	towerId: string,
	bomId: string,
	signal?: AbortSignal
): Promise<string | null> {
	const envelope = await apiClient.get<ApiEnvelope<ProjBomRow[]>>(
		apiClient.datahub(
			`proj_boms?bom_id=${encodeURIComponent(bomId)}&structure_id=${encodeURIComponent(towerId)}&select=bom_id,bom_name`
		),
		{ signal }
	);
	const row = rowsFromEnvelope<ProjBomRow>(envelope.data)[0];
	const name = row?.bom_name?.trim();
	return name || null;
}

/** Poll-only: read `extract_status` without re-fetching drawings. */
export async function fetchBomExtractStatus(
	bomId: string,
	signal?: AbortSignal
): Promise<BomExtractStatus | null> {
	const envelope = await apiClient.get<ApiEnvelope<ProjBomRow[]>>(
		apiClient.datahub(
			`proj_boms?bom_id=${encodeURIComponent(bomId)}&select=${PROJ_BOM_EXTRACT_STATUS_SELECT}`
		),
		{ signal }
	);
	const row = rowsFromEnvelope<ProjBomRow>(envelope.data)[0];
	if (!row) return null;
	return parseBomExtractStatus(row.extract_status);
}

export type ProjBomItemRow = {
	bom_item_id: string;
	bom_id: string;
	row_number: number | null;
	mark_no: string;
	material_grade: string | null;
	section: string | null;
	type: string | null;
	section_thickness_mm: number | string | null;
	section_length_mm: number | string | null;
	section_width_mm: number | string | null;
	width_mm: number | string | null;
	length_mm: number | string | null;
	unit_weight: number | string | null;
	weight_per_piece: number | string | null;
	num_pieces: number | string | null;
	total_weight: number | string | null;
	remark: string | null;
};

const PROJ_BOM_ITEM_LIST_SELECT = [
	'bom_item_id',
	'bom_id',
	'row_number',
	'mark_no',
	'material_grade',
	'section',
	'type',
	'section_thickness_mm',
	'section_length_mm',
	'section_width_mm',
	'width_mm',
	'length_mm',
	'unit_weight',
	'weight_per_piece',
	'num_pieces',
	'total_weight',
	'remark'
].join(',');

export async function listBomItems(bomId: string, signal?: AbortSignal): Promise<ProjBomItemRow[]> {
	const envelope = await apiClient.get<ApiEnvelope<ProjBomItemRow[]>>(
		apiClient.datahub(
			projBomItemsListPath(
				{ bom_id: bomId },
				{ orderBy: 'row_number:asc', select: PROJ_BOM_ITEM_LIST_SELECT }
			)
		),
		{ signal }
	);
	return rowsFromEnvelope<ProjBomItemRow>(envelope.data);
}

/**
 * Resolve extract readiness from `proj_boms.extract_status`, falling back to whether
 * `proj_bom_items` already exist (sidecar may not have flipped the denormalized flag).
 * Fallback uses `limit=1` — never the full items table.
 */
export async function resolveBomExtractStatus(
	bomId: string,
	signal?: AbortSignal
): Promise<BomExtractStatus | null> {
	const status = await fetchBomExtractStatus(bomId, signal);
	if (!status) return null;
	if (status === 'extracted' || status === 'failed') return status;
	return (await hasBomItems(bomId, signal)) ? 'extracted' : status;
}

/**
 * For list rows already loaded with `extract_status`: if still pending/failed and a file is
 * linked, probe items existence once (`limit=1`) so Extract vs View matches reality.
 */
export async function reconcileBomExtractStatusFromItems(
	bom: BomConfig,
	signal?: AbortSignal
): Promise<BomExtractStatus> {
	if (!bom.bomFileId) return bom.extractStatus;
	if (bom.extractStatus === 'extracted' || bom.extractStatus === 'failed') {
		return bom.extractStatus;
	}
	return (await hasBomItems(bom.id, signal)) ? 'extracted' : bom.extractStatus;
}

export type CreateBomInput = {
	projectId: string;
	towerId: string;
	bomName: string;
	bomFileName: string | null;
	drawingsFileName: string | null;
	/** Manual MT per set → `metadata.bom_wt`. */
	bomWt?: number | null;
	nextSNo: number;
};

export async function createBom(
	input: CreateBomInput,
	signal?: AbortSignal
): Promise<{ bom: BomConfig; bomFileId: string | null; drawingsFileId: string | null }> {
	const envelope = await apiClient.post<ApiEnvelope<ProjBomRow>>(
		apiClient.datahub('proj_boms'),
		{
			structure_id: input.towerId,
			bom_name: input.bomName.trim(),
			sort_order: input.nextSNo,
			metadata: withBomMetadata(undefined, {
				bomFileName: input.bomFileName,
				drawingsFileName: input.drawingsFileName,
				bomWt: input.bomWt
			})
		},
		{ signal }
	);
	const row = rowsFromEnvelope<ProjBomRow>(envelope.data)[0];
	if (!row) throw new Error('Create BOM returned no data');

	return {
		bom: mapBomRow(row, input.towerId, input.nextSNo, null),
		bomFileId: row.bom_file_id ?? null,
		drawingsFileId: null
	};
}

export type CreateBomVersionInput = {
	towerId: string;
	bomName: string;
	bomLineageId: string;
	/** Next version number within the lineage (caller computes max+1). */
	version: number;
	nextSNo: number;
	stage?: 'proto' | 'mass';
};

/** Creates the next version row in an existing lineage (same `bom_name` + `bom_lineage_id`). */
export async function createBomVersion(
	input: CreateBomVersionInput,
	signal?: AbortSignal
): Promise<BomConfig> {
	const envelope = await apiClient.post<ApiEnvelope<ProjBomRow>>(
		apiClient.datahub('proj_boms'),
		{
			structure_id: input.towerId,
			bom_name: input.bomName.trim(),
			bom_lineage_id: input.bomLineageId,
			version: input.version,
			stage: input.stage ?? 'proto',
			sort_order: input.nextSNo
		},
		{ signal }
	);
	const row = rowsFromEnvelope<ProjBomRow>(envelope.data)[0];
	if (!row) throw new Error('Create BOM version returned no data');
	return mapBomRow(row, input.towerId, input.nextSNo, null);
}

/** Sets user-controlled stage (`proto` | `mass`). Publish in the UI = `mass`. */
export async function setBomStage(
	bomId: string,
	stage: 'proto' | 'mass',
	signal?: AbortSignal
): Promise<void> {
	await apiClient.patch(apiClient.datahub(`proj_boms/${bomId}`), { stage }, { signal });
}

export type UpdateBomInput = {
	projectId: string;
	towerId: string;
	bomId: string;
	bomName: string;
	sNo: number;
	bomFileName: string | null;
	drawingsFileName: string | null;
	/** Manual MT per set → `metadata.bom_wt` (null clears). */
	bomWt?: number | null;
	operationsCountRoi?: BomConfig['operationsCountRoi'];
	existingMetadata?: Record<string, unknown>;
};

export async function updateBom(
	input: UpdateBomInput,
	signal?: AbortSignal
): Promise<{ bom: BomConfig; bomFileId: string | null; drawingsFileId: string | null }> {
	const envelope = await apiClient.patch<ApiEnvelope<ProjBomRow>>(
		apiClient.datahub(`proj_boms/${input.bomId}`),
		{
			bom_name: input.bomName.trim(),
			sort_order: input.sNo,
			metadata: withBomMetadata(input.existingMetadata, {
				bomFileName: input.bomFileName,
				drawingsFileName: input.drawingsFileName,
				bomWt: input.bomWt,
				operationsCountRoi: input.operationsCountRoi
			})
		},
		{ signal }
	);
	const row = rowsFromEnvelope<ProjBomRow>(envelope.data)[0];
	if (!row) throw new Error('Update BOM returned no data');
	const drawing = await listDrawingsForBom(input.bomId, signal);

	return {
		bom: mapBomRow(row, input.towerId, input.sNo, drawing),
		bomFileId: row.bom_file_id ?? null,
		drawingsFileId: drawing?.file_id ?? null
	};
}

/** Flips the denormalized Operations Count cache (`proj_boms.ocr_status`). */
export async function setBomOcrStatus(
	bomId: string,
	ocrStatus: BomOcrStatus,
	signal?: AbortSignal
): Promise<void> {
	await apiClient.patch(
		apiClient.datahub(`proj_boms/${bomId}`),
		{ ocr_status: ocrStatus },
		{ signal }
	);
}

/**
 * Invalidate a prior OCR confirmation when the user starts a new extraction.
 * Clears `proj_boms.ocr_status` and verification confirm fields; workflow status is owned by
 * the orchestrator (`extracting` → `action_needed` / `verified`). Used by the OCR app.
 */
export async function invalidateOperationsCountConfirmation(
	bomId: string,
	signal?: AbortSignal
): Promise<void> {
	await setBomOcrStatus(bomId, 'not_verified', signal);

	const envelope = await apiClient.get<ApiEnvelope<Array<{ verification_id: string }>>>(
		apiClient.datahub(
			`ocr_verifications?bom_id=${encodeURIComponent(bomId)}&select=verification_id`
		),
		{ signal }
	);
	const verification = rowsFromEnvelope(envelope.data)[0];
	if (!verification) return;

	await apiClient.patch(
		apiClient.datahub(`ocr_verifications/${verification.verification_id}`),
		{
			confirmed_at: null,
			confirmed_by_user_id: null
		},
		{ signal }
	);
}

/** Resets or updates the denormalized BOM extraction cache (`proj_boms.extract_status`). */
export async function setBomExtractStatus(
	bomId: string,
	extractStatus: BomExtractStatus,
	signal?: AbortSignal
): Promise<void> {
	await apiClient.patch(
		apiClient.datahub(`proj_boms/${bomId}`),
		{ extract_status: extractStatus },
		{ signal }
	);
}

export async function setBomFileId(
	bomId: string,
	fileId: string,
	existingMetadata: Record<string, unknown> | undefined,
	bomFileName: string,
	signal?: AbortSignal
): Promise<void> {
	await apiClient.patch(
		apiClient.datahub(`proj_boms/${bomId}`),
		{
			bom_file_id: fileId,
			metadata: withBomMetadata(existingMetadata, {
				bomFileName,
				bomFileUploadedAt: new Date().toISOString()
			})
		},
		{ signal }
	);
}

/** Clears the BOM CSV attachment on a version row (metadata + denormalized extract cache). */
export async function clearBomFile(bomId: string, signal?: AbortSignal): Promise<void> {
	await apiClient.patch(
		apiClient.datahub(`proj_boms/${bomId}`),
		{
			bom_file_id: null,
			extract_status: 'pending',
			// Shallow-merge PATCH — explicit null clears the key on the server.
			metadata: withBomMetadata(undefined, { bomFileName: null, bomFileUploadedAt: null })
		},
		{ signal }
	);
}

export async function setBomDrawingsFileName(
	bomId: string,
	existingMetadata: Record<string, unknown> | undefined,
	drawingsFileName: string,
	signal?: AbortSignal
): Promise<void> {
	await apiClient.patch(
		apiClient.datahub(`proj_boms/${bomId}`),
		{
			metadata: withBomMetadata(existingMetadata, { drawingsFileName })
		},
		{ signal }
	);
}

export async function upsertPrimaryDrawingFile(
	bomId: string,
	fileId: string,
	signal?: AbortSignal
): Promise<void> {
	const drawing = await listDrawingsForBom(bomId, signal);

	if (drawing) {
		await apiClient.patch(
			apiClient.datahub(`proj_bom_drawings/${drawing.bom_drawing_id}`),
			{ file_id: fileId },
			{ signal }
		);
		return;
	}

	await apiClient.post(
		apiClient.datahub('proj_bom_drawings'),
		{
			bom_id: bomId,
			file_id: fileId,
			drawing_set: 'Drawings',
			set_sort_order: 0,
			sort_order: 0
		},
		{ signal }
	);
}

export async function deleteBom(bomId: string, signal?: AbortSignal): Promise<void> {
	const fileIds = await listUploadedFileIdsForBom(bomId, signal);
	await apiClient.delete(apiClient.datahub(`proj_boms/${bomId}`), { signal });
	await Promise.all(fileIds.map((fileId) => deleteUploadedFile(fileId, signal)));
}

/** e.g. "V1" or "V1–V4" for delete confirmations. */
export function formatBomVersionRange(versions: number[]): string {
	if (versions.length === 0) return '';
	const sorted = [...versions].sort((a, b) => a - b);
	const min = sorted[0];
	const max = sorted[sorted.length - 1];
	if (min === max) return `V${min}`;
	return `V${min}–V${max}`;
}

export function subtypeDeleteDescription(
	allBoms: BomConfig[],
	lineageBom: Pick<BomConfig, 'bomLineageId' | 'bomName'>
): string {
	const versions = allBoms
		.filter((bom) => bom.bomLineageId === lineageBom.bomLineageId)
		.map((bom) => bom.version);
	const range = formatBomVersionRange(versions);
	return `Deletes all versions (${range}) and their files for ${lineageBom.bomName}.`;
}

/** Deletes every version row in a subtype lineage and uploaded files for each. */
export async function deleteBomLineage(
	structureId: string,
	lineageId: string,
	signal?: AbortSignal
): Promise<BomConfig[]> {
	const versions = await listBomsByLineageId(structureId, lineageId, signal);
	await Promise.all(versions.map((bom) => deleteBom(bom.id, signal)));
	return versions;
}

/** Best-effort delete of a file-service object. Re-upload cleanup must not fail if already gone. */
export async function deleteUploadedFile(fileId: string, signal?: AbortSignal): Promise<void> {
	try {
		await deleteUploadedFileStrict(fileId, signal);
	} catch (error) {
		console.warn(`Failed to delete uploaded file ${fileId}`, error);
	}
}

/** Deletes a file-service object; throws on failure (BOM file removal). */
export async function deleteUploadedFileStrict(
	fileId: string,
	signal?: AbortSignal
): Promise<void> {
	await apiClient.delete(apiClient.files(encodeURIComponent(fileId)), { signal });
}

/** Removes extracted BOM rows and cutting-plan runs tied to a CSV. */
export async function deleteBomCsvDerivedRows(bomId: string, signal?: AbortSignal): Promise<void> {
	await deleteBomItemsForBom(bomId, signal);
	await deletePlanRunsForBom(bomId, signal);
}

/**
 * Fully removes a BOM CSV from a version: extracted items, plan runs, row attachment, and file bytes.
 */
export async function deleteBomCsvFile(
	bomId: string,
	bomFileId: string | null | undefined,
	signal?: AbortSignal
): Promise<void> {
	await deleteBomCsvDerivedRows(bomId, signal);
	await clearBomFile(bomId, signal);
	if (bomFileId) {
		await deleteUploadedFileStrict(bomFileId, signal);
	}
}

async function deleteRowsInChunks<T extends Record<string, unknown>>(
	rows: T[],
	idKey: keyof T & string,
	entity: string,
	signal?: AbortSignal
): Promise<void> {
	const chunkSize = 50;
	for (let index = 0; index < rows.length; index += chunkSize) {
		const chunk = rows.slice(index, index + chunkSize);
		await Promise.all(
			chunk.map((row) =>
				apiClient.delete(apiClient.datahub(`${entity}/${encodeURIComponent(String(row[idKey]))}`), {
					signal
				})
			)
		);
	}
}

/** Removes extracted BOM rows before a CSV re-upload/re-extract. */
export async function deleteBomItemsForBom(bomId: string, signal?: AbortSignal): Promise<void> {
	const envelope = await apiClient.get<ApiEnvelope<Array<{ bom_item_id: string }>>>(
		apiClient.datahub(projBomItemsListPath({ bom_id: bomId }, { select: 'bom_item_id' })),
		{ signal }
	);
	const items = rowsFromEnvelope<{ bom_item_id: string }>(envelope.data);
	if (items.length === 0) return;
	await deleteRowsInChunks(items, 'bom_item_id', 'proj_bom_items', signal);
}

type CpPlanRunDeleteRow = {
	run_id: string;
};

/** Drops persisted cutting-plan runs for a BOM when its source CSV changes. */
export async function deletePlanRunsForBom(bomId: string, signal?: AbortSignal): Promise<void> {
	const envelope = await apiClient.get<ApiEnvelope<CpPlanRunDeleteRow[]>>(
		apiClient.datahub(`cp_plan_runs?bom_id=${encodeURIComponent(bomId)}&limit=5000&select=run_id`),
		{ signal }
	);
	const runs = rowsFromEnvelope<CpPlanRunDeleteRow>(envelope.data);
	if (runs.length === 0) return;
	await deleteRowsInChunks(runs, 'run_id', 'cp_plan_runs', signal);
}

export async function triggerBomExtract(
	bomId: string,
	fileId: string,
	signal?: AbortSignal
): Promise<{ job_id: string; status: string }> {
	const envelope = await apiClient.post<
		ApiEnvelope<{
			job_id: string;
			status: string;
		}>
	>(
		apiClient.datahub('jobs/bom-extract'),
		{
			request: {
				file_id: fileId,
				file_type: 'BOM',
				bom_id: bomId
			}
		},
		{ signal }
	);

	const row = rowsFromEnvelope<{ job_id: string; status: string }>(envelope.data)[0];
	if (!row) throw new Error('Failed to queue BOM extraction job');
	return row;
}

function filenameFromContentDisposition(header: string | null, fallback: string): string {
	if (!header) return fallback;
	const utf8Match = /filename\*=UTF-8''([^;]+)/i.exec(header);
	if (utf8Match?.[1]) return decodeURIComponent(utf8Match[1]);
	const plainMatch = /filename="?([^"]+)"?/i.exec(header);
	return plainMatch?.[1] ?? fallback;
}

export async function downloadFile(fileId: string, fallbackName: string): Promise<File> {
	const response = await apiClient.fetch(apiClient.files(encodeURIComponent(fileId)));
	if (!response.ok) {
		throw new Error(`Unable to download file ${fileId} (${response.status})`);
	}
	const blob = await response.blob();
	const name = filenameFromContentDisposition(
		response.headers.get('content-disposition'),
		fallbackName
	);
	return new File([blob], name, { type: blob.type || 'application/octet-stream' });
}
