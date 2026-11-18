import { apiClient } from '../../../lib/api/api-client.js';
import { rowsFromEnvelope, type ApiEnvelope } from '../../../lib/api/types.js';
import { DEFAULT_OCR_ENGINE } from '../ocr.constants.js';
import type { OperationsCountConfig, Project } from '../store.svelte.js';
import type { Contractor, ProjContractorRow, ProjProjectRow } from './types.js';
import { listContractors } from './contractors.api.js';
import { getProjectById } from './projects.api.js';
import { upsertProjectBreadcrumb } from './breadcrumb-registry.js';

function mapContractorToConfig(row: ProjContractorRow | undefined): OperationsCountConfig {
	const metadata = row?.metadata ?? {};
	return {
		markNumberRegex: row?.mark_number_regex?.trim() ?? '',
		ocrEngine:
			typeof metadata.ocr_engine === 'string' && metadata.ocr_engine.trim()
				? metadata.ocr_engine.trim()
				: DEFAULT_OCR_ENGINE,
		sampleMarkNumbers: Array.isArray(row?.sample_mark_numbers)
			? (row.sample_mark_numbers as string[])
			: undefined,
		metadata
	};
}

export async function getOperationsCountConfig(
	contractorId: string,
	signal?: AbortSignal
): Promise<OperationsCountConfig> {
	const envelope = await apiClient.get<ApiEnvelope<ProjContractorRow[]>>(
		apiClient.datahub(`proj_contractors?contractor_id=${encodeURIComponent(contractorId)}`),
		{ signal }
	);
	const row = rowsFromEnvelope<ProjContractorRow>(envelope.data)[0];
	return mapContractorToConfig(row);
}

/**
 * Load OCR settings from the project's contractor.
 * Returns an empty regex config when the project has no contractor assigned.
 */
export async function loadOperationsCountConfig(
	project: Project,
	signal?: AbortSignal
): Promise<OperationsCountConfig> {
	if (!project.contractorId) {
		return {
			markNumberRegex: '',
			ocrEngine: DEFAULT_OCR_ENGINE
		};
	}
	return getOperationsCountConfig(project.contractorId, signal);
}

/** Contractor currently linked to the project for operations-count OCR. */
export function resolveOperationsCountContractorId(project: Project): string {
	return project.contractorId?.trim() ?? '';
}

/**
 * OCC page load: one contractors list + one project fetch.
 * Does not load customers — OCC only needs project name + contractor options.
 */
export async function loadOperationsCountConfigurationPage(
	projectId: string,
	signal?: AbortSignal
): Promise<{ project: Project | null; contractors: Contractor[] }> {
	const contractors = await listContractors(signal);
	const contractorNameById = new Map(
		contractors.map((contractor) => [contractor.id, contractor.name])
	);
	// Empty customer map: OCC never displays customerName.
	const project = await getProjectById(projectId, new Map(), contractorNameById, signal);
	if (project) upsertProjectBreadcrumb(project);
	return { project, contractors };
}

/**
 * Persist which contractor's mark-number regex this project should use for OCR.
 * Updates `proj_projects.contractor_id` only — no list re-fetches.
 */
export async function saveOperationsCountContractorSelection(
	project: Project,
	contractorId: string,
	contractorName: string,
	signal?: AbortSignal
): Promise<Project> {
	const trimmedContractorId = contractorId.trim();
	if (!trimmedContractorId) {
		throw new Error('Contractor is required');
	}

	await apiClient.patch<ApiEnvelope<ProjProjectRow>>(
		apiClient.datahub(`proj_projects/${project.id}`),
		{ contractor_id: trimmedContractorId },
		{ signal }
	);

	const updated: Project = {
		...project,
		contractorId: trimmedContractorId,
		contractorName: contractorName.trim() || trimmedContractorId
	};
	upsertProjectBreadcrumb(updated);
	return updated;
}

/** @deprecated Use loadOperationsCountConfig */
export const ensureOperationsCountConfigLoaded = loadOperationsCountConfig;
