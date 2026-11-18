// OCR backend adapter — one interface, two implementations, switched by VITE_OCR_MODE.
//   'poc'  (default): the existing point-to-point OCR PoC calls (ocr.api.ts).
//   'core'          : route through ifactoryai-core — Files API + jobs/ocr + ocr_* CRUD.
//
// Core mode: the PM app has already provisioned the proj_* hierarchy and uploaded the drawings/BOM
// files (so the route's bomId IS the core bom_id). The first OCR action only ensures the OCR
// prerequisites are attached idempotently — the drawings PDF (proj_bom_drawings) when missing —
// then drives the two dispatches (rasterize, extract). BOM rows come from bom-extract on the BOMs
// page (`proj_bom_items`); matching is bridge-side against that spine.

import { ASYNC_STATUS_POLL_MS } from '../../lib/api/jobs.js';
import { BOM_MATCH_STATUS } from './ocr.constants.js';
import { ocrFetch, ocrStaticUrl } from './ocr.api';
import type {
	OcrResultRow,
	PdfJob,
	RasterizeProgress,
	RasterizeStatus,
	UploadPdfResponse
} from './ocr.types';
import {
	datahubCreate,
	datahubDelete,
	datahubList,
	datahubUpdate,
	filesUpload,
	fileDownloadUrl,
	triggerJob,
	getJob
} from './core-api';
import { mapHoleImages, type StoredHoleImagesMeta } from './ocr-hole-images';

export const OCR_MODE: 'poc' | 'core' = import.meta.env.VITE_OCR_MODE === 'core' ? 'core' : 'poc';

export interface ProvisionContext {
	/** The core `proj_boms.bom_id` (the PM app already provisions the proj_* hierarchy). */
	localBomId: string;
	/** Required in poc mode; optional in core when `proj_bom_drawings` already exists. */
	drawingsFile?: File | null;
	/** Required in poc mode for BOM matching upload; unused in core. */
	bomCsvFile?: File | null;
	/** Core mode display name when `drawingsFile` is omitted. */
	drawingsFilename?: string;
	/**
	 * Core mode: subset of `proj_bom_drawings.file_id` to rasterize.
	 * Omitted = whole BOM set (legacy).
	 */
	drawingFileIds?: string[];
	/** Optional display names keyed by drawing file_id. */
	filenamesByFileId?: Record<string, string>;
}

export interface UploadDrawingsOptions {
	onRasterizeProgress?: (progress: RasterizeProgress) => void;
}

export interface StatusResult {
	status: string;
	progress?: number;
	results?: OcrResultRow[];
	/** core mode: all persisted page image URLs (from ocr_pages after extract). */
	pageSamples?: Array<{ page: number; url: string }>;
	/** core mode: present while extract waits on background rendering. */
	rasterizeProgress?: RasterizeProgress;
	error?: string;
}

// ── core session state (per local BOM, for this page session) ────────────────
interface CoreSession {
	coreBomId: string;
	verificationId?: string;
}
const sessions = new Map<string, CoreSession>();

function rehydrateCoreSession(localBomId: string, verificationId: string): CoreSession {
	const session = sessions.get(localBomId) ?? { coreBomId: localBomId };
	session.verificationId = verificationId;
	sessions.set(localBomId, session);
	return session;
}

const ROI_FILMSTRIP_MAX_PAGES = 5;

interface OcrVerificationRow {
	verification_id: string;
	status: string;
	rasterize_status?: RasterizeStatus | null;
	pages_ready?: number | null;
	total_pages?: number | null;
	roi?: PdfJob['roi'];
	found_count?: number | null;
}

interface OcrPageRow {
	page_number: number;
	page_image_file_id: string;
	drawing_file_id?: string | null;
	source_page_number?: number | null;
}

function buildUploadPdfResponse(
	session: CoreSession,
	ctx: ProvisionContext,
	verification: OcrVerificationRow,
	samples: Array<{ page: number; url: string }>,
	rasterize: RasterizeProgress
): UploadPdfResponse {
	return {
		pdfs: [
			{
				pdf_id: session.coreBomId,
				filename: resolveDrawingsFilename(ctx),
				total_pages: verification.total_pages ?? samples.length,
				samples
			}
		],
		rasterize
	};
}

function buildMultiFileUploadPdfResponse(
	ctx: ProvisionContext,
	verification: OcrVerificationRow,
	pages: OcrPageRow[],
	rasterize: RasterizeProgress,
	drawingFileIds: string[],
	allDrawingFileIdsInOrder?: string[]
): UploadPdfResponse {
	const order = allDrawingFileIdsInOrder?.length ? allDrawingFileIdsInOrder : drawingFileIds;
	const pdfs = drawingFileIds.map((fileId, index) => {
		const samples = mapFilmstripSamplesForFile(pages, fileId, order);
		return {
			pdf_id: fileId,
			filename:
				ctx.filenamesByFileId?.[fileId] ??
				(drawingFileIds.length === 1 ? resolveDrawingsFilename(ctx) : `Drawing ${index + 1}.pdf`),
			total_pages: samples.length || filmstripTargetPages(verification.total_pages),
			samples
		};
	});
	return { pdfs, rasterize };
}

async function currentDrawingFileId(bomId: string): Promise<string | null> {
	const drawings = await datahubList<{ file_id: string }>('proj_bom_drawings', { bom_id: bomId });
	return drawings[0]?.file_id ?? null;
}

function pagesMatchCurrentDrawing(pages: OcrPageRow[], drawingFileId: string): boolean {
	return !pages.some((p) => p.drawing_file_id && p.drawing_file_id !== drawingFileId);
}

/**
 * When sample pages already exist for this BOM's current drawing, return them without
 * dispatching ocr.rasterize again. If rendering is still in flight, wait for the filmstrip.
 */
async function loadExistingFilmstripIfReady(
	bomId: string,
	session: CoreSession,
	ctx: ProvisionContext,
	onProgress?: (progress: RasterizeProgress) => void
): Promise<UploadPdfResponse | null> {
	const verification = await listVerificationForBom(bomId);
	if (!verification || verification.rasterize_status === 'failed') return null;
	rehydrateCoreSession(bomId, verification.verification_id);

	const selectedIds = resolveSelectedDrawingFileIds(ctx);
	const drawingFileId = selectedIds?.[0] ?? (await currentDrawingFileId(bomId));
	if (!drawingFileId) return null;

	const pages = await datahubList<OcrPageRow>('ocr_pages', {
		verification_id: verification.verification_id
	});
	const drawingOrder = await listDrawingFileIdsInOrder(bomId);

	if (!selectedIds && pages.length > 0 && !pagesMatchCurrentDrawing(pages, drawingFileId)) {
		return null;
	}

	// Only reuse a filmstrip when every selected file has pages attributed to its file_id.
	// Legacy null drawing_file_id rows (or pages from deleted files) must not be reused —
	// re-rasterize will clear/replace them (orchestrator drawingChanged fix).
	if (selectedIds && selectedIds.length > 0) {
		const hasAttributedFilmstrip = selectedIds.every((id) =>
			pages.some(
				(p) =>
					p.page_image_file_id &&
					p.drawing_file_id === id &&
					(p.source_page_number == null ||
						p.source_page_number <= 0 ||
						p.source_page_number <= ROI_FILMSTRIP_MAX_PAGES)
			)
		);
		if (!hasAttributedFilmstrip) return null;
	}

	const buildResponse = (readyPages: OcrPageRow[], readyVerification: OcrVerificationRow) => {
		const rasterize = mapVerificationProgress(readyVerification);
		onProgress?.(rasterize);
		if (selectedIds && selectedIds.length > 0) {
			return {
				...buildMultiFileUploadPdfResponse(
					ctx,
					readyVerification,
					readyPages,
					rasterize,
					selectedIds,
					drawingOrder
				),
				reusedExistingFilmstrip: true
			};
		}
		const samples = mapFilmstripSamples(readyPages);
		return {
			...buildUploadPdfResponse(session, ctx, readyVerification, samples, rasterize),
			reusedExistingFilmstrip: true
		};
	};

	const samplesReady = selectedIds
		? selectedIds.every((id) => mapFilmstripSamplesForFile(pages, id, drawingOrder).length >= 1)
		: mapFilmstripSamples(pages).length >= filmstripTargetPages(verification.total_pages);

	if (!samplesReady) {
		const inFlight =
			verification.rasterize_status === 'pending' || verification.rasterize_status === 'rendering';
		if (!inFlight) return null;

		const readyVerification = await waitForFilmstripReady(bomId, onProgress, selectedIds);
		rehydrateCoreSession(bomId, readyVerification.verification_id);
		const readyPages = await datahubList<OcrPageRow>('ocr_pages', {
			verification_id: readyVerification.verification_id
		});
		return buildResponse(readyPages, readyVerification);
	}

	rehydrateCoreSession(bomId, verification.verification_id);
	return buildResponse(pages, verification);
}

/**
 * Ensure the OCR prerequisites exist for an already-provisioned BOM.
 *
 * The PM app creates the proj_* hierarchy (customer → project → structure → bom) and uploads the
 * drawings/BOM files up front (Boms.svelte), so `localBomId` IS the core `bom_id`. This never
 * re-creates that hierarchy — doing so collided with the unique constraints on name and surfaced
 * as a 502 (duplicate key) on reload. It only attaches the OCR prerequisites idempotently:
 * the drawings PDF (proj_bom_drawings) and the match spine (proj_bom_items).
 */
async function ensureCoreBom(ctx: ProvisionContext): Promise<CoreSession> {
	const cached = sessions.get(ctx.localBomId);
	if (cached) return cached;

	const coreBomId = ctx.localBomId;

	// Drawings PDF → file-service → proj_bom_drawings (skip if already attached).
	const drawings = await datahubList<{ bom_drawing_id: string }>('proj_bom_drawings', {
		bom_id: coreBomId
	});
	if (drawings.length === 0) {
		if (!ctx.drawingsFile) {
			throw new Error('Drawings file is missing. Edit this BOM and upload the drawings PDF again.');
		}
		const fileId = await filesUpload(
			ctx.drawingsFile,
			ctx.drawingsFile.name || ctx.drawingsFilename || 'drawings.pdf',
			'proj_boms',
			coreBomId
		);
		await datahubCreate('proj_bom_drawings', { bom_id: coreBomId, file_id: fileId });
	}

	// BOM CSV → proj_bom_items (populated by bom-extract on the BOMs page before OCR).
	const existingItems = await datahubList('proj_bom_items', {
		bom_id: coreBomId,
		limit: '1',
		select: 'bom_item_id'
	});
	if (existingItems.length === 0) {
		throw new Error(
			'BOM items are not ready yet. Wait for BOM extraction to finish on the BOMs page, then try again.'
		);
	}

	const session: CoreSession = { coreBomId };
	sessions.set(ctx.localBomId, session);
	return session;
}

async function pollUntil(predicate: () => Promise<boolean>): Promise<void> {
	for (;;) {
		if (await predicate()) return;
		await new Promise((r) => setTimeout(r, ASYNC_STATUS_POLL_MS));
	}
}

function mapVerificationProgress(row: OcrVerificationRow): RasterizeProgress {
	return {
		verificationId: row.verification_id,
		workflowStatus: row.status,
		rasterizeStatus: row.rasterize_status ?? null,
		pagesReady: row.pages_ready ?? 0,
		totalPages: row.total_pages ?? null
	};
}

async function listVerificationForBom(bomId: string): Promise<OcrVerificationRow | null> {
	const verifications = await datahubList<OcrVerificationRow>('ocr_verifications', {
		bom_id: bomId
	});
	return verifications[0] ?? null;
}

/** Core mode: read render progress from `ocr_verifications`. */
export async function getRasterizeProgress(localBomId: string): Promise<RasterizeProgress | null> {
	if (OCR_MODE !== 'core') return null;
	const verification = await listVerificationForBom(localBomId);
	return verification ? mapVerificationProgress(verification) : null;
}

function filmstripTargetPages(totalPages: number | null | undefined): number {
	if (totalPages == null || totalPages <= 0) return ROI_FILMSTRIP_MAX_PAGES;
	return Math.min(ROI_FILMSTRIP_MAX_PAGES, totalPages);
}

function filmstripReady(progress: RasterizeProgress): boolean {
	const target = filmstripTargetPages(progress.totalPages);
	return progress.pagesReady >= target;
}

async function waitForFilmstripReady(
	bomId: string,
	onProgress?: (progress: RasterizeProgress) => void,
	drawingFileIds?: string[] | null
): Promise<OcrVerificationRow> {
	let latest: OcrVerificationRow | null = null;
	let terminalEmptyPolls = 0;
	const drawingOrder =
		drawingFileIds && drawingFileIds.length > 0 ? await listDrawingFileIdsInOrder(bomId) : [];
	await pollUntil(async () => {
		latest = await listVerificationForBom(bomId);
		if (!latest) return false;
		const mapped = mapVerificationProgress(latest);
		onProgress?.(mapped);
		if (mapped.rasterizeStatus === 'failed') {
			throw new Error('Rendering failed for this drawing.');
		}
		if (!filmstripReady(mapped)) return false;

		// Per-file extract: verification roll-up can be "ready" before the selected
		// file's pages exist — wait until each selected file has filmstrip samples.
		if (drawingFileIds && drawingFileIds.length > 0) {
			const pages = await datahubList<OcrPageRow>('ocr_pages', {
				verification_id: latest.verification_id
			});
			if (
				drawingFileIds.every((id) => mapFilmstripSamplesForFile(pages, id, drawingOrder).length > 0)
			) {
				return true;
			}
			if (mapped.rasterizeStatus === 'complete' || mapped.rasterizeStatus === 'partial') {
				terminalEmptyPolls += 1;
				if (terminalEmptyPolls >= 10) {
					throw new Error(
						'No preview pages for the selected drawing(s). Re-run Generate after rasterize finishes.'
					);
				}
			}
			return false;
		}
		return true;
	});
	return latest!;
}

function mapFilmstripSamples(pages: OcrPageRow[]): Array<{ page: number; url: string }> {
	return pages
		.filter((p) => p.page_number <= ROI_FILMSTRIP_MAX_PAGES && p.page_image_file_id)
		.sort((a, b) => a.page_number - b.page_number)
		.map((p) => ({ page: p.page_number, url: fileDownloadUrl(p.page_image_file_id) }));
}

/**
 * Filmstrip for one drawing file: first 5 pages of that file.
 * Prefer `source_page_number <= 5` when present; otherwise take the first 5 pages of
 * the file by `page_number` order (global offsets mean `page_number <= 5` is wrong).
 *
 * When `ocr_pages.drawing_file_id` is null (legacy / unattributed rasterize), pages from
 * every PDF in the verification share one list and source numbers restart per file
 * (1..N, then 1..M). Without partitioning, `source <= 5` returns duplicates (1,1,2,2,…).
 * Pass `allDrawingFileIdsInOrder` (proj_bom_drawings sort order) to assign chunks correctly.
 */
function mapFilmstripSamplesForFile(
	pages: OcrPageRow[],
	drawingFileId: string,
	allDrawingFileIdsInOrder?: string[]
): Array<{ page: number; url: string }> {
	const scoped = scopePagesForDrawingFile(pages, drawingFileId, allDrawingFileIdsInOrder);
	if (scoped.length === 0) return [];

	const hasSource = scoped.some((p) => p.source_page_number != null && p.source_page_number > 0);
	const sorted = [...scoped].sort((a, b) => {
		const aKey = hasSource ? (a.source_page_number ?? a.page_number) : a.page_number;
		const bKey = hasSource ? (b.source_page_number ?? b.page_number) : b.page_number;
		return aKey - bKey;
	});

	const filmstrip = hasSource
		? sorted.filter((p) => {
				const source = p.source_page_number ?? 0;
				return source > 0 && source <= ROI_FILMSTRIP_MAX_PAGES;
			})
		: sorted.slice(0, ROI_FILMSTRIP_MAX_PAGES);

	// Deduplicate by display page (stale re-rasterize can leave two rows with source 1, 2, …).
	const seen = new Set<number>();
	const unique = filmstrip.filter((p) => {
		const page = hasSource ? (p.source_page_number ?? p.page_number) : p.page_number;
		if (seen.has(page)) return false;
		seen.add(page);
		return true;
	});

	return unique.map((p, index) => ({
		page: hasSource ? (p.source_page_number ?? p.page_number) : index + 1,
		url: fileDownloadUrl(p.page_image_file_id)
	}));
}

/** Pages belonging to one drawing file (attributed column, or partitioned legacy rows). */
function scopePagesForDrawingFile(
	pages: OcrPageRow[],
	drawingFileId: string,
	allDrawingFileIdsInOrder?: string[]
): OcrPageRow[] {
	const attributed = pages.filter(
		(p) => p.page_image_file_id && p.drawing_file_id === drawingFileId
	);
	if (attributed.length > 0) return attributed;

	const unattributed = pages
		.filter((p) => p.page_image_file_id && !p.drawing_file_id)
		.slice()
		.sort((a, b) => a.page_number - b.page_number);
	if (unattributed.length === 0) return [];

	const order =
		allDrawingFileIdsInOrder && allDrawingFileIdsInOrder.length > 0
			? allDrawingFileIdsInOrder
			: [drawingFileId];

	// Single drawing in the BOM: only claim the unattributed list when it is one PDF run.
	// Multiple source-reset chunks mean leftover pages from a prior multi-file rasterize —
	// returning them all produces duplicate filmstrip pages (1,1,2,2,…). Force re-rasterize.
	if (order.length <= 1) {
		const chunks = partitionUnattributedPagesBySourceReset(unattributed);
		return chunks.length === 1 ? chunks[0]! : [];
	}

	const chunks = partitionUnattributedPagesBySourceReset(unattributed);
	const idx = order.indexOf(drawingFileId);
	if (idx < 0 || idx >= chunks.length) return [];
	return chunks[idx];
}

/**
 * Split a global page list into per-PDF runs when source_page_number restarts
 * (e.g. sources 1..7 then 1..8 → two files).
 */
function partitionUnattributedPagesBySourceReset(pages: OcrPageRow[]): OcrPageRow[][] {
	const chunks: OcrPageRow[][] = [];
	let current: OcrPageRow[] = [];
	let prevSource: number | null = null;
	for (const p of pages) {
		const src = p.source_page_number ?? p.page_number;
		if (current.length > 0 && prevSource != null && src < prevSource) {
			chunks.push(current);
			current = [];
		}
		current.push(p);
		prevSource = src;
	}
	if (current.length > 0) chunks.push(current);
	return chunks;
}

async function listDrawingFileIdsInOrder(bomId: string): Promise<string[]> {
	const drawings = await datahubList<{ file_id: string; sort_order?: number }>(
		'proj_bom_drawings',
		{
			bom_id: bomId
		}
	);
	return drawings
		.slice()
		.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
		.map((d) => d.file_id);
}

function resolveSelectedDrawingFileIds(ctx: ProvisionContext): string[] | null {
	const ids = ctx.drawingFileIds?.filter(Boolean) ?? [];
	return ids.length > 0 ? ids : null;
}

function resolveDrawingsFilename(ctx: ProvisionContext): string {
	return ctx.drawingsFilename ?? ctx.drawingsFile?.name ?? 'drawings.pdf';
}

const STATUS_MAP: Record<string, string> = {
	matched: BOM_MATCH_STATUS.MATCHED,
	missing_in_bom: BOM_MATCH_STATUS.MISSING_IN_BOM,
	duplicate_suffix: BOM_MATCH_STATUS.DUPLICATE_SUFFIX,
	not_in_pdf: BOM_MATCH_STATUS.MISSING_IN_SKETCH
};

interface OcrResultDbRow {
	result_id?: string;
	page_number: number | null;
	ocr_raw: string | null;
	extracted_number: string | null;
	sketch_mark?: string | null;
	corrected_mark?: string | null;
	bom_mark: string | null;
	match_status: string | null;
	hole_count: number | null;
	corrected_hole_count?: number | null;
	drawing_file_id?: string | null;
	metadata?: {
		sketch_mark?: string | null;
		hole_images?: StoredHoleImagesMeta;
	};
}

function isNotFoundStatus(matchStatus: string | null | undefined): boolean {
	return matchStatus == null;
}

function cleanSketchField(
	value: string | null | undefined,
	ocrRaw: string | null | undefined
): string | null {
	const trimmed = value?.trim();
	if (!trimmed) return null;
	const raw = ocrRaw?.trim();
	if (raw && trimmed === raw) return null;
	return trimmed;
}

function mapResults(rows: OcrResultDbRow[]): OcrResultRow[] {
	return rows.map((r) => {
		const ocrRaw = r.ocr_raw ?? '';
		const ocrSketch = isNotFoundStatus(r.match_status)
			? null
			: cleanSketchField(r.sketch_mark ?? r.metadata?.sketch_mark ?? null, ocrRaw);
		const correctedMark = cleanSketchField(r.corrected_mark, ocrRaw);
		const displayMark = correctedMark ?? ocrSketch;
		return {
			id: r.result_id,
			page: r.page_number ?? 0,
			mark_number: displayMark ?? 'NOT_FOUND',
			sketch_mark: ocrSketch,
			corrected_mark: correctedMark,
			extracted_number: r.extracted_number,
			raw_text: ocrRaw,
			bom_match_status: r.match_status
				? (STATUS_MAP[r.match_status] ?? r.match_status)
				: 'OCR NOT FOUND',
			bom_mark_number: r.bom_mark ?? '-',
			hole_count: r.corrected_hole_count ?? r.hole_count ?? undefined,
			hole_images: mapHoleImages(r.metadata?.hole_images),
			is_hole_manual: r.corrected_hole_count != null ? true : undefined,
			drawing_file_id: r.drawing_file_id ?? null
		};
	});
}

/** Attach per-PDF source page numbers for display (global `page` stays the lookup key). */
function attachSourcePages(rows: OcrResultRow[], pages: OcrPageRow[]): OcrResultRow[] {
	const sourceByGlobal = new Map<number, number>();
	for (const p of pages) {
		if (p.source_page_number != null && p.source_page_number > 0) {
			sourceByGlobal.set(p.page_number, p.source_page_number);
		}
	}
	if (sourceByGlobal.size === 0) return rows;
	return rows.map((row) => ({
		...row,
		source_page: sourceByGlobal.get(row.page) ?? row.source_page ?? null
	}));
}

async function resolveVerificationId(localBomId: string): Promise<string | undefined> {
	const session = sessions.get(localBomId);
	if (session?.verificationId) return session.verificationId;

	const verifications = await datahubList<{ verification_id: string }>('ocr_verifications', {
		bom_id: localBomId
	});
	const verificationId = verifications[0]?.verification_id;
	if (verificationId && session) session.verificationId = verificationId;
	return verificationId;
}

/** Core mode helper: resolve the latest OCR verification id for this BOM. */
export async function getVerificationIdForBom(localBomId: string): Promise<string | undefined> {
	return resolveVerificationId(localBomId);
}

const UI_TO_DB_MATCH_STATUS: Record<string, string> = {
	[BOM_MATCH_STATUS.MATCHED]: 'matched',
	[BOM_MATCH_STATUS.DUPLICATE_SUFFIX]: 'duplicate_suffix',
	[BOM_MATCH_STATUS.MISSING_IN_BOM]: 'missing_in_bom',
	[BOM_MATCH_STATUS.MISSING_IN_SKETCH]: 'not_in_pdf'
};

export function uiMatchStatusToDb(uiStatus: string | undefined): string | null {
	if (!uiStatus) return null;
	return UI_TO_DB_MATCH_STATUS[uiStatus] ?? null;
}

export function ocrMarkMatchPatchForRow(
	row: OcrResultRow,
	bomItemIdByMark: Record<string, string>
): Record<string, unknown> {
	const match_status = uiMatchStatusToDb(row.bom_match_status);
	const bomMark =
		row.bom_mark_number && row.bom_mark_number !== '-' ? row.bom_mark_number.trim() : null;
	const bomItemId = bomMark ? bomItemIdByMark[bomMark] : undefined;

	const raw = row.raw_text?.trim() ?? '';
	const corrected = (row.corrected_mark ?? row.mark_number ?? '').trim();
	return {
		corrected_mark: corrected && corrected !== raw ? corrected : null,
		match_status,
		...(bomMark ? { bom_mark: bomMark } : { bom_mark: null }),
		...(bomItemId ? { bom_item_id: bomItemId } : {})
	};
}

/** Delete one persisted OCR result row by primary key. */
export async function persistOcrResultDelete(resultId: string): Promise<void> {
	await datahubDelete('ocr_results', resultId);
}

/** Persist mark-match edits for one or more OCR result rows (incl. duplicate-suffix cascade). */
export async function persistOcrMarkMatchRows(
	bomId: string,
	rows: OcrResultRow[],
	bomItemIdByMark: Record<string, string>
): Promise<void> {
	const persistable = rows.filter((row) => row.id);
	if (persistable.length === 0) return;

	await Promise.all(
		persistable.map((row) =>
			datahubUpdate('ocr_results', row.id!, ocrMarkMatchPatchForRow(row, bomItemIdByMark))
		)
	);

	const matchedMarks = [
		...new Set(
			persistable
				.filter((row) => row.bom_match_status === 'MATCHED')
				.map((row) => (row.bom_mark_number ?? '').trim())
				.filter(Boolean)
		)
	];
	if (matchedMarks.length === 0) return;

	const verificationId = await getVerificationIdForBom(bomId);
	if (!verificationId) return;

	const reconciliationRows = await datahubList<{ result_id: string; bom_mark: string | null }>(
		'ocr_results',
		{ verification_id: verificationId, match_status: 'not_in_pdf' }
	);
	const marksToClear = new Set(matchedMarks);
	const toDelete = reconciliationRows.filter((r) => marksToClear.has((r.bom_mark ?? '').trim()));
	await Promise.all(toDelete.map((r) => datahubDelete('ocr_results', r.result_id)));
}

const OCR_RESULTS_READY_STATUSES = new Set(['action_needed', 'verified']);

function isRoiRect(value: unknown): value is NonNullable<PdfJob['roi']> {
	if (!value || typeof value !== 'object') return false;
	const roi = value as Record<string, unknown>;
	return (
		typeof roi.x === 'number' &&
		typeof roi.y === 'number' &&
		typeof roi.w === 'number' &&
		typeof roi.h === 'number'
	);
}

async function loadPageSamples(
	verificationId: string,
	drawingFileId?: string
): Promise<Array<{ page: number; url: string }>> {
	const pages = await datahubList<OcrPageRow>('ocr_pages', {
		verification_id: verificationId
	});
	const filtered = pages.filter((p) => {
		if (!p.page_image_file_id) return false;
		if (!drawingFileId) return true;
		return !p.drawing_file_id || p.drawing_file_id === drawingFileId;
	});
	return filtered
		.sort((a, b) => {
			const aKey = a.source_page_number ?? a.page_number;
			const bKey = b.source_page_number ?? b.page_number;
			return aKey - bKey;
		})
		.map((p) => ({
			page: p.page_number,
			url: fileDownloadUrl(p.page_image_file_id)
		}));
}

/** Resolve ROI for a drawing file: map on verification, else legacy bare rect. */
function roiForDrawingFile(verificationRoi: unknown, drawingFileId: string): PdfJob['roi'] {
	if (isRoiRect(verificationRoi)) return verificationRoi;
	if (verificationRoi && typeof verificationRoi === 'object') {
		const entry = (verificationRoi as Record<string, unknown>)[drawingFileId];
		if (isRoiRect(entry)) return entry;
	}
	return null;
}

/**
 * Split verification-wide results/pages onto PdfJobs by `drawing_file_id`.
 * BOM-wide `not_in_pdf` rows (no file id) attach to the first job only so flatMap stays unique.
 */
export function assignResultsToPdfJobs(
	pdfs: PdfJob[],
	rows: OcrResultRow[],
	pageSamplesByFile?: Map<string, Array<{ page: number; url: string }>>,
	allPageSamples?: Array<{ page: number; url: string }>
): void {
	const attributed = rows.filter((r) => r.drawing_file_id);
	const orphans = rows.filter((r) => !r.drawing_file_id);
	const multi =
		pdfs.length > 1 || pdfs.some((pdf) => attributed.some((r) => r.drawing_file_id === pdf.pdf_id));

	for (let i = 0; i < pdfs.length; i++) {
		const pdf = pdfs[i];
		if (!multi) {
			pdf.results = rows;
			if (allPageSamples?.length) pdf.samples = allPageSamples;
			continue;
		}
		const scoped = attributed.filter((r) => r.drawing_file_id === pdf.pdf_id);
		pdf.results = i === 0 ? [...scoped, ...orphans] : scoped;
		const fileSamples = pageSamplesByFile?.get(pdf.pdf_id);
		if (fileSamples?.length) pdf.samples = fileSamples;
	}
}

/** core mode: replace pdf.samples with every persisted page image URL from ocr_pages. */
export async function hydratePdfPageSamples(localBomId: string, pdf: PdfJob): Promise<void> {
	if (OCR_MODE !== 'core') return;
	const verificationId = await resolveVerificationId(localBomId);
	if (!verificationId) return;
	const drawingFileId = pdf.pdf_id !== localBomId ? pdf.pdf_id : undefined;
	const samples = await loadPageSamples(verificationId, drawingFileId);
	if (samples.length > 0) pdf.samples = samples;
}

/** Fill missing PdfJob.roi from BOM metadata so mark-edit can toggle ROI/full-page after reload. */
export function applyPdfRoiFallback(
	pdfs: PdfJob[],
	fallbackRoi: PdfJob['roi'] | null | undefined
): PdfJob[] {
	const fallback = isRoiRect(fallbackRoi) ? fallbackRoi : null;
	if (!fallback) return pdfs;
	return pdfs.map((pdf) => ({
		...pdf,
		roi: isRoiRect(pdf.roi) ? pdf.roi : fallback
	}));
}

/**
 * Core mode: rebuild PdfJob[] from durable ocr_verifications + ocr_results so View
 * works after a full page reload (session memory is empty).
 *
 * Pass `drawingFileIds` to scope to the files the user selected / viewed (subset extract
 * keeps other files' rows in the DB — without a filter the Results table shows all of them).
 */
export async function loadPersistedOperationsCountResults(
	localBomId: string,
	filename = 'drawings.pdf',
	fallbackRoi: PdfJob['roi'] | null = null,
	options?: { drawingFileIds?: string[]; filenamesByFileId?: Record<string, string> }
): Promise<PdfJob[] | null> {
	if (OCR_MODE !== 'core') return null;

	const verifications = await datahubList<OcrVerificationRow>('ocr_verifications', {
		bom_id: localBomId
	});
	const verification = verifications[0];
	if (!verification) return null;

	rehydrateCoreSession(localBomId, verification.verification_id);

	const ready =
		OCR_RESULTS_READY_STATUSES.has(verification.status) || (verification.found_count ?? 0) > 0;
	if (!ready) return null;

	const focusIds = options?.drawingFileIds?.filter(Boolean) ?? [];
	const focusSet = focusIds.length > 0 ? new Set(focusIds) : null;

	const [rows, pages, draftRois, drawings] = await Promise.all([
		datahubList<OcrResultDbRow>('ocr_results', {
			verification_id: verification.verification_id
		}),
		datahubList<OcrPageRow>('ocr_pages', {
			verification_id: verification.verification_id
		}),
		loadDraftRoisByDrawingFileId(localBomId, verification.verification_id),
		datahubList<{ file_id: string }>('proj_bom_drawings', { bom_id: localBomId })
	]);

	const scopedRows = focusSet
		? rows.filter((r) => r.drawing_file_id != null && focusSet.has(r.drawing_file_id))
		: rows;
	const mapped = attachSourcePages(mapResults(scopedRows), pages);
	const allSamples = pages
		.filter((p) => p.page_image_file_id)
		.sort((a, b) => a.page_number - b.page_number)
		.map((p) => ({ page: p.page_number, url: fileDownloadUrl(p.page_image_file_id) }));

	const fileIds = focusSet
		? focusIds.filter((id) => mapped.some((r) => r.drawing_file_id === id) || focusSet.has(id))
		: [...new Set(mapped.map((r) => r.drawing_file_id).filter((id): id is string => Boolean(id)))];

	// Focused view asked for files that have no results yet.
	if (focusSet && mapped.length === 0) return null;

	if (fileIds.length === 0) {
		const legacyRoi = isRoiRect(verification.roi) ? verification.roi : null;
		return applyPdfRoiFallback(
			[
				{
					pdf_id: localBomId,
					filename,
					totalPages: verification.total_pages ?? allSamples.length,
					samples: allSamples,
					roi: legacyRoi,
					jobId: verification.verification_id,
					progress: 100,
					results: mapped,
					status: 'completed',
					error: null,
					currentSampleIdx: 0
				}
			],
			fallbackRoi
		);
	}

	const nameById = new Map(drawings.map((d, i) => [d.file_id, `Drawing ${i + 1}.pdf`] as const));
	const pdfs: PdfJob[] = fileIds.map((fileId, index) => ({
		pdf_id: fileId,
		filename:
			options?.filenamesByFileId?.[fileId] ??
			(fileIds.length === 1 ? filename : (nameById.get(fileId) ?? `Drawing ${index + 1}.pdf`)),
		totalPages: 0,
		samples: [],
		roi: roiForDrawingFile(verification.roi, fileId) ?? draftRois[fileId] ?? null,
		jobId: verification.verification_id,
		progress: 100,
		results: [],
		status: 'completed',
		error: null,
		currentSampleIdx: 0
	}));

	const samplesByFile = new Map<string, Array<{ page: number; url: string }>>();
	for (const fileId of fileIds) {
		samplesByFile.set(
			fileId,
			pages
				.filter((p) => p.page_image_file_id && (!p.drawing_file_id || p.drawing_file_id === fileId))
				.sort((a, b) => {
					const aKey = a.source_page_number ?? a.page_number;
					const bKey = b.source_page_number ?? b.page_number;
					return aKey - bKey;
				})
				.map((p) => ({
					page: p.page_number,
					url: fileDownloadUrl(p.page_image_file_id)
				}))
		);
	}
	for (const pdf of pdfs) {
		const samples = samplesByFile.get(pdf.pdf_id) ?? [];
		pdf.samples = samples;
		pdf.totalPages = samples.length || verification.total_pages || 0;
	}

	assignResultsToPdfJobs(pdfs, mapped, samplesByFile, allSamples);
	return applyPdfRoiFallback(pdfs, fallbackRoi);
}

// ── the adapter surface the components call ──────────────────────────────────

/** Upload drawings and get sample pages. poc: PoC /upload. core: provision + ocr.rasterize. */
export async function uploadDrawings(
	ctx: ProvisionContext,
	options?: UploadDrawingsOptions
): Promise<UploadPdfResponse> {
	if (OCR_MODE === 'poc') {
		if (!ctx.drawingsFile) {
			throw new Error('Drawings file is missing.');
		}
		const form = new FormData();
		form.append('pdf', ctx.drawingsFile);
		return ocrFetch<UploadPdfResponse>('/upload', { method: 'POST', body: form });
	}
	const session = await ensureCoreBom(ctx);

	const existing = await loadExistingFilmstripIfReady(
		session.coreBomId,
		session,
		ctx,
		options?.onRasterizeProgress
	);
	if (existing) return existing;

	const selectedIds = resolveSelectedDrawingFileIds(ctx);
	const rasterizeBody: Record<string, unknown> = {
		op: 'rasterize',
		bom_id: session.coreBomId
	};
	if (selectedIds) rasterizeBody.drawing_file_ids = selectedIds;

	await triggerJob('ocr', rasterizeBody);
	const verification = await waitForFilmstripReady(
		session.coreBomId,
		options?.onRasterizeProgress,
		selectedIds
	);
	session.verificationId = verification.verification_id;
	const pages = await datahubList<OcrPageRow>('ocr_pages', {
		verification_id: verification.verification_id
	});
	const rasterize = mapVerificationProgress(verification);
	options?.onRasterizeProgress?.(rasterize);

	if (selectedIds && selectedIds.length > 0) {
		const drawingOrder = await listDrawingFileIdsInOrder(session.coreBomId);
		const response = buildMultiFileUploadPdfResponse(
			ctx,
			verification,
			pages,
			rasterize,
			selectedIds,
			drawingOrder
		);
		const missing = response.pdfs?.filter((pdf) => !pdf.samples?.length) ?? [];
		if (missing.length > 0) {
			throw new Error(
				`No preview pages for ${missing.map((p) => p.filename).join(', ')}. Re-run Generate after rasterize finishes.`
			);
		}
		return response;
	}

	const samples = mapFilmstripSamples(pages);
	return buildUploadPdfResponse(session, ctx, verification, samples, rasterize);
}

/** Resolve a sample/image URL for an <img src>. */
export function sampleUrl(url: string): string {
	return OCR_MODE === 'core' ? url : ocrStaticUrl(url);
}

/**
 * Full-page image URL for mark-edit / review UIs.
 * poc: PoC `/page_image/{pdf_id}/{page}`. core: file-service URLs from rasterized `ocr_pages`
 * (sample pages are cached on `pdf.samples`; others are looked up by verification).
 */
export async function resolvePageImageUrl(
	localBomId: string,
	pdf: PdfJob,
	page: number
): Promise<string | null> {
	const sample = pdf.samples.find((s) => s.page === page);
	if (sample?.url) return sampleUrl(sample.url);

	if (OCR_MODE === 'poc') {
		return ocrStaticUrl(`/page_image/${pdf.pdf_id}/${page}`);
	}

	const verificationId = await resolveVerificationId(localBomId);
	if (!verificationId) return null;

	const pages = await datahubList<OcrPageRow>('ocr_pages', {
		verification_id: verificationId
	});
	const drawingFileId = pdf.pdf_id !== localBomId ? pdf.pdf_id : undefined;
	const scoped = drawingFileId
		? pages.filter((p) => !p.drawing_file_id || p.drawing_file_id === drawingFileId)
		: pages;
	const match =
		scoped.find((p) => p.page_number === page) ?? scoped.find((p) => p.source_page_number === page);
	return match?.page_image_file_id ? fileDownloadUrl(match.page_image_file_id) : null;
}

/**
 * Full-resolution page URL for detail views (mark edit, review).
 * Skips the filmstrip `pdf.samples` shortcut so every page resolves from persisted `ocr_pages`.
 */
export async function resolveFullPageImageUrl(
	localBomId: string,
	pdf: PdfJob,
	page: number
): Promise<string | null> {
	if (OCR_MODE === 'poc') {
		return ocrStaticUrl(`/page_image/${pdf.pdf_id}/${page}`);
	}

	const verificationId = await resolveVerificationId(localBomId);
	if (!verificationId) return null;

	const pages = await datahubList<OcrPageRow>('ocr_pages', {
		verification_id: verificationId
	});
	const drawingFileId = pdf.pdf_id !== localBomId ? pdf.pdf_id : undefined;
	const scoped = drawingFileId
		? pages.filter((p) => !p.drawing_file_id || p.drawing_file_id === drawingFileId)
		: pages;
	const match =
		scoped.find((p) => p.page_number === page) ?? scoped.find((p) => p.source_page_number === page);
	return match?.page_image_file_id ? fileDownloadUrl(match.page_image_file_id) : null;
}

/** poc: upload the BOM CSV → bom_id. core: no-op (items already inserted) → core bom_id. */
export async function ensureBomForMatching(ctx: ProvisionContext): Promise<string | null> {
	if (OCR_MODE === 'poc') {
		if (!ctx.bomCsvFile) return null;
		const form = new FormData();
		form.append('bom', ctx.bomCsvFile);
		const data = await ocrFetch<{ bom_id?: string }>('/upload_bom', { method: 'POST', body: form });
		return data.bom_id ?? null;
	}
	const session = await ensureCoreBom(ctx);
	return session.coreBomId;
}

export interface StartProcessArgs {
	localBomId: string;
	pdf_id: string;
	job_id: string;
	roi: { x: number; y: number; w: number; h: number };
	/**
	 * Per-file extract (preferred): one ROI per `drawing_file_id`.
	 * Sent as `rois[]` whenever non-empty — including a single file.
	 * Legacy `{ roi }` is only used when this list is omitted (applies to every file).
	 */
	rois?: Array<{ drawing_file_id: string; roi: { x: number; y: number; w: number; h: number } }>;
	regex: string;
	bom_id: string | null;
	ocr_engine: string;
}

/** Start extraction. poc: PoC /process. core: ocr.extract dispatch. Returns the job id to poll. */
export async function startProcess(args: StartProcessArgs): Promise<string> {
	if (OCR_MODE === 'poc') {
		await ocrFetch('/process', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				pdf_id: args.pdf_id,
				job_id: args.job_id,
				roi: args.roi,
				regex: args.regex,
				bom_id: args.bom_id,
				ocr_engine: args.ocr_engine
			})
		});
		return args.job_id;
	}
	const session =
		sessions.get(args.localBomId) ?? (await ensureCoreBom({ localBomId: args.localBomId }));

	const extractBody: Record<string, unknown> = {
		op: 'extract',
		bom_id: session.coreBomId,
		regex: args.regex,
		ocr_engine: args.ocr_engine
	};

	if (args.rois && args.rois.length > 0) {
		const needsFileIdRewrite = args.rois.some(
			(entry) => entry.drawing_file_id === session.coreBomId
		);
		if (needsFileIdRewrite && args.rois.length === 1) {
			const fileId = await currentDrawingFileId(session.coreBomId);
			extractBody.rois = [
				{ drawing_file_id: fileId ?? args.rois[0].drawing_file_id, roi: args.rois[0].roi }
			];
		} else if (needsFileIdRewrite) {
			// Legacy multi PdfJob keyed by bom_id — apply one ROI to every file.
			extractBody.roi = args.roi;
		} else {
			extractBody.rois = args.rois;
		}
	} else {
		extractBody.roi = args.roi;
	}

	const job = await triggerJob('ocr', extractBody);
	return job.job_id;
}

/**
 * Persist a draft ROI on `ocr_verification_drawings` when a per-file row exists.
 * No-op when the orchestrator has not created verification_drawings yet.
 */
export async function persistDraftRoi(
	localBomId: string,
	drawingFileId: string,
	roi: { x: number; y: number; w: number; h: number }
): Promise<void> {
	if (OCR_MODE !== 'core') return;
	const verificationId = await resolveVerificationId(localBomId);
	if (!verificationId) return;

	const rows = await datahubList<{
		verification_drawing_id: string;
		drawing_file_id: string;
	}>('ocr_verification_drawings', { verification_id: verificationId });

	const match = rows.find((r) => r.drawing_file_id === drawingFileId);
	if (!match) return;

	await datahubUpdate('ocr_verification_drawings', match.verification_drawing_id, { roi });
}

/** Load draft ROIs from ocr_verification_drawings keyed by drawing_file_id. */
export async function loadDraftRoisByDrawingFileId(
	localBomId: string,
	knownVerificationId?: string
): Promise<Record<string, { x: number; y: number; w: number; h: number }>> {
	if (OCR_MODE !== 'core') return {};
	const verificationId = knownVerificationId ?? (await resolveVerificationId(localBomId));
	if (!verificationId) return {};

	const rows = await datahubList<{
		drawing_file_id: string;
		roi?: unknown;
	}>('ocr_verification_drawings', { verification_id: verificationId });

	const out: Record<string, { x: number; y: number; w: number; h: number }> = {};
	for (const row of rows) {
		if (isRoiRect(row.roi)) out[row.drawing_file_id] = row.roi;
	}
	return out;
}

/** Poll job status + (on completion) results. poc: PoC /status. core: async_jobs + ocr_results. */
export async function getStatus(localBomId: string, jobId: string): Promise<StatusResult> {
	if (OCR_MODE === 'poc') {
		return ocrFetch<StatusResult>(`/status/${jobId}`);
	}
	const job = await getJob(jobId);
	if (!job) return { status: 'not_found' };
	if (job.status !== 'completed') {
		const rasterizeProgress = await getRasterizeProgress(localBomId);
		const waitingOnRender =
			rasterizeProgress != null &&
			(rasterizeProgress.rasterizeStatus === 'pending' ||
				rasterizeProgress.rasterizeStatus === 'rendering');
		return {
			status: job.status === 'failed' ? 'failed' : 'processing',
			progress: job.progress,
			error: job.error ?? undefined,
			rasterizeProgress: waitingOnRender ? rasterizeProgress : undefined
		};
	}
	const verificationId = await resolveVerificationId(localBomId);
	const [rows, pages] = verificationId
		? await Promise.all([
				datahubList<OcrResultDbRow>('ocr_results', { verification_id: verificationId }),
				datahubList<OcrPageRow>('ocr_pages', { verification_id: verificationId })
			])
		: [[], []];
	const pageSamples = pages.length
		? pages
				.filter((p) => p.page_image_file_id)
				.sort((a, b) => a.page_number - b.page_number)
				.map((p) => ({ page: p.page_number, url: fileDownloadUrl(p.page_image_file_id) }))
		: undefined;
	return {
		status: 'completed',
		progress: 100,
		results: attachSourcePages(mapResults(rows), pages),
		pageSamples
	};
}

/**
 * After a completed extract, partition verification-wide status onto each PdfJob
 * (by `drawing_file_id`) so Results.flatMap does not duplicate rows.
 */
export async function applyCompletedStatusToPdfJobs(
	localBomId: string,
	pdfs: PdfJob[],
	data: StatusResult
): Promise<void> {
	const rows = (data.results || []).map((row) => ({
		...row,
		id: row.id ?? crypto.randomUUID()
	}));

	const multi = pdfs.length > 1 || rows.some((r) => r.drawing_file_id);
	if (!multi) {
		for (const pdf of pdfs) {
			pdf.results = rows;
			if (data.pageSamples?.length) pdf.samples = data.pageSamples;
			pdf.status = 'completed';
			pdf.progress = data.progress ?? 100;
		}
		return;
	}

	const verificationId = await resolveVerificationId(localBomId);
	const samplesByFile = new Map<string, Array<{ page: number; url: string }>>();
	if (verificationId) {
		await Promise.all(
			pdfs.map(async (pdf) => {
				if (pdf.pdf_id === localBomId) return;
				samplesByFile.set(pdf.pdf_id, await loadPageSamples(verificationId, pdf.pdf_id));
			})
		);
	}

	assignResultsToPdfJobs(pdfs, rows, samplesByFile, data.pageSamples);
	for (const pdf of pdfs) {
		pdf.status = 'completed';
		pdf.progress = data.progress ?? 100;
	}
}
