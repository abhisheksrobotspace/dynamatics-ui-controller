/** Weights at or above this (kg) display in metric tonnes (MT). Same rule as CP. */
export const WEIGHT_MT_THRESHOLD_KG = 500;

function formatFixed(value: number, decimals: number): string {
	return value.toFixed(decimals);
}

/**
 * Display weight from an internal kg value.
 * &lt; 500 kg → kg; ≥ 500 kg → MT (kg / 1000).
 */
export function formatDisplayWeight(
	weightKg: number | undefined | null,
	options?: { kgDecimals?: number; mtDecimals?: number }
): string {
	if (weightKg == null || !Number.isFinite(weightKg)) return '-';

	if (weightKg < WEIGHT_MT_THRESHOLD_KG) {
		const decimals = options?.kgDecimals ?? 1;
		return `${formatFixed(weightKg, decimals)} kg`;
	}

	const decimals = options?.mtDecimals ?? 3;
	return `${formatFixed(weightKg / 1000, decimals)} MT`;
}

/** Deliverable sheets print kg (template columns already say kg). Null / non-finite → `-`. */
export function formatSheetKg(weightKg: number | undefined | null, decimals = 2): string {
	if (weightKg == null || !Number.isFinite(weightKg)) return '-';
	return weightKg.toFixed(decimals);
}

/**
 * Printed job card tonnage columns are labelled "in MT" on the JSL form, so they always
 * convert regardless of magnitude - unlike `formatDisplayWeight`, which switches on a threshold.
 * Null / non-finite → `-`.
 */
export function formatSheetMt(weightKg: number | undefined | null, decimals = 3): string {
	if (weightKg == null || !Number.isFinite(weightKg)) return '-';
	return (weightKg / 1000).toFixed(decimals);
}

/** Export always uses kg (no unit suffix). */
export function formatExportWeightKg(weightKg: number | undefined | null, decimals = 3): string {
	if (weightKg == null || !Number.isFinite(weightKg)) return '';
	return formatFixed(weightKg, decimals);
}

export function mtStringToKg(mt: string | number | null | undefined): number {
	if (mt === null || mt === undefined || mt === '') return 0;
	const n = typeof mt === 'number' ? mt : Number(mt);
	return Number.isFinite(n) ? n * 1000 : 0;
}
