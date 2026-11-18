import { apiClient } from '../../lib/api/api-client.js';
import { rowsFromEnvelope, type ApiEnvelope } from '../../lib/api/types.js';

export const COEFFICIENT_KEYS = [
	'travel_time',
	'drilling',
	'sawing',
	'shearing_time',
	'punching_time',
	'heel_grinding_factor',
	'notching_factor',
	'bending_factor'
] as const;

export type CoefficientKey = (typeof COEFFICIENT_KEYS)[number];

export const COEFFICIENT_HEADERS: Record<CoefficientKey, string> = {
	travel_time: 'Travel Time (s/m)',
	drilling: 'Drilling (s/mm)',
	sawing: 'Sawing (s/mm)',
	shearing_time: 'Shearing Time (s/mm)',
	punching_time: 'Punching Time (s/mm)',
	heel_grinding_factor: 'Heel Grinding Factor (s/m)',
	notching_factor: 'Notching Factor (s/m)',
	bending_factor: 'Bending Factor (s/m)'
};

/** Capability envelope bounds (NULL = unconstrained). */
export const LIMIT_KEYS = [
	'min_section_mm',
	'max_section_mm',
	'min_thickness_mm',
	'max_thickness_mm'
] as const;

export type LimitKey = (typeof LIMIT_KEYS)[number];

export const LIMIT_HEADERS: Record<LimitKey, string> = {
	min_section_mm: 'Min Section (mm)',
	max_section_mm: 'Max Section (mm)',
	min_thickness_mm: 'Min Thickness (mm)',
	max_thickness_mm: 'Max Thickness (mm)'
};

export type MachineConfigRow = {
	config_id: string;
	machine_id: string;
	step_code: string;
	coefficients?: Record<string, number> | null;
	min_section_mm?: string | number | null;
	max_section_mm?: string | number | null;
	min_thickness_mm?: string | number | null;
	max_thickness_mm?: string | number | null;
	created_at?: string;
	updated_at?: string | null;
};

export type MachineConfigPatch = {
	coefficients: Record<string, number>;
	min_section_mm: number | null;
	max_section_mm: number | null;
	min_thickness_mm: number | null;
	max_thickness_mm: number | null;
};

const CONFIG_SELECT =
	'config_id,machine_id,step_code,coefficients,min_section_mm,max_section_mm,min_thickness_mm,max_thickness_mm,created_at,updated_at';

export async function listMachineConfigs(signal?: AbortSignal): Promise<MachineConfigRow[]> {
	const envelope = await apiClient.get<ApiEnvelope<MachineConfigRow[]>>(
		apiClient.datahub(`machine_config?select=${CONFIG_SELECT}&orderBy=machine_id:asc&limit=5000`),
		{ signal }
	);
	return rowsFromEnvelope<MachineConfigRow>(envelope.data);
}

export async function updateMachineConfig(
	configId: string,
	patch: MachineConfigPatch,
	signal?: AbortSignal
): Promise<void> {
	await apiClient.patch(
		apiClient.datahub(`machine_config/${encodeURIComponent(configId)}`),
		patch,
		{ signal }
	);
}
