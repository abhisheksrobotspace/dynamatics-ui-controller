import { apiClient } from '../../lib/api/api-client.js';
import { rowsFromEnvelope, type ApiEnvelope } from '../../lib/api/types.js';

export type MachineRow = {
	machine_id: string;
	name: string;
	group_id: string;
	location_id?: string | null;
	setup_time_s?: number | null;
	is_active?: boolean | null;
	created_at?: string;
	updated_at?: string | null;
};

const MACHINE_SELECT =
	'machine_id,name,group_id,location_id,setup_time_s,is_active,created_at,updated_at';

export async function listMachines(signal?: AbortSignal): Promise<MachineRow[]> {
	const envelope = await apiClient.get<ApiEnvelope<MachineRow[]>>(
		apiClient.datahub(`machines?select=${MACHINE_SELECT}&orderBy=machine_id:asc&limit=5000`),
		{ signal }
	);
	return rowsFromEnvelope<MachineRow>(envelope.data);
}
