import { apiClient } from '../../lib/api/api-client.js';
import { rowsFromEnvelope, type ApiEnvelope } from '../../lib/api/types.js';
import { readPlantCapacityMt, readPlantMaxLoading } from './plant-capacity.js';

type PlantRow = {
	plant_id: string;
	name: string;
	monthly_capacity_mt?: string | number | null;
	max_loading_pct?: string | number | null;
};

const PLANT_SELECT = 'plant_id,name,monthly_capacity_mt,max_loading_pct';

export type ApsPlantCapacity = {
	plantId: string;
	name: string;
	capacityMt: number | null;
	maxLoading: number | null;
};

export async function getApsPlantCapacity(
	plantId: string,
	signal?: AbortSignal
): Promise<ApsPlantCapacity | null> {
	const envelope = await apiClient.get<ApiEnvelope<PlantRow[]>>(
		apiClient.datahub(
			`plants?plant_id=${encodeURIComponent(plantId)}&select=${PLANT_SELECT}&limit=1`
		),
		{ signal }
	);
	const row = rowsFromEnvelope<PlantRow>(envelope.data)[0];
	if (!row) return null;
	return {
		plantId: row.plant_id,
		name: row.name,
		capacityMt: readPlantCapacityMt(row),
		maxLoading: readPlantMaxLoading(row)
	};
}
