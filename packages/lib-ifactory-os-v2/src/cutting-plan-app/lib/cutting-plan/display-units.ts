/** Lengths at or above this (mm) display in meters. */
export const LENGTH_METERS_THRESHOLD_MM = 20_000;

/** Weights at or above this (kg) display in metric tonnes (MT). */
export const WEIGHT_MT_THRESHOLD_KG = 500;

function formatFixed(value: number, decimals: number): string {
	return value.toFixed(decimals);
}

/**
 * Display length from an internal mm value.
 * &lt; 20 m → mm; ≥ 20 m → m.
 */
export function formatDisplayLength(
	lengthMm: number | undefined | null,
	options?: { mmDecimals?: number; mDecimals?: number }
): string {
	if (lengthMm == null || !Number.isFinite(lengthMm)) return '-';

	if (lengthMm < LENGTH_METERS_THRESHOLD_MM) {
		const decimals = options?.mmDecimals ?? 0;
		return `${formatFixed(lengthMm, decimals)} mm`;
	}

	const decimals = options?.mDecimals ?? 2;
	return `${formatFixed(lengthMm / 1000, decimals)} m`;
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

	const decimals = options?.mtDecimals ?? 2;
	return `${formatFixed(weightKg / 1000, decimals)} MT`;
}
