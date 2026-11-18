import { datahubQuery, leftJoin, pickAlias, pickAliasString } from '../../lib/api/datahub-query.js';
import { loadBomSections } from '../../cutting-plan-app/lib/cutting-plan/bom-sections.js';
import {
	corePlanResponse,
	getCorePlanRun
} from '../../cutting-plan-app/lib/cutting-plan/cp-plan.api.js';
import { unitWeightBySectionFromBom } from '../../cutting-plan-app/lib/cutting-plan/plan-section-weights.js';
import type { PlanResponse } from '../../cutting-plan-app/lib/cutting-plan/types.js';
import type { CpPlanRunRow } from '../../cutting-plan-app/lib/cutting-plan/cp.rows.js';
import { apiClient } from '../../lib/api/api-client.js';
import { rowsFromEnvelope, type ApiEnvelope } from '../../lib/api/types.js';

export type CuttingPlanDetail = {
	runId: string;
	bomId: string;
	version: number;
	versionLabel: string;
	projectId: string;
	projectLabel: string;
	/** Work order (or project name) for compact headers. */
	projectShortLabel: string;
	towerLabel: string;
	bomLabel: string;
	towerBomLabel: string;
	plantLabel: string;
	plantId: string;
	customerName: string;
	createdAt: string;
	planResponse: PlanResponse;
	unitWeightBySection: Record<string, number>;
};

type BomRow = Record<string, unknown> & {
	bom_id: string;
	bom_name: string;
	structure_id: string;
};

type ProjectRow = Record<string, unknown> & {
	project_id: string;
	name: string;
	customer_id?: string;
	metadata?: Record<string, unknown>;
};

function workOrderNo(metadata: Record<string, unknown> | undefined): string {
	const value = metadata?.work_order_no;
	return typeof value === 'string' ? value.trim() : '';
}

function formatProjectLabel(project: ProjectRow): string {
	const workOrder = workOrderNo(project.metadata);
	const name = project.name?.trim() || project.project_id;
	return workOrder ? `${workOrder} - ${name}` : name;
}

function formatProjectShortLabel(project: ProjectRow): string {
	return workOrderNo(project.metadata) || project.name?.trim() || project.project_id;
}

function plantFromMetadata(metadata: Record<string, unknown> | undefined): string {
	for (const key of [
		'plant_id',
		'plant',
		'plant_name',
		'primary_location',
		'plant_label'
	] as const) {
		const value = metadata?.[key];
		if (typeof value === 'string' && value.trim()) return value.trim();
	}
	return '';
}

async function loadBomContext(
	bomId: string,
	signal?: AbortSignal
): Promise<{
	projectId: string;
	projectLabel: string;
	projectShortLabel: string;
	towerLabel: string;
	bomLabel: string;
	towerBomLabel: string;
	plantLabel: string;
	plantId: string;
	customerName: string;
}> {
	const empty = {
		projectId: '',
		projectLabel: '-',
		projectShortLabel: '-',
		towerLabel: '-',
		bomLabel: '-',
		towerBomLabel: '-',
		plantLabel: '-',
		plantId: '',
		customerName: '-'
	};

	const rows = await datahubQuery<BomRow>(
		'proj_boms',
		{
			bom_id: bomId,
			select:
				'bom_id,bom_name,structure_id,s.structure_id,s.project_id,s.name,p.project_id,p.name,p.metadata,p.customer_id,c.name',
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
				}
			]
		},
		signal
	);

	const row = rows[0];
	if (!row) return empty;

	const bomName = row.bom_name?.trim() || '-';
	const tower = pickAliasString(row, 's', 'name').trim() || '-';
	const projectId =
		pickAliasString(row, 's', 'project_id') || pickAliasString(row, 'p', 'project_id');
	if (!projectId) {
		return {
			...empty,
			bomLabel: bomName,
			towerBomLabel: bomName
		};
	}

	const project: ProjectRow = {
		project_id: projectId,
		name: pickAliasString(row, 'p', 'name'),
		customer_id: pickAliasString(row, 'p', 'customer_id') || undefined,
		metadata: (pickAlias(row, 'p', 'metadata') ?? undefined) as Record<string, unknown> | undefined
	};
	const plantLabel = plantFromMetadata(project.metadata) || '-';
	const plantId = plantLabel === '-' ? '' : plantLabel;
	const customerName = pickAliasString(row, 'c', 'name').trim() || '-';

	return {
		projectId,
		projectLabel: formatProjectLabel(project),
		projectShortLabel: formatProjectShortLabel(project),
		towerLabel: tower,
		bomLabel: bomName,
		towerBomLabel: `${tower} - ${bomName}`,
		plantLabel,
		plantId,
		customerName
	};
}

async function getRunHeader(runId: string, signal?: AbortSignal): Promise<CpPlanRunRow | null> {
	const envelope = await apiClient.get<ApiEnvelope<CpPlanRunRow[]>>(
		apiClient.datahub(
			`cp_plan_runs?run_id=${encodeURIComponent(runId)}&limit=1&select=run_id,bom_id,created_at`
		),
		{ signal }
	);
	return rowsFromEnvelope<CpPlanRunRow & Record<string, unknown>>(envelope.data)[0] ?? null;
}

export async function getCuttingPlanDetail(
	runId: string,
	signal?: AbortSignal
): Promise<CuttingPlanDetail | null> {
	const header = await getRunHeader(runId, signal);
	if (!header) return null;

	const [run, bomContext, bomSections] = await Promise.all([
		getCorePlanRun(header.bom_id, runId, signal),
		loadBomContext(header.bom_id, signal),
		loadBomSections(header.bom_id, signal)
	]);
	if (!run || run.status !== 'completed') return null;

	const [planResponse] = await Promise.all([corePlanResponse(run, { bars: 'detail' })]);
	const unitWeightBySection = unitWeightBySectionFromBom(bomSections.sections);
	const versionLabel = `v${run.version}`;

	return {
		runId: run.run_id,
		bomId: run.bom_id,
		version: run.version,
		versionLabel,
		projectId: bomContext.projectId,
		projectLabel: bomContext.projectLabel,
		projectShortLabel: bomContext.projectShortLabel,
		towerLabel: bomContext.towerLabel,
		bomLabel: bomContext.bomLabel,
		towerBomLabel: bomContext.towerBomLabel,
		plantLabel: bomContext.plantLabel,
		plantId: bomContext.plantId || '',
		customerName: bomContext.customerName,
		createdAt: header.created_at ?? run.created_at ?? '',
		planResponse,
		unitWeightBySection
	};
}
