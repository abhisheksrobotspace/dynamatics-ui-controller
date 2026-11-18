import { listPlants } from '../../asset-manager-app/lib/plants.api.js';

/** Prefer first active plant; fall back to APS default id if the list is empty. */
export const DEFAULT_PLANNING_PLANT_ID = 'NASHIK-1';

export async function resolveDefaultPlanningPlantId(signal?: AbortSignal): Promise<string> {
	const plants = await listPlants(signal);
	const first = plants[0]?.plant_id?.trim();
	if (first) return first;
	return DEFAULT_PLANNING_PLANT_ID;
}
