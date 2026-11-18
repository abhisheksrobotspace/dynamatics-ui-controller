/**
 * Uniform API error shape (ERROR_CATALOG_DESIGN.md §7).
 * Prefer branching on `code`; `message` is safe display copy from the server (or a legacy fallback).
 */

export type ApiErrorDetail = { path?: string; message: string };

export type ApiErrorShape = {
	code: string;
	message: string;
	status: number;
	requestId?: string;
	details?: ApiErrorDetail[];
	/** Raw response body retained for debugging / legacy formatters. */
	body?: unknown;
};

/** Tiny map for async-job codes when the server only stamps `metadata.error_code` (no HTTP envelope). */
const JOB_CODE_MESSAGES: Record<string, string> = {
	'ocr.default': 'The scan could not be completed. Please try again.',
	'cp.default': 'The planner could not complete. Please try again.',
	'pln.default': 'Planning could not complete this action. Please try again.',
	'pln.bad_request': 'That planning request is missing something we need.',
	'pln.plan_not_found': 'That plan could not be found.',
	'pln.month_invalid': 'Please choose a valid month.',
	'pln.month_frozen':
		'This month is frozen on the shop floor and can no longer be changed. Unfreeze it first.',
	'pln.month_empty':
		'This plan has no quantities for the selected month, so there is nothing to send.',
	'pln.already_frozen': 'This month is already frozen.',
	'pln.not_frozen': 'This month has not been frozen yet.',
	'pln.plan_empty': 'This shop-floor plan has no lines to freeze.',
	'pln.carry_target_unavailable':
		'The leftover quantity has nowhere to go — every later month is already frozen.',
	'sys.timeout': 'The request took too long to complete. Please try again.',
	'sys.internal':
		'Something went wrong on our end. Please try again, and contact support if it keeps happening.'
};

function codeFromHttpStatus(status: number): string {
	if (status === 401) return 'auth.unauthenticated';
	if (status === 403) return 'auth.forbidden';
	if (status === 404) return 'sys.not_found';
	if (status === 429) return 'sys.rate_limited';
	if (status >= 500) return 'sys.internal';
	return 'validation.failed';
}

function asRecord(value: unknown): Record<string, unknown> | null {
	return value != null && typeof value === 'object' && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null;
}

function formatLegacyDetail(data: Record<string, unknown>, status: number): string {
	if (typeof data.error === 'string') return data.error;
	if (typeof data.message === 'string') return data.message;
	if (typeof data.detail === 'string') return data.detail;
	if (Array.isArray(data.detail)) {
		return data.detail
			.map((item) =>
				typeof item === 'object' && item && 'msg' in item
					? String((item as { msg: unknown }).msg)
					: String(item)
			)
			.join(', ');
	}
	return `Request failed (${status})`;
}

export class ApiError extends Error implements ApiErrorShape {
	readonly code: string;
	readonly status: number;
	readonly requestId?: string;
	readonly details?: ApiErrorDetail[];
	readonly body?: unknown;

	constructor(shape: ApiErrorShape);
	/** @deprecated Prefer {@link ApiErrorShape}; kept for existing call sites/tests. */
	constructor(message: string, status: number, body?: unknown);
	constructor(messageOrShape: string | ApiErrorShape, status?: number, body?: unknown) {
		if (typeof messageOrShape === 'object') {
			super(messageOrShape.message);
			this.name = 'ApiError';
			this.code = messageOrShape.code;
			this.status = messageOrShape.status;
			this.requestId = messageOrShape.requestId;
			this.details = messageOrShape.details;
			this.body = messageOrShape.body;
			return;
		}
		super(messageOrShape);
		this.name = 'ApiError';
		this.status = status ?? 500;
		this.code = codeFromHttpStatus(this.status);
		this.body = body;
	}

	/** True when retrying the same request could plausibly succeed. */
	get retryable(): boolean {
		return this.status === 429 || this.status === 503 || this.status === 504;
	}
}

/**
 * Normalize a parsed JSON body + HTTP status into {@link ApiError}.
 * Handles the new `{ error: { code, message, … } }` envelope and legacy string shapes.
 */
export function toApiErrorFromBody(body: unknown, status: number): ApiError {
	const data = asRecord(body) ?? {};
	const nested = asRecord(data.error);

	if (nested && typeof nested.code === 'string') {
		const details = Array.isArray(nested.details)
			? (nested.details as ApiErrorDetail[]).filter(
					(d) => d && typeof d === 'object' && typeof d.message === 'string'
				)
			: undefined;
		return new ApiError({
			code: nested.code,
			message:
				typeof nested.message === 'string' ? nested.message : formatLegacyDetail(data, status),
			status: typeof nested.status === 'number' ? nested.status : status,
			requestId: typeof nested.requestId === 'string' ? nested.requestId : undefined,
			details,
			body
		});
	}

	const message = formatLegacyDetail(data, status);
	return new ApiError({
		code: codeFromHttpStatus(status),
		message:
			message ||
			(status === 401 ? 'Please sign in to continue.' : 'Something went wrong. Please try again.'),
		status,
		body
	});
}

/** Normalize ANY failed Response (new envelope + legacy shapes during migration). */
export async function toApiError(res: Response): Promise<ApiError> {
	let body: unknown = null;
	try {
		body = await res.json();
	} catch {
		/* empty body (e.g. edge 401) */
	}
	return toApiErrorFromBody(body, res.status);
}

/** Build an ApiError from a failed async_jobs row (`metadata.error_code`). */
export function apiErrorFromJob(job: {
	job_id?: string;
	error?: string | null;
	metadata?: { error_code?: string; [key: string]: unknown } | null;
}): ApiError {
	const code = job.metadata?.error_code ?? 'sys.internal';
	const mapped = JOB_CODE_MESSAGES[code];
	const raw = job.error?.trim();
	// Prefer catalog copy when the raw string is the delivery-wrapper noise.
	const message =
		mapped && (!raw || /max delivery attempts/i.test(raw))
			? mapped
			: raw || mapped || `job ${job.job_id ?? ''} failed`.trim();
	return new ApiError({ code, message, status: 502, body: job });
}
