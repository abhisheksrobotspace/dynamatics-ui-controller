/** Core plant topology shapes (ifactory_core.plants / locations / transfer_times). */

export type PlantMetadata = {
	[key: string]: unknown;
};

export type Plant = {
	plant_id: string;
	name: string;
	created_at: string;
	metadata?: PlantMetadata;
	monthly_capacity_mt?: string | number | null;
	max_loading_pct?: string | number | null;
};

export type Location = {
	location_id: string;
	plant_id: string;
	name: string;
	location_type: string | null;
};

export type TransferTime = {
	transfer_id: string;
	from_location_id: string;
	to_location_id: string;
	transfer_minutes: number;
};
