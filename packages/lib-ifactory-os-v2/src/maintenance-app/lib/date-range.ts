export type DateRange = { from: Date; to: Date; shift?: string };

/** Default list filter range: last 7 days inclusive (v1 behaviour). */
export function lastSevenDaysRange(): DateRange {
	const to = new Date();
	to.setHours(23, 59, 59, 999);
	const from = new Date();
	from.setDate(from.getDate() - 6);
	from.setHours(0, 0, 0, 0);
	return { from, to };
}
