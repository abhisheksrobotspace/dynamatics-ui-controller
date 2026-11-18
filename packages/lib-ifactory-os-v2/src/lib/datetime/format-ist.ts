/** Display timezone for factory-floor UI. DB timestamps are stored as UTC. */
export const DISPLAY_TIME_ZONE = 'Asia/Kolkata';

/**
 * Normalize Postgres / JSON timestamp strings into something `Date` accepts.
 * node-pg often emits `2026-07-11 00:00:00+00` (space + hour-only offset).
 */
function normalizeUtcTimestamp(iso: string): string {
	let value = iso.trim();
	if (!value) return value;

	if (!value.includes('T')) {
		value = value.replace(' ', 'T');
	}

	// +00 / -05 → +00:00 / -05:00
	value = value.replace(/([+-]\d{2})$/, '$1:00');
	// +0000 / -0530 → +00:00 / -05:30
	value = value.replace(/([+-]\d{2})(\d{2})$/, '$1:$2');

	return value;
}

/**
 * Parse a DB timestamp as UTC.
 * Values without `Z` / offset (common from Postgres JSON) are treated as UTC, not local.
 */
export function parseUtcTimestamp(iso: string): Date {
	const normalized = normalizeUtcTimestamp(iso);
	if (!normalized) return new Date(Number.NaN);

	if (/[zZ]$|[+-]\d{2}:\d{2}$/.test(normalized)) {
		return new Date(normalized);
	}

	return new Date(`${normalized}Z`);
}

/** Format a UTC DB timestamp for display in IST. */
export function formatUtcAsIst(
	iso: string,
	options: Intl.DateTimeFormatOptions = {
		dateStyle: 'medium',
		timeStyle: 'short'
	}
): string {
	const date = parseUtcTimestamp(iso);
	if (Number.isNaN(date.getTime())) return iso;

	return date.toLocaleString('en-IN', {
		timeZone: DISPLAY_TIME_ZONE,
		...options
	});
}
