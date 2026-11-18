/** UTC month prefix e.g. `MP-2026-07-`. */
export function planIdMonthPrefix(now: Date = new Date()): string {
	const year = now.getUTCFullYear();
	const month = String(now.getUTCMonth() + 1).padStart(2, '0');
	return `MP-${year}-${month}-`;
}

/** First day of current UTC month as `YYYY-MM-01`. */
export function planMonthDate(now: Date = new Date()): string {
	const year = now.getUTCFullYear();
	const month = String(now.getUTCMonth() + 1).padStart(2, '0');
	return `${year}-${month}-01`;
}

const PLAN_MONTH_RE = /^(\d{4})-(\d{2})-01$/;

/** UTC Date at the first of the stored plan month (`YYYY-MM-01`). */
export function dateFromPlanMonth(month: string): Date | null {
	const match = PLAN_MONTH_RE.exec(month.trim());
	if (!match) return null;
	const year = Number(match[1]);
	const monthIndex = Number(match[2]) - 1;
	if (monthIndex < 0 || monthIndex > 11) return null;
	return new Date(Date.UTC(year, monthIndex, 1));
}

export type PlanMonthOption = {
	value: string;
	label: string;
};

/** Jan–Dec of `year` as `YYYY-MM-01` options. */
export function planMonthOptions(year: number): PlanMonthOption[] {
	return Array.from({ length: 12 }, (_, monthIndex) => {
		const month = String(monthIndex + 1).padStart(2, '0');
		const value = `${year}-${month}-01`;
		const label = new Date(year, monthIndex, 1).toLocaleString('en-GB', {
			month: 'long',
			year: 'numeric'
		});
		return { value, label };
	});
}

/** Local calendar month as `YYYY-MM-01` (matches `planMonthOptions`). */
export function currentLocalPlanMonth(now: Date = new Date()): string {
	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, '0');
	return `${year}-${month}-01`;
}

/** Convert 0 → A, 25 → Z, 26 → AA, … */
export function indexToLetterSuffix(index: number): string {
	if (index < 0) throw new Error('suffix index must be >= 0');
	let n = index;
	let out = '';
	do {
		out = String.fromCharCode(65 + (n % 26)) + out;
		n = Math.floor(n / 26) - 1;
	} while (n >= 0);
	return out;
}

export function letterSuffixToIndex(suffix: string): number | null {
	if (!/^[A-Z]+$/.test(suffix)) return null;
	let index = 0;
	for (const ch of suffix) {
		index = index * 26 + (ch.charCodeAt(0) - 64);
	}
	return index - 1;
}

/**
 * Next free plan id for the month: `MP-YYYY-MM-A`, `MP-YYYY-MM-B`, …
 * Uses existing ids that match the month prefix.
 */
export function nextPlanId(existingPlanIds: string[], now: Date = new Date()): string {
	const prefix = planIdMonthPrefix(now);
	let maxIndex = -1;
	for (const id of existingPlanIds) {
		if (!id.startsWith(prefix)) continue;
		const suffix = id.slice(prefix.length);
		const index = letterSuffixToIndex(suffix);
		if (index != null && index > maxIndex) maxIndex = index;
	}
	return `${prefix}${indexToLetterSuffix(maxIndex + 1)}`;
}
