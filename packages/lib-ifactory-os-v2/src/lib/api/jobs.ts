import { apiErrorFromJob } from './api-error.js';
import { apiClient } from './api-client.js';
import { rowsFromEnvelope, type ApiEnvelope } from './types.js';

/**
 * Generic core job trigger + poll, shared across features (OCR, cutting-plan, …).
 *
 * A job is started with `POST /api/v2/datahub/jobs/:feature { request }` and observed by polling
 * `GET /api/v2/datahub/async_jobs?job_id=&select=…`. Auth is the session cookie via `apiClient`.
 * This is the `apiClient`-native equivalent of the older `core-api.ts` `triggerJob`/`getJob`/`waitForJob`.
 */

/** Shared interval for all async / status polls (jobs, OCR, BOM extract, cutting plan). */
export const ASYNC_STATUS_POLL_MS = 10_000;

/**
 * Status-poll columns only. Omits jsonb `request` (can be 100KB+ for CP) — the caller already
 * has the input; polls only need status / progress / result_ref / error.
 */
export const ASYNC_JOB_POLL_SELECT = [
	'job_id',
	'status',
	'progress',
	'result_ref',
	'error',
	'metadata',
	'created_at',
	'updated_at'
].join(',');

export type AsyncJobStatus = 'queued' | 'dispatched' | 'processing' | 'completed' | 'failed';

export type AsyncJobRow = {
	job_id: string;
	status: AsyncJobStatus;
	progress?: number | null;
	/** Feature-specific job result JSON. e.g. `cp.plan` returns `{ run_id, version, cached }`. */
	result_ref?: unknown;
	error?: string | null;
	/** job-gateway stamps `error_code` here on failure (ERROR_CATALOG_DESIGN.md §7d). */
	metadata?: { error_code?: string; [key: string]: unknown } | null;
	created_at?: string;
	updated_at?: string | null;
};

export type TriggerJobResult = { job_id: string; status: AsyncJobStatus };

/** Start a job for `feature` (e.g. `'cp'`, `'ocr'`). Returns the new `job_id`. */
export async function triggerJob(
	feature: string,
	request: unknown,
	signal?: AbortSignal
): Promise<TriggerJobResult> {
	const envelope = await apiClient.post<ApiEnvelope<TriggerJobResult>>(
		apiClient.datahub(`jobs/${encodeURIComponent(feature)}`),
		{ request },
		{ signal }
	);
	const row = rowsFromEnvelope<TriggerJobResult>(envelope.data)[0];
	if (!row) throw new Error(`triggerJob(${feature}) returned no data`);
	return row;
}

/** One status read. Returns null if the job row isn't visible yet. */
export async function getJob(jobId: string, signal?: AbortSignal): Promise<AsyncJobRow | null> {
	const envelope = await apiClient.get<ApiEnvelope<AsyncJobRow[]>>(
		apiClient.datahub(
			`async_jobs?job_id=${encodeURIComponent(jobId)}&select=${ASYNC_JOB_POLL_SELECT}`
		),
		{ signal }
	);
	return rowsFromEnvelope<AsyncJobRow>(envelope.data)[0] ?? null;
}

export type WaitForJobOptions = {
	/** Fixed sleep between polls. Ignored when `intervalMsSchedule` is set. Default 10s. */
	intervalMs?: number;
	/**
	 * Adaptive poll delays (ms). When set: sleep `schedule[0]` before the first status
	 * read, then after each non-terminal poll sleep `schedule[i]` (clamped to the last
	 * entry). Scalar `intervalMs` callers keep poll-immediately-then-sleep behavior.
	 */
	intervalMsSchedule?: number[];
	timeoutMs?: number;
	signal?: AbortSignal;
	onProgress?: (progress: number | null) => void;
};

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
	if (signal?.aborted) {
		return Promise.reject(
			signal.reason instanceof Error ? signal.reason : new DOMException('Aborted', 'AbortError')
		);
	}
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => {
			signal?.removeEventListener('abort', onAbort);
			resolve();
		}, ms);
		const onAbort = () => {
			clearTimeout(timer);
			reject(
				signal?.reason instanceof Error ? signal.reason : new DOMException('Aborted', 'AbortError')
			);
		};
		signal?.addEventListener('abort', onAbort, { once: true });
	});
}

/** Poll until the job is terminal. Resolves on `completed`; throws on `failed`, timeout, or abort. */
export async function waitForJob(
	jobId: string,
	options: WaitForJobOptions = {}
): Promise<AsyncJobRow> {
	const schedule = options.intervalMsSchedule?.filter((ms) => Number.isFinite(ms) && ms >= 0);
	const useSchedule = Boolean(schedule && schedule.length > 0);
	const intervalMs = options.intervalMs ?? ASYNC_STATUS_POLL_MS;
	const timeoutMs = options.timeoutMs ?? 30 * 60 * 1000;
	const startedAt = Date.now();
	/** Next index into `schedule` for post-poll sleeps (0 = initial delay already applied). */
	let scheduleIndex = 0;

	if (useSchedule) {
		await sleep(schedule![0]!, options.signal);
		scheduleIndex = 1;
	}

	for (;;) {
		if (options.signal?.aborted) {
			throw options.signal.reason instanceof Error
				? options.signal.reason
				: new DOMException('Aborted', 'AbortError');
		}
		const job = await getJob(jobId, options.signal);
		if (job) {
			options.onProgress?.(job.progress ?? null);
			if (job.status === 'completed') return job;
			if (job.status === 'failed') throw apiErrorFromJob(job);
		}
		if (Date.now() - startedAt > timeoutMs) {
			throw apiErrorFromJob({
				job_id: jobId,
				error: `job ${jobId} timed out`,
				metadata: { error_code: 'sys.timeout' }
			});
		}
		const delayMs = useSchedule
			? schedule![Math.min(scheduleIndex, schedule!.length - 1)]!
			: intervalMs;
		if (useSchedule) scheduleIndex += 1;
		await sleep(delayMs, options.signal);
	}
}
