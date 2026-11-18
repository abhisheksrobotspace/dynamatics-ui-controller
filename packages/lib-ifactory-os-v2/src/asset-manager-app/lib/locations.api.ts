import { apiClient } from '../../lib/api/api-client.js';
import { rowsFromEnvelope, type ApiEnvelope } from '../../lib/api/types.js';
import type { Location } from './types.js';

const LOCATION_SELECT = 'location_id,plant_id,name,location_type';

export type CreateLocationInput = {
	location_id: string;
	plant_id: string;
	name: string;
	location_type: string | null;
};

export type UpdateLocationInput = {
	plant_id: string;
	name: string;
	location_type: string | null;
};

export async function listLocations(signal?: AbortSignal): Promise<Location[]> {
	const envelope = await apiClient.get<ApiEnvelope<Location[]>>(
		apiClient.datahub(`locations?is_active=true&select=${LOCATION_SELECT}&orderBy=created_at:desc`),
		{ signal }
	);
	return rowsFromEnvelope<Location>(envelope.data);
}

export async function getLocation(
	locationId: string,
	signal?: AbortSignal
): Promise<Location | null> {
	const envelope = await apiClient.get<ApiEnvelope<Location[]>>(
		apiClient.datahub(
			`locations?location_id=${encodeURIComponent(locationId)}&select=${LOCATION_SELECT}`
		),
		{ signal }
	);
	return rowsFromEnvelope<Location>(envelope.data)[0] ?? null;
}

export async function createLocation(
	input: CreateLocationInput,
	signal?: AbortSignal
): Promise<Location> {
	const locationId = input.location_id.trim();
	const plantId = input.plant_id.trim();
	const name = input.name.trim();
	const locationType = input.location_type?.trim() || null;
	if (!locationId) throw new Error('Location ID is required.');
	if (!plantId) throw new Error('Plant is required.');
	if (!name) throw new Error('Location name is required.');

	const envelope = await apiClient.post<ApiEnvelope<Location>>(
		apiClient.datahub('locations'),
		{
			location_id: locationId,
			plant_id: plantId,
			name,
			location_type: locationType
		},
		{ signal }
	);

	return (
		rowsFromEnvelope<Location>(envelope.data)[0] ?? {
			location_id: locationId,
			plant_id: plantId,
			name,
			location_type: locationType
		}
	);
}

export async function updateLocation(
	locationId: string,
	input: UpdateLocationInput,
	signal?: AbortSignal
): Promise<Location> {
	const plantId = input.plant_id.trim();
	const name = input.name.trim();
	const locationType = input.location_type?.trim() || null;
	if (!plantId) throw new Error('Plant is required.');
	if (!name) throw new Error('Location name is required.');

	const envelope = await apiClient.patch<ApiEnvelope<Location>>(
		apiClient.datahub(`locations/${encodeURIComponent(locationId)}`),
		{
			plant_id: plantId,
			name,
			location_type: locationType
		},
		{ signal }
	);

	return (
		rowsFromEnvelope<Location>(envelope.data)[0] ?? {
			location_id: locationId,
			plant_id: plantId,
			name,
			location_type: locationType
		}
	);
}

export async function deleteLocation(locationId: string, signal?: AbortSignal): Promise<void> {
	await apiClient.delete(apiClient.datahub(`locations/${encodeURIComponent(locationId)}`), {
		signal
	});
}
