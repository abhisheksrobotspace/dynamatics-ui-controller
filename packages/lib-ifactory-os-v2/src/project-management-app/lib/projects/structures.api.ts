import { apiClient } from '../../../lib/api/api-client.js';
import { rowsFromEnvelope, type ApiEnvelope } from '../../../lib/api/types.js';
import type { StubType, TowerType } from '../store.svelte.js';
import type { ProjStructureRow } from './types.js';

const TOWER_TYPE = 'tower';
const STUB_TYPE = 'stub';

function mapTowerRow(row: ProjStructureRow, sNo: number): TowerType {
	return {
		id: row.structure_id,
		projectId: row.project_id,
		sNo,
		towerTypeName: row.name,
		extensionsConfigured: 'No extensions'
	};
}

const STRUCTURE_LIST_SELECT = 'structure_id,project_id,name,type,sort_order';

function listTowersUrl(projectId: string): string {
	return `proj_structures?project_id=${encodeURIComponent(projectId)}&type=${TOWER_TYPE}&orderBy=created_at:asc&select=${STRUCTURE_LIST_SELECT}`;
}

function mapStubRow(row: ProjStructureRow, sNo: number): StubType {
	return {
		id: row.structure_id,
		projectId: row.project_id,
		sNo,
		stubTypeName: row.name
	};
}

function listStubsUrl(projectId: string): string {
	return `proj_structures?project_id=${encodeURIComponent(projectId)}&type=${STUB_TYPE}&orderBy=created_at:asc&select=${STRUCTURE_LIST_SELECT}`;
}

/** Towers + stubs for a project in one call (`type__in=tower,stub`). */
export async function listProjectTowersAndStubs(
	projectId: string,
	signal?: AbortSignal
): Promise<{ towers: TowerType[]; stubs: StubType[] }> {
	const envelope = await apiClient.get<ApiEnvelope<ProjStructureRow[]>>(
		apiClient.datahub(
			`proj_structures?project_id=${encodeURIComponent(projectId)}&type__in=${TOWER_TYPE},${STUB_TYPE}&orderBy=created_at:asc&select=${STRUCTURE_LIST_SELECT}&limit=5000`
		),
		{ signal }
	);

	const towers: TowerType[] = [];
	const stubs: StubType[] = [];
	for (const row of rowsFromEnvelope<ProjStructureRow>(envelope.data)) {
		if (row.type === 'stub') {
			stubs.push(mapStubRow(row, stubs.length + 1));
		} else if (row.type === 'tower') {
			towers.push(mapTowerRow(row, towers.length + 1));
		}
	}
	return { towers, stubs };
}

export async function listTowers(projectId: string, signal?: AbortSignal): Promise<TowerType[]> {
	const envelope = await apiClient.get<ApiEnvelope<ProjStructureRow[]>>(
		apiClient.datahub(listTowersUrl(projectId)),
		{ signal }
	);
	return rowsFromEnvelope<ProjStructureRow>(envelope.data).map((row, index) =>
		mapTowerRow(row, index + 1)
	);
}

export async function getTowerById(
	towerId: string,
	projectId: string,
	signal?: AbortSignal
): Promise<TowerType | null> {
	const envelope = await apiClient.get<ApiEnvelope<ProjStructureRow[]>>(
		apiClient.datahub(
			`proj_structures?structure_id=${encodeURIComponent(towerId)}&project_id=${encodeURIComponent(projectId)}&type=${TOWER_TYPE}&select=structure_id,project_id,name,sort_order`
		),
		{ signal }
	);
	const row = rowsFromEnvelope<ProjStructureRow>(envelope.data)[0];
	if (!row) return null;

	return mapTowerRow(row, row.sort_order);
}

export async function listStubs(projectId: string, signal?: AbortSignal): Promise<StubType[]> {
	const envelope = await apiClient.get<ApiEnvelope<ProjStructureRow[]>>(
		apiClient.datahub(listStubsUrl(projectId)),
		{ signal }
	);
	return rowsFromEnvelope<ProjStructureRow>(envelope.data).map((row, index) =>
		mapStubRow(row, index + 1)
	);
}

export async function getStubById(
	stubId: string,
	projectId: string,
	signal?: AbortSignal
): Promise<StubType | null> {
	const envelope = await apiClient.get<ApiEnvelope<ProjStructureRow[]>>(
		apiClient.datahub(
			`proj_structures?structure_id=${encodeURIComponent(stubId)}&project_id=${encodeURIComponent(projectId)}&type=${STUB_TYPE}&select=structure_id,project_id,name,sort_order`
		),
		{ signal }
	);
	const row = rowsFromEnvelope<ProjStructureRow>(envelope.data)[0];
	if (!row) return null;

	return mapStubRow(row, row.sort_order);
}

export type CreateTowerInput = {
	projectId: string;
	towerTypeName: string;
	nextSNo: number;
};

export async function createTower(
	input: CreateTowerInput,
	signal?: AbortSignal
): Promise<TowerType> {
	const envelope = await apiClient.post<ApiEnvelope<ProjStructureRow>>(
		apiClient.datahub('proj_structures'),
		{
			project_id: input.projectId,
			name: input.towerTypeName.trim(),
			type: TOWER_TYPE,
			sort_order: input.nextSNo
		},
		{ signal }
	);

	const row = rowsFromEnvelope<ProjStructureRow>(envelope.data)[0];
	if (!row) throw new Error('Create tower type returned no data');

	return mapTowerRow(row, input.nextSNo);
}

export type UpdateTowerInput = {
	towerId: string;
	towerTypeName: string;
	sNo: number;
	sortOrder: number;
};

export async function updateTower(
	input: UpdateTowerInput,
	signal?: AbortSignal
): Promise<TowerType> {
	const envelope = await apiClient.patch<ApiEnvelope<ProjStructureRow>>(
		apiClient.datahub(`proj_structures/${input.towerId}`),
		{
			name: input.towerTypeName.trim(),
			sort_order: input.sortOrder
		},
		{ signal }
	);

	const row = rowsFromEnvelope<ProjStructureRow>(envelope.data)[0];
	if (!row) throw new Error('Update tower type returned no data');

	return mapTowerRow(row, input.sNo);
}

export async function deleteTower(towerId: string, signal?: AbortSignal): Promise<void> {
	await apiClient.delete(apiClient.datahub(`proj_structures/${towerId}`), { signal });
}

export type CreateStubInput = {
	projectId: string;
	stubTypeName: string;
	nextSNo: number;
};

export async function createStub(input: CreateStubInput, signal?: AbortSignal): Promise<StubType> {
	const envelope = await apiClient.post<ApiEnvelope<ProjStructureRow>>(
		apiClient.datahub('proj_structures'),
		{
			project_id: input.projectId,
			name: input.stubTypeName.trim(),
			type: STUB_TYPE,
			sort_order: input.nextSNo
		},
		{ signal }
	);

	const row = rowsFromEnvelope<ProjStructureRow>(envelope.data)[0];
	if (!row) throw new Error('Create stub returned no data');

	return mapStubRow(row, input.nextSNo);
}

export type UpdateStubInput = {
	stubId: string;
	stubTypeName: string;
	sNo: number;
	sortOrder: number;
};

export async function updateStub(input: UpdateStubInput, signal?: AbortSignal): Promise<StubType> {
	const envelope = await apiClient.patch<ApiEnvelope<ProjStructureRow>>(
		apiClient.datahub(`proj_structures/${input.stubId}`),
		{
			name: input.stubTypeName.trim(),
			sort_order: input.sortOrder
		},
		{ signal }
	);

	const row = rowsFromEnvelope<ProjStructureRow>(envelope.data)[0];
	if (!row) throw new Error('Update stub returned no data');

	return mapStubRow(row, input.sNo);
}

export async function deleteStub(stubId: string, signal?: AbortSignal): Promise<void> {
	await apiClient.delete(apiClient.datahub(`proj_structures/${stubId}`), { signal });
}
