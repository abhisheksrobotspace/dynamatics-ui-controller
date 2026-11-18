/**
 * Job-card drawing files (`JOB_CARD_ARTIFACTS_UI_HANDOFF.md` §2.3).
 *
 * The runtime downloads each artifact. This module builds the fetch payload and
 * reads status replies. The signed `url` is only placed on the fetch body.
 */

export const DRAWING_FILES_FETCH = '/rt/files/fetch';
export const DRAWING_FILES_STATUS = '/rt/files/status';
export const DRAWING_FILES_RESULT = '/rt/files/result';
export const DRAWING_FILES_CHANGED = '/rt/files/changed';

const MAX_BYTES = 16 * 1024 * 1024;

export type DrawingFetch = {
	dest: string;
	url: string;
	sha256: string;
	sizeBytes: number;
};

export type DrawingFileNotice = {
	dest: string;
	status: string;
	error?: string;
};

export function extFromMime(mime: string): string {
	const value = mime.split(';')[0]?.trim().toLowerCase() ?? '';
	if (value === 'image/jpeg' || value === 'image/jpg') return 'jpg';
	if (value === 'image/png') return 'png';
	if (value === 'image/webp') return 'webp';
	return '';
}

function safeSegment(value: string): boolean {
	return value.length > 0 && !value.includes('/') && !value.includes('\\') && !value.includes('..');
}

/** Relative path under the runtime artifact root. Empty when the path would be rejected. */
export function drawingArtifactDest(jobId: string, fileId: string, ext: string): string {
	if (!safeSegment(jobId) || !safeSegment(fileId) || !safeSegment(ext)) return '';
	return `jobs/${jobId}/${fileId}.${ext}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cell(value: unknown): string {
	if (typeof value === 'string') return value.trim();
	return '';
}

function linkExpired(expiresAt: string): boolean {
	if (!expiresAt) return false;
	const at = Date.parse(expiresAt);
	return Number.isFinite(at) && at <= Date.now();
}

function fetchFromArtifact(jobId: string, row: Record<string, unknown>): DrawingFetch | null {
	if (linkExpired(cell(row.expiresAt))) return null;
	const fileId = cell(row.fileId);
	const ext = extFromMime(cell(row.mime));
	const dest = drawingArtifactDest(jobId, fileId, ext);
	const url = cell(row.url);
	const sha256 = cell(row.sha256).toLowerCase();
	const sizeBytes = typeof row.sizeBytes === 'number' ? row.sizeBytes : Number(row.sizeBytes);
	if (!dest || !url.startsWith('https://') || !/^[0-9a-f]{64}$/.test(sha256)) return null;
	if (!Number.isInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > MAX_BYTES) return null;
	return { dest, url, sha256, sizeBytes };
}

/** One fetch per file. Marks that share a `fileId` produce one destination. Expired links are omitted. */
export function drawingFetchesFromCard(card: Record<string, unknown> | undefined): DrawingFetch[] {
	if (!isRecord(card) || !Array.isArray(card.artifacts)) return [];
	const jobId = cell(card.jobId);
	const byDest = new Map<string, DrawingFetch>();
	for (const row of card.artifacts) {
		if (!isRecord(row)) continue;
		const item = fetchFromArtifact(jobId, row);
		if (!item || byDest.has(item.dest)) continue;
		byDest.set(item.dest, item);
	}
	return [...byDest.values()];
}

export function drawingFetchesFromJobs(
	jobs: Record<string, { sourceCard?: Record<string, unknown> }>
): DrawingFetch[] {
	const byDest = new Map<string, DrawingFetch>();
	for (const job of Object.values(jobs)) {
		for (const item of drawingFetchesFromCard(job.sourceCard)) {
			if (!byDest.has(item.dest)) byDest.set(item.dest, item);
		}
	}
	return [...byDest.values()];
}

export function drawingFetchForDest(
	card: Record<string, unknown> | undefined,
	dest: string
): DrawingFetch | null {
	return drawingFetchesFromCard(card).find((item) => item.dest === dest) ?? null;
}

export function drawingFetchMessage(
	item: DrawingFetch,
	requestId: string
): { topic: string; body: Record<string, unknown> } {
	return {
		topic: DRAWING_FILES_FETCH,
		body: {
			requestId,
			url: item.url,
			sha256: item.sha256,
			sizeBytes: item.sizeBytes,
			dest: item.dest
		}
	};
}

export function drawingStatusMessage(
	dest: string,
	requestId: string
): { topic: string; body: Record<string, unknown> } {
	return {
		topic: DRAWING_FILES_STATUS,
		body: { requestId, dest }
	};
}

/** Reply or change event. Anything else, including a fetch publish, is ignored. */
export function parseDrawingFileNotice(topic: string, data: unknown): DrawingFileNotice | null {
	if (topic !== DRAWING_FILES_RESULT && topic !== DRAWING_FILES_CHANGED) return null;
	if (!isRecord(data)) return null;
	const dest = cell(data.dest);
	const status = cell(data.status);
	if (!dest || !status) return null;
	const error = cell(data.error);
	return error ? { dest, status, error } : { dest, status };
}

/**
 * Operator copy for one drawing. `null` means the file is ready and the image can be shown.
 * A missing status is "downloading…" — the screen has asked, and the runtime has not answered yet.
 */
export function drawingStatusCopy(input: {
	expired: boolean;
	hasFile: boolean;
	status?: string;
	error?: string;
	broken?: boolean;
}): string | null {
	if (input.broken) return 'drawing not available';
	if (input.expired || (input.status === 'failed' && input.error === 'forbidden')) {
		return 'drawing link expired — ask planning to republish';
	}
	if (!input.hasFile) return 'drawing not available';
	if (input.status === 'ready') return null;
	if (input.status === 'failed' && input.error === 'disk_full') return 'device storage full';
	if (input.status === 'failed' || input.status === 'deleted') return 'drawing not available';
	return 'downloading…';
}

/** Republish the fetch for a missing file, or a failure that a later open can retry. */
export function shouldRefetchDrawing(input: {
	expired: boolean;
	status: string;
	error?: string;
}): boolean {
	if (input.expired) return false;
	if (input.status === 'absent') return true;
	if (input.status === 'failed' && input.error !== 'forbidden') return true;
	return false;
}
