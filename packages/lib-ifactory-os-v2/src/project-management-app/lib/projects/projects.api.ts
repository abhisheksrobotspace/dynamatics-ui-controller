import { apiClient } from '../../../lib/api/api-client.js';
import { datahubQuery, leftJoin, pickAliasString } from '../../../lib/api/datahub-query.js';
import { rowsFromEnvelope, type ApiEnvelope } from '../../../lib/api/types.js';
import { user } from '../../../lib/os/index.svelte.js';
import type { Project } from '../store.svelte.js';
import {
	createdByFromMetadata,
	metadataWithCreatedBy,
	metadataWithProjectFields,
	projectSetupFromMetadata,
	shortNameFromMetadata,
	type ProjProjectRow,
	type ProjectMetadataInput
} from './types.js';

function projectActor(): string {
	const email = typeof user.email === 'string' ? user.email.trim() : '';
	if (email) return email;
	const name = typeof user.name === 'string' ? user.name.trim() : '';
	if (name) return name;
	return 'ui';
}

const PROJECT_LIST_SELECT = [
	'project_id',
	'name',
	'customer_id',
	'contractor_id',
	'active',
	'metadata',
	'created_at',
	'updated_at',
	'c.name',
	'co.name'
].join(',');

function mapProjectRow(
	row: Record<string, unknown> | ProjProjectRow,
	customerNameById: Map<string, string>,
	contractorNameById: Map<string, string>,
	sNo: number
): Project {
	const record = row as Record<string, unknown>;
	const projectRow = row as ProjProjectRow;
	const setup = projectSetupFromMetadata(projectRow.metadata);
	const contractorId = projectRow.contractor_id?.trim() || undefined;
	const customerId = projectRow.customer_id;
	const joinedCustomer = pickAliasString(record, 'c', 'name').trim();
	const joinedContractor = pickAliasString(record, 'co', 'name').trim();

	return {
		id: projectRow.project_id,
		sNo,
		createdAt: projectRow.created_at,
		createdBy: createdByFromMetadata(projectRow.metadata) || undefined,
		projectName: projectRow.name,
		shortName: shortNameFromMetadata(projectRow.metadata) || undefined,
		workOrderNo: setup.workOrderNo || undefined,
		projectDetails: setup.projectDetails || undefined,
		lineDetails: setup.lineDetails || undefined,
		loaNo: setup.loaNo || undefined,
		customerId,
		customerName: joinedCustomer || customerNameById.get(customerId) || 'Unknown customer',
		contractorId,
		contractorName: contractorId
			? joinedContractor || contractorNameById.get(contractorId) || 'Unknown contractor'
			: undefined,
		metadata: projectRow.metadata ?? {}
	};
}

/** List active projects with customer + contractor names in one joined query. */
export async function listProjects(
	customerNameById: Map<string, string> = new Map(),
	contractorNameById: Map<string, string> = new Map(),
	signal?: AbortSignal
): Promise<Project[]> {
	const rows = await datahubQuery<Record<string, unknown>>(
		'proj_projects',
		{
			active: true,
			orderBy: 'created_at:desc',
			select: PROJECT_LIST_SELECT,
			joins: [
				leftJoin('proj_customers', 'c', 'customer_id', 'c.customer_id'),
				leftJoin('proj_contractors', 'co', 'contractor_id', 'co.contractor_id')
			]
		},
		signal
	);
	return rows.map((row, index) =>
		mapProjectRow(row, customerNameById, contractorNameById, index + 1)
	);
}

export async function getProjectById(
	projectId: string,
	customerNameById: Map<string, string> = new Map(),
	contractorNameById: Map<string, string> = new Map(),
	signal?: AbortSignal
): Promise<Project | null> {
	const rows = await datahubQuery<Record<string, unknown>>(
		'proj_projects',
		{
			project_id: projectId,
			active: true,
			select: PROJECT_LIST_SELECT,
			limit: 1,
			joins: [
				leftJoin('proj_customers', 'c', 'customer_id', 'c.customer_id'),
				leftJoin('proj_contractors', 'co', 'contractor_id', 'co.contractor_id')
			]
		},
		signal
	);
	const row = rows[0];
	if (!row) return null;
	return mapProjectRow(row, customerNameById, contractorNameById, 1);
}

/** Work order only — used on Delivery Schedule export click, not on matrix load. */
export async function getProjectWorkOrderNo(
	projectId: string,
	signal?: AbortSignal
): Promise<string> {
	const envelope = await apiClient.get<ApiEnvelope<Pick<ProjProjectRow, 'metadata'>[]>>(
		apiClient.datahub(
			`proj_projects?project_id=${encodeURIComponent(projectId)}&select=metadata&limit=1`
		),
		{ signal }
	);
	const row = rowsFromEnvelope<Pick<ProjProjectRow, 'metadata'>>(envelope.data)[0];
	return projectSetupFromMetadata(row?.metadata).workOrderNo;
}

export type CreateProjectInput = {
	projectName: string;
	customerId: string;
	/** Optional — usually set later via Operations Count Configuration. */
	contractorId?: string;
} & ProjectMetadataInput;

export async function createProject(
	input: CreateProjectInput,
	customerNameById: Map<string, string>,
	contractorNameById: Map<string, string>,
	nextSNo: number,
	signal?: AbortSignal
): Promise<Project> {
	const contractorId = input.contractorId?.trim();
	const envelope = await apiClient.post<ApiEnvelope<ProjProjectRow>>(
		apiClient.datahub('proj_projects'),
		{
			name: input.projectName.trim(),
			customer_id: input.customerId,
			...(contractorId ? { contractor_id: contractorId } : {}),
			metadata: metadataWithCreatedBy(metadataWithProjectFields(undefined, input), projectActor())
		},
		{ signal }
	);

	const row = rowsFromEnvelope<ProjProjectRow>(envelope.data)[0];
	if (!row) throw new Error('Create project returned no data');

	return mapProjectRow(row, customerNameById, contractorNameById, nextSNo);
}

export type UpdateProjectInput = {
	projectId: string;
	projectName: string;
	customerId: string;
	/**
	 * When omitted, existing `contractor_id` is left unchanged.
	 * Pass a value only when intentionally assigning/changing the contractor.
	 */
	contractorId?: string;
	existingMetadata?: Record<string, unknown>;
} & ProjectMetadataInput;

export async function updateProject(
	input: UpdateProjectInput,
	customerNameById: Map<string, string>,
	contractorNameById: Map<string, string>,
	sNo: number,
	signal?: AbortSignal
): Promise<Project> {
	const envelope = await apiClient.patch<ApiEnvelope<ProjProjectRow>>(
		apiClient.datahub(`proj_projects/${input.projectId}`),
		{
			name: input.projectName.trim(),
			customer_id: input.customerId,
			// Omit when unset so an existing OCC contractor assignment is preserved.
			...(input.contractorId !== undefined
				? { contractor_id: input.contractorId.trim() || null }
				: {}),
			metadata: metadataWithProjectFields(input.existingMetadata, input)
		},
		{ signal }
	);

	const row = rowsFromEnvelope<ProjProjectRow>(envelope.data)[0];
	if (!row) throw new Error('Update project returned no data');

	return mapProjectRow(row, customerNameById, contractorNameById, sNo);
}

export async function deleteProject(projectId: string, signal?: AbortSignal): Promise<void> {
	await apiClient.delete(apiClient.datahub(`proj_projects/${projectId}`), { signal });
}
