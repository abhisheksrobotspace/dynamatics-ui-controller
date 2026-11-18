import { ApiError } from './api-error.js';
import { formatDatahubErrorMessage } from './format-datahub-error.js';

export {
	ApiError,
	apiErrorFromJob,
	toApiError,
	toApiErrorFromBody,
	type ApiErrorDetail,
	type ApiErrorShape
} from './api-error.js';

/** Standard datahub v2 response envelope (error may be a string or the §3 catalog object). */
export type ApiEnvelope<T = unknown> = {
	success: boolean;
	data?: T;
	error?: string | { code: string; message: string; status?: number; requestId?: string };
	_timing?: { dbExecMs: number };
};

export function rowsFromEnvelope<T extends Record<string, unknown>>(data: unknown): T[] {
	return Array.isArray(data) ? (data as T[]) : data != null ? [data as T] : [];
}

/** User-visible message from a caught error — prefers server-provided `error.message`. */
export function errorDescription(
	error: unknown,
	fallback = 'Something went wrong. Please try again.'
): string {
	return error instanceof Error ? error.message : fallback;
}

export { formatDatahubErrorMessage } from './format-datahub-error.js';

export function formatApiErrorMessage(error: unknown): string {
	if (error instanceof ApiError) {
		// Catalog codes already carry safe copy — only scrape legacy raw DB/wrapper strings.
		if (error.code.includes('.') && !/\[(?:23|42)\d{3}\]|Failed query:|←/.test(error.message)) {
			return error.message;
		}
		return formatDatahubErrorMessage(error.message);
	}
	if (error instanceof Error) return formatDatahubErrorMessage(error.message);
	return 'Something went wrong. Please try again.';
}
