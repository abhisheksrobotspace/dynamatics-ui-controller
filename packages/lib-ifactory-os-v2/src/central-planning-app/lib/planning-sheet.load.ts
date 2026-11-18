import { datahubQuery, leftJoin, pickAlias, pickAliasString } from '../../lib/api/datahub-query.js';
import { listBomSetWeightKgByBomIds } from '../../project-management-app/lib/projects/bom-set-weight.js';
import { shortNameFromMetadata } from '../../project-management-app/lib/projects/types.js';
import type { TreeTableNode } from '@ifactory/ui-v2';
import { bomNodeIdForDsLine } from './pln.api.js';
import type { PlanningSheetLoadedTree, PlanningSheetRowData } from './planning-sheet.types.js';

type ProjectRow = {
	project_id: string;
	name: string;
	active?: boolean | null;
	metadata?: Record<string, unknown>;
};

type StructureRow = {
	structure_id: string;
	project_id: string;
	name: string;
	type: string;
	sort_order: number;
};

type BomRow = {
	bom_id: string;
	structure_id: string;
	bom_name: string;
	sort_order: number;
};

type ScheduleRow = {
	delivery_schedule_id: string;
	project_id: string;
	delivery_date: string;
	status: string;
	name?: string | null;
	plant_id?: string | null;
};

type ScheduleLineRow = {
	delivery_schedule_line_id: string;
	delivery_schedule_id: string;
	bom_id: string;
	quantity: number;
};

const LIST_LIMIT = 5000;
const ALLOWED_STATUSES = new Set(['draft', 'confirmed', 'frozen']);

const TREE_JOIN_SELECT = [
	'delivery_schedule_id',
	'project_id',
	'delivery_date',
	'status',
	'name',
	'plant_id',
	'l.delivery_schedule_line_id',
	'l.delivery_schedule_id',
	'l.bom_id',
	'l.quantity',
	'b.bom_id',
	'b.structure_id',
	'b.bom_name',
	'b.sort_order',
	's.structure_id',
	's.project_id',
	's.name',
	's.type',
	's.sort_order',
	'p.project_id',
	'p.name',
	'p.active',
	'p.metadata'
].join(',');

function asNumber(value: unknown): number {
	if (typeof value === 'number' && Number.isFinite(value)) return value;
	if (typeof value === 'string' && value.trim() !== '') {
		const n = Number(value);
		if (Number.isFinite(n)) return n;
	}
	return 0;
}

function monthKeyFromIsoDate(iso: string): string {
	return iso.slice(0, 7);
}

function formatMonthLabel(monthKey: string): string {
	const [y, m] = monthKey.split('-');
	const monthIndex = Number(m) - 1;
	if (!y || Number.isNaN(monthIndex) || monthIndex < 0 || monthIndex > 11) return monthKey;
	const short = new Date(Date.UTC(Number(y), monthIndex, 1)).toLocaleString('en-US', {
		month: 'short',
		timeZone: 'UTC'
	});
	return `${short} ${y}`;
}

function formatScheduleLabel(dateIso: string, name?: string | null): string {
	const datePart = (() => {
		const d = new Date(`${dateIso}T00:00:00`);
		if (Number.isNaN(d.getTime())) return dateIso;
		const dd = String(d.getDate()).padStart(2, '0');
		const mm = String(d.getMonth() + 1).padStart(2, '0');
		const yyyy = d.getFullYear();
		return `${dd}-${mm}-${yyyy}`;
	})();
	const trimmed = typeof name === 'string' ? name.trim() : '';
	return trimmed ? `${trimmed} · ${datePart}` : datePart;
}

function projectLabel(project: ProjectRow): string {
	const short = shortNameFromMetadata(project.metadata);
	if (short) return short;
	const wo =
		typeof project.metadata?.work_order_no === 'string'
			? project.metadata.work_order_no.trim()
			: '';
	if (wo) return wo;
	return project.name?.trim() || project.project_id;
}

/** MT per set from item kg sum — same source as Delivery Plan. Null = unknown, not zero. */
function weightMtPerSetFromKg(setKg: number | undefined): number | null {
	if (setKg === undefined || !Number.isFinite(setKg) || setKg <= 0) return null;
	return setKg / 1000;
}

function sumMt(values: Array<number | null>): number | null {
	let sum = 0;
	let any = false;
	for (const v of values) {
		if (v == null) continue;
		sum += v;
		any = true;
	}
	return any ? sum : null;
}

export { formatMonthLabel };

function monthDateRange(month: string): { start: string; end: string } {
	const m = month.slice(0, 7);
	const start = `${m}-01`;
	const [year, monthNum] = m.split('-').map(Number);
	const lastDay = new Date(Date.UTC(year, monthNum, 0)).getUTCDate();
	const end = `${m}-${String(lastDay).padStart(2, '0')}`;
	return { start, end };
}

/**
 * Future (or month-scoped) schedules with lines + BOM + structure + project in one round-trip.
 * Weight (MT) still needs a separate groupBy on `proj_bom_items` (aggregate).
 */
async function listJoinedScheduleTreeRows(
	opts: { gte?: string; lte?: string },
	signal?: AbortSignal
): Promise<Record<string, unknown>[]> {
	const rows = await datahubQuery<Record<string, unknown>>(
		'proj_delivery_schedules',
		{
			...(opts.gte ? { delivery_date__gte: opts.gte } : {}),
			...(opts.lte ? { delivery_date__lte: opts.lte } : {}),
			orderBy: 'delivery_date:asc',
			select: TREE_JOIN_SELECT,
			limit: LIST_LIMIT,
			joins: [
				leftJoin(
					'proj_delivery_schedule_lines',
					'l',
					'delivery_schedule_id',
					'l.delivery_schedule_id'
				),
				{
					entity: 'proj_boms',
					alias: 'b',
					type: 'left',
					on: [{ leftField: 'l.bom_id', op: 'eq', rightField: 'b.bom_id' }]
				},
				{
					entity: 'proj_structures',
					alias: 's',
					type: 'left',
					on: [{ leftField: 'b.structure_id', op: 'eq', rightField: 's.structure_id' }]
				},
				leftJoin('proj_projects', 'p', 'project_id', 'p.project_id')
			]
		},
		signal
	);
	return rows.filter((row) => ALLOWED_STATUSES.has(String(row.status ?? '')));
}

/**
 * Load Project → DS → Tower → BOM for draft/confirmed/frozen schedules
 * with delivery_date ≥ today (all plants).
 * One tree leaf per `delivery_schedule_line_id` (pln_* grain).
 *
 * `plantId` is accepted for call-site compatibility but not used to filter —
 * PM often leaves `proj_delivery_schedules.plant_id` null.
 */
export async function loadFuturePlanningSheetTree(
	_plantId?: string,
	signal?: AbortSignal
): Promise<PlanningSheetLoadedTree> {
	const now = new Date();
	const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
	const rows = await listJoinedScheduleTreeRows({ gte: today }, signal);
	return buildPlanningSheetTree(rows, signal);
}

/**
 * Same tree as the planning sheet, but only schedules whose delivery_date
 * falls in the given calendar month (`YYYY-MM`). Used by Stock Assignment.
 */
export async function loadPlanningSheetTreeForMonth(
	month: string,
	signal?: AbortSignal
): Promise<PlanningSheetLoadedTree> {
	const { start, end } = monthDateRange(month);
	const rows = await listJoinedScheduleTreeRows({ gte: start, lte: end }, signal);
	return buildPlanningSheetTree(rows, signal);
}

async function buildPlanningSheetTree(
	joined: Record<string, unknown>[],
	signal?: AbortSignal
): Promise<PlanningSheetLoadedTree> {
	if (joined.length === 0) {
		return { months: [], nodes: [], bomNodeIds: [] };
	}

	const schedulesById = new Map<string, ScheduleRow>();
	const projectById = new Map<string, ProjectRow>();
	const bomById = new Map<string, BomRow>();
	const structureById = new Map<string, StructureRow>();
	const linesBySchedule = new Map<string, ScheduleLineRow[]>();
	const seenLineIds = new Set<string>();

	for (const row of joined) {
		const scheduleId = String(row.delivery_schedule_id ?? '');
		const projectId = String(row.project_id ?? '');
		if (!scheduleId || !projectId) continue;

		if (!schedulesById.has(scheduleId)) {
			schedulesById.set(scheduleId, {
				delivery_schedule_id: scheduleId,
				project_id: projectId,
				delivery_date: String(row.delivery_date ?? ''),
				status: String(row.status ?? ''),
				name: typeof row.name === 'string' ? row.name : null,
				plant_id: typeof row.plant_id === 'string' ? row.plant_id : null
			});
		}

		const pId = pickAliasString(row, 'p', 'project_id');
		if (pId && !projectById.has(pId)) {
			const activeRaw = pickAlias(row, 'p', 'active');
			const metaRaw = pickAlias(row, 'p', 'metadata');
			projectById.set(pId, {
				project_id: pId,
				name: pickAliasString(row, 'p', 'name'),
				active:
					typeof activeRaw === 'boolean'
						? activeRaw
						: activeRaw == null
							? null
							: Boolean(activeRaw),
				metadata:
					metaRaw && typeof metaRaw === 'object' && !Array.isArray(metaRaw)
						? (metaRaw as Record<string, unknown>)
						: undefined
			});
		}

		const lineId = pickAliasString(row, 'l', 'delivery_schedule_line_id');
		const bomId = pickAliasString(row, 'l', 'bom_id') || pickAliasString(row, 'b', 'bom_id');
		const qty = asNumber(pickAlias(row, 'l', 'quantity'));
		if (!lineId || !bomId || !(qty > 0) || seenLineIds.has(lineId)) continue;
		seenLineIds.add(lineId);

		const line: ScheduleLineRow = {
			delivery_schedule_line_id: lineId,
			delivery_schedule_id: pickAliasString(row, 'l', 'delivery_schedule_id') || scheduleId,
			bom_id: bomId,
			quantity: qty
		};
		const bucket = linesBySchedule.get(line.delivery_schedule_id) ?? [];
		bucket.push(line);
		linesBySchedule.set(line.delivery_schedule_id, bucket);

		if (!bomById.has(bomId)) {
			bomById.set(bomId, {
				bom_id: bomId,
				structure_id: pickAliasString(row, 'b', 'structure_id'),
				bom_name: pickAliasString(row, 'b', 'bom_name'),
				sort_order: asNumber(pickAlias(row, 'b', 'sort_order'))
			});
		}

		const structureId =
			pickAliasString(row, 's', 'structure_id') || bomById.get(bomId)?.structure_id;
		if (structureId && !structureById.has(structureId)) {
			structureById.set(structureId, {
				structure_id: structureId,
				project_id: pickAliasString(row, 's', 'project_id'),
				name: pickAliasString(row, 's', 'name'),
				type: pickAliasString(row, 's', 'type'),
				sort_order: asNumber(pickAlias(row, 's', 'sort_order'))
			});
		}
	}

	/** Treat missing `active` as included; only drop explicit inactive. */
	for (const [id, project] of [...projectById.entries()]) {
		if (project.active === false) projectById.delete(id);
	}

	const bomIds = [...bomById.keys()];
	const setKgByBomId = await listBomSetWeightKgByBomIds(bomIds, signal);

	const schedulesByProject = new Map<string, ScheduleRow[]>();
	for (const schedule of schedulesById.values()) {
		if (!projectById.has(schedule.project_id)) continue;
		const bucket = schedulesByProject.get(schedule.project_id) ?? [];
		bucket.push(schedule);
		schedulesByProject.set(schedule.project_id, bucket);
	}

	const months = [
		...new Set(
			[...schedulesById.values()]
				.filter((s) => projectById.has(s.project_id))
				.map((s) => monthKeyFromIsoDate(s.delivery_date))
		)
	].sort();

	const bomNodeIds: string[] = [];
	const nodes: TreeTableNode<PlanningSheetRowData>[] = [];

	for (const projectId of [...schedulesByProject.keys()].sort((a, b) => {
		const la = projectLabel(projectById.get(a)!);
		const lb = projectLabel(projectById.get(b)!);
		return la.localeCompare(lb);
	})) {
		const project = projectById.get(projectId)!;
		const projectSchedules = (schedulesByProject.get(projectId) ?? [])
			.slice()
			.sort((a, b) => a.delivery_date.localeCompare(b.delivery_date));

		const scheduleNodes: TreeTableNode<PlanningSheetRowData>[] = [];
		let projectQtySets = 0;
		const projectMtParts: Array<number | null> = [];

		for (const schedule of projectSchedules) {
			const scheduleLines = linesBySchedule.get(schedule.delivery_schedule_id) ?? [];
			/** structureId → list of DS lines (no collapse — one leaf per line). */
			const byStructure = new Map<string, Array<{ line: ScheduleLineRow; bom: BomRow }>>();

			for (const line of scheduleLines) {
				const bom = bomById.get(line.bom_id);
				if (!bom) continue;
				const structure = structureById.get(bom.structure_id);
				if (!structure || structure.project_id !== projectId) continue;

				const bucket = byStructure.get(bom.structure_id) ?? [];
				bucket.push({ line, bom });
				byStructure.set(bom.structure_id, bucket);
			}

			const towerNodes: TreeTableNode<PlanningSheetRowData>[] = [];
			let scheduleQtySets = 0;
			const scheduleMtParts: Array<number | null> = [];

			const structureEntries = [...byStructure.entries()].sort(([aId], [bId]) => {
				const a = structureById.get(aId);
				const b = structureById.get(bId);
				return (
					(a?.sort_order ?? 0) - (b?.sort_order ?? 0) ||
					(a?.name ?? aId).localeCompare(b?.name ?? bId)
				);
			});

			for (const [structureId, entries] of structureEntries) {
				const structure = structureById.get(structureId);
				if (!structure) continue;

				const sorted = [...entries].sort(
					(a, b) =>
						a.bom.sort_order - b.bom.sort_order ||
						a.bom.bom_name.localeCompare(b.bom.bom_name) ||
						a.line.delivery_schedule_line_id.localeCompare(b.line.delivery_schedule_line_id)
				);
				const bomNodes: TreeTableNode<PlanningSheetRowData>[] = [];
				let towerQtySets = 0;
				const towerMtParts: Array<number | null> = [];

				for (const entry of sorted) {
					const qty = entry.line.quantity ?? 0;
					if (qty <= 0) continue;
					const weightMtPerSet = weightMtPerSetFromKg(setKgByBomId.get(entry.bom.bom_id));
					const mt = weightMtPerSet != null ? weightMtPerSet * qty : null;
					const bomNodeId = bomNodeIdForDsLine(entry.line.delivery_schedule_line_id);
					bomNodeIds.push(bomNodeId);
					bomNodes.push({
						id: bomNodeId,
						label: entry.bom.bom_name,
						data: {
							kind: 'bom',
							projectId,
							scheduleId: schedule.delivery_schedule_id,
							structureId,
							bomId: entry.bom.bom_id,
							deliveryScheduleLineId: entry.line.delivery_schedule_line_id,
							deliveryMonth: monthKeyFromIsoDate(schedule.delivery_date),
							qtySets: qty,
							qtyMt: mt,
							weightMtPerSet
						}
					});
					towerQtySets += qty;
					towerMtParts.push(mt);
				}

				if (bomNodes.length === 0) continue;
				towerNodes.push({
					id: `tower:${schedule.delivery_schedule_id}:${structureId}`,
					label: structure.name,
					defaultExpanded: true,
					children: bomNodes,
					data: {
						kind: 'tower',
						projectId,
						scheduleId: schedule.delivery_schedule_id,
						structureId,
						qtySets: towerQtySets,
						qtyMt: sumMt(towerMtParts)
					}
				});
				scheduleQtySets += towerQtySets;
				scheduleMtParts.push(...towerMtParts);
			}

			if (towerNodes.length === 0) continue;
			scheduleNodes.push({
				id: `schedule:${schedule.delivery_schedule_id}`,
				label: formatScheduleLabel(schedule.delivery_date.slice(0, 10), schedule.name),
				defaultExpanded: true,
				children: towerNodes,
				data: {
					kind: 'schedule',
					projectId,
					scheduleId: schedule.delivery_schedule_id,
					deliveryDate: schedule.delivery_date.slice(0, 10),
					name: schedule.name ?? null,
					qtySets: scheduleQtySets,
					qtyMt: sumMt(scheduleMtParts)
				}
			});
			projectQtySets += scheduleQtySets;
			projectMtParts.push(...scheduleMtParts);
		}

		if (scheduleNodes.length === 0) continue;
		nodes.push({
			id: `project:${projectId}`,
			label: projectLabel(project),
			defaultExpanded: true,
			children: scheduleNodes,
			data: {
				kind: 'project',
				projectId,
				qtySets: projectQtySets,
				qtyMt: sumMt(projectMtParts)
			}
		});
	}

	return { months, nodes, bomNodeIds };
}
