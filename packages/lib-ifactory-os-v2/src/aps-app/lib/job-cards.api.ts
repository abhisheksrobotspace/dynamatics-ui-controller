import { apiClient } from '../../lib/api/api-client.js';
import { datahubQuery, leftJoin, pickAlias, pickAliasString } from '../../lib/api/datahub-query.js';
import { rowsFromEnvelope, type ApiEnvelope } from '../../lib/api/types.js';
import { formatUtcAsIst } from '../../lib/datetime/format-ist.js';
import { getScheduleRequest } from './schedule-requests.api.js';
import {
	buildMachineLoadingRows,
	cuttingSummary,
	filterBarsByRmIds,
	formatBundles,
	groupSteelRequisition,
	mapCuttingBar,
	operationLetters,
	parseBundles,
	pickSectionPlans,
	pageIdsForJobCardDrawings,
	toJobCardDrawings,
	unitWeightKgPerM,
	type JobCardTaskInput,
	type OcrDrawingInput,
	type SectionPlanBarInput,
	type SectionPlanInput
} from './job-cards.derive.js';
import { mtStringToKg } from './job-cards.weight.js';
import type {
	JobCardCuttingBarRow,
	JobCardDetail,
	JobCardMarkRow,
	JobCardStatus,
	JobCardSummary
} from './job-cards.types.js';

type PlanRow = {
	plan_id: string;
	latest_run_id?: string | null;
};

type PlanRunRow = {
	run_id: string;
	plan_id: string;
	request_id?: string;
	status: string;
	published_at?: string | null;
	published_by?: string | null;
	sources_frozen?: boolean | null;
};

export type ApsJobCardRow = {
	job_card_id: string;
	run_id: string;
	plan_id: string;
	card_no: number;
	card_ref?: string | null;
	work_order_id: string;
	project_id?: string | null;
	production_plan_id?: string | null;
	bom_id?: string | null;
	tower_label: string;
	bom_name: string;
	section: string;
	section_group_key?: string | null;
	num_sets: number;
	marks_count: number;
	pieces_total?: number | null;
	total_weight_mt?: string | number | null;
	customer_name?: string | null;
	rm_grade?: string | null;
	batch_no?: string | null;
	plant_id?: string | null;
	card_fy?: number | null;
	job_id?: string | null;
	num_bundles?: number | null;
	due_date?: string | null;
	scheduled_start?: string | null;
	scheduled_end?: string | null;
	status: string;
	published_at?: string | null;
	published_by?: string | null;
	sort_order?: number | null;
	metadata?: Record<string, unknown> | null;
};

export type ApsJobCardLineRow = {
	job_card_line_id: string;
	job_card_id: string;
	bom_item_id?: string | null;
	mark_no: string;
	length_mm?: string | number | null;
	width_mm?: string | number | null;
	weight_per_piece_kg?: string | number | null;
	pieces_per_set?: number | null;
	pieces_total?: number | null;
	total_weight_mt?: string | number | null;
	holes?: number | null;
	step_codes?: unknown;
	notching_weight_mt?: string | number | null;
	bending_weight_mt?: string | number | null;
	heel_grinding_weight_mt?: string | number | null;
	num_bundles?: number | null;
	bundles?: unknown;
	bundle_max_weight_mt?: string | number | null;
	sort_order?: number | null;
};

type ApsScheduledTaskRow = JobCardTaskInput & {
	job_card_id?: string | null;
};

type MachineNameRow = {
	machine_id: string;
	name?: string | null;
};

const JOB_CARD_SELECT = [
	'card_id',
	'run_id',
	'request_id',
	'card_no',
	'card_ref',
	'work_order_id',
	'bom_id',
	'tower_label',
	'bom_name',
	'section',
	'section_group_key',
	'rm_grade',
	'plant_id',
	'card_fy',
	'job_id',
	'num_sets',
	'marks_count',
	'pieces_total',
	'total_weight_mt',
	'num_bundles',
	'due_date',
	'scheduled_start',
	'scheduled_end',
	'status',
	'published_at',
	'published_by',
	'sort_order',
	'metadata'
].join(',');

const JOB_CARD_LINE_SELECT = [
	'card_line_id',
	'card_id',
	'mark_no',
	'length_mm',
	'width_mm',
	'weight_per_piece_kg',
	'pieces_per_set',
	'pieces_total',
	'total_weight_mt',
	'holes',
	'step_codes',
	'notching_weight_mt',
	'bending_weight_mt',
	'heel_grinding_weight_mt',
	'num_bundles',
	'bundles',
	'bundle_max_weight_mt',
	'sort_order'
].join(',');

const TASK_SELECT = [
	'task_id',
	'card_id',
	'task_kind',
	'step_code',
	'machine_id',
	'rm_id',
	'mark_no',
	'product',
	'qty',
	'unit_index',
	'bundle_index',
	'start_time',
	'end_time'
].join(',');
const MACHINE_SELECT = 'machine_id,name';
const OCR_DRAWING_SELECT =
	'bom_item_id,bom_mark,corrected_mark,sketch_mark,match_status,page_id,metadata';
const OCR_PAGE_SELECT = 'page_id,page_image_file_id';
const OCR_VERIFICATION_SELECT = 'verification_id,status,created_at';

const RUN_SELECT = 'run_id,request_id,status,published_at,published_by,sources_frozen';

const jobCardLabelById = new Map<string, string>();

function numberValue(value: unknown): number {
	if (typeof value === 'number' && Number.isFinite(value)) return value;
	if (typeof value === 'string' && value.trim()) {
		const n = Number(value);
		return Number.isFinite(n) ? n : 0;
	}
	return 0;
}

function optionalNumber(value: unknown): number | null {
	if (value === null || value === undefined || value === '') return null;
	const n = numberValue(value);
	return Number.isFinite(n) ? n : null;
}

function parseStatus(value: string | null | undefined): JobCardStatus {
	switch (value) {
		case 'published':
		case 'pushed':
		case 'material_issued':
		case 'completed':
		case 'cancelled':
			return value;
		default:
			return 'draft';
	}
}

export function formatJobCardSrNo(card: Pick<ApsJobCardRow, 'card_no' | 'card_ref'>): string {
	const ref = card.card_ref?.trim();
	if (ref) return ref;
	return `M-${card.card_no}`;
}

export function formatJobCardStatus(status: JobCardStatus): string {
	switch (status) {
		case 'published':
			return 'Published';
		case 'pushed':
			return 'Pushed';
		case 'material_issued':
			return 'Material issued';
		case 'completed':
			return 'Completed';
		case 'cancelled':
			return 'Cancelled';
		default:
			return 'Draft';
	}
}

function formatDueDate(iso: string | null | undefined): string {
	if (!iso?.trim()) return '-';
	const formatted = formatUtcAsIst(iso, {
		day: '2-digit',
		month: '2-digit',
		year: 'numeric'
	});
	return formatted === iso ? '-' : formatted;
}

function stepCodesFromJson(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function rememberJobCardLabel(jobCardId: string, label: string): void {
	if (jobCardId && label) jobCardLabelById.set(jobCardId, label);
}

export function getJobCardLabel(jobCardId: string): string {
	return jobCardLabelById.get(jobCardId) ?? jobCardId;
}

export async function ensureJobCardLabel(jobCardId: string, signal?: AbortSignal): Promise<string> {
	const cached = jobCardLabelById.get(jobCardId);
	if (cached) return cached;
	const card = await getJobCardRow(jobCardId, signal);
	if (!card) return jobCardId;
	const label = formatJobCardSrNo(card);
	rememberJobCardLabel(jobCardId, label);
	return label;
}

export function mapJobCardRow(row: ApsJobCardRow): JobCardSummary {
	const jcSrNo = formatJobCardSrNo(row);
	rememberJobCardLabel(row.job_card_id, jcSrNo);
	return {
		jobId: row.job_card_id,
		runId: row.run_id,
		planId: row.plan_id,
		jcSrNo,
		workOrder: row.work_order_id?.trim() || '-',
		towerType: row.tower_label?.trim() || '-',
		subtype: row.bom_name?.trim() || '-',
		section: row.section?.trim() || '-',
		sets: numberValue(row.num_sets),
		markCount: numberValue(row.marks_count),
		totalWeightKg: mtStringToKg(row.total_weight_mt),
		date: formatDueDate(row.due_date),
		status: parseStatus(row.status),
		sortOrder: numberValue(row.sort_order)
	};
}

function mapJobCardLineRow(card: ApsJobCardRow): (row: ApsJobCardLineRow) => JobCardMarkRow {
	return (row: ApsJobCardLineRow) => {
		const stepCodes = stepCodesFromJson(row.step_codes);
		const bundles = parseBundles(row.bundles);
		return {
			id: row.job_card_line_id,
			towerType: card.tower_label?.trim() || '-',
			subtype: card.bom_name?.trim() || '-',
			markNo: row.mark_no?.trim() || '-',
			lengthMm: numberValue(row.length_mm),
			widthMm: optionalNumber(row.width_mm) ?? null,
			wtPerPieceKg: numberValue(row.weight_per_piece_kg),
			totalPcs: numberValue(row.pieces_total),
			totalWtKg: mtStringToKg(row.total_weight_mt),
			notchingWtKg:
				row.notching_weight_mt == null || row.notching_weight_mt === ''
					? null
					: mtStringToKg(row.notching_weight_mt),
			bendingWtKg:
				row.bending_weight_mt == null || row.bending_weight_mt === ''
					? null
					: mtStringToKg(row.bending_weight_mt),
			heelGrindingWtKg:
				row.heel_grinding_weight_mt == null || row.heel_grinding_weight_mt === ''
					? null
					: mtStringToKg(row.heel_grinding_weight_mt),
			holes: numberValue(row.holes),
			stepCodes,
			operation: operationLetters(stepCodes),
			numBundles: optionalNumber(row.num_bundles),
			bundlesLabel: formatBundles(bundles),
			sortOrder: numberValue(row.sort_order)
		};
	};
}

function formatStepTime(iso: string): string {
	const formatted = formatUtcAsIst(iso, {
		day: 'numeric',
		month: 'short',
		year: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
		hour12: true
	});
	return formatted === iso ? '' : formatted;
}

async function getPlan(planId: string, signal?: AbortSignal): Promise<PlanRow | undefined> {
	const request = await getScheduleRequest(planId, signal).catch(() => null);
	if (request) {
		return { plan_id: request.request_id, latest_run_id: null };
	}
	return undefined;
}

/** Same resolution as production-schedule: prefer a run id, else latest completed. */
export async function resolveJobCardsRunId(
	planId: string,
	preferredRunId?: string | null,
	signal?: AbortSignal
): Promise<string | null> {
	if (preferredRunId?.trim()) {
		const byId = await apiClient.get<ApiEnvelope<PlanRunRow[]>>(
			apiClient.datahub(
				`aps_schedule_runs?run_id=${encodeURIComponent(preferredRunId)}&select=${RUN_SELECT}&limit=1`
			),
			{ signal }
		);
		const row = rowsFromEnvelope<PlanRunRow>(byId.data)[0];
		if (row?.status === 'completed') return row.run_id;
	}

	const plan = await getPlan(planId, signal);
	if (plan?.latest_run_id?.trim()) {
		const byLatest = await apiClient.get<ApiEnvelope<PlanRunRow[]>>(
			apiClient.datahub(
				`aps_schedule_runs?run_id=${encodeURIComponent(plan.latest_run_id)}&select=${RUN_SELECT}&limit=1`
			),
			{ signal }
		);
		const latest = rowsFromEnvelope<PlanRunRow>(byLatest.data)[0];
		if (latest?.status === 'completed') return latest.run_id;
	}

	const envelope = await apiClient.get<ApiEnvelope<PlanRunRow[]>>(
		apiClient.datahub(
			`aps_schedule_runs?request_id=${encodeURIComponent(planId)}&status=completed&orderBy=created_at:desc&select=${RUN_SELECT}&limit=1`
		),
		{ signal }
	);
	return rowsFromEnvelope<PlanRunRow>(envelope.data)[0]?.run_id ?? null;
}

type CardApiRow = Record<string, unknown> & {
	card_id?: string;
	request_id?: string;
	work_order_id?: string;
	tower_label?: string;
	bom_name?: string;
	section?: string;
	num_sets?: number;
	marks_count?: number;
	card_no?: number;
	run_id?: string;
	status?: string;
	metadata?: Record<string, unknown> | null;
};

function mapCardApiRow(row: CardApiRow): ApsJobCardRow {
	const meta =
		row.metadata && typeof row.metadata === 'object'
			? (row.metadata as Record<string, unknown>)
			: {};
	const customerFromMeta = typeof meta.customer_name === 'string' ? meta.customer_name.trim() : '';
	const batchFromMeta = typeof meta.batch_no === 'string' ? meta.batch_no.trim() : '';
	const projectFromMeta = typeof meta.project_id === 'string' ? meta.project_id.trim() : '';

	return {
		...(row as unknown as ApsJobCardRow),
		job_card_id: String(row.card_id ?? ''),
		plan_id: String(row.request_id ?? ''),
		work_order_id: String(row.work_order_id ?? ''),
		tower_label: String(row.tower_label ?? ''),
		bom_name: String(row.bom_name ?? ''),
		section: String(row.section ?? ''),
		num_sets: Number(row.num_sets ?? 0),
		marks_count: Number(row.marks_count ?? 0),
		card_no: Number(row.card_no ?? 0),
		run_id: String(row.run_id ?? ''),
		status: String(row.status ?? 'draft'),
		project_id: projectFromMeta || null,
		customer_name: customerFromMeta || null,
		batch_no: batchFromMeta || null
	};
}

type CardLineApiRow = Record<string, unknown> & {
	card_line_id?: string;
	card_id?: string;
};

function mapCardLineApiRow(row: CardLineApiRow): ApsJobCardLineRow {
	return {
		...(row as unknown as ApsJobCardLineRow),
		job_card_line_id: String(row.card_line_id ?? ''),
		job_card_id: String(row.card_id ?? ''),
		mark_no: String(row.mark_no ?? '')
	};
}

export async function listJobCardRows(
	runId: string,
	signal?: AbortSignal
): Promise<ApsJobCardRow[]> {
	const envelope = await apiClient.get<ApiEnvelope<CardApiRow[]>>(
		apiClient.datahub(
			`aps_cards?run_id=${encodeURIComponent(runId)}&orderBy=sort_order:asc&select=${JOB_CARD_SELECT}&limit=5000`
		),
		{ signal }
	);
	return rowsFromEnvelope<CardApiRow>(envelope.data).map(mapCardApiRow);
}

export async function listJobCards(runId: string, signal?: AbortSignal): Promise<JobCardSummary[]> {
	return (await listJobCardRows(runId, signal)).map(mapJobCardRow);
}

export async function getJobCardRow(
	jobCardId: string,
	signal?: AbortSignal
): Promise<ApsJobCardRow | null> {
	const envelope = await apiClient.get<ApiEnvelope<CardApiRow[]>>(
		apiClient.datahub(
			`aps_cards?card_id=${encodeURIComponent(jobCardId)}&select=${JOB_CARD_SELECT}&limit=1`
		),
		{ signal }
	);
	const row = rowsFromEnvelope<CardApiRow>(envelope.data)[0];
	return row ? mapCardApiRow(row) : null;
}

export async function listJobCardLineRows(
	jobCardId: string,
	signal?: AbortSignal
): Promise<ApsJobCardLineRow[]> {
	const envelope = await apiClient.get<ApiEnvelope<CardLineApiRow[]>>(
		apiClient.datahub(
			`aps_card_lines?card_id=${encodeURIComponent(jobCardId)}&orderBy=sort_order:asc&select=${JOB_CARD_LINE_SELECT}&limit=5000`
		),
		{ signal }
	);
	return rowsFromEnvelope<CardLineApiRow>(envelope.data).map(mapCardLineApiRow);
}

/** Batch card lines for many cards (avoids N+1 markings fallback). */
export async function listJobCardLineRowsForCards(
	jobCardIds: string[],
	signal?: AbortSignal
): Promise<ApsJobCardLineRow[]> {
	const ids = [...new Set(jobCardIds.map((id) => id.trim()).filter(Boolean))];
	if (ids.length === 0) return [];
	const envelope = await apiClient.get<ApiEnvelope<CardLineApiRow[]>>(
		apiClient.datahub(
			`aps_card_lines?card_id__in=${ids.map((id) => encodeURIComponent(id)).join(',')}&orderBy=sort_order:asc&select=${JOB_CARD_LINE_SELECT}&limit=5000`
		),
		{ signal }
	);
	return rowsFromEnvelope<CardLineApiRow>(envelope.data).map(mapCardLineApiRow);
}

async function listJobCardTasks(
	jobCardId: string,
	signal?: AbortSignal
): Promise<ApsScheduledTaskRow[]> {
	const envelope = await apiClient.get<
		ApiEnvelope<Array<ApsScheduledTaskRow & { card_id?: string }>>
	>(
		apiClient.datahub(
			`aps_schedule_tasks?card_id=${encodeURIComponent(jobCardId)}&select=${TASK_SELECT}&limit=5000`
		),
		{ signal }
	);
	return rowsFromEnvelope<ApsScheduledTaskRow & { card_id?: string }>(envelope.data).map((row) => ({
		...row,
		job_card_id: row.card_id ?? row.job_card_id
	}));
}

async function listMachineNames(
	machineIds: string[],
	signal?: AbortSignal
): Promise<Map<string, string>> {
	const ids = [...new Set(machineIds.map((id) => id.trim()).filter(Boolean))];
	const names = new Map<string, string>();
	if (ids.length === 0) return names;
	const envelope = await apiClient.get<ApiEnvelope<MachineNameRow[]>>(
		apiClient.datahub(
			`machines?machine_id__in=${ids.map((id) => encodeURIComponent(id)).join(',')}&select=${MACHINE_SELECT}&limit=5000`
		),
		{ signal }
	);
	for (const row of rowsFromEnvelope<MachineNameRow>(envelope.data)) {
		names.set(row.machine_id, row.name?.trim() || row.machine_id);
	}
	return names;
}

async function listCuttingBarsForCard(
	card: ApsJobCardRow,
	tasks: ApsScheduledTaskRow[],
	markRows: JobCardMarkRow[],
	signal?: AbortSignal
): Promise<JobCardCuttingBarRow[]> {
	const bomId = card.bom_id?.trim();
	if (!bomId) return [];

	const joined = await datahubQuery<Record<string, unknown>>(
		'cp_section_plans',
		{
			bom_id: bomId,
			limit: 5000,
			select: [
				'section_plan_id',
				'section',
				'section_version',
				'produced_by_run_id',
				'status',
				'b.bar_id',
				'b.section_plan_id',
				'b.bar_index',
				'b.rmid',
				'b.rm_length_mm',
				'b.quantity',
				'b.markings'
			].join(','),
			joins: [leftJoin('cp_section_plan_bars', 'b', 'section_plan_id', 'b.section_plan_id')]
		},
		signal
	).catch(() => [] as Record<string, unknown>[]);

	const planById = new Map<string, SectionPlanInput>();
	const barsRaw: SectionPlanBarInput[] = [];
	for (const row of joined) {
		const planId = String(row.section_plan_id ?? '');
		if (planId && !planById.has(planId)) {
			planById.set(planId, {
				section_plan_id: planId,
				section: typeof row.section === 'string' ? row.section : '',
				section_version: Number(row.section_version ?? 0)
			});
		}
		const barId = pickAliasString(row, 'b', 'bar_id');
		if (!barId) continue;
		barsRaw.push({
			bar_id: barId,
			section_plan_id: pickAliasString(row, 'b', 'section_plan_id') || planId,
			bar_index: Number(pickAlias(row, 'b', 'bar_index') ?? 0),
			rmid: pickAliasString(row, 'b', 'rmid') || null,
			rm_length_mm: pickAlias(row, 'b', 'rm_length_mm') as SectionPlanBarInput['rm_length_mm'],
			quantity: pickAlias(row, 'b', 'quantity') as SectionPlanBarInput['quantity'],
			markings: pickAlias(row, 'b', 'markings') as SectionPlanBarInput['markings']
		});
	}

	const plans = pickSectionPlans([...planById.values()], card.section);
	if (plans.length === 0) return [];
	const planIds = new Set(plans.map((plan) => plan.section_plan_id));
	const barsForPlans = barsRaw.filter((bar) => planIds.has(bar.section_plan_id));

	const rmIds = new Set(
		tasks.map((task) => task.rm_id?.trim()).filter((id): id is string => Boolean(id))
	);
	const bars = filterBarsByRmIds(barsForPlans, rmIds);
	const unitKgM = unitWeightKgPerM(markRows);
	return bars.map((bar, index) =>
		mapCuttingBar(
			bar,
			numberValue(card.num_sets),
			unitKgM,
			bar.bar_id ?? `${bar.section_plan_id}-${index}`
		)
	);
}

/**
 * Prefer `metadata.project_id` stamped on the card; else bom → structure → project (one join).
 * (`aps_cards` has no top-level `project_id` column.)
 */
async function resolveProjectName(card: ApsJobCardRow, signal?: AbortSignal): Promise<string> {
	const meta =
		card.metadata && typeof card.metadata === 'object'
			? (card.metadata as Record<string, unknown>)
			: {};
	const fromMeta = typeof meta.project_id === 'string' ? meta.project_id.trim() : '';
	if (fromMeta) {
		const projectEnvelope = await apiClient.get<ApiEnvelope<Array<{ name?: string | null }>>>(
			apiClient.datahub(
				`proj_projects?project_id=${encodeURIComponent(fromMeta)}&select=name&limit=1`
			),
			{ signal }
		);
		return rowsFromEnvelope<{ name?: string | null }>(projectEnvelope.data)[0]?.name?.trim() || '';
	}

	const bomId = card.bom_id?.trim();
	if (!bomId) return '';

	const rows = await datahubQuery<Record<string, unknown>>(
		'proj_boms',
		{
			bom_id: bomId,
			select: 'bom_id,s.structure_id,s.project_id,p.name',
			limit: 1,
			joins: [
				leftJoin('proj_structures', 's', 'structure_id', 's.structure_id'),
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
	return pickAliasString(rows[0] ?? {}, 'p', 'name').trim();
}

async function listOcrDrawingsForBom(
	bomId: string,
	signal?: AbortSignal
): Promise<OcrDrawingInput[]> {
	const verificationEnvelope = await apiClient.get<
		ApiEnvelope<Array<{ verification_id?: string | null }>>
	>(
		apiClient.datahub(
			`ocr_verifications?bom_id=${encodeURIComponent(bomId)}&orderBy=created_at:desc&select=${OCR_VERIFICATION_SELECT}&limit=1`
		),
		{ signal }
	);
	const verificationId = rowsFromEnvelope<{ verification_id?: string | null }>(
		verificationEnvelope.data
	)[0]?.verification_id?.trim();
	if (!verificationId) return [];

	const envelope = await apiClient.get<ApiEnvelope<OcrDrawingInput[]>>(
		apiClient.datahub(
			`ocr_results?verification_id=${encodeURIComponent(verificationId)}&select=${OCR_DRAWING_SELECT}&limit=5000`
		),
		{ signal }
	);
	return rowsFromEnvelope<OcrDrawingInput>(envelope.data);
}

/**
 * Prefer line `bom_item_id` matches; `aps_card_lines` often omit that column, so fall back to
 * the card's BOM verification and match results by mark.
 */
async function listOcrDrawingsForCard(
	card: ApsJobCardRow,
	lines: ApsJobCardLineRow[],
	signal?: AbortSignal
): Promise<OcrDrawingInput[]> {
	const ids = [
		...new Set(
			lines.map((line) => line.bom_item_id?.trim()).filter((id): id is string => Boolean(id))
		)
	];
	if (ids.length > 0) {
		const envelope = await apiClient.get<ApiEnvelope<OcrDrawingInput[]>>(
			apiClient.datahub(
				`ocr_results?bom_item_id__in=${ids.map((id) => encodeURIComponent(id)).join(',')}&select=${OCR_DRAWING_SELECT}&limit=5000`
			),
			{ signal }
		);
		const byItem = rowsFromEnvelope<OcrDrawingInput>(envelope.data);
		if (byItem.length > 0) return byItem;
	}

	const bomId = card.bom_id?.trim();
	if (!bomId) return [];
	return listOcrDrawingsForBom(bomId, signal);
}

/** Keep `page_id__in` URLs under proxy/header limits (~8–16KB with cookies). */
const OCR_PAGE_ID_CHUNK = 40;

async function listOcrPageImages(
	pageIds: string[],
	signal?: AbortSignal
): Promise<Map<string, string>> {
	const ids = [...new Set(pageIds.map((id) => id.trim()).filter(Boolean))];
	const images = new Map<string, string>();
	if (ids.length === 0) return images;

	for (let offset = 0; offset < ids.length; offset += OCR_PAGE_ID_CHUNK) {
		const chunk = ids.slice(offset, offset + OCR_PAGE_ID_CHUNK);
		const envelope = await apiClient.get<
			ApiEnvelope<Array<{ page_id: string; page_image_file_id?: string | null }>>
		>(
			apiClient.datahub(
				`ocr_pages?page_id__in=${chunk.map((id) => encodeURIComponent(id)).join(',')}&select=${OCR_PAGE_SELECT}&limit=5000`
			),
			{ signal }
		);
		for (const row of rowsFromEnvelope<{ page_id: string; page_image_file_id?: string | null }>(
			envelope.data
		)) {
			const fileId = row.page_image_file_id?.trim();
			if (fileId) images.set(row.page_id, fileId);
		}
	}
	return images;
}

export async function loadJobCardDetail(
	jobCardId: string,
	signal?: AbortSignal
): Promise<JobCardDetail | null> {
	const card = await getJobCardRow(jobCardId, signal);
	if (!card) return null;
	const [lines, tasks, projectName] = await Promise.all([
		listJobCardLineRows(jobCardId, signal),
		listJobCardTasks(jobCardId, signal),
		resolveProjectName(card, signal)
	]);
	const machineIds = tasks
		.map((task) => task.machine_id?.trim())
		.filter((id): id is string => Boolean(id));
	const machineNames = await listMachineNames(machineIds, signal);
	const summary = mapJobCardRow(card);
	rememberJobCardLabel(jobCardId, summary.jcSrNo);
	const rows = lines.map(mapJobCardLineRow(card));
	const [cuttingRows, ocrRows] = await Promise.all([
		listCuttingBarsForCard(card, tasks, rows, signal),
		listOcrDrawingsForCard(card, lines, signal)
	]);
	const drawingLines = lines.map((line) => ({
		id: line.job_card_line_id,
		markNo: line.mark_no?.trim() || '-',
		bomItemId: line.bom_item_id
	}));
	const pageImageById = await listOcrPageImages(
		pageIdsForJobCardDrawings(drawingLines, ocrRows),
		signal
	);
	const lengthByRmId = new Map(
		cuttingRows
			.filter((row) => row.rmid && row.lengthMm > 0)
			.map((row) => [row.rmid, row.lengthMm] as const)
	);
	const lengthByMark = new Map(
		rows
			.filter((row) => row.markNo && row.lengthMm > 0)
			.map((row) => [row.markNo, row.lengthMm] as const)
	);
	return {
		jobId: summary.jobId,
		runId: summary.runId,
		planId: summary.planId,
		jcSrNo: summary.jcSrNo,
		workOrder: summary.workOrder,
		towerType: summary.towerType,
		subtype: summary.subtype,
		section: summary.section,
		sets: summary.sets,
		status: summary.status,
		date: summary.date,
		projectName,
		customerName: card.customer_name?.trim() || '',
		rmGrade: card.rm_grade?.trim() || '-',
		batchNo: card.batch_no?.trim() || '',
		plantId: card.plant_id?.trim() || '',
		cardFy: optionalNumber(card.card_fy),
		solverJobId: card.job_id?.trim() || '',
		piecesTotal: numberValue(card.pieces_total),
		numBundles: optionalNumber(card.num_bundles),
		rows,
		loadingRows: buildMachineLoadingRows(
			tasks,
			machineNames,
			formatStepTime,
			lengthByRmId,
			lengthByMark
		),
		requisitionRows: groupSteelRequisition(
			summary.section,
			cuttingRows.map((row) => ({
				lengthMm: row.lengthMm,
				totalPcs: row.quantity,
				totalWtKg: row.weightKg
			}))
		),
		cuttingRows,
		cuttingSummary: cuttingSummary(cuttingRows),
		drawings: toJobCardDrawings(drawingLines, ocrRows, pageImageById).map((drawing) => ({
			id: drawing.id,
			markNo: drawing.markNo,
			imageUrl: apiClient.files(drawing.fileId)
		}))
	};
}

/**
 * Publish a completed run: stamp the run, publish its cards, supersede other
 * request-wide published cards. Each step is idempotent - safe to retry.
 * Refused by the DB when `sources_frozen` is false (`aps.run_provisional`).
 */
export async function publishApsRun(
	planId: string,
	runId: string,
	publishedBy: string,
	signal?: AbortSignal
): Promise<void> {
	const now = new Date().toISOString();
	const by = publishedBy.trim() || 'unknown';

	await apiClient.patch(
		apiClient.datahub(`aps_schedule_runs/${encodeURIComponent(runId)}`),
		{ published_at: now, published_by: by },
		{ signal }
	);

	const cards = await listJobCardRows(runId, signal);
	for (const card of cards) {
		// `pushed` / `material_issued` = floor has the card; do not downgrade.
		if (card.status === 'pushed' || card.status === 'material_issued') continue;
		if (card.status === 'published') continue;
		const metadata = { ...(card.metadata ?? {}) };
		delete metadata.superseded_by_run_id;
		await apiClient.patch(
			apiClient.datahub(`aps_cards/${encodeURIComponent(card.job_card_id)}`),
			{ status: 'published', published_at: now, published_by: by, metadata },
			{ signal }
		);
	}

	const publishedEnvelope = await apiClient.get<ApiEnvelope<CardApiRow[]>>(
		apiClient.datahub(
			`aps_cards?request_id=${encodeURIComponent(planId)}&status=published&select=${JOB_CARD_SELECT}&limit=5000`
		),
		{ signal }
	);
	for (const raw of rowsFromEnvelope<CardApiRow>(publishedEnvelope.data)) {
		const card = mapCardApiRow(raw);
		if (card.run_id === runId) continue;
		const metadata = { ...(card.metadata ?? {}), superseded_by_run_id: runId };
		await apiClient.patch(
			apiClient.datahub(`aps_cards/${encodeURIComponent(card.job_card_id)}`),
			{ status: 'cancelled', metadata },
			{ signal }
		);
	}
}

/** True when this run has at least one `status='published'` job card. */
export async function isRunPublished(runId: string, signal?: AbortSignal): Promise<boolean> {
	const envelope = await apiClient.get<ApiEnvelope<Array<{ card_id: string }>>>(
		apiClient.datahub(
			`aps_cards?run_id=${encodeURIComponent(runId)}&status=published&select=card_id&limit=1`
		),
		{ signal }
	);
	return rowsFromEnvelope<{ card_id: string }>(envelope.data).length > 0;
}

export function jobCardsHash(planId: string, runId?: string | null): string {
	const base = `#/ShopFloorPlanning/Aps/${encodeURIComponent(planId)}/JobCards`;
	if (runId?.trim()) return `${base}/run/${encodeURIComponent(runId)}`;
	return base;
}

export function jobCardDetailHash(planId: string, jobId: string): string {
	return `#/ShopFloorPlanning/Aps/${encodeURIComponent(planId)}/JobCards/${encodeURIComponent(jobId)}`;
}
