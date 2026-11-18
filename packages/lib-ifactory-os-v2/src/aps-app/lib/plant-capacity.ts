/** Plant loading helpers for APS manufacturing plans (`plants` columns). */

export type PlantCapacitySource = {
	monthly_capacity_mt?: string | number | null;
	max_loading_pct?: string | number | null;
};

function readNumeric(value: unknown): number | null {
	if (typeof value === 'number' && Number.isFinite(value)) return value;
	if (typeof value === 'string' && value.trim() !== '') {
		const parsed = Number(value);
		if (Number.isFinite(parsed)) return parsed;
	}
	return null;
}

/** Capacity (MT) from `plants.monthly_capacity_mt`. */
export function readPlantCapacityMt(plant: PlantCapacitySource | null | undefined): number | null {
	const value = readNumeric(plant?.monthly_capacity_mt);
	return value != null && value >= 0 ? value : null;
}

/** Max loading (%) from `plants.max_loading_pct`. */
export function readPlantMaxLoading(plant: PlantCapacitySource | null | undefined): number | null {
	const value = readNumeric(plant?.max_loading_pct);
	return value != null && value > 0 ? value : null;
}

/** Max (MT) = capacity × maxLoading% / 100. */
export function computeMaxLoadingMt(
	capacityMt: number | null | undefined,
	maxLoadingPct: number | null | undefined
): number | null {
	if (capacityMt == null || maxLoadingPct == null) return null;
	if (!Number.isFinite(capacityMt) || capacityMt < 0) return null;
	if (!Number.isFinite(maxLoadingPct) || maxLoadingPct <= 0) return null;
	return (capacityMt * maxLoadingPct) / 100;
}

/** Current loading (%) = currentMt / maxMt × 100. */
export function computeCurrentLoadingPct(
	currentMt: number,
	maxMt: number | null | undefined
): number | null {
	if (maxMt == null || !Number.isFinite(maxMt) || maxMt <= 0) return null;
	if (!Number.isFinite(currentMt) || currentMt < 0) return null;
	return (currentMt / maxMt) * 100;
}
