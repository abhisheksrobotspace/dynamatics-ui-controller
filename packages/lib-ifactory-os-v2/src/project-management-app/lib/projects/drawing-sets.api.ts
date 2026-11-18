import { apiClient } from '../../../lib/api/api-client.js';
import { datahubQuery, leftJoin, pickAliasString } from '../../../lib/api/datahub-query.js';
import { rowsFromEnvelope, type ApiEnvelope } from '../../../lib/api/types.js';
import { formatUtcAsIst } from '../../../lib/datetime/format-ist.js';
import { datahubDelete, filesUpload } from '../core-api.js';
import { deleteUploadedFile, setBomOcrStatus } from './boms.api.js';
import type { ProjBomDrawingRow } from './types.js';

const PROJ_BOM_DRAWING_SET_SELECT = [
	'bom_drawing_id',
	'bom_id',
	'file_id',
	'drawing_set',
	'set_sort_order',
	'sort_order',
	'created_at',
	'f.file_name'
].join(',');

const DEFAULT_DRAWING_SET_NAME = 'Drawings';
const PENDING_SETS_KEY = (bomId: string) => `pm.pendingDrawingSets:${bomId}`;

export type BomDrawingFile = {
	bomDrawingId: string;
	bomId: string;
	fileId: string;
	fileName: string | null;
	drawingSet: string;
	setSortOrder: number;
	sortOrder: number;
	createdAt: string | null;
};

export type BomDrawingSetListRow = {
	id: string;
	name: string;
	files: number;
	status: 'Updated' | 'Published';
	updated: string;
	setSortOrder: number;
	isPending: boolean;
};

export type BomDrawingFileListRow = {
	id: string;
	bomDrawingId: string;
	fileId: string;
	fileName: string;
	status: 'Updated' | 'Published';
	updated: string;
	sortOrder: number;
};

function mapDrawingRow(row: Record<string, unknown> | ProjBomDrawingRow): BomDrawingFile {
	const record = row as Record<string, unknown>;
	const joinedName = pickAliasString(record, 'f', 'file_name').trim();
	const bareName =
		typeof (row as ProjBomDrawingRow).file_name === 'string'
			? (row as ProjBomDrawingRow).file_name!.trim()
			: '';
	const drawingSetRaw = (row as ProjBomDrawingRow).drawing_set;
	return {
		bomDrawingId: String((row as ProjBomDrawingRow).bom_drawing_id ?? ''),
		bomId: String((row as ProjBomDrawingRow).bom_id ?? ''),
		fileId: String((row as ProjBomDrawingRow).file_id ?? ''),
		fileName: joinedName || bareName || null,
		drawingSet:
			typeof drawingSetRaw === 'string' && drawingSetRaw.length > 0
				? drawingSetRaw
				: DEFAULT_DRAWING_SET_NAME,
		setSortOrder:
			typeof (row as ProjBomDrawingRow).set_sort_order === 'number'
				? (row as ProjBomDrawingRow).set_sort_order!
				: 0,
		sortOrder: (row as ProjBomDrawingRow).sort_order,
		createdAt: (row as ProjBomDrawingRow).created_at ?? null
	};
}

export function readPendingDrawingSetNames(bomId: string): string[] {
	if (typeof sessionStorage === 'undefined') return [];
	try {
		const raw = sessionStorage.getItem(PENDING_SETS_KEY(bomId));
		if (!raw) return [];
		const parsed = JSON.parse(raw) as unknown;
		return Array.isArray(parsed) ? parsed.filter((name) => typeof name === 'string') : [];
	} catch {
		return [];
	}
}

export function writePendingDrawingSetNames(bomId: string, names: string[]) {
	if (typeof sessionStorage === 'undefined') return;
	sessionStorage.setItem(PENDING_SETS_KEY(bomId), JSON.stringify(names));
}

export function addPendingDrawingSetName(bomId: string, name: string) {
	const trimmed = name.trim();
	if (!trimmed) return;
	const existing = readPendingDrawingSetNames(bomId);
	if (existing.includes(trimmed)) return;
	writePendingDrawingSetNames(bomId, [...existing, trimmed]);
}

export function removePendingDrawingSetName(bomId: string, name: string) {
	writePendingDrawingSetNames(
		bomId,
		readPendingDrawingSetNames(bomId).filter((entry) => entry !== name)
	);
}

export async function listBomDrawingFiles(
	bomId: string,
	signal?: AbortSignal
): Promise<BomDrawingFile[]> {
	const rows = await datahubQuery<Record<string, unknown>>(
		'proj_bom_drawings',
		{
			bom_id: bomId,
			limit: 2500,
			select: PROJ_BOM_DRAWING_SET_SELECT,
			joins: [leftJoin('files', 'f', 'file_id', 'f.file_id')]
		},
		signal
	);
	return rows
		.map(mapDrawingRow)
		.sort(
			(a, b) =>
				a.setSortOrder - b.setSortOrder ||
				a.sortOrder - b.sortOrder ||
				a.drawingSet.localeCompare(b.drawingSet)
		);
}

export function buildDrawingSetListRows(
	files: BomDrawingFile[],
	versionStage: 'proto' | 'mass',
	pendingSetNames: string[] = []
): BomDrawingSetListRow[] {
	const bySet = new Map<string, BomDrawingFile[]>();
	for (const file of files) {
		const list = bySet.get(file.drawingSet) ?? [];
		list.push(file);
		bySet.set(file.drawingSet, list);
	}

	const status: BomDrawingSetListRow['status'] = versionStage === 'mass' ? 'Published' : 'Updated';

	const rows: BomDrawingSetListRow[] = [];
	for (const [name, setFiles] of bySet) {
		const latest = setFiles.reduce<string | null>((max, file) => {
			if (!file.createdAt) return max;
			if (!max) return file.createdAt;
			return file.createdAt > max ? file.createdAt : max;
		}, null);
		rows.push({
			id: name,
			name,
			files: setFiles.length,
			status,
			updated: latest ? formatUtcAsIst(latest) : '—',
			setSortOrder: setFiles[0]?.setSortOrder ?? 0,
			isPending: false
		});
	}

	const usedSortOrders = new Set(rows.map((row) => row.setSortOrder));
	let nextSortOrder = rows.length === 0 ? 0 : Math.max(...rows.map((row) => row.setSortOrder)) + 1;

	for (const name of pendingSetNames) {
		if (bySet.has(name)) continue;
		while (usedSortOrders.has(nextSortOrder)) nextSortOrder += 1;
		rows.push({
			id: name,
			name,
			files: 0,
			status,
			updated: '—',
			setSortOrder: nextSortOrder,
			isPending: true
		});
		usedSortOrders.add(nextSortOrder);
		nextSortOrder += 1;
	}

	return rows.sort((a, b) => a.setSortOrder - b.setSortOrder || a.name.localeCompare(b.name));
}

export async function buildDrawingFileListRows(
	files: BomDrawingFile[],
	drawingSet: string,
	versionStage: 'proto' | 'mass'
): Promise<BomDrawingFileListRow[]> {
	const status: BomDrawingFileListRow['status'] = versionStage === 'mass' ? 'Published' : 'Updated';

	const inSet = files
		.filter((file) => file.drawingSet === drawingSet)
		.sort((a, b) => a.sortOrder - b.sortOrder);

	return inSet.map((file, index) => {
		const fallback = `Drawing ${index + 1}.pdf`;
		return {
			id: file.bomDrawingId,
			bomDrawingId: file.bomDrawingId,
			fileId: file.fileId,
			fileName: file.fileName?.trim() || fallback,
			status,
			updated: file.createdAt ? formatUtcAsIst(file.createdAt) : '—',
			sortOrder: file.sortOrder
		};
	});
}

/** Auto-name drawing sets as Set 1, Set 2, … skipping names already in use. */
export function nextDrawingSetName(
	files: BomDrawingFile[],
	pendingSetNames: string[] = []
): string {
	const used = new Set<string>();
	for (const file of files) used.add(file.drawingSet);
	for (const name of pendingSetNames) used.add(name);

	let index = 1;
	while (used.has(`Set ${index}`)) index += 1;
	return `Set ${index}`;
}

export function nextSetSortOrder(files: BomDrawingFile[], pendingNames: string[]): number {
	if (files.length === 0 && pendingNames.length === 0) return 0;
	const fromFiles = files.length > 0 ? Math.max(...files.map((file) => file.setSortOrder)) + 1 : 0;
	return Math.max(fromFiles, pendingNames.length);
}

export function nextFileSortOrder(files: BomDrawingFile[], drawingSet: string): number {
	const inSet = files.filter((file) => file.drawingSet === drawingSet);
	if (inSet.length === 0) return 0;
	return Math.max(...inSet.map((file) => file.sortOrder)) + 1;
}

export async function createBomDrawingFile(
	input: {
		bomId: string;
		fileId: string;
		drawingSet: string;
		setSortOrder: number;
		sortOrder: number;
	},
	signal?: AbortSignal
): Promise<BomDrawingFile> {
	const envelope = await apiClient.post<ApiEnvelope<ProjBomDrawingRow>>(
		apiClient.datahub('proj_bom_drawings'),
		{
			bom_id: input.bomId,
			file_id: input.fileId,
			drawing_set: input.drawingSet,
			set_sort_order: input.setSortOrder,
			sort_order: input.sortOrder
		},
		{ signal }
	);
	const row = rowsFromEnvelope(envelope.data)[0];
	if (!row) throw new Error('Create drawing file returned no data');
	return mapDrawingRow(row);
}

export async function uploadDrawingPdfToSet(
	bomId: string,
	drawingSet: string,
	file: File,
	setSortOrder: number,
	sortOrder: number,
	signal?: AbortSignal
): Promise<BomDrawingFile> {
	const fileId = await filesUpload(file, file.name, 'proj_boms', bomId);
	const created = await createBomDrawingFile(
		{ bomId, fileId, drawingSet, setSortOrder, sortOrder },
		signal
	);
	removePendingDrawingSetName(bomId, drawingSet);
	return { ...created, fileName: file.name || created.fileName };
}

async function clearOcrClientCaches(bomId: string): Promise<void> {
	try {
		const [{ cancelBackgroundExtraction }, { clearOperationsCountResults }] = await Promise.all([
			import('../../../ocr-app/lib/operations-count-extraction.svelte.js'),
			import('../../../ocr-app/lib/operations-count-results.svelte.js')
		]);
		cancelBackgroundExtraction(bomId);
		clearOperationsCountResults(bomId);
	} catch {
		// OCR app client caches are best-effort when deleting from PM.
	}
}

/**
 * After a drawing PDF is removed: server CASCADE already wiped per-file OCR rows.
 * UI still owns verification status + BOM ocr_status + BOM-level draft ROI.
 *
 * - Drawings remain → demote verification to `awaiting_roi`, clear ROI / confirm fields
 * - Last drawing gone → delete the verification row (clears not_in_pdf leftovers too)
 */
export async function resetOcrStateAfterDrawingDelete(
	bomId: string,
	signal?: AbortSignal
): Promise<void> {
	await clearOcrClientCaches(bomId);

	const [remaining, verificationEnvelope, bomEnvelope] = await Promise.all([
		listBomDrawingFiles(bomId, signal),
		apiClient.get<ApiEnvelope<Array<{ verification_id: string }>>>(
			apiClient.datahub(
				`ocr_verifications?bom_id=${encodeURIComponent(bomId)}&select=verification_id&limit=1`
			),
			{ signal }
		),
		apiClient.get<ApiEnvelope<Array<{ metadata?: Record<string, unknown> | null }>>>(
			apiClient.datahub(`proj_boms?bom_id=${encodeURIComponent(bomId)}&select=metadata&limit=1`),
			{ signal }
		)
	]);

	const verification = rowsFromEnvelope(verificationEnvelope.data)[0];
	const bomRow = rowsFromEnvelope(bomEnvelope.data)[0];
	const metadata = { ...(bomRow?.metadata ?? {}) };
	const hadLegacyRoi = metadata.operations_count_roi != null;

	await setBomOcrStatus(bomId, 'not_verified', signal);
	if (hadLegacyRoi) {
		metadata.operations_count_roi = null;
		await apiClient.patch(
			apiClient.datahub(`proj_boms/${encodeURIComponent(bomId)}`),
			{ metadata },
			{ signal }
		);
	}

	if (!verification) return;

	if (remaining.length === 0) {
		await datahubDelete('ocr_verifications', verification.verification_id);
		return;
	}

	await apiClient.patch(
		apiClient.datahub(`ocr_verifications/${encodeURIComponent(verification.verification_id)}`),
		{
			status: 'awaiting_roi',
			roi: null,
			confirmed_at: null,
			confirmed_by_user_id: null
		},
		{ signal }
	);
}

export async function deleteBomDrawingFile(
	bomId: string,
	drawing: BomDrawingFile,
	signal?: AbortSignal,
	options?: { skipOcrReset?: boolean }
): Promise<void> {
	await datahubDelete('proj_bom_drawings', drawing.bomDrawingId);
	await deleteUploadedFile(drawing.fileId, signal);
	if (!options?.skipOcrReset) {
		await resetOcrStateAfterDrawingDelete(bomId, signal);
	}
}

export async function deleteDrawingSet(
	bomId: string,
	drawingSet: string,
	files: BomDrawingFile[],
	signal?: AbortSignal
): Promise<void> {
	const targets = files.filter((file) => file.drawingSet === drawingSet);
	if (targets.length === 0) {
		removePendingDrawingSetName(bomId, drawingSet);
		return;
	}
	await Promise.all(
		targets.map((file) => deleteBomDrawingFile(bomId, file, signal, { skipOcrReset: true }))
	);
	removePendingDrawingSetName(bomId, drawingSet);
	await resetOcrStateAfterDrawingDelete(bomId, signal);
}

export async function renameDrawingSet(
	bomId: string,
	currentName: string,
	nextName: string,
	files: BomDrawingFile[],
	signal?: AbortSignal
): Promise<void> {
	const trimmed = nextName.trim();
	if (!trimmed || trimmed === currentName) return;

	const targets = files.filter((file) => file.drawingSet === currentName);
	await Promise.all(
		targets.map((file) =>
			apiClient.patch(
				apiClient.datahub(`proj_bom_drawings/${encodeURIComponent(file.bomDrawingId)}`),
				{ drawing_set: trimmed },
				{ signal }
			)
		)
	);

	const pending = readPendingDrawingSetNames(bomId);
	if (pending.includes(currentName)) {
		writePendingDrawingSetNames(
			bomId,
			pending.map((name) => (name === currentName ? trimmed : name))
		);
	}
}
