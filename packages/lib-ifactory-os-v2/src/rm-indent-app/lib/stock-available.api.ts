/**
 * Stock Available home — project list with last-upload + RM tonnage summaries.
 * Assembled client-side from existing entities (no dedicated project-grain view).
 */

import { apiClient } from '../../lib/api/api-client.js';
import { datahubQuery, leftJoin, pickAlias } from '../../lib/api/datahub-query.js';
import { rowsFromEnvelope, type ApiEnvelope } from '../../lib/api/types.js';
import { shortNameFromMetadata } from '../../project-management-app/lib/projects/types.js';
import { invList } from './inv.api.js';
import { num, numOrNull } from './inv.num.js';
import { formatWeightMt } from './inv-views.api.js';

export type StockAvailableProjectRow = {
	project_id: string;
	project_name: string;
	/** From metadata — UI-only prefill for stock upload Project # mapping. */
	work_order_no: string;
	stock_last_updated: string | null;
	stock_last_updated_label: string;
	required_rm_mt: number | null;
	required_rm_mt_label: string;
	available_rm_mt: number | null;
	available_rm_mt_label: string;
};

type ProjectRow = {
	project_id: string;
	name?: string;
	metadata?: Record<string, unknown>;
};

type UploadRow = {
	project_id?: string | null;
	project_map?: Record<string, string> | null;
	status?: string;
	applied_at?: string | null;
	created_at?: string | null;
};

function workOrderNo(metadata: Record<string, unknown> | undefined): string {
	const value = metadata?.work_order_no;
	return typeof value === 'string' ? value.trim() : '';
}

function projectName(project: ProjectRow): string {
	const short = shortNameFromMetadata(project.metadata);
	if (short) return short;
	const wo = workOrderNo(project.metadata);
	if (wo) return wo;
	return (project.name ?? '').trim() || project.project_id;
}

function formatDate(iso: string | null | undefined): string {
	if (!iso) return '-';
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return '-';
	return d.toLocaleDateString('en-IN', {
		day: '2-digit',
		month: 'short',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	});
}

function lengthMmFromVariantKey(variantKey: string): number | null {
	const match = variantKey.match(/L=(\d+(?:\.\d+)?)/i);
	if (!match) return null;
	const mm = Number(match[1]);
	return Number.isFinite(mm) ? mm : null;
}

function kgToMt(kg: number | null): number | null {
	if (kg == null || !Number.isFinite(kg)) return null;
	return Math.round((kg / 1000) * 1000) / 1000;
}

function freeWeightKg(input: {
	freeBase: number;
	baseUom: string;
	variantKey: string;
	nominalWeight: number | null;
	weightBasis: string | null;
}): number | null {
	const uom = input.baseUom.trim().toUpperCase();
	if (uom === 'MT' || uom === 'TON' || uom === 'TONNE') return input.freeBase * 1000;
	if (uom === 'KG' || uom === 'KGS') return input.freeBase;
	if (input.nominalWeight == null || input.nominalWeight <= 0) return null;
	if (input.weightBasis === 'per_piece') return input.freeBase * input.nominalWeight;
	if (input.weightBasis === 'per_metre') {
		const lengthMm = lengthMmFromVariantKey(input.variantKey);
		if (lengthMm == null || lengthMm <= 0) return null;
		return input.freeBase * (lengthMm / 1000) * input.nominalWeight;
	}
	return null;
}

export async function listStockAvailableProjects(
	signal?: AbortSignal
): Promise<StockAvailableProjectRow[]> {
	const projectsEnvelope = await apiClient.get<ApiEnvelope<ProjectRow[]>>(
		apiClient.datahub(
			'proj_projects?active=true&select=project_id,name,metadata&orderBy=name:asc&limit=5000'
		),
		{ signal }
	);
	const projects = rowsFromEnvelope<ProjectRow>(projectsEnvelope.data);
	if (projects.length === 0) return [];

	// No project_id__in: long UUID lists blow URL/proxy limits (HTTP 431). Slim selects
	// keep payloads manageable; client rolls up to the active project list below.
	const [uploads, requirementRows, stockLines] = await Promise.all([
		invList<UploadRow & Record<string, unknown>>(
			'inv_stock_uploads',
			{ select: 'project_id,project_map,status,applied_at,created_at', limit: 5000 },
			signal
		),
		invList<Record<string, unknown>>(
			'inv_ds_requirements',
			{ select: 'project_id,required_weight_kg', limit: 5000 },
			signal
		),
		datahubQuery<Record<string, unknown>>(
			'inv_stock_lines',
			{
				select:
					'stock_line_id,item_id,project_id,free_base,base_uom,variant_key,d.nominal_weight,d.weight_basis',
				joins: [leftJoin('inv_item_dims', 'd', 'item_id', 'd.item_id')],
				limit: 5000
			},
			signal
		)
	]);

	const lastUpdatedByProject = new Map<string, string>();
	for (const upload of uploads) {
		const status = String(upload.status ?? '');
		if (status !== 'applied' && status !== 'partially_applied') continue;
		const at = upload.applied_at || upload.created_at;
		if (!at || typeof at !== 'string') continue;

		// Multi-project uploads leave header `project_id` null and put targets in
		// `project_map` — attribute the applied_at to every mapped project (+ legacy header).
		const projectIds = new Set<string>();
		const headerProjectId = String(upload.project_id ?? '').trim();
		if (headerProjectId) projectIds.add(headerProjectId);
		const map = upload.project_map;
		if (map && typeof map === 'object' && !Array.isArray(map)) {
			for (const value of Object.values(map)) {
				const projectId = typeof value === 'string' ? value.trim() : '';
				if (projectId) projectIds.add(projectId);
			}
		}
		for (const projectId of projectIds) {
			const prev = lastUpdatedByProject.get(projectId);
			if (!prev || at > prev) lastUpdatedByProject.set(projectId, at);
		}
	}

	const requiredKgByProject = new Map<string, { sum: number; complete: boolean }>();
	for (const row of requirementRows) {
		const projectId = String(row.project_id ?? '');
		if (!projectId) continue;
		const bucket = requiredKgByProject.get(projectId) ?? { sum: 0, complete: true };
		const kg = numOrNull(row.required_weight_kg as string | number | null | undefined);
		if (kg == null) bucket.complete = false;
		else bucket.sum += kg;
		requiredKgByProject.set(projectId, bucket);
	}

	const availableKgByProject = new Map<string, { sum: number; complete: boolean }>();
	for (const line of stockLines) {
		const projectId = String(line.project_id ?? '');
		if (!projectId) continue;
		const weightBasisRaw = pickAlias(line, 'd', 'weight_basis');
		const kg = freeWeightKg({
			freeBase: num(line.free_base as string | number | null | undefined),
			baseUom: String(line.base_uom ?? 'PCS'),
			variantKey: String(line.variant_key ?? ''),
			nominalWeight: numOrNull(
				pickAlias(line, 'd', 'nominal_weight') as string | number | null | undefined
			),
			weightBasis: typeof weightBasisRaw === 'string' ? weightBasisRaw : null
		});
		const bucket = availableKgByProject.get(projectId) ?? { sum: 0, complete: true };
		if (kg == null) bucket.complete = false;
		else bucket.sum += kg;
		availableKgByProject.set(projectId, bucket);
	}

	return projects.map((project) => {
		const lastUpdated = lastUpdatedByProject.get(project.project_id) ?? null;
		const required = requiredKgByProject.get(project.project_id);
		const available = availableKgByProject.get(project.project_id);
		const requiredMt = required?.complete ? kgToMt(required.sum) : null;
		const availableMt =
			available && (available.complete || available.sum > 0) ? kgToMt(available.sum) : null;

		return {
			project_id: project.project_id,
			project_name: projectName(project),
			work_order_no: workOrderNo(project.metadata),
			stock_last_updated: lastUpdated,
			stock_last_updated_label: formatDate(lastUpdated),
			required_rm_mt: requiredMt,
			required_rm_mt_label: formatWeightMt(required?.complete ? required.sum : null),
			available_rm_mt: availableMt,
			available_rm_mt_label: formatWeightMt(
				available && (available.complete || available.sum > 0) ? available.sum : null
			)
		};
	});
}
