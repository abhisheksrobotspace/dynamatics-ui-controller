import { apiClient } from '../../../lib/api/api-client.js';
import {
	datahubQuery,
	leftJoin,
	pickAlias,
	pickAliasString
} from '../../../lib/api/datahub-query.js';
import { rowsFromEnvelope, type ApiEnvelope } from '../../../lib/api/types.js';
import type { ProjectRelease } from '../store.svelte.js';
import type { ProjFabricationReleaseRow, ProjReleaseLineRow } from './types.js';

const RELEASE_LIST_SELECT = [
	'release_id',
	'project_id',
	'release_name',
	'release_date',
	'notes',
	'created_at'
].join(',');

const RELEASE_LINE_SELECT = [
	'release_line_id',
	'release_id',
	'bom_id',
	'quantity',
	'tentative_order_qty',
	'unit',
	'description'
].join(',');

const RELEASE_WITH_LINES_SELECT = [
	RELEASE_LIST_SELECT,
	'l.release_line_id',
	'l.release_id',
	'l.bom_id',
	'l.quantity',
	'l.tentative_order_qty',
	'l.unit',
	'l.description'
].join(',');

function idListParam(ids: string[]): string {
	return ids.map((id) => encodeURIComponent(id)).join(',');
}

function numOrNull(value: unknown): number | null {
	if (value == null || value === '') return null;
	const n = typeof value === 'number' ? value : Number(value);
	return Number.isFinite(n) ? n : null;
}

function releaseLineFromJoinedRow(row: Record<string, unknown>): ProjReleaseLineRow | null {
	const releaseLineId = pickAliasString(row, 'l', 'release_line_id');
	if (!releaseLineId) return null;
	const quantity = numOrNull(pickAlias(row, 'l', 'quantity'));
	return {
		release_line_id: releaseLineId,
		release_id: pickAliasString(row, 'l', 'release_id'),
		bom_id: pickAliasString(row, 'l', 'bom_id'),
		quantity: quantity ?? 0,
		tentative_order_qty: numOrNull(pickAlias(row, 'l', 'tentative_order_qty')),
		unit: pickAliasString(row, 'l', 'unit'),
		description: pickAliasString(row, 'l', 'description') || null
	};
}

function releaseHeaderFromJoinedRow(row: Record<string, unknown>): ProjFabricationReleaseRow {
	return {
		release_id: String(row.release_id ?? ''),
		project_id: String(row.project_id ?? ''),
		release_name: String(row.release_name ?? ''),
		release_date: String(row.release_date ?? ''),
		notes: typeof row.notes === 'string' ? row.notes : row.notes == null ? null : String(row.notes),
		created_at: typeof row.created_at === 'string' ? row.created_at : undefined
	};
}

export type ReleaseUiStatus = 'Draft' | 'Confirmed';

export function releaseStatusToUi(status: string | undefined | null): ReleaseUiStatus {
	return status === 'confirmed' ? 'Confirmed' : 'Draft';
}

/** `YYYY-MM-DD` → `DD/MM/YYYY` for date-only strings. */
export function isoDateToDdMmYyyy(isoDate: string): string {
	const datePart = isoDate.slice(0, 10);
	const [year, month, day] = datePart.split('-');
	if (!year || !month || !day) return isoDate;
	return `${day}/${month}/${year}`;
}

/** `DD/MM/YYYY` → `YYYY-MM-DD`. */
export function ddMmYyyyToIsoDate(displayDate: string): string | null {
	if (!/^\d{2}\/\d{2}\/\d{4}$/.test(displayDate)) return null;
	const [day, month, year] = displayDate.split('/');
	return `${year}-${month}-${day}`;
}

export function mapReleaseRow(row: ProjFabricationReleaseRow, sNo: number): ProjectRelease {
	return {
		id: row.release_id,
		projectId: row.project_id,
		sNo,
		name: row.release_name,
		date: isoDateToDdMmYyyy(row.release_date),
		notes: row.notes ?? ''
	};
}

function listReleasesUrl(projectId: string): string {
	return `proj_fabrication_releases?project_id=${encodeURIComponent(projectId)}&orderBy=release_date:asc&select=${RELEASE_LIST_SELECT}`;
}

export async function listReleases(
	projectId: string,
	signal?: AbortSignal
): Promise<ProjectRelease[]> {
	const envelope = await apiClient.get<ApiEnvelope<ProjFabricationReleaseRow[]>>(
		apiClient.datahub(listReleasesUrl(projectId)),
		{ signal }
	);
	const rows = rowsFromEnvelope<ProjFabricationReleaseRow>(envelope.data)
		.slice()
		.sort((a, b) => a.release_date.localeCompare(b.release_date));
	return rows.map((row, index) => mapReleaseRow(row, index + 1));
}

export async function getReleaseById(
	releaseId: string,
	projectId: string,
	signal?: AbortSignal
): Promise<ProjectRelease | null> {
	const envelope = await apiClient.get<ApiEnvelope<ProjFabricationReleaseRow[]>>(
		apiClient.datahub(
			`proj_fabrication_releases?release_id=${encodeURIComponent(releaseId)}&project_id=${encodeURIComponent(projectId)}&select=${RELEASE_LIST_SELECT}`
		),
		{ signal }
	);
	const row = rowsFromEnvelope<ProjFabricationReleaseRow>(envelope.data)[0];
	if (!row) return null;
	return mapReleaseRow(row, 1);
}

export type CreateReleaseInput = {
	projectId: string;
	name: string;
	releaseDateIso: string;
	notes?: string;
};

export async function createRelease(
	input: CreateReleaseInput,
	sNo: number,
	signal?: AbortSignal
): Promise<ProjectRelease> {
	const envelope = await apiClient.post<ApiEnvelope<ProjFabricationReleaseRow>>(
		apiClient.datahub('proj_fabrication_releases'),
		{
			project_id: input.projectId,
			release_name: input.name,
			release_date: input.releaseDateIso,
			notes: input.notes ?? null
		},
		{ signal }
	);
	const row = rowsFromEnvelope<ProjFabricationReleaseRow>(envelope.data)[0];
	if (!row) throw new Error('Create release returned no data');
	return mapReleaseRow(row, sNo);
}

export type UpdateReleaseInput = {
	releaseId: string;
	name?: string;
	releaseDateIso?: string;
	notes?: string | null;
	sNo: number;
};

export async function updateRelease(
	input: UpdateReleaseInput,
	signal?: AbortSignal
): Promise<ProjectRelease> {
	const body: Record<string, unknown> = {};
	if (input.name !== undefined) body.release_name = input.name;
	if (input.releaseDateIso !== undefined) body.release_date = input.releaseDateIso;
	if (input.notes !== undefined) body.notes = input.notes;

	const envelope = await apiClient.patch<ApiEnvelope<ProjFabricationReleaseRow>>(
		apiClient.datahub(`proj_fabrication_releases/${input.releaseId}`),
		body,
		{ signal }
	);
	const row = rowsFromEnvelope<ProjFabricationReleaseRow>(envelope.data)[0];
	if (!row) throw new Error('Update release returned no data');
	return mapReleaseRow(row, input.sNo);
}

export async function deleteRelease(releaseId: string, signal?: AbortSignal): Promise<void> {
	await apiClient.delete(apiClient.datahub(`proj_fabrication_releases/${releaseId}`), {
		signal
	});
}

export async function listReleaseLines(
	releaseId: string,
	signal?: AbortSignal
): Promise<ProjReleaseLineRow[]> {
	const envelope = await apiClient.get<ApiEnvelope<ProjReleaseLineRow[]>>(
		apiClient.datahub(
			`proj_release_lines?release_id=${encodeURIComponent(releaseId)}&select=${RELEASE_LINE_SELECT}`
		),
		{ signal }
	);
	return rowsFromEnvelope<ProjReleaseLineRow>(envelope.data);
}

/** Batch-fetch lines for many releases via `release_id__in`. */
export async function listReleaseLinesByReleaseIds(
	releaseIds: string[],
	signal?: AbortSignal
): Promise<ProjReleaseLineRow[]> {
	if (releaseIds.length === 0) return [];

	const envelope = await apiClient.get<ApiEnvelope<ProjReleaseLineRow[]>>(
		apiClient.datahub(
			`proj_release_lines?limit=5000&release_id__in=${idListParam(releaseIds)}&select=${RELEASE_LINE_SELECT}`
		),
		{ signal }
	);
	return rowsFromEnvelope<ProjReleaseLineRow>(envelope.data);
}

/** Current release header + its lines (one joined query). */
export async function getReleaseWithLines(
	releaseId: string,
	projectId: string,
	signal?: AbortSignal
): Promise<{ release: ProjectRelease; lines: ProjReleaseLineRow[] } | null> {
	const rows = await datahubQuery<Record<string, unknown>>(
		'proj_fabrication_releases',
		{
			release_id: releaseId,
			project_id: projectId,
			select: RELEASE_WITH_LINES_SELECT,
			joins: [leftJoin('proj_release_lines', 'l', 'release_id', 'l.release_id')]
		},
		signal
	);
	const first = rows[0];
	if (!first) return null;
	const release = mapReleaseRow(releaseHeaderFromJoinedRow(first), 1);
	const lines = rows
		.map((row) => releaseLineFromJoinedRow(row))
		.filter((line): line is ProjReleaseLineRow => line != null);
	return { release, lines };
}

/** All project releases + lines via header ⟕ lines (for Already Released sums). */
export async function listProjectReleaseLinesForProject(
	projectId: string,
	signal?: AbortSignal
): Promise<{ release: ProjFabricationReleaseRow; lines: ProjReleaseLineRow[] }[]> {
	const rows = await datahubQuery<Record<string, unknown>>(
		'proj_fabrication_releases',
		{
			project_id: projectId,
			orderBy: 'release_date:asc',
			select: RELEASE_WITH_LINES_SELECT,
			joins: [leftJoin('proj_release_lines', 'l', 'release_id', 'l.release_id')]
		},
		signal
	);
	if (rows.length === 0) return [];

	const byRelease = new Map<
		string,
		{ release: ProjFabricationReleaseRow; lines: ProjReleaseLineRow[] }
	>();
	for (const row of rows) {
		const header = releaseHeaderFromJoinedRow(row);
		if (!header.release_id) continue;
		let bucket = byRelease.get(header.release_id);
		if (!bucket) {
			bucket = { release: header, lines: [] };
			byRelease.set(header.release_id, bucket);
		}
		const line = releaseLineFromJoinedRow(row);
		if (line) bucket.lines.push(line);
	}

	return [...byRelease.values()].sort((a, b) =>
		a.release.release_date.localeCompare(b.release.release_date)
	);
}

/** @deprecated Use {@link listProjectReleaseLinesForProject}. */
export const listAllReleaseLinesForProject = listProjectReleaseLinesForProject;

/** @deprecated Use {@link listProjectReleaseLinesForProject}. */
export const listConfirmedReleaseLinesForProject = listProjectReleaseLinesForProject;

export type ReleaseLineWrite = {
	releaseLineId?: string;
	bomId: string;
	quantity: number;
	unit: string;
	description: string;
	tentativeOrderQty?: number | null;
};

export async function createReleaseLine(
	releaseId: string,
	line: ReleaseLineWrite,
	signal?: AbortSignal
): Promise<ProjReleaseLineRow> {
	const envelope = await apiClient.post<ApiEnvelope<ProjReleaseLineRow>>(
		apiClient.datahub('proj_release_lines'),
		{
			release_id: releaseId,
			bom_id: line.bomId,
			quantity: line.quantity,
			unit: line.unit,
			description: line.description,
			tentative_order_qty: line.tentativeOrderQty ?? null
		},
		{ signal }
	);
	const row = rowsFromEnvelope<ProjReleaseLineRow>(envelope.data)[0];
	if (!row) throw new Error('Create release line returned no data');
	return row;
}

export async function updateReleaseLine(
	releaseLineId: string,
	line: Omit<ReleaseLineWrite, 'releaseLineId' | 'bomId'>,
	signal?: AbortSignal
): Promise<ProjReleaseLineRow> {
	const envelope = await apiClient.patch<ApiEnvelope<ProjReleaseLineRow>>(
		apiClient.datahub(`proj_release_lines/${releaseLineId}`),
		{
			quantity: line.quantity,
			unit: line.unit,
			description: line.description,
			tentative_order_qty: line.tentativeOrderQty ?? null
		},
		{ signal }
	);
	const row = rowsFromEnvelope<ProjReleaseLineRow>(envelope.data)[0];
	if (!row) throw new Error('Update release line returned no data');
	return row;
}

export async function deleteReleaseLine(
	releaseLineId: string,
	signal?: AbortSignal
): Promise<void> {
	await apiClient.delete(apiClient.datahub(`proj_release_lines/${releaseLineId}`), { signal });
}

function lineNeedsUpdate(existing: ProjReleaseLineRow, desired: ReleaseLineWrite): boolean {
	return (
		existing.quantity !== desired.quantity ||
		existing.unit !== desired.unit ||
		(existing.description ?? '') !== desired.description ||
		(existing.tentative_order_qty ?? null) !== (desired.tentativeOrderQty ?? null)
	);
}

/** Diff draft lines against persisted rows: create / patch. */
export async function saveReleaseLines(
	releaseId: string,
	desired: ReleaseLineWrite[],
	existing: ProjReleaseLineRow[],
	signal?: AbortSignal
): Promise<ProjReleaseLineRow[]> {
	const existingByBom = new Map(existing.map((line) => [line.bom_id, line]));
	const result: ProjReleaseLineRow[] = [];

	for (const line of desired) {
		const current = existingByBom.get(line.bomId);
		if (!current) {
			result.push(await createReleaseLine(releaseId, line, signal));
			continue;
		}
		if (lineNeedsUpdate(current, line)) {
			result.push(
				await updateReleaseLine(
					current.release_line_id,
					{
						quantity: line.quantity,
						unit: line.unit,
						description: line.description,
						tentativeOrderQty: line.tentativeOrderQty
					},
					signal
				)
			);
		} else {
			result.push(current);
		}
	}

	return result;
}
