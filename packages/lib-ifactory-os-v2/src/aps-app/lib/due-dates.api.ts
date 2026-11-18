import { apiClient } from '../../lib/api/api-client.js';

export async function patchStructureDueDate(
	structureId: string,
	dueDate: string | null,
	signal?: AbortSignal
): Promise<void> {
	await apiClient.patch(
		apiClient.datahub(`proj_structures/${encodeURIComponent(structureId)}`),
		{ due_date: dueDate },
		{ signal }
	);
}

export async function patchBomDueDate(
	bomId: string,
	dueDate: string | null,
	signal?: AbortSignal
): Promise<void> {
	await apiClient.patch(
		apiClient.datahub(`proj_boms/${encodeURIComponent(bomId)}`),
		{ due_date: dueDate },
		{ signal }
	);
}
