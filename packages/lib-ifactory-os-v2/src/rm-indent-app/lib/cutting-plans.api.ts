import { datahubQuery, leftJoin, pickAlias, pickAliasString } from '../../lib/api/datahub-query.js';
import { formatPlanNumber } from '../../cutting-plan-app/lib/cutting-plan/planner-results.js';
import { invList } from './inv.api.js';
import { num, numOrNull } from './inv.num.js';
import type { InvStockLockRow } from './inv.types.js';

export type CuttingPlanLockStatus = 'not_assigned' | 'partial' | 'locked';

export type CuttingPlanRow = {
	cutting_plan_id: string;
	run_version: number;
	/** Display version label (e.g. `v3`). */
	version_label: string;
	project_label: string;
	tower_label: string;
	bom_label: string;
	tower_bom_label: string;
	plant_label: string;
	bars: number;
	bars_assigned: number;
	bars_short: number;
	assigned_label: string;
	weight_mt: number | null;
	weight_mt_label: string;
	lock_status: CuttingPlanLockStatus;
	lock_status_label: string;
	action_label: 'Assign' | 'Continue' | 'View';
	bom_id: string;
	project_id: string;
	structure_id: string;
};

type ProjectRow = Record<string, unknown> & {
	project_id: string;
	name: string;
	metadata?: Record<string, unknown>;
};

/** Keep `__in=` query strings under proxy/header limits (HTTP 431). */
function chunkIds(ids: string[], maxEncodedLen = 2500): string[][] {
	const unique = [...new Set(ids.filter(Boolean))];
	const chunks: string[][] = [];
	let current: string[] = [];
	let encodedLen = 0;
	for (const id of unique) {
		const piece = encodeURIComponent(id);
		const next = encodedLen === 0 ? piece.length : encodedLen + 1 + piece.length;
		if (current.length > 0 && next > maxEncodedLen) {
			chunks.push(current);
			current = [];
			encodedLen = 0;
		}
		current.push(id);
		encodedLen = encodedLen === 0 ? piece.length : encodedLen + 1 + piece.length;
	}
	if (current.length > 0) chunks.push(current);
	return chunks;
}

function workOrderNo(metadata: Record<string, unknown> | undefined): string {
	const value = metadata?.work_order_no;
	return typeof value === 'string' ? value.trim() : '';
}

function formatProjectLabel(project: ProjectRow): string {
	const workOrder = workOrderNo(project.metadata);
	return workOrder || project.name?.trim() || project.project_id;
}

function formatTowerBomLabel(structureName: string, bomName: string): string {
	const tower = structureName.trim() || '-';
	const bom = bomName.trim() || '-';
	return `${tower} - ${bom}`;
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

function assignmentFields(
	bars: number,
	locks: { assignedQty: number; shortQty: number; hasDraft: boolean; hasActive: boolean }
): Pick<
	CuttingPlanRow,
	| 'bars_assigned'
	| 'bars_short'
	| 'assigned_label'
	| 'lock_status'
	| 'lock_status_label'
	| 'action_label'
> {
	const barsAssigned = locks.assignedQty;
	const barsShort = locks.shortQty;
	const unassigned = Math.max(0, bars - barsAssigned - barsShort);

	if (locks.hasActive && unassigned === 0 && !locks.hasDraft) {
		return {
			bars_assigned: barsAssigned,
			bars_short: barsShort,
			assigned_label: `${barsAssigned}/${bars}`,
			lock_status: barsShort > 0 && barsAssigned === 0 ? 'partial' : 'locked',
			lock_status_label:
				barsShort > 0
					? `Partially locked - ${barsShort} short, ${unassigned} unassigned`
					: 'Locked',
			action_label: barsShort > 0 || barsAssigned < bars ? 'Continue' : 'View'
		};
	}

	if (barsAssigned > 0 || barsShort > 0 || locks.hasDraft) {
		return {
			bars_assigned: barsAssigned,
			bars_short: barsShort,
			assigned_label: `${barsAssigned}/${bars}`,
			lock_status: 'partial',
			lock_status_label: `Partially locked - ${barsShort} short, ${unassigned} unassigned`,
			action_label: 'Continue'
		};
	}

	return {
		bars_assigned: 0,
		bars_short: 0,
		assigned_label: `0/${bars}`,
		lock_status: 'not_assigned',
		lock_status_label: 'Not assigned',
		action_label: 'Assign'
	};
}

function formatWeightMt(weightKg: number | string | null | undefined): {
	weight_mt: number | null;
	weight_mt_label: string;
} {
	const kg = numOrNull(weightKg);
	if (kg == null) return { weight_mt: null, weight_mt_label: '-' };
	const mt = kg / 1000;
	return { weight_mt: mt, weight_mt_label: formatPlanNumber(mt, 2) };
}

async function lockStatsByRunId(
	runIds: string[],
	signal?: AbortSignal
): Promise<
	Map<string, { assignedQty: number; shortQty: number; hasDraft: boolean; hasActive: boolean }>
> {
	const stats = new Map<
		string,
		{ assignedQty: number; shortQty: number; hasDraft: boolean; hasActive: boolean }
	>();
	for (const runId of runIds) {
		stats.set(runId, { assignedQty: 0, shortQty: 0, hasDraft: false, hasActive: false });
	}
	if (runIds.length === 0) return stats;

	for (const chunk of chunkIds(runIds)) {
		const locks = await invList<InvStockLockRow & Record<string, unknown>>(
			'inv_stock_locks',
			{
				owner_type: 'cutting_plan',
				owner_id__in: chunk.join(','),
				select: 'lock_id,owner_id,status,required_base,locked_base,short_base,stock_line_id'
			},
			signal
		);
		for (const lock of locks) {
			const ownerId = lock.owner_id ? String(lock.owner_id) : '';
			const entry = stats.get(ownerId);
			if (!entry) continue;
			const required = num(lock.required_base);
			if (lock.status === 'draft') {
				entry.hasDraft = true;
				if (lock.stock_line_id) entry.assignedQty += required;
				else entry.shortQty += required;
			} else if (lock.status === 'active') {
				entry.hasActive = true;
				const short = num(lock.short_base);
				if (short > 0) entry.shortQty += short;
				else entry.assignedQty += num(lock.locked_base) || required;
			}
		}
	}
	return stats;
}

/** Published cutting-plan runs only (`cp_plan_runs.status=published`). */
export async function getCuttingPlans(signal?: AbortSignal): Promise<CuttingPlanRow[]> {
	const rows = await datahubQuery<Record<string, unknown>>(
		'cp_plan_runs',
		{
			status: 'published',
			select:
				'run_id,bom_id,version,status,total_bars,total_stock_weight_kg,published_at,published_by,b.bom_id,b.bom_name,b.structure_id,s.structure_id,s.project_id,s.name,p.project_id,p.name,p.metadata',
			joins: [
				leftJoin('proj_boms', 'b', 'bom_id', 'b.bom_id'),
				{
					entity: 'proj_structures',
					alias: 's',
					type: 'left',
					on: [{ leftField: 'b.structure_id', op: 'eq', rightField: 's.structure_id' }]
				},
				{
					entity: 'proj_projects',
					alias: 'p',
					type: 'left',
					on: [{ leftField: 's.project_id', op: 'eq', rightField: 'p.project_id' }]
				}
			]
		},
		signal
	);
	if (rows.length === 0) return [];

	const runIds = rows.map((row) => String(row.run_id ?? '')).filter(Boolean);
	const lockStats = await lockStatsByRunId(runIds, signal);

	return rows
		.map((row) => {
			const runId = String(row.run_id ?? '');
			const bomId = pickAliasString(row, 'b', 'bom_id') || String(row.bom_id ?? '');
			const bomName = pickAliasString(row, 'b', 'bom_name');
			const structureId =
				pickAliasString(row, 'b', 'structure_id') || pickAliasString(row, 's', 'structure_id');
			const structureName = pickAliasString(row, 's', 'name');
			const projectId =
				pickAliasString(row, 's', 'project_id') || pickAliasString(row, 'p', 'project_id');
			const project: ProjectRow = {
				project_id: projectId,
				name: pickAliasString(row, 'p', 'name'),
				metadata: (pickAlias(row, 'p', 'metadata') ?? undefined) as
					Record<string, unknown> | undefined
			};
			const version = num(row.version);
			const { weight_mt, weight_mt_label } = formatWeightMt(
				row.total_stock_weight_kg as string | number | null | undefined
			);
			const bars = num(row.total_bars) || 0;
			const locks = lockStats.get(runId) ?? {
				assignedQty: 0,
				shortQty: 0,
				hasDraft: false,
				hasActive: false
			};

			return {
				cutting_plan_id: runId,
				run_version: version,
				version_label: `v${version}`,
				project_label: projectId ? formatProjectLabel(project) : '-',
				tower_label: structureName.trim() || '-',
				bom_label: bomName.trim() || '-',
				tower_bom_label: formatTowerBomLabel(structureName, bomName),
				plant_label: plantFromMetadata(project.metadata) || '-',
				bars,
				...assignmentFields(bars, locks),
				weight_mt,
				weight_mt_label,
				bom_id: bomId,
				project_id: projectId,
				structure_id: structureId
			};
		})
		.sort((a, b) => {
			const byProject = a.project_label.localeCompare(b.project_label);
			if (byProject !== 0) return byProject;
			const byTower = a.tower_bom_label.localeCompare(b.tower_bom_label);
			if (byTower !== 0) return byTower;
			return b.run_version - a.run_version;
		});
}
