import { apiClient } from '../../../lib/api/api-client.js';
import { rowsFromEnvelope, type ApiEnvelope } from '../../../lib/api/types.js';
import { filesUpload } from '../core-api.js';
import type { Contractor, ProjContractorRow } from './types.js';

/** Legacy single-image key — still read for older rows. */
export const SAMPLE_MARKINGS_FILE_ID_KEY = 'sample_markings_file_id';
/** Preferred multi-image key: string[]. */
export const SAMPLE_MARKINGS_FILE_IDS_KEY = 'sample_markings_file_ids';

function metadataRecord(row: ProjContractorRow): Record<string, unknown> {
	return row.metadata && typeof row.metadata === 'object' ? { ...row.metadata } : {};
}

/** Merge array + legacy single id into a de-duplicated list (order preserved). */
export function sampleMarkingsFileIdsFromMetadata(metadata: Record<string, unknown>): string[] {
	const ids: string[] = [];
	const seen = new Set<string>();

	const push = (raw: unknown) => {
		if (typeof raw !== 'string') return;
		const id = raw.trim();
		if (!id || seen.has(id)) return;
		seen.add(id);
		ids.push(id);
	};

	const fromArray = metadata[SAMPLE_MARKINGS_FILE_IDS_KEY];
	if (Array.isArray(fromArray)) {
		for (const entry of fromArray) push(entry);
	}

	push(metadata[SAMPLE_MARKINGS_FILE_ID_KEY]);
	return ids;
}

function mapContractorRow(row: ProjContractorRow): Contractor {
	const metadata = metadataRecord(row);
	const sampleMarkingsFileIds = sampleMarkingsFileIdsFromMetadata(metadata);

	return {
		id: row.contractor_id,
		name: row.name,
		sampleMarkingsFileIds,
		sampleMarkingsFileId: sampleMarkingsFileIds[0] ?? null,
		metadata
	};
}

const LIST_CONTRACTORS_URL =
	'proj_contractors?active=true&orderBy=name:asc&select=contractor_id,name,metadata';

/** Active contractors including sample-markings metadata. */
export async function listContractors(signal?: AbortSignal): Promise<Contractor[]> {
	const envelope = await apiClient.get<ApiEnvelope<ProjContractorRow[]>>(
		apiClient.datahub(LIST_CONTRACTORS_URL),
		{ signal }
	);
	return rowsFromEnvelope<ProjContractorRow>(envelope.data).map(mapContractorRow);
}

export async function getContractorById(
	contractorId: string,
	signal?: AbortSignal
): Promise<Contractor | null> {
	const envelope = await apiClient.get<ApiEnvelope<ProjContractorRow[]>>(
		apiClient.datahub(
			`proj_contractors?contractor_id=${encodeURIComponent(contractorId)}&select=contractor_id,name,metadata`
		),
		{ signal }
	);
	const row = rowsFromEnvelope<ProjContractorRow>(envelope.data)[0];
	return row ? mapContractorRow(row) : null;
}

export async function createContractor(name: string, signal?: AbortSignal): Promise<Contractor> {
	const envelope = await apiClient.post<ApiEnvelope<ProjContractorRow>>(
		apiClient.datahub('proj_contractors'),
		{ name: name.trim() },
		{ signal }
	);

	const row = rowsFromEnvelope<ProjContractorRow>(envelope.data)[0];
	if (!row) throw new Error('Create contractor returned no data');

	return mapContractorRow(row);
}

export async function updateContractor(
	contractorId: string,
	name: string,
	signal?: AbortSignal
): Promise<Contractor> {
	const envelope = await apiClient.patch<ApiEnvelope<ProjContractorRow>>(
		apiClient.datahub(`proj_contractors/${contractorId}`),
		{ name: name.trim() },
		{ signal }
	);

	const row = rowsFromEnvelope<ProjContractorRow>(envelope.data)[0];
	if (!row) throw new Error('Update contractor returned no data');

	return mapContractorRow(row);
}

/** Upload a sample-markings image and append it to `metadata.sample_markings_file_ids`. */
export async function uploadContractorSampleMarkingsFile(
	contractor: Contractor,
	file: File,
	signal?: AbortSignal
): Promise<Contractor> {
	const fileId = await filesUpload(file, file.name, 'proj_contractors', contractor.id);
	const nextIds = [...contractor.sampleMarkingsFileIds];
	if (!nextIds.includes(fileId)) nextIds.push(fileId);

	const metadata: Record<string, unknown> = {
		...contractor.metadata,
		[SAMPLE_MARKINGS_FILE_IDS_KEY]: nextIds
	};
	// Keep legacy key pointing at the first image for older readers.
	if (nextIds[0]) metadata[SAMPLE_MARKINGS_FILE_ID_KEY] = nextIds[0];
	else delete metadata[SAMPLE_MARKINGS_FILE_ID_KEY];

	const envelope = await apiClient.patch<ApiEnvelope<ProjContractorRow>>(
		apiClient.datahub(`proj_contractors/${contractor.id}`),
		{ metadata },
		{ signal }
	);

	const row = rowsFromEnvelope<ProjContractorRow>(envelope.data)[0];
	if (!row) throw new Error('Update contractor sample markings returned no data');

	return mapContractorRow(row);
}

export async function deleteContractor(contractorId: string, signal?: AbortSignal): Promise<void> {
	await apiClient.delete(apiClient.datahub(`proj_contractors/${contractorId}`), { signal });
}
