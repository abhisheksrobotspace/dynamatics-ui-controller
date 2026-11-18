/**
 * Slim OCR shell loader (Mark Region + Results) — one joined query instead of
 * PM's full loadBomPageContext (customers+contractors catalogs, drawings, cp_plan_runs).
 */
import { datahubQuery, leftJoin, pickAlias, pickAliasString } from '../../lib/api/datahub-query.js';
import { parseBomExtractStatus } from '../../project-management-app/lib/bom-extract-status.js';
import {
	upsertBomBreadcrumb,
	upsertStubBreadcrumb,
	upsertTowerBreadcrumb,
	upsertProjectBreadcrumb
} from '../../project-management-app/lib/projects/breadcrumb-registry.js';
import type {
	BomConfig,
	Project,
	StubType,
	TowerType
} from '../../project-management-app/lib/store.svelte.js';
import { DEFAULT_OCR_ENGINE } from './ocr.constants.js';
import type { OperationsCountConfig } from './operations-count-config.api.js';

export type OcrBomPageContext = {
	project: Project | null;
	tower: TowerType | null;
	stub: StubType | null;
	bom: BomConfig | null;
	operationsConfig: OperationsCountConfig;
};

function parseBomStage(value: string | null | undefined): 'proto' | 'mass' {
	return value === 'mass' ? 'mass' : 'proto';
}

function parseOcrStatus(value: string | null | undefined): BomConfig['ocrStatus'] {
	if (value === 'verified' || value === 'action_needed') return value;
	return 'not_verified';
}

function parseCpStatus(value: string | null | undefined): 'none' | 'planned' {
	return value === 'planned' ? 'planned' : 'none';
}

function mapOperationsConfig(row: Record<string, unknown>): OperationsCountConfig {
	const metadata = (pickAlias(row, 'co', 'metadata') ?? {}) as Record<string, unknown>;
	const regex = pickAliasString(row, 'co', 'mark_number_regex').trim();
	const samples = pickAlias(row, 'co', 'sample_mark_numbers');
	return {
		markNumberRegex: regex,
		ocrEngine:
			typeof metadata.ocr_engine === 'string' && metadata.ocr_engine.trim()
				? metadata.ocr_engine.trim()
				: DEFAULT_OCR_ENGINE,
		sampleMarkNumbers: Array.isArray(samples) ? (samples as string[]) : undefined,
		metadata
	};
}

function emptyOperationsConfig(): OperationsCountConfig {
	return { markNumberRegex: '', ocrEngine: DEFAULT_OCR_ENGINE };
}

/**
 * Load OCR page shell data: bom ⟕ structure ⟕ project ⟕ contractor ⟕ customer,
 * plus primary drawing file id (limit 1). Skips CP publish + full name catalogs.
 */
export async function loadOcrBomPageContext(
	projectId: string,
	params: Record<string, string>,
	bomId: string,
	signal?: AbortSignal
): Promise<OcrBomPageContext> {
	const structureKey = params.stubId ? 'stubId' : 'towerId';
	const structureId = params[structureKey];
	if (!structureId) {
		return {
			project: null,
			tower: null,
			stub: null,
			bom: null,
			operationsConfig: emptyOperationsConfig()
		};
	}

	const rows = await datahubQuery<Record<string, unknown>>(
		'proj_boms',
		{
			bom_id: bomId,
			structure_id: structureId,
			select: [
				'bom_id',
				'structure_id',
				'bom_name',
				'bom_lineage_id',
				'version',
				'stage',
				'bom_file_id',
				'extract_status',
				'ocr_status',
				'cp_status',
				'metadata',
				'created_at',
				's.structure_id',
				's.project_id',
				's.name',
				's.type',
				'p.project_id',
				'p.name',
				'p.customer_id',
				'p.contractor_id',
				'p.metadata',
				'p.created_at',
				'c.name',
				'co.contractor_id',
				'co.name',
				'co.mark_number_regex',
				'co.sample_mark_numbers',
				'co.metadata',
				'd.file_id'
			].join(','),
			limit: 1,
			joins: [
				leftJoin('proj_structures', 's', 'structure_id', 's.structure_id'),
				{
					entity: 'proj_projects',
					alias: 'p',
					type: 'left',
					on: [{ leftField: 's.project_id', op: 'eq', rightField: 'p.project_id' }]
				},
				{
					entity: 'proj_customers',
					alias: 'c',
					type: 'left',
					on: [{ leftField: 'p.customer_id', op: 'eq', rightField: 'c.customer_id' }]
				},
				{
					entity: 'proj_contractors',
					alias: 'co',
					type: 'left',
					on: [{ leftField: 'p.contractor_id', op: 'eq', rightField: 'co.contractor_id' }]
				},
				leftJoin('proj_bom_drawings', 'd', 'bom_id', 'd.bom_id')
			]
		},
		signal
	);

	const row = rows[0];
	if (!row) {
		return {
			project: null,
			tower: null,
			stub: null,
			bom: null,
			operationsConfig: emptyOperationsConfig()
		};
	}

	const resolvedProjectId =
		pickAliasString(row, 'p', 'project_id') || pickAliasString(row, 's', 'project_id') || projectId;
	const customerId = pickAliasString(row, 'p', 'customer_id');
	const contractorId = pickAliasString(row, 'p', 'contractor_id') || undefined;
	const customerName = pickAliasString(row, 'c', 'name').trim() || 'Unknown customer';
	const contractorName = contractorId
		? pickAliasString(row, 'co', 'name').trim() || 'Unknown contractor'
		: undefined;
	const projectMetadata = (pickAlias(row, 'p', 'metadata') ?? {}) as Record<string, unknown>;

	const project: Project = {
		id: resolvedProjectId,
		sNo: 1,
		createdAt:
			typeof pickAlias(row, 'p', 'created_at') === 'string'
				? (pickAlias(row, 'p', 'created_at') as string)
				: undefined,
		projectName: pickAliasString(row, 'p', 'name'),
		customerId,
		customerName,
		contractorId,
		contractorName,
		metadata: projectMetadata
	};

	const structureName = pickAliasString(row, 's', 'name');
	const structureType = pickAliasString(row, 's', 'type');
	const isStub = Boolean(params.stubId) || structureType === 'stub';
	const tower: TowerType | null = isStub
		? null
		: {
				id: structureId,
				projectId: resolvedProjectId,
				sNo: 1,
				towerTypeName: structureName,
				extensionsConfigured: 'No extensions'
			};
	const stub: StubType | null = isStub
		? {
				id: structureId,
				projectId: resolvedProjectId,
				sNo: 1,
				stubTypeName: structureName
			}
		: null;

	const metadata = (row.metadata ?? {}) as Record<string, unknown>;
	const bomFileName = typeof metadata.bom_file_name === 'string' ? metadata.bom_file_name : null;
	const drawingsFileName =
		typeof metadata.drawings_file_name === 'string' ? metadata.drawings_file_name : null;
	const drawingFileId = pickAliasString(row, 'd', 'file_id') || null;
	const bomFileId = typeof row.bom_file_id === 'string' ? row.bom_file_id : null;
	const bomLineageId =
		typeof row.bom_lineage_id === 'string' && row.bom_lineage_id.length > 0
			? row.bom_lineage_id
			: String(row.bom_id ?? bomId);

	const bom: BomConfig = {
		id: String(row.bom_id ?? bomId),
		towerId: isStub ? undefined : structureId,
		stubId: isStub ? structureId : undefined,
		sNo: 1,
		bomName: String(row.bom_name ?? ''),
		bomLineageId,
		version: typeof row.version === 'number' && row.version >= 1 ? row.version : 1,
		stage: parseBomStage(typeof row.stage === 'string' ? row.stage : null),
		bomFileId,
		bomFile: bomFileName ?? (bomFileId ? 'BOM file' : null),
		bomFileUploadedAt:
			typeof metadata.bom_file_uploaded_at === 'string' ? metadata.bom_file_uploaded_at : null,
		bomWt: null,
		drawingsFile: drawingsFileName ?? (drawingFileId ? 'Drawings file' : null),
		drawingsPdfId: drawingFileId,
		extractStatus: parseBomExtractStatus(row.extract_status),
		ocrStatus: parseOcrStatus(typeof row.ocr_status === 'string' ? row.ocr_status : null),
		cpStatus: parseCpStatus(typeof row.cp_status === 'string' ? row.cp_status : null),
		publishedCpRunId: null,
		publishedCpVersion: null,
		operationsCountRoi: null,
		createdAt: typeof row.created_at === 'string' ? row.created_at : null
	};

	upsertProjectBreadcrumb(project);
	if (tower) upsertTowerBreadcrumb(tower);
	if (stub) upsertStubBreadcrumb(stub);
	upsertBomBreadcrumb(bom);

	return {
		project,
		tower,
		stub,
		bom,
		operationsConfig: contractorId ? mapOperationsConfig(row) : emptyOperationsConfig()
	};
}
