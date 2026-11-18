import { apiClient } from '../../lib/api/api-client.js';

export async function patchProductionPlanPlant(
	productionPlanId: string,
	plantId: string,
	signal?: AbortSignal
): Promise<void> {
	await apiClient.patch(
		apiClient.datahub(`proj_production_plans/${encodeURIComponent(productionPlanId)}`),
		{ plant_id: plantId },
		{ signal }
	);
}

export async function patchProductionPlanPlants(
	productionPlanIds: string[],
	plantId: string,
	signal?: AbortSignal
): Promise<void> {
	const uniqueIds = [...new Set(productionPlanIds.filter(Boolean))];
	if (uniqueIds.length === 0) return;
	await Promise.all(uniqueIds.map((id) => patchProductionPlanPlant(id, plantId, signal)));
}
