import { apiClient } from '../../lib/api/api-client.js';
import { rowsFromEnvelope, type ApiEnvelope } from '../../lib/api/types.js';

/**
 * Active plant master machine count via server-side aggregate.
 *
 * Prefer `count(machine_id)` over `count(*)`: the gateway's select filter drops
 * `count(*)` (star is not an OPA-allowed column), which silently expands to `*`
 * and returns full rows — see DATAHUB_QUERY_API.md §6 / §11.
 *
 * Machines master UI lives in Asset Manager; APS keeps this for ScheduleRuns
 * plant utilization labels.
 */
export async function countMachines(signal?: AbortSignal): Promise<number> {
	const envelope = await apiClient.get<ApiEnvelope<Array<{ count: number }>>>(
		apiClient.datahub(
			`machines?is_active=true&select=${encodeURIComponent('count(machine_id) as count')}&limit=1`
		),
		{ signal }
	);
	const count = rowsFromEnvelope<{ count: number }>(envelope.data)[0]?.count;
	const countNumber = Number(count);
	return Number.isFinite(countNumber) ? countNumber : 0;
}
