import { apiClient } from '../../../lib/api/api-client.js';
import {
	datahubQuery,
	leftJoin,
	pickAlias,
	pickAliasString
} from '../../../lib/api/datahub-query.js';
import { rowsFromEnvelope, type ApiEnvelope } from '../../../lib/api/types.js';
import type { ProjectProductionPlan } from '../store.svelte.js';
import type {
	ProductionPlanSummaryMetadata,
	ProjProductionPlanLineRow,
	ProjProductionPlanRow,
	ProjReleaseLineRow
} from './types.js';
import { ddMmYyyyToIsoDate, isoDateToDdMmYyyy, releaseStatusToUi } from './releases.api.js';
import * as productionPlanMock from './production-plans.mock.js';

export const PRODUCTION_PLAN_MOCK = import.meta.env.VITE_PRODUCTION_PLAN_MOCK === 'true';

const PLAN_LIST_SELECT = [
	'production_plan_id',
	'project_id',
	'plan_name',
	'plan_date',
	'status',
	'notes',
	'metadata',
	'confirmed_at',
	'created_at'
].join(',');

const PLAN_LINE_SELECT = [
	'production_plan_line_id',
	'production_plan_id',
	'bom_id',
	'quantity',
	'tentative_order_qty',
	'unit',
	'description',
	'cp_run_id',
	'metadata'
].join(',');

const PLAN_WITH_LINES_SELECT = [
	PLAN_LIST_SELECT,
	'l.production_plan_line_id',
	'l.production_plan_id',
	'l.bom_id',
	'l.quantity',
	'l.tentative_order_qty',
	'l.unit',
	'l.description',
	'l.cp_run_id',
	'l.metadata'
].join(',');

function idListParam(ids: string[]): string {
	return ids.map((id) => encodeURIComponent(id)).join(',');
}

function numOrNull(value: unknown): number | null {
	if (value == null || value === '') return null;
	const n = typeof value === 'number' ? value : Number(value);
	return Number.isFinite(n) ? n : null;
}

function planLineFromJoinedRow(row: Record<string, unknown>): ProjProductionPlanLineRow | null {
	const lineId = pickAliasString(row, 'l', 'production_plan_line_id');
	if (!lineId) return null;
	const quantity = numOrNull(pickAlias(row, 'l', 'quantity'));
	const tentative = numOrNull(pickAlias(row, 'l', 'tentative_order_qty'));
	const cpRunId = pickAlias(row, 'l', 'cp_run_id');
	const metadata = pickAlias(row, 'l', 'metadata');
	return {
		production_plan_line_id: lineId,
		production_plan_id: pickAliasString(row, 'l', 'production_plan_id'),
		bom_id: pickAliasString(row, 'l', 'bom_id'),
		quantity: quantity ?? 0,
		tentative_order_qty: tentative,
		unit: pickAliasString(row, 'l', 'unit'),
		description: pickAliasString(row, 'l', 'description') || null,
		cp_run_id: typeof cpRunId === 'string' ? cpRunId : cpRunId == null ? null : String(cpRunId),
		metadata:
			metadata && typeof metadata === 'object' && !Array.isArray(metadata)
				? (metadata as Record<string, unknown>)
				: undefined
	};
}

function planHeaderFromJoinedRow(row: Record<string, unknown>): ProjProductionPlanRow {
	return {
		production_plan_id: String(row.production_plan_id ?? ''),
		project_id: String(row.project_id ?? ''),
		plan_name: String(row.plan_name ?? ''),
		plan_date: String(row.plan_date ?? ''),
		status: String(row.status ?? 'draft'),
		notes: typeof row.notes === 'string' ? row.notes : row.notes == null ? null : String(row.notes),
		metadata:
			row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
				? (row.metadata as Record<string, unknown>)
				: undefined,
		confirmed_at: typeof row.confirmed_at === 'string' ? row.confirmed_at : null,
		created_at: typeof row.created_at === 'string' ? row.created_at : undefined
	};
}

function summaryFromMetadata(
	metadata: Record<string, unknown> | undefined
): ProductionPlanSummaryMetadata {
	const summary = metadata?.summary;
	if (!summary || typeof summary !== 'object' || Array.isArray(summary)) return {};
	const record = summary as Record<string, unknown>;
	return {
		releases: typeof record.releases === 'string' ? record.releases : undefined,
		total_qty: typeof record.total_qty === 'number' ? record.total_qty : undefined
	};
}

export function mapProductionPlanRow(
	row: ProjProductionPlanRow,
	sNo: number
): ProjectProductionPlan {
	const summary = summaryFromMetadata(row.metadata);
	return {
		id: row.production_plan_id,
		projectId: row.project_id,
		sNo,
		name: row.plan_name,
		date: isoDateToDdMmYyyy(row.plan_date),
		status: releaseStatusToUi(row.status),
		releases: summary.releases ?? '',
		totalQty: summary.total_qty ?? 0,
		notes: row.notes ?? ''
	};
}

/** Adapts plan lines for reuse of release tree utilities. */
export function planLinesAsReleaseLines(lines: ProjProductionPlanLineRow[]): ProjReleaseLineRow[] {
	return lines.map((line) => ({
		release_line_id: line.production_plan_line_id,
		release_id: line.production_plan_id,
		bom_id: line.bom_id,
		quantity: line.quantity,
		tentative_order_qty: line.tentative_order_qty,
		unit: line.unit,
		description: line.description,
		metadata: line.metadata,
		created_at: line.created_at
	}));
}

function listProductionPlansUrl(projectId: string): string {
	return `proj_production_plans?project_id=${encodeURIComponent(projectId)}&orderBy=plan_date:asc&select=${PLAN_LIST_SELECT}`;
}

export async function listProductionPlans(
	projectId: string,
	signal?: AbortSignal
): Promise<ProjectProductionPlan[]> {
	if (PRODUCTION_PLAN_MOCK) return productionPlanMock.mockListProductionPlans(projectId);
	const envelope = await apiClient.get<ApiEnvelope<ProjProductionPlanRow[]>>(
		apiClient.datahub(listProductionPlansUrl(projectId)),
		{ signal }
	);
	return rowsFromEnvelope<ProjProductionPlanRow>(envelope.data).map((row, index) =>
		mapProductionPlanRow(row, index + 1)
	);
}

export async function getProductionPlanById(
	planId: string,
	projectId: string,
	signal?: AbortSignal
): Promise<ProjectProductionPlan | null> {
	if (PRODUCTION_PLAN_MOCK) return productionPlanMock.mockGetProductionPlanById(planId, projectId);
	const envelope = await apiClient.get<ApiEnvelope<ProjProductionPlanRow[]>>(
		apiClient.datahub(
			`proj_production_plans?production_plan_id=${encodeURIComponent(planId)}&project_id=${encodeURIComponent(projectId)}&select=${PLAN_LIST_SELECT}`
		),
		{ signal }
	);
	const row = rowsFromEnvelope<ProjProductionPlanRow>(envelope.data)[0];
	if (!row) return null;
	return mapProductionPlanRow(row, 1);
}

export async function getProductionPlanRow(
	planId: string,
	signal?: AbortSignal
): Promise<ProjProductionPlanRow | null> {
	if (PRODUCTION_PLAN_MOCK) return productionPlanMock.mockGetProductionPlanRow(planId);
	const envelope = await apiClient.get<ApiEnvelope<ProjProductionPlanRow[]>>(
		apiClient.datahub(
			`proj_production_plans?production_plan_id=${encodeURIComponent(planId)}&select=${PLAN_LIST_SELECT}`
		),
		{ signal }
	);
	return rowsFromEnvelope<ProjProductionPlanRow>(envelope.data)[0] ?? null;
}

export type CreateProductionPlanInput = {
	projectId: string;
	name: string;
	planDateIso: string;
	notes?: string;
};

export async function createProductionPlan(
	input: CreateProductionPlanInput,
	sNo: number,
	signal?: AbortSignal
): Promise<ProjectProductionPlan> {
	if (PRODUCTION_PLAN_MOCK) return productionPlanMock.mockCreateProductionPlan(input, sNo);
	const envelope = await apiClient.post<ApiEnvelope<ProjProductionPlanRow>>(
		apiClient.datahub('proj_production_plans'),
		{
			project_id: input.projectId,
			plan_name: input.name,
			plan_date: input.planDateIso,
			status: 'draft',
			notes: input.notes ?? null
		},
		{ signal }
	);
	const row = rowsFromEnvelope<ProjProductionPlanRow>(envelope.data)[0];
	if (!row) throw new Error('Create production plan returned no data');
	return mapProductionPlanRow(row, sNo);
}

export type UpdateProductionPlanInput = {
	planId: string;
	name?: string;
	planDateIso?: string;
	status?: 'draft' | 'confirmed';
	notes?: string | null;
	confirmedAt?: string | null;
	metadata?: Record<string, unknown>;
	sNo: number;
};

export async function updateProductionPlan(
	input: UpdateProductionPlanInput,
	signal?: AbortSignal
): Promise<ProjectProductionPlan> {
	if (PRODUCTION_PLAN_MOCK) return productionPlanMock.mockUpdateProductionPlan(input);
	const body: Record<string, unknown> = {};
	if (input.name !== undefined) body.plan_name = input.name;
	if (input.planDateIso !== undefined) body.plan_date = input.planDateIso;
	if (input.status !== undefined) body.status = input.status;
	if (input.notes !== undefined) body.notes = input.notes;
	if (input.confirmedAt !== undefined) body.confirmed_at = input.confirmedAt;
	if (input.metadata !== undefined) body.metadata = input.metadata;

	const envelope = await apiClient.patch<ApiEnvelope<ProjProductionPlanRow>>(
		apiClient.datahub(`proj_production_plans/${input.planId}`),
		body,
		{ signal }
	);
	const row = rowsFromEnvelope<ProjProductionPlanRow>(envelope.data)[0];
	if (!row) throw new Error('Update production plan returned no data');
	return mapProductionPlanRow(row, input.sNo);
}

export async function confirmProductionPlan(
	planId: string,
	sNo: number,
	signal?: AbortSignal
): Promise<ProjectProductionPlan> {
	return updateProductionPlan(
		{
			planId,
			status: 'confirmed',
			confirmedAt: new Date().toISOString(),
			sNo
		},
		signal
	);
}

/** Production plan ids currently linked to an existing manufacturing plan for this project. */
export async function listLinkedProductionPlanIds(
	projectId: string,
	signal?: AbortSignal
): Promise<Set<string>> {
	if (PRODUCTION_PLAN_MOCK) return new Set();
	const linksEnvelope = await apiClient.get<
		ApiEnvelope<Array<{ production_plan_id: string; plan_id: string }>>
	>(
		apiClient.datahub(
			`aps_production_plans?project_id=${encodeURIComponent(projectId)}&select=production_plan_id,plan_id&limit=5000`
		),
		{ signal }
	);
	const links = rowsFromEnvelope<{ production_plan_id: string; plan_id: string }>(
		linksEnvelope.data
	);
	if (links.length === 0) return new Set();

	const manufacturingPlanIds = [...new Set(links.map((link) => link.plan_id))];
	const plansEnvelope = await apiClient.get<ApiEnvelope<Array<{ plan_id: string }>>>(
		apiClient.datahub(
			`aps_manufacturing_plans?plan_id__in=${idListParam(manufacturingPlanIds)}&select=plan_id&limit=5000`
		),
		{ signal }
	);
	const livePlanIds = new Set(
		rowsFromEnvelope<{ plan_id: string }>(plansEnvelope.data).map((row) => row.plan_id)
	);

	return new Set(
		links.filter((link) => livePlanIds.has(link.plan_id)).map((link) => link.production_plan_id)
	);
}

async function isProductionPlanLinkedToLiveManufacturingPlan(
	planId: string,
	signal?: AbortSignal
): Promise<boolean> {
	const linksEnvelope = await apiClient.get<
		ApiEnvelope<Array<{ production_plan_id: string; plan_id: string }>>
	>(
		apiClient.datahub(
			`aps_production_plans?production_plan_id=${encodeURIComponent(planId)}&select=production_plan_id,plan_id&limit=5000`
		),
		{ signal }
	);
	const links = rowsFromEnvelope<{ production_plan_id: string; plan_id: string }>(
		linksEnvelope.data
	);
	if (links.length === 0) return false;

	const manufacturingPlanIds = [...new Set(links.map((link) => link.plan_id))];
	const plansEnvelope = await apiClient.get<ApiEnvelope<Array<{ plan_id: string }>>>(
		apiClient.datahub(
			`aps_manufacturing_plans?plan_id__in=${idListParam(manufacturingPlanIds)}&select=plan_id&limit=5000`
		),
		{ signal }
	);
	const livePlanIds = new Set(
		rowsFromEnvelope<{ plan_id: string }>(plansEnvelope.data).map((row) => row.plan_id)
	);
	return links.some((link) => livePlanIds.has(link.plan_id));
}

export async function deleteProductionPlan(planId: string, signal?: AbortSignal): Promise<void> {
	if (PRODUCTION_PLAN_MOCK) {
		productionPlanMock.mockDeleteProductionPlan(planId);
		return;
	}
	if (await isProductionPlanLinkedToLiveManufacturingPlan(planId, signal)) {
		throw new Error('Cannot delete a production plan that is linked to a manufacturing plan.');
	}
	await apiClient.delete(apiClient.datahub(`proj_production_plans/${planId}`), {
		signal
	});
}

export async function listPlanLines(
	planId: string,
	signal?: AbortSignal
): Promise<ProjProductionPlanLineRow[]> {
	if (PRODUCTION_PLAN_MOCK) return productionPlanMock.mockListPlanLines(planId);
	const envelope = await apiClient.get<ApiEnvelope<ProjProductionPlanLineRow[]>>(
		apiClient.datahub(
			`proj_production_plan_lines?production_plan_id=${encodeURIComponent(planId)}&select=${PLAN_LINE_SELECT}`
		),
		{ signal }
	);
	return rowsFromEnvelope<ProjProductionPlanLineRow>(envelope.data);
}

/** Batch-fetch lines for many production plans via `production_plan_id__in`. */
export async function listPlanLinesByPlanIds(
	planIds: string[],
	signal?: AbortSignal
): Promise<ProjProductionPlanLineRow[]> {
	if (PRODUCTION_PLAN_MOCK) {
		return planIds.flatMap((planId) => productionPlanMock.mockListPlanLines(planId));
	}
	if (planIds.length === 0) return [];

	const envelope = await apiClient.get<ApiEnvelope<ProjProductionPlanLineRow[]>>(
		apiClient.datahub(
			`proj_production_plan_lines?limit=5000&production_plan_id__in=${idListParam(planIds)}&select=${PLAN_LINE_SELECT}`
		),
		{ signal }
	);
	return rowsFromEnvelope<ProjProductionPlanLineRow>(envelope.data);
}

export async function listConfirmedPlanLinesForProject(
	projectId: string,
	signal?: AbortSignal
): Promise<{ plan: ProjProductionPlanRow; lines: ProjProductionPlanLineRow[] }[]> {
	if (PRODUCTION_PLAN_MOCK) {
		return productionPlanMock.mockListConfirmedPlanLinesForProject(projectId);
	}
	const rows = await datahubQuery<Record<string, unknown>>(
		'proj_production_plans',
		{
			project_id: projectId,
			status: 'confirmed',
			orderBy: 'plan_date:asc',
			select: PLAN_WITH_LINES_SELECT,
			joins: [
				leftJoin('proj_production_plan_lines', 'l', 'production_plan_id', 'l.production_plan_id')
			]
		},
		signal
	);
	if (rows.length === 0) return [];

	const byPlan = new Map<
		string,
		{ plan: ProjProductionPlanRow; lines: ProjProductionPlanLineRow[] }
	>();
	for (const row of rows) {
		const header = planHeaderFromJoinedRow(row);
		if (!header.production_plan_id) continue;
		let bucket = byPlan.get(header.production_plan_id);
		if (!bucket) {
			bucket = { plan: header, lines: [] };
			byPlan.set(header.production_plan_id, bucket);
		}
		const line = planLineFromJoinedRow(row);
		if (line) bucket.lines.push(line);
	}

	return [...byPlan.values()].sort((a, b) => a.plan.plan_date.localeCompare(b.plan.plan_date));
}

export type PlanLineWrite = {
	planLineId?: string;
	bomId: string;
	quantity: number;
	unit: string;
	description: string;
	tentativeOrderQty?: number | null;
	cpRunId?: string | null;
};

export async function createPlanLine(
	planId: string,
	line: PlanLineWrite,
	signal?: AbortSignal
): Promise<ProjProductionPlanLineRow> {
	if (PRODUCTION_PLAN_MOCK) return productionPlanMock.mockCreatePlanLine(planId, line);
	const envelope = await apiClient.post<ApiEnvelope<ProjProductionPlanLineRow>>(
		apiClient.datahub('proj_production_plan_lines'),
		{
			production_plan_id: planId,
			bom_id: line.bomId,
			quantity: line.quantity,
			unit: line.unit,
			description: line.description,
			tentative_order_qty: line.tentativeOrderQty ?? null,
			cp_run_id: line.cpRunId ?? null
		},
		{ signal }
	);
	const row = rowsFromEnvelope<ProjProductionPlanLineRow>(envelope.data)[0];
	if (!row) throw new Error('Create plan line returned no data');
	return row;
}

export async function updatePlanLine(
	planLineId: string,
	line: Omit<PlanLineWrite, 'planLineId' | 'bomId'>,
	signal?: AbortSignal
): Promise<ProjProductionPlanLineRow> {
	if (PRODUCTION_PLAN_MOCK) return productionPlanMock.mockUpdatePlanLine(planLineId, line);
	const body: Record<string, unknown> = {
		quantity: line.quantity,
		unit: line.unit,
		description: line.description,
		tentative_order_qty: line.tentativeOrderQty ?? null
	};
	if (line.cpRunId !== undefined) body.cp_run_id = line.cpRunId;
	const envelope = await apiClient.patch<ApiEnvelope<ProjProductionPlanLineRow>>(
		apiClient.datahub(`proj_production_plan_lines/${planLineId}`),
		body,
		{ signal }
	);
	const row = rowsFromEnvelope<ProjProductionPlanLineRow>(envelope.data)[0];
	if (!row) throw new Error('Update plan line returned no data');
	return row;
}

export async function deletePlanLine(planLineId: string, signal?: AbortSignal): Promise<void> {
	if (PRODUCTION_PLAN_MOCK) {
		productionPlanMock.mockDeletePlanLine(planLineId);
		return;
	}
	await apiClient.delete(apiClient.datahub(`proj_production_plan_lines/${planLineId}`), { signal });
}

function lineNeedsUpdate(existing: ProjProductionPlanLineRow, desired: PlanLineWrite): boolean {
	return (
		existing.quantity !== desired.quantity ||
		existing.unit !== desired.unit ||
		(existing.description ?? '') !== desired.description ||
		(existing.tentative_order_qty ?? null) !== (desired.tentativeOrderQty ?? null) ||
		(existing.cp_run_id ?? null) !== (desired.cpRunId ?? null)
	);
}

export async function savePlanLines(
	planId: string,
	desired: PlanLineWrite[],
	existing: ProjProductionPlanLineRow[],
	signal?: AbortSignal
): Promise<ProjProductionPlanLineRow[]> {
	if (PRODUCTION_PLAN_MOCK) {
		return productionPlanMock.mockSavePlanLines(planId, desired, existing);
	}
	const existingByBom = new Map(existing.map((line) => [line.bom_id, line]));
	const desiredBomIds = new Set(desired.map((line) => line.bomId));
	const result: ProjProductionPlanLineRow[] = [];

	for (const line of desired) {
		const current = existingByBom.get(line.bomId);
		if (!current) {
			result.push(await createPlanLine(planId, line, signal));
			continue;
		}
		if (lineNeedsUpdate(current, line)) {
			result.push(
				await updatePlanLine(
					current.production_plan_line_id,
					{
						quantity: line.quantity,
						unit: line.unit,
						description: line.description,
						tentativeOrderQty: line.tentativeOrderQty,
						cpRunId: line.cpRunId ?? null
					},
					signal
				)
			);
		} else {
			result.push(current);
		}
	}

	await Promise.all(
		existing
			.filter((line) => !desiredBomIds.has(line.bom_id))
			.map((line) => deletePlanLine(line.production_plan_line_id, signal))
	);

	return result;
}

export function metadataWithProductionPlanSummary(
	existing: Record<string, unknown> | undefined,
	summary: ProductionPlanSummaryMetadata
): Record<string, unknown> {
	return {
		...(existing ?? {}),
		summary: {
			releases: summary.releases ?? '',
			total_qty: summary.total_qty ?? 0
		}
	};
}

export { ddMmYyyyToIsoDate };
