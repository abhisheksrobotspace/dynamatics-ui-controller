import { apiClient } from '../../lib/api/api-client.js';
import { rowsFromEnvelope, type ApiEnvelope } from '../../lib/api/types.js';
import type {
	MfgDsBomLine,
	MfgDsProjectGroup,
	MfgDsScheduleGroup,
	MfgDsStructureGroup
} from './create-plan-ds.types.js';
import {
	formatDeliveryScheduleLabel,
	formatIsoDateDdMmYyyy,
	monthRangeFromPlanMonth,
	sumWeightMtNullAware,
	weightMtFromRollupKg
} from './create-plan-ds.utils.js';

type ProjectRow = {
	project_id: string;
	name: string;
	active: boolean;
	metadata?: Record<string, unknown>;
};

type StructureRow = {
	structure_id: string;
	project_id: string;
	name: string;
	type: 'tower' | 'stub' | string;
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
};

type ScheduleLineRow = {
	delivery_schedule_line_id: string;
	delivery_schedule_id: string;
	bom_id: string;
	quantity: number;
	unit?: string | null;
};

type DsRequirementRollupRow = {
	delivery_schedule_line_id: string;
	delivery_schedule_id: string;
	bom_id: string;
	sets: number;
	required_weight_kg?: string | number | null;
	lines_without_weight?: number | null;
};

const PROJECT_SELECT = 'project_id,name,active,metadata';
const STRUCTURE_SELECT = 'structure_id,project_id,name,type,sort_order';
const BOM_SELECT = 'bom_id,structure_id,bom_name,sort_order';
const SCHEDULE_SELECT = 'delivery_schedule_id,project_id,delivery_date,status,name';
const LINE_SELECT = 'delivery_schedule_line_id,delivery_schedule_id,bom_id,quantity,unit';
const ROLLUP_SELECT =
	'delivery_schedule_line_id,delivery_schedule_id,bom_id,sets,required_weight_kg,lines_without_weight';

function idListParam(ids: string[]): string {
	return ids.map((id) => encodeURIComponent(id)).join(',');
}

function parseKg(value: unknown): number | null {
	if (value === null || value === undefined || value === '') return null;
	if (typeof value === 'number' && Number.isFinite(value)) return value;
	if (typeof value === 'string' && value.trim() !== '') {
		const parsed = Number(value);
		if (Number.isFinite(parsed)) return parsed;
	}
	return null;
}

async function listProjectsByIds(
	projectIds: string[],
	signal?: AbortSignal
): Promise<ProjectRow[]> {
	if (projectIds.length === 0) return [];
	const envelope = await apiClient.get<ApiEnvelope<ProjectRow[]>>(
		apiClient.datahub(
			`proj_projects?project_id__in=${idListParam(projectIds)}&select=${PROJECT_SELECT}&limit=5000`
		),
		{ signal }
	);
	return rowsFromEnvelope<ProjectRow>(envelope.data);
}

async function listStructuresByProjectIds(
	projectIds: string[],
	signal?: AbortSignal
): Promise<StructureRow[]> {
	if (projectIds.length === 0) return [];
	const envelope = await apiClient.get<ApiEnvelope<StructureRow[]>>(
		apiClient.datahub(
			`proj_structures?project_id__in=${idListParam(projectIds)}&orderBy=sort_order:asc&select=${STRUCTURE_SELECT}&limit=5000`
		),
		{ signal }
	);
	return rowsFromEnvelope<StructureRow>(envelope.data);
}

async function listBomsByStructureIds(
	structureIds: string[],
	signal?: AbortSignal
): Promise<BomRow[]> {
	if (structureIds.length === 0) return [];
	const envelope = await apiClient.get<ApiEnvelope<BomRow[]>>(
		apiClient.datahub(
			`proj_boms?structure_id__in=${idListParam(structureIds)}&orderBy=sort_order:asc&select=${BOM_SELECT}&limit=5000`
		),
		{ signal }
	);
	return rowsFromEnvelope<BomRow>(envelope.data);
}

async function listDeliverySchedulesInMonth(
	startDate: string,
	endDate: string,
	signal?: AbortSignal
): Promise<ScheduleRow[]> {
	const envelope = await apiClient.get<ApiEnvelope<ScheduleRow[]>>(
		apiClient.datahub(
			`proj_delivery_schedules?delivery_date__gte=${encodeURIComponent(startDate)}&delivery_date__lte=${encodeURIComponent(endDate)}&select=${SCHEDULE_SELECT}&limit=5000`
		),
		{ signal }
	);
	return rowsFromEnvelope<ScheduleRow>(envelope.data).filter(
		(row) => row.status === 'confirmed' || row.status === 'frozen'
	);
}

async function listLinesByScheduleIds(
	scheduleIds: string[],
	signal?: AbortSignal
): Promise<ScheduleLineRow[]> {
	if (scheduleIds.length === 0) return [];
	const envelope = await apiClient.get<ApiEnvelope<ScheduleLineRow[]>>(
		apiClient.datahub(
			`proj_delivery_schedule_lines?delivery_schedule_id__in=${idListParam(scheduleIds)}&select=${LINE_SELECT}&limit=5000`
		),
		{ signal }
	);
	return rowsFromEnvelope<ScheduleLineRow>(envelope.data);
}

type RollupWeight = {
	sets: number;
	requiredWeightKg: number | null;
};

async function listRollupWeightByLineIds(
	scheduleIds: string[],
	signal?: AbortSignal
): Promise<Map<string, RollupWeight>> {
	const byLineId = new Map<string, RollupWeight>();
	if (scheduleIds.length === 0) return byLineId;

	const envelope = await apiClient.get<ApiEnvelope<DsRequirementRollupRow[]>>(
		apiClient.datahub(
			`inv_ds_requirement_rollup?delivery_schedule_id__in=${idListParam(scheduleIds)}&select=${ROLLUP_SELECT}&limit=5000`
		),
		{ signal }
	);

	for (const row of rowsFromEnvelope<DsRequirementRollupRow>(envelope.data)) {
		const lineId = row.delivery_schedule_line_id;
		if (!lineId) continue;
		const linesWithoutWeight = row.lines_without_weight ?? 0;
		const kg = linesWithoutWeight > 0 ? null : parseKg(row.required_weight_kg);
		byLineId.set(lineId, {
			sets: Number.isFinite(row.sets) ? row.sets : 0,
			requiredWeightKg: kg
		});
	}
	return byLineId;
}

function workOrderFromMetadata(metadata: Record<string, unknown> | undefined): string {
	const value = metadata?.work_order_no;
	return typeof value === 'string' ? value.trim() : '';
}

function buildStructureGroups(input: {
	scheduleId: string;
	projectId: string;
	structures: StructureRow[];
	bomsByStructureId: Map<string, BomRow[]>;
	qtyByBomId: Map<string, { qty: number; unit: string; scheduleLineId: string }>;
	rollupByLineId: Map<string, RollupWeight>;
}): MfgDsStructureGroup[] {
	const groups: MfgDsStructureGroup[] = [];

	for (const structure of input.structures) {
		const boms = input.bomsByStructureId.get(structure.structure_id) ?? [];
		const bomLines: MfgDsBomLine[] = [];

		for (const bom of boms) {
			const qtyInfo = input.qtyByBomId.get(bom.bom_id);
			if (!qtyInfo || qtyInfo.qty <= 0) continue;
			const rollup = input.rollupByLineId.get(qtyInfo.scheduleLineId);
			const weightMt = weightMtFromRollupKg(
				rollup?.requiredWeightKg,
				rollup?.sets ?? qtyInfo.qty,
				qtyInfo.qty
			);
			bomLines.push({
				id: `bom-${input.scheduleId}-${bom.bom_id}`,
				scheduleId: input.scheduleId,
				projectId: input.projectId,
				structureId: structure.structure_id,
				bomId: bom.bom_id,
				scheduleLineId: qtyInfo.scheduleLineId,
				bomName: bom.bom_name,
				unit: qtyInfo.unit || 'Set',
				qty: qtyInfo.qty,
				weightMt
			});
		}

		if (bomLines.length === 0) continue;

		groups.push({
			id: `structure-${input.scheduleId}-${structure.structure_id}`,
			structureId: structure.structure_id,
			name: structure.name,
			type: structure.type,
			boms: bomLines,
			weightMt: sumWeightMtNullAware(bomLines.map((line) => line.weightMt))
		});
	}

	return groups;
}

/**
 * Load Delivery Schedules in the manufacturing plan month and build
 * Project → Date → Tower/Stub → BOM groups with weights from `inv_ds_requirement_rollup`.
 */
export async function loadManufacturingPlanDsTree(
	planMonth: string | null | undefined,
	signal?: AbortSignal
): Promise<MfgDsProjectGroup[]> {
	const range = monthRangeFromPlanMonth(planMonth);
	if (!range) return [];

	const schedules = await listDeliverySchedulesInMonth(range.startDate, range.endDate, signal);
	if (schedules.length === 0) return [];

	const projectIds = [...new Set(schedules.map((s) => s.project_id))];
	const scheduleIds = schedules.map((s) => s.delivery_schedule_id);

	const [projects, structures, lines, rollupByLineId] = await Promise.all([
		listProjectsByIds(projectIds, signal),
		listStructuresByProjectIds(projectIds, signal),
		listLinesByScheduleIds(scheduleIds, signal),
		listRollupWeightByLineIds(scheduleIds, signal)
	]);

	const structuresByProject = new Map<string, StructureRow[]>();
	for (const structure of structures) {
		const bucket = structuresByProject.get(structure.project_id) ?? [];
		bucket.push(structure);
		structuresByProject.set(structure.project_id, bucket);
	}

	const structureIds = structures.map((s) => s.structure_id);
	const boms = await listBomsByStructureIds(structureIds, signal);
	const bomsByStructureId = new Map<string, BomRow[]>();
	for (const bom of boms) {
		const bucket = bomsByStructureId.get(bom.structure_id) ?? [];
		bucket.push(bom);
		bomsByStructureId.set(bom.structure_id, bucket);
	}

	const qtyByScheduleAndBom = new Map<
		string,
		Map<string, { qty: number; unit: string; scheduleLineId: string }>
	>();
	for (const line of lines) {
		let byBom = qtyByScheduleAndBom.get(line.delivery_schedule_id);
		if (!byBom) {
			byBom = new Map();
			qtyByScheduleAndBom.set(line.delivery_schedule_id, byBom);
		}
		const prev = byBom.get(line.bom_id);
		byBom.set(line.bom_id, {
			qty: (prev?.qty ?? 0) + (line.quantity ?? 0),
			unit: line.unit?.trim() || prev?.unit || 'Set',
			scheduleLineId: line.delivery_schedule_line_id
		});
	}

	const projectById = new Map(projects.map((p) => [p.project_id, p]));
	const schedulesByProject = new Map<string, ScheduleRow[]>();
	for (const schedule of schedules) {
		const bucket = schedulesByProject.get(schedule.project_id) ?? [];
		bucket.push(schedule);
		schedulesByProject.set(schedule.project_id, bucket);
	}

	const result: MfgDsProjectGroup[] = [];

	for (const projectId of projectIds) {
		const project = projectById.get(projectId);
		if (!project || !project.active) continue;

		const projectStructures = (structuresByProject.get(projectId) ?? [])
			.slice()
			.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));

		const scheduleGroups: MfgDsScheduleGroup[] = [];
		for (const schedule of schedulesByProject.get(projectId) ?? []) {
			const qtyByBomId = qtyByScheduleAndBom.get(schedule.delivery_schedule_id) ?? new Map();
			const structureGroups = buildStructureGroups({
				scheduleId: schedule.delivery_schedule_id,
				projectId,
				structures: projectStructures,
				bomsByStructureId,
				qtyByBomId,
				rollupByLineId
			});
			if (structureGroups.length === 0) continue;

			const deliveryDate = schedule.delivery_date.slice(0, 10);
			const dateLabel = formatIsoDateDdMmYyyy(deliveryDate);
			const scheduleName = schedule.name?.trim() ?? '';
			scheduleGroups.push({
				id: `schedule-${schedule.delivery_schedule_id}`,
				scheduleId: schedule.delivery_schedule_id,
				projectId,
				deliveryDate,
				label: formatDeliveryScheduleLabel(scheduleName, dateLabel),
				name: scheduleName || dateLabel,
				structures: structureGroups,
				weightMt: sumWeightMtNullAware(structureGroups.map((g) => g.weightMt))
			});
		}

		if (scheduleGroups.length === 0) continue;

		result.push({
			id: `project-${projectId}`,
			projectId,
			title: project.name,
			workOrderCode: workOrderFromMetadata(project.metadata),
			schedules: scheduleGroups,
			weightMt: sumWeightMtNullAware(scheduleGroups.map((g) => g.weightMt))
		});
	}

	result.sort((a, b) => a.title.localeCompare(b.title));
	return result;
}
