const DEFAULT_SUCCESS_TOAST_TIMEOUT_MS = 5_000;
const DEFAULT_ERROR_TOAST_TIMEOUT_MS = 10_000;
const DEFAULT_TOAST_TIMEOUT_MS = 10_000;

function parseEnvTimeoutMs(raw: string | undefined, fallbackMs: number): number {
	if (raw == null || String(raw).trim() === '') {
		return fallbackMs;
	}

	const parsed = Number(raw);
	if (!Number.isFinite(parsed) || parsed <= 0) {
		return fallbackMs;
	}

	return parsed;
}

/** Neutral toasts — `VITE_TOAST_TIMEOUT_MS` (default 10s). */
export function toastDurationMs(): number {
	return parseEnvTimeoutMs(import.meta.env.VITE_TOAST_TIMEOUT_MS, DEFAULT_TOAST_TIMEOUT_MS);
}

/** Success toasts — `VITE_TOAST_SUCCESS_TIMEOUT_MS` (default 5s). */
export function toastSuccessDurationMs(): number {
	return parseEnvTimeoutMs(
		import.meta.env.VITE_TOAST_SUCCESS_TIMEOUT_MS,
		DEFAULT_SUCCESS_TOAST_TIMEOUT_MS
	);
}

/** Error toasts — `VITE_TOAST_ERROR_TIMEOUT_MS` (default 10s). */
export function toastErrorDurationMs(): number {
	return parseEnvTimeoutMs(
		import.meta.env.VITE_TOAST_ERROR_TIMEOUT_MS,
		DEFAULT_ERROR_TOAST_TIMEOUT_MS
	);
}
