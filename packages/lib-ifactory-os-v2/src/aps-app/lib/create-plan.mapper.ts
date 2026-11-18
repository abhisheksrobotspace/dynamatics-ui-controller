import type { PartRow, PlanProject, PlanRelease } from './create-plan.types.js';
import { DEFAULT_APS_PLANT_LABEL } from './aps-plant.constants.js';

export type MapperBom = {
	bom_id: string;
	structure_id: string;
	bom_name: string;
	sort_order: number;
	due_date?: string | null;
};

export type MapperStructure = {
	structure_id: string;
	name: string;
	type: 'tower' | 'stub';
	sort_order: number;
	due_date?: string | null;
};

export type MapperProductionPlanLine = {
	production_plan_line_id: string;
	bom_id: string;
	quantity: number;
	unit: string;
	description?: string | null;
};

export type MapperProductionPlan = {
	production_plan_id: string;
	project_id: string;
	plan_name: string;
	plan_date: string;
	plant_id?: string | null;
	notes?: string | null;
};

/** @deprecated Use {@link MapperProductionPlanLine}. */
export type MapperReleaseLine = MapperProductionPlanLine;

/** @deprecated Use {@link MapperProductionPlan}. */
export type MapperRelease = MapperProductionPlan;

export type MapperProject = {
	project_id: string;
	name: string;
	customer_id: string;
	metadata?: Record<string, unknown>;
};

function stringMeta(metadata: Record<string, unknown> | undefined, key: string): string {
	const value = metadata?.[key];
	return typeof value === 'string' ? value.trim() : '';
}

/** `YYYY-MM-DD` → `DD-MM-YYYY` for labels. */
export function isoDateToDdMmYyyy(isoDate: string): string {
	const datePart = isoDate.slice(0, 10);
	const [year, month, day] = datePart.split('-');
	if (!year || !month || !day) return isoDate;
	return `${day}-${month}-${year}`;
}

function projectTitle(project: MapperProject, customerName: string): string {
	const shortName = stringMeta(project.metadata, 'short_name');
	const wo = stringMeta(project.metadata, 'work_order_no');
	const head = shortName || wo || project.name;
	const customer = customerName && customerName !== 'Unknown customer' ? customerName : '';
	if (customer && head !== project.name) return `${head} - ${customer}`;
	if (customer) return `${project.name} - ${customer}`;
	return project.name;
}

function projectSubtitle(project: MapperProject): string {
	const line = stringMeta(project.metadata, 'line_details');
	const loa = stringMeta(project.metadata, 'loa_no');
	const parts = [line, loa ? `LOA ${loa}` : ''].filter(Boolean);
	return parts.join(' · ');
}

function groupLinesByStructure(
	lines: MapperProductionPlanLine[],
	bomById: Map<string, MapperBom>,
	structures: MapperStructure[],
	kind: 'tower' | 'stub',
	bomWeightKgByBomId: Map<string, number>
): PartRow[] {
	const structureOrder = new Map(structures.map((s, i) => [s.structure_id, i]));
	const kindStructures = structures.filter((s) => s.type === kind);
	const linesByStructure = new Map<string, MapperProductionPlanLine[]>();

	for (const line of lines) {
		const bom = bomById.get(line.bom_id);
		if (!bom) continue;
		const structure = kindStructures.find((s) => s.structure_id === bom.structure_id);
		if (!structure) continue;
		const bucket = linesByStructure.get(structure.structure_id) ?? [];
		bucket.push(line);
		linesByStructure.set(structure.structure_id, bucket);
	}

	const structureIds = [...linesByStructure.keys()].sort(
		(a, b) => (structureOrder.get(a) ?? 0) - (structureOrder.get(b) ?? 0)
	);

	const rows: PartRow[] = [];
	structureIds.forEach((structureId, index) => {
		const structure = kindStructures.find((s) => s.structure_id === structureId);
		if (!structure) return;
		const structureLines = linesByStructure.get(structureId) ?? [];
		structureLines.sort((a, b) => {
			const aBom = bomById.get(a.bom_id);
			const bBom = bomById.get(b.bom_id);
			return (aBom?.sort_order ?? 0) - (bBom?.sort_order ?? 0);
		});

		rows.push({
			key: `${kind}-${structureId}`,
			kind,
			depth: 0,
			sr: String(index + 1),
			description: structure.name,
			structureId,
			dueDate: structure.due_date ?? null
		});

		for (const line of structureLines) {
			const bom = bomById.get(line.bom_id);
			const setKg = bomWeightKgByBomId.get(line.bom_id) ?? 0;
			const weightMt = (setKg * (line.quantity ?? 0)) / 1000;
			rows.push({
				key: line.production_plan_line_id,
				kind: 'bom',
				depth: 1,
				description: line.description?.trim() || bom?.bom_name || 'BOM',
				unit: line.unit || '',
				qtySurvey: '',
				cleared: '',
				release: String(line.quantity),
				cumulative: '',
				weightMt,
				bomId: line.bom_id,
				dueDate: bom?.due_date ?? null
			});
		}
	});

	return rows;
}

/** One BOM set's black weight in kg (sum of mark lines). Prefer total_weight. */
export function bomSetWeightKg(
	items: Array<{
		total_weight?: number | string | null;
		weight_per_piece?: number | string | null;
		num_pieces?: number | string | null;
		length_mm?: number | string | null;
		unit_weight?: number | string | null;
	}>
): number {
	let kg = 0;
	for (const item of items) {
		const total = Number(item.total_weight);
		if (Number.isFinite(total) && total > 0) {
			kg += total;
			continue;
		}
		const perPc = Number(item.weight_per_piece);
		const pcs = Number(item.num_pieces);
		if (Number.isFinite(perPc) && perPc > 0 && Number.isFinite(pcs) && pcs > 0) {
			kg += perPc * pcs;
			continue;
		}
		const lengthMm = Number(item.length_mm);
		const unitKgPerM = Number(item.unit_weight);
		if (
			Number.isFinite(lengthMm) &&
			lengthMm > 0 &&
			Number.isFinite(unitKgPerM) &&
			unitKgPerM > 0 &&
			Number.isFinite(pcs) &&
			pcs > 0
		) {
			kg += (lengthMm / 1000) * unitKgPerM * pcs;
		}
	}
	return kg;
}

/** Production plan batch weight in MT: Σ (BOM set kg × plan-line qty) / 1000. */
export function productionPlanBatchWeightMt(
	lines: MapperProductionPlanLine[],
	bomWeightKgByBomId: Map<string, number>
): number {
	let kg = 0;
	for (const line of lines) {
		const setKg = bomWeightKgByBomId.get(line.bom_id) ?? 0;
		kg += setKg * (line.quantity ?? 0);
	}
	return kg / 1000;
}

/** @deprecated Use {@link productionPlanBatchWeightMt}. */
export const releaseBatchWeightMt = productionPlanBatchWeightMt;

export function mapProductionPlanToPlanRelease(input: {
	productionPlan: MapperProductionPlan;
	lines: MapperProductionPlanLine[];
	boms: MapperBom[];
	structures: MapperStructure[];
	workOrderCode: string;
	planIdIfTaken?: string;
	bomWeightKgByBomId?: Map<string, number>;
}): PlanRelease {
	const {
		productionPlan,
		lines,
		boms,
		structures,
		workOrderCode,
		planIdIfTaken,
		bomWeightKgByBomId = new Map()
	} = input;
	const bomById = new Map(boms.map((bom) => [bom.bom_id, bom]));
	const towerParts = groupLinesByStructure(lines, bomById, structures, 'tower', bomWeightKgByBomId);
	const stubs = groupLinesByStructure(lines, bomById, structures, 'stub', bomWeightKgByBomId);

	const sets = lines.reduce((sum, line) => sum + (line.quantity ?? 0), 0);
	const structureIds = new Set<string>();
	for (const line of lines) {
		const bom = bomById.get(line.bom_id);
		if (bom) structureIds.add(bom.structure_id);
	}

	const structureNameById = new Map(structures.map((s) => [s.structure_id, s.name]));
	const structureNames = [...structureIds]
		.map((id) => structureNameById.get(id)?.trim() || '')
		.filter(Boolean)
		.join(', ');

	const dateLabel = isoDateToDdMmYyyy(productionPlan.plan_date);
	const planName = productionPlan.plan_name.trim() || 'Production plan';
	const metaParts = [
		structureNames,
		sets > 0 ? `${sets} set${sets === 1 ? '' : 's'}` : '',
		dateLabel
	].filter(Boolean);

	const selectedLines: Record<string, number> = {};
	for (const line of lines) {
		selectedLines[line.production_plan_line_id] = line.quantity;
	}

	const selectable = !planIdIfTaken;
	const plantLabel = productionPlan.plant_id?.trim() || DEFAULT_APS_PLANT_LABEL;

	return {
		id: productionPlan.production_plan_id,
		projectId: productionPlan.project_id,
		label: `${planName} · ${dateLabel}`,
		meta: metaParts.length > 0 ? metaParts.join(' · ') : undefined,
		status: planIdIfTaken ? 'unavailable' : 'confirmed',
		disabledReason: planIdIfTaken ? `Already in ${planIdIfTaken}` : undefined,
		selectable,
		workOrderCode,
		sets,
		batchWeightMt: productionPlanBatchWeightMt(lines, bomWeightKgByBomId),
		plants: plantLabel,
		zincReqMt: 0,
		selectedLines,
		structureCount: structureIds.size,
		towerParts,
		stubs,
		sourceNote: productionPlan.notes?.trim() || undefined
	};
}

/** @deprecated Use {@link mapProductionPlanToPlanRelease}. */
export function mapReleaseToPlanRelease(input: {
	release: MapperProductionPlan;
	lines: MapperProductionPlanLine[];
	boms: MapperBom[];
	structures: MapperStructure[];
	workOrderCode: string;
	planIdIfTaken?: string;
	bomWeightKgByBomId?: Map<string, number>;
}): PlanRelease {
	return mapProductionPlanToPlanRelease({
		productionPlan: input.release,
		lines: input.lines,
		boms: input.boms,
		structures: input.structures,
		workOrderCode: input.workOrderCode,
		planIdIfTaken: input.planIdIfTaken,
		bomWeightKgByBomId: input.bomWeightKgByBomId
	});
}

export function mapProjectToPlanProject(input: {
	project: MapperProject;
	customerName: string;
	releases: PlanRelease[];
}): PlanProject {
	const workOrderCode = stringMeta(input.project.metadata, 'work_order_no');
	return {
		id: input.project.project_id,
		title: projectTitle(input.project, input.customerName),
		subtitle: projectSubtitle(input.project),
		workOrderCode,
		releases: input.releases
	};
}
