/** Coerce datahub numeric strings ("10.0000") before arithmetic. */
export function num(value: number | string | null | undefined): number {
	if (value === null || value === undefined || value === '') return 0;
	const n = typeof value === 'number' ? value : Number(value);
	return Number.isFinite(n) ? n : 0;
}

export function numOrNull(value: number | string | null | undefined): number | null {
	if (value === null || value === undefined || value === '') return null;
	const n = typeof value === 'number' ? value : Number(value);
	return Number.isFinite(n) ? n : null;
}
