import { apiClient } from '../../lib/api/api-client.js';
import { rowsFromEnvelope, type ApiEnvelope } from '../../lib/api/types.js';
import type { TransferTime } from './types.js';

const TRANSFER_SELECT = 'transfer_id,from_location_id,to_location_id,transfer_minutes';

export type CreateTransferTimeInput = {
	from_location_id: string;
	to_location_id: string;
	transfer_minutes: number;
};

export type UpdateTransferTimeInput = CreateTransferTimeInput;

function assertCreateInput(input: CreateTransferTimeInput): {
	fromId: string;
	toId: string;
	minutes: number;
} {
	const fromId = input.from_location_id.trim();
	const toId = input.to_location_id.trim();
	const minutes = Math.floor(input.transfer_minutes);
	if (!fromId) throw new Error('From location is required.');
	if (!toId) throw new Error('To location is required.');
	if (fromId === toId) throw new Error('From and to locations must be different.');
	if (!Number.isFinite(minutes) || minutes < 0) {
		throw new Error('Transfer minutes must be zero or greater.');
	}
	return { fromId, toId, minutes };
}

export async function listTransferTimes(signal?: AbortSignal): Promise<TransferTime[]> {
	const envelope = await apiClient.get<ApiEnvelope<TransferTime[]>>(
		apiClient.datahub(`transfer_times?select=${TRANSFER_SELECT}&orderBy=created_at:desc`),
		{ signal }
	);
	return rowsFromEnvelope<TransferTime>(envelope.data);
}

export async function createTransferTime(
	input: CreateTransferTimeInput,
	signal?: AbortSignal
): Promise<void> {
	const { fromId, toId, minutes } = assertCreateInput(input);

	await apiClient.post(
		apiClient.datahub('transfer_times'),
		{
			from_location_id: fromId,
			to_location_id: toId,
			transfer_minutes: minutes
		},
		{ signal }
	);
}

export async function updateTransferTime(
	transferId: string,
	input: UpdateTransferTimeInput,
	signal?: AbortSignal
): Promise<void> {
	const { fromId, toId, minutes } = assertCreateInput(input);

	await apiClient.patch(
		apiClient.datahub(`transfer_times/${encodeURIComponent(transferId)}`),
		{
			from_location_id: fromId,
			to_location_id: toId,
			transfer_minutes: minutes
		},
		{ signal }
	);
}

export async function deleteTransferTime(transferId: string, signal?: AbortSignal): Promise<void> {
	await apiClient.delete(apiClient.datahub(`transfer_times/${encodeURIComponent(transferId)}`), {
		signal
	});
}
