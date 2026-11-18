/** Human-readable message for screen-level error banners/toasts. */
export function formatErrorMessage(error: unknown): string {
	if (error instanceof Error && error.message) return error.message;
	return 'Something went wrong. Please try again.';
}

export function isAbortError(error: unknown): boolean {
	return error instanceof DOMException && error.name === 'AbortError';
}
