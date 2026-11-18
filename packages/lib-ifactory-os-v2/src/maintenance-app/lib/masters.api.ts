// Mock-backed master data. Integration note: swap internals for apiClient
// calls (v1 sources: cms/items/assets, ifactory_users_master,
// machine_group_master, factory shifts).
import {
	mockAssetManuals,
	mockAssets,
	mockMachineGroups,
	mockShifts,
	mockUsers
} from './masters.mock.js';
import { clone, mockDelay } from './mock-utils.js';
import type { AssetRef, MachineGroup, Shift, TicketFile, UserRef } from './types.js';

export async function listAssets(signal?: AbortSignal): Promise<AssetRef[]> {
	await mockDelay(signal);
	return clone(mockAssets);
}

export async function listUsers(signal?: AbortSignal): Promise<UserRef[]> {
	await mockDelay(signal);
	return clone(mockUsers);
}

export async function listMachineGroups(signal?: AbortSignal): Promise<MachineGroup[]> {
	await mockDelay(signal);
	return clone(mockMachineGroups);
}

export async function listShifts(signal?: AbortSignal): Promise<Shift[]> {
	await mockDelay(signal);
	return clone(mockShifts);
}

/** Manuals attached to an asset (v1: assets.attachments → files). */
export async function listAssetManuals(
	assetId: number,
	signal?: AbortSignal
): Promise<TicketFile[]> {
	await mockDelay(signal);
	return clone(mockAssetManuals[assetId] ?? []);
}

export function formatUserName(user: UserRef | undefined | null): string {
	if (!user) return '-';
	return `${user.first_name} ${user.last_name}`.trim() || '-';
}
