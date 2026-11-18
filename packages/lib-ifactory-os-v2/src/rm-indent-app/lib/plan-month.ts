/** Plan-cell month: first calendar day (`2026-11-01`). Accepts `YYYY-MM` or a date. */
export function toPlanMonthDate(month: string): string {
	const value = month.trim();
	if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
	if (/^\d{4}-\d{2}$/.test(value)) return `${value}-01`;
	return value;
}

export function planMonthKey(month: string): string {
	return toPlanMonthDate(month).slice(0, 7);
}
