import { apiClient } from '../../lib/api/api-client.js';
import { rowsFromEnvelope, type ApiEnvelope } from '../../lib/api/types.js';
import type { Plant } from './types.js';

const PLANT_SELECT = 'plant_id,name,created_at,metadata,monthly_capacity_mt,max_loading_pct';

export type CreatePlantInput = {
	plant_id: string;
	name: string;
	/** Monthly plant capacity in MT (`plants.monthly_capacity_mt`). */
	capacityMt?: number | null;
	/** Max loading % (`plants.max_loading_pct`). */
	maxLoading?: number | null;
};

export type UpdatePlantInput = {
	name: string;
	capacityMt?: number | null;
	maxLoading?: number | null;
};

export async function listPlants(signal?: AbortSignal): Promise<Plant[]> {
	const envelope = await apiClient.get<ApiEnvelope<Plant[]>>(
		apiClient.datahub(`plants?is_active=true&select=${PLANT_SELECT}&orderBy=plant_id:asc`),
		{ signal }
	);
	return rowsFromEnvelope<Plant>(envelope.data);
}

export async function createPlant(input: CreatePlantInput, signal?: AbortSignal): Promise<Plant> {
	const plantId = input.plant_id.trim();
	if (!plantId) throw new Error('Plant ID is required.');
	if (!input.name.trim()) throw new Error('Plant name is required.');

	const body: Record<string, unknown> = {
		plant_id: plantId,
		name: input.name.trim(),
		monthly_capacity_mt: input.capacityMt ?? null,
		max_loading_pct: input.maxLoading ?? null
	};

	const envelope = await apiClient.post<ApiEnvelope<Plant>>(apiClient.datahub('plants'), body, {
		signal
	});

	const row = rowsFromEnvelope<Plant>(envelope.data)[0];
	if (!row) throw new Error('Create plant returned no data');
	return row;
}

export async function updatePlant(
	plantId: string,
	input: UpdatePlantInput,
	signal?: AbortSignal
): Promise<Plant> {
	if (!input.name.trim()) throw new Error('Plant name is required.');

	const envelope = await apiClient.patch<ApiEnvelope<Plant>>(
		apiClient.datahub(`plants/${encodeURIComponent(plantId)}`),
		{
			name: input.name.trim(),
			monthly_capacity_mt: input.capacityMt ?? null,
			max_loading_pct: input.maxLoading ?? null
		},
		{ signal }
	);

	const row = rowsFromEnvelope<Plant>(envelope.data)[0];
	if (!row) throw new Error('Update plant returned no data');
	return row;
}

export async function deletePlant(plantId: string, signal?: AbortSignal): Promise<void> {
	await apiClient.delete(apiClient.datahub(`plants/${encodeURIComponent(plantId)}`), { signal });
}
