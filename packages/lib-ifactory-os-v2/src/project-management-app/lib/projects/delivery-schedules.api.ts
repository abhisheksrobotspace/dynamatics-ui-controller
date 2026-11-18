import { apiClient } from '../../../lib/api/api-client.js';
import {
	datahubQuery,
	leftJoin,
	pickAlias,
	pickAliasString
} from '../../../lib/api/datahub-query.js';
import { rowsFromEnvelope, type ApiEnvelope } from '../../../lib/api/types.js';
import type { ProjectDeliverySchedule } from '../store.svelte.js';
import type {
	ProjDeliveryScheduleLineRow,
	ProjDeliveryScheduleRow,
	ProjReleaseLineRow
} from './types.js';
import { ddMmYyyyToIsoDate, isoDateToDdMmYyyy } from './releases.api.js';

const SCHEDULE_LIST_SELECT = [
	'delivery_schedule_id',
	'project_id',
	'delivery_date',
	'status',
	'plant_id',
	'name',
	'description',
	'confirmed_at',
	'frozen_at',
	'created_at'
].join(',');

const SCHEDULE_LINE_SELECT = [
	'delivery_schedule_line_id',
	'delivery_schedule_id',
	'bom_id',
	'quantity',
	'cp_run_id',
	'unit',
	'description',
	'metadata',
	'created_at'
].join(',');

const SCHEDULE_WITH_LINES_SELECT = [
	SCHEDULE_LIST_SELECT,
	'l.delivery_schedule_line_id',
	'l.delivery_schedule_id',
	'l.bom_id',
	'l.quantity',
	'l.cp_run_id',
	'l.unit',
	'l.description',
	'l.metadata',
	'l.created_at'
].join(',');

function idListParam(ids: string[]): string {
	return ids.map((id) => encodeURIComponent(id)).join(',');
}

function numOrNull(value: unknown): number | null {
	if (value == null || value === '') return null;
	const n = typeof value === 'number' ? value : Number(value);
	return Number.isFinite(n) ? n : null;
}

function scheduleLineFromJoinedRow(
	row: Record<string, unknown>
): ProjDeliveryScheduleLineRow | null {
	const lineId = pickAliasString(row, 'l', 'delivery_schedule_line_id');
	if (!lineId) return null;
	const quantity = numOrNull(pickAlias(row, 'l', 'quantity'));
	const cpRunId = pickAlias(row, 'l', 'cp_run_id');
	const metadata = pickAlias(row, 'l', 'metadata');
	const createdAt = pickAlias(row, 'l', 'created_at');
	return {
		delivery_schedule_line_id: lineId,
		delivery_schedule_id: pickAliasString(row, 'l', 'delivery_schedule_id'),
		bom_id: pickAliasString(row, 'l', 'bom_id'),
		quantity: quantity ?? 0,
		cp_run_id: typeof cpRunId === 'string' ? cpRunId : cpRunId == null ? null : String(cpRunId),
		unit: pickAliasString(row, 'l', 'unit'),
		description: pickAliasString(row, 'l', 'description') || null,
		metadata:
			metadata && typeof metadata === 'object' && !Array.isArray(metadata)
				? (metadata as Record<string, unknown>)
				: undefined,
		created_at: typeof createdAt === 'string' ? createdAt : undefined
	};
}

function scheduleHeaderFromJoinedRow(row: Record<string, unknown>): ProjDeliveryScheduleRow {
	return {
		delivery_schedule_id: String(row.delivery_schedule_id ?? ''),
		project_id: String(row.project_id ?? ''),
		delivery_date: String(row.delivery_date ?? ''),
		status: String(row.status ?? 'draft'),
		plant_id:
			typeof row.plant_id === 'string'
				? row.plant_id
				: row.plant_id == null
					? null
					: String(row.plant_id),
		name: typeof row.name === 'string' ? row.name : row.name == null ? null : String(row.name),
		description:
			typeof row.description === 'string'
				? row.description
				: row.description == null
					? null
					: String(row.description),
		confirmed_at: typeof row.confirmed_at === 'string' ? row.confirmed_at : null,
		frozen_at: typeof row.frozen_at === 'string' ? row.frozen_at : null,
		created_at: typeof row.created_at === 'string' ? row.created_at : undefined
	};
}

export type DeliveryScheduleUiStatus = 'Draft' | 'Confirmed' | 'Frozen';

export function deliveryScheduleStatusToUi(
	status: string | undefined | null
): DeliveryScheduleUiStatus {
	if (status === 'confirmed') return 'Confirmed';
	if (status === 'frozen') return 'Frozen';
	return 'Draft';
}

/** Frozen schedules are locked after jobs are published — quantities and metadata must not change. */
export function isDeliveryScheduleFrozen(schedule: { status?: string | null }): boolean {
	return schedule.status?.trim().toLowerCase() === 'frozen';
}

export function isDeliveryScheduleEditable(schedule: { status?: string | null }): boolean {
	return !isDeliveryScheduleFrozen(schedule);
}

export function mapDeliveryScheduleRow(
	row: ProjDeliveryScheduleRow,
	sNo: number
): ProjectDeliverySchedule {
	return {
		id: row.delivery_schedule_id,
		projectId: row.project_id,
		sNo,
		name: row.name ?? '',
		date: isoDateToDdMmYyyy(row.delivery_date),
		status: deliveryScheduleStatusToUi(row.status),
		description: row.description ?? ''
	};
}

/** Adapts schedule lines for reuse of release tree utilities. */
export function scheduleLinesAsReleaseLines(
	lines: ProjDeliveryScheduleLineRow[]
): ProjReleaseLineRow[] {
	return lines.map((line) => ({
		release_line_id: line.delivery_schedule_line_id,
		release_id: line.delivery_schedule_id,
		bom_id: line.bom_id,
		quantity: line.quantity,
		unit: line.unit,
		description: line.description,
		metadata: line.metadata,
		created_at: line.created_at
	}));
}

function listDeliverySchedulesUrl(projectId: string): string {
	return `proj_delivery_schedules?project_id=${encodeURIComponent(projectId)}&orderBy=delivery_date:asc&select=${SCHEDULE_LIST_SELECT}`;
}

export async function listDeliverySchedules(
	projectId: string,
	signal?: AbortSignal
): Promise<ProjectDeliverySchedule[]> {
	const envelope = await apiClient.get<ApiEnvelope<ProjDeliveryScheduleRow[]>>(
		apiClient.datahub(listDeliverySchedulesUrl(projectId)),
		{ signal }
	);
	const rows = rowsFromEnvelope<ProjDeliveryScheduleRow>(envelope.data)
		.slice()
		.sort((a, b) => a.delivery_date.localeCompare(b.delivery_date));
	return rows.map((row, index) => mapDeliveryScheduleRow(row, index + 1));
}

export async function listConfirmedDeliverySchedulesInMonth(
	monthIso: string,
	signal?: AbortSignal
): Promise<ProjDeliveryScheduleRow[]> {
	const month = monthIso.slice(0, 7);
	const start = `${month}-01`;
	const [year, monthNum] = month.split('-').map(Number);
	const lastDay = new Date(Date.UTC(year, monthNum, 0)).getUTCDate();
	const end = `${month}-${String(lastDay).padStart(2, '0')}`;
	const envelope = await apiClient.get<ApiEnvelope<ProjDeliveryScheduleRow[]>>(
		apiClient.datahub(
			`proj_delivery_schedules?status=confirmed&delivery_date__gte=${encodeURIComponent(start)}&delivery_date__lte=${encodeURIComponent(end)}&orderBy=delivery_date:asc&select=${SCHEDULE_LIST_SELECT}&limit=5000`
		),
		{ signal }
	);
	return rowsFromEnvelope<ProjDeliveryScheduleRow>(envelope.data);
}

export async function getDeliveryScheduleById(
	scheduleId: string,
	projectId: string,
	signal?: AbortSignal
): Promise<ProjectDeliverySchedule | null> {
	const envelope = await apiClient.get<ApiEnvelope<ProjDeliveryScheduleRow[]>>(
		apiClient.datahub(
			`proj_delivery_schedules?delivery_schedule_id=${encodeURIComponent(scheduleId)}&project_id=${encodeURIComponent(projectId)}&select=${SCHEDULE_LIST_SELECT}`
		),
		{ signal }
	);
	const row = rowsFromEnvelope<ProjDeliveryScheduleRow>(envelope.data)[0];
	if (!row) return null;
	return mapDeliveryScheduleRow(row, 1);
}

export type CreateDeliveryScheduleInput = {
	projectId: string;
	name: string;
	deliveryDateIso: string;
	description?: string;
};

export async function createDeliverySchedule(
	input: CreateDeliveryScheduleInput,
	sNo: number,
	signal?: AbortSignal
): Promise<ProjectDeliverySchedule> {
	const envelope = await apiClient.post<ApiEnvelope<ProjDeliveryScheduleRow>>(
		apiClient.datahub('proj_delivery_schedules'),
		{
			project_id: input.projectId,
			delivery_date: input.deliveryDateIso,
			status: 'draft',
			name: input.name,
			description: input.description ?? null
		},
		{ signal }
	);
	const row = rowsFromEnvelope<ProjDeliveryScheduleRow>(envelope.data)[0];
	if (!row) throw new Error('Create delivery schedule returned no data');
	return mapDeliveryScheduleRow(row, sNo);
}

export type UpdateDeliveryScheduleInput = {
	scheduleId: string;
	name?: string;
	deliveryDateIso?: string;
	status?: 'draft' | 'confirmed' | 'frozen';
	description?: string | null;
	confirmedAt?: string | null;
	sNo: number;
};

export async function updateDeliverySchedule(
	input: UpdateDeliveryScheduleInput,
	signal?: AbortSignal
): Promise<ProjectDeliverySchedule> {
	const body: Record<string, unknown> = {};
	if (input.name !== undefined) body.name = input.name;
	if (input.deliveryDateIso !== undefined) body.delivery_date = input.deliveryDateIso;
	if (input.status !== undefined) body.status = input.status;
	if (input.description !== undefined) body.description = input.description;
	if (input.confirmedAt !== undefined) body.confirmed_at = input.confirmedAt;

	const envelope = await apiClient.patch<ApiEnvelope<ProjDeliveryScheduleRow>>(
		apiClient.datahub(`proj_delivery_schedules/${input.scheduleId}`),
		body,
		{ signal }
	);
	const row = rowsFromEnvelope<ProjDeliveryScheduleRow>(envelope.data)[0];
	if (!row) throw new Error('Update delivery schedule returned no data');
	return mapDeliveryScheduleRow(row, input.sNo);
}

export async function deleteDeliverySchedule(
	scheduleId: string,
	signal?: AbortSignal
): Promise<void> {
	await apiClient.delete(apiClient.datahub(`proj_delivery_schedules/${scheduleId}`), {
		signal
	});
}

export async function listDeliveryScheduleLines(
	scheduleId: string,
	signal?: AbortSignal
): Promise<ProjDeliveryScheduleLineRow[]> {
	const envelope = await apiClient.get<ApiEnvelope<ProjDeliveryScheduleLineRow[]>>(
		apiClient.datahub(
			`proj_delivery_schedule_lines?delivery_schedule_id=${encodeURIComponent(scheduleId)}&select=${SCHEDULE_LINE_SELECT}`
		),
		{ signal }
	);
	return rowsFromEnvelope<ProjDeliveryScheduleLineRow>(envelope.data);
}

export async function listDeliveryScheduleLinesByIds(
	scheduleIds: string[],
	signal?: AbortSignal
): Promise<ProjDeliveryScheduleLineRow[]> {
	if (scheduleIds.length === 0) return [];
	const envelope = await apiClient.get<ApiEnvelope<ProjDeliveryScheduleLineRow[]>>(
		apiClient.datahub(
			`proj_delivery_schedule_lines?limit=5000&delivery_schedule_id__in=${idListParam(scheduleIds)}&select=${SCHEDULE_LINE_SELECT}`
		),
		{ signal }
	);
	return rowsFromEnvelope<ProjDeliveryScheduleLineRow>(envelope.data);
}

/** Current schedule header + its lines (one joined query). */
export async function getDeliveryScheduleWithLines(
	scheduleId: string,
	projectId: string,
	signal?: AbortSignal
): Promise<{ schedule: ProjectDeliverySchedule; lines: ProjDeliveryScheduleLineRow[] } | null> {
	const rows = await datahubQuery<Record<string, unknown>>(
		'proj_delivery_schedules',
		{
			delivery_schedule_id: scheduleId,
			project_id: projectId,
			select: SCHEDULE_WITH_LINES_SELECT,
			joins: [
				leftJoin(
					'proj_delivery_schedule_lines',
					'l',
					'delivery_schedule_id',
					'l.delivery_schedule_id'
				)
			]
		},
		signal
	);
	const first = rows[0];
	if (!first) return null;
	const schedule = mapDeliveryScheduleRow(scheduleHeaderFromJoinedRow(first), 1);
	const lines = rows
		.map((row) => scheduleLineFromJoinedRow(row))
		.filter((line): line is ProjDeliveryScheduleLineRow => line != null);
	return { schedule, lines };
}

/** All project schedules + lines via header ⟕ lines. */
export async function listProjectDeliveryScheduleLinesForProject(
	projectId: string,
	signal?: AbortSignal
): Promise<{ schedule: ProjDeliveryScheduleRow; lines: ProjDeliveryScheduleLineRow[] }[]> {
	const rows = await datahubQuery<Record<string, unknown>>(
		'proj_delivery_schedules',
		{
			project_id: projectId,
			orderBy: 'delivery_date:asc',
			select: SCHEDULE_WITH_LINES_SELECT,
			joins: [
				leftJoin(
					'proj_delivery_schedule_lines',
					'l',
					'delivery_schedule_id',
					'l.delivery_schedule_id'
				)
			]
		},
		signal
	);
	if (rows.length === 0) return [];

	const bySchedule = new Map<
		string,
		{ schedule: ProjDeliveryScheduleRow; lines: ProjDeliveryScheduleLineRow[] }
	>();
	for (const row of rows) {
		const header = scheduleHeaderFromJoinedRow(row);
		if (!header.delivery_schedule_id) continue;
		let bucket = bySchedule.get(header.delivery_schedule_id);
		if (!bucket) {
			bucket = { schedule: header, lines: [] };
			bySchedule.set(header.delivery_schedule_id, bucket);
		}
		const line = scheduleLineFromJoinedRow(row);
		if (line) bucket.lines.push(line);
	}

	return [...bySchedule.values()].sort((a, b) =>
		a.schedule.delivery_date.localeCompare(b.schedule.delivery_date)
	);
}

export type DeliveryScheduleLineWrite = {
	scheduleLineId?: string;
	bomId: string;
	quantity: number;
	unit: string;
	description: string;
	cpRunId?: string | null;
};

export async function createDeliveryScheduleLine(
	scheduleId: string,
	line: DeliveryScheduleLineWrite,
	signal?: AbortSignal
): Promise<ProjDeliveryScheduleLineRow> {
	const envelope = await apiClient.post<ApiEnvelope<ProjDeliveryScheduleLineRow>>(
		apiClient.datahub('proj_delivery_schedule_lines'),
		{
			delivery_schedule_id: scheduleId,
			bom_id: line.bomId,
			quantity: line.quantity,
			unit: line.unit,
			description: line.description,
			cp_run_id: line.cpRunId ?? null
		},
		{ signal }
	);
	const row = rowsFromEnvelope<ProjDeliveryScheduleLineRow>(envelope.data)[0];
	if (!row) throw new Error('Create delivery schedule line returned no data');
	return row;
}

export async function updateDeliveryScheduleLine(
	scheduleLineId: string,
	line: Omit<DeliveryScheduleLineWrite, 'scheduleLineId' | 'bomId'>,
	signal?: AbortSignal
): Promise<ProjDeliveryScheduleLineRow> {
	const envelope = await apiClient.patch<ApiEnvelope<ProjDeliveryScheduleLineRow>>(
		apiClient.datahub(`proj_delivery_schedule_lines/${scheduleLineId}`),
		{
			quantity: line.quantity,
			unit: line.unit,
			description: line.description,
			...(line.cpRunId !== undefined ? { cp_run_id: line.cpRunId } : {})
		},
		{ signal }
	);
	const row = rowsFromEnvelope<ProjDeliveryScheduleLineRow>(envelope.data)[0];
	if (!row) throw new Error('Update delivery schedule line returned no data');
	return row;
}

export async function deleteDeliveryScheduleLine(
	scheduleLineId: string,
	signal?: AbortSignal
): Promise<void> {
	await apiClient.delete(apiClient.datahub(`proj_delivery_schedule_lines/${scheduleLineId}`), {
		signal
	});
}

function lineNeedsUpdate(
	existing: ProjDeliveryScheduleLineRow,
	desired: DeliveryScheduleLineWrite
): boolean {
	return (
		existing.quantity !== desired.quantity ||
		existing.unit !== desired.unit ||
		(existing.description ?? '') !== desired.description ||
		(existing.cp_run_id ?? null) !== (desired.cpRunId ?? null)
	);
}

export async function saveDeliveryScheduleLines(
	scheduleId: string,
	desired: DeliveryScheduleLineWrite[],
	existing: ProjDeliveryScheduleLineRow[],
	signal?: AbortSignal
): Promise<ProjDeliveryScheduleLineRow[]> {
	const existingByBom = new Map(existing.map((line) => [line.bom_id, line]));
	const result: ProjDeliveryScheduleLineRow[] = [];

	for (const line of desired) {
		const current = existingByBom.get(line.bomId);
		if (!current) {
			result.push(await createDeliveryScheduleLine(scheduleId, line, signal));
			continue;
		}
		if (lineNeedsUpdate(current, line)) {
			result.push(
				await updateDeliveryScheduleLine(
					current.delivery_schedule_line_id,
					{
						quantity: line.quantity,
						unit: line.unit,
						description: line.description,
						cpRunId: line.cpRunId ?? null
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

export { ddMmYyyyToIsoDate };
