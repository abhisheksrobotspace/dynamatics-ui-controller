import { apiClient } from '../../lib/api/api-client.js';
import { rowsFromEnvelope, type ApiEnvelope } from '../../lib/api/types.js';

export type PlanScheduleReadiness = {
	ok: boolean;
	errors: string[];
	warnings: string[];
};

type PlanDeliveryScheduleLinkRow = {
	delivery_schedule_id: string;
	plant_id: string;
	selected_lines?: Record<string, number> | null;
};

type DeliveryScheduleRow = {
	delivery_schedule_id: string;
	plant_id?: string | null;
};

type DeliveryScheduleLineRow = {
	delivery_schedule_line_id: string;
	delivery_schedule_id: string;
	bom_id: string;
	cp_run_id?: string | null;
};

export type BomScheduleGateRow = {
	bom_id: string;
	bom_name?: string | null;
	ocr_status?: string | null;
	cp_status?: string | null;
};

type PublishedCpRunRow = {
	bom_id: string;
	run_id: string;
};

const OCR_READY_FOR_SCHEDULING = new Set(['verified', 'action_needed']);

function idListParam(ids: string[]): string {
	return ids.map((id) => encodeURIComponent(id)).join(',');
}

async function listByIds<T extends Record<string, unknown>>(
	entity: string,
	idColumn: string,
	ids: string[],
	select: string,
	signal?: AbortSignal
): Promise<T[]> {
	if (ids.length === 0) return [];
	const envelope = await apiClient.get<ApiEnvelope<T[]>>(
		apiClient.datahub(`${entity}?limit=5000&${idColumn}__in=${idListParam(ids)}&select=${select}`),
		{ signal }
	);
	return rowsFromEnvelope<T>(envelope.data);
}

function bomDisplayName(bom: BomScheduleGateRow): string {
	return bom.bom_name?.trim() || bom.bom_id;
}

/** Block reasons when a selected BOM is not ready for APS scheduling. */
export function bomScheduleBlockReasons(
	bom: BomScheduleGateRow,
	publishedCpBomIds: ReadonlySet<string>
): string[] {
	const reasons: string[] = [];
	const label = bomDisplayName(bom);

	const ocrStatus = bom.ocr_status ?? 'not_verified';
	if (!OCR_READY_FOR_SCHEDULING.has(ocrStatus)) {
		reasons.push(`${label}: complete Operations Count before scheduling.`);
	}

	const cpStatus = bom.cp_status ?? 'none';
	if (cpStatus !== 'planned') {
		reasons.push(`${label}: complete Cutting Plan before scheduling.`);
	} else if (!publishedCpBomIds.has(bom.bom_id)) {
		reasons.push(`${label}: publish a cutting plan version on All Runs before scheduling.`);
	}

	return reasons;
}

async function listPublishedCpRunsForBoms(
	bomIds: string[],
	signal?: AbortSignal
): Promise<PublishedCpRunRow[]> {
	if (bomIds.length === 0) return [];
	const envelope = await apiClient.get<ApiEnvelope<PublishedCpRunRow[]>>(
		apiClient.datahub(
			`cp_plan_runs?status=published&bom_id__in=${idListParam(bomIds)}&select=bom_id,run_id&limit=5000`
		),
		{ signal }
	);
	return rowsFromEnvelope(envelope.data);
}

async function appendSelectedBomReadinessErrors(
	bomIds: string[],
	errors: string[],
	signal?: AbortSignal
): Promise<void> {
	const uniqueIds = [...new Set(bomIds.filter(Boolean))];
	if (uniqueIds.length === 0) return;

	const [boms, publishedRuns] = await Promise.all([
		listByIds<BomScheduleGateRow>(
			'proj_boms',
			'bom_id',
			uniqueIds,
			'bom_id,bom_name,ocr_status,cp_status',
			signal
		),
		listPublishedCpRunsForBoms(uniqueIds, signal)
	]);

	const publishedCpBomIds = new Set(publishedRuns.map((row) => row.bom_id));
	const bomById = new Map(boms.map((bom) => [bom.bom_id, bom]));

	for (const bomId of uniqueIds) {
		const bom = bomById.get(bomId);
		if (!bom) {
			errors.push(`BOM ${bomId} not found.`);
			continue;
		}
		errors.push(...bomScheduleBlockReasons(bom, publishedCpBomIds));
	}
}

function collectPlantIds(
	rows: Array<{ plant_id?: string | null; delivery_schedule_id?: string }>,
	errors: string[]
): Set<string> {
	const plantIds = new Set<string>();
	for (const row of rows) {
		const plantId = row.plant_id?.trim();
		const id = row.delivery_schedule_id ? String(row.delivery_schedule_id) : '';
		if (!plantId) {
			errors.push(
				`Delivery schedule ${id} has no plant assigned. Save the manufacturing plan first.`
			);
			continue;
		}
		plantIds.add(plantId);
	}
	return plantIds;
}

function countUnpinnedLines(lines: Array<{ cp_run_id?: string | null }>): number {
	let unpinnedLines = 0;
	for (const line of lines) {
		if (!line.cp_run_id?.trim()) unpinnedLines += 1;
	}
	return unpinnedLines;
}

/** Pre-schedule checks for delivery-schedule manufacturing plans only. */
export async function loadPlanScheduleReadiness(
	planId: string,
	signal?: AbortSignal
): Promise<PlanScheduleReadiness> {
	const errors: string[] = [];
	const warnings: string[] = [];

	const linksEnv = await apiClient.get<ApiEnvelope<PlanDeliveryScheduleLinkRow[]>>(
		apiClient.datahub(
			`aps_delivery_schedules?plan_id=${encodeURIComponent(planId)}&select=delivery_schedule_id,plant_id,selected_lines&limit=5000`
		),
		{ signal }
	);
	const links = rowsFromEnvelope<PlanDeliveryScheduleLinkRow>(linksEnv.data);
	if (links.length === 0) {
		return {
			ok: false,
			errors: ['Add at least one delivery schedule before scheduling.'],
			warnings
		};
	}

	const scheduleIds = [...new Set(links.map((link) => link.delivery_schedule_id))];
	const [schedules, lines] = await Promise.all([
		listByIds<DeliveryScheduleRow>(
			'proj_delivery_schedules',
			'delivery_schedule_id',
			scheduleIds,
			'delivery_schedule_id,plant_id',
			signal
		),
		listByIds<DeliveryScheduleLineRow>(
			'proj_delivery_schedule_lines',
			'delivery_schedule_id',
			scheduleIds,
			'delivery_schedule_line_id,delivery_schedule_id,bom_id,cp_run_id',
			signal
		)
	]);

	const linesBySchedule = new Map<string, DeliveryScheduleLineRow[]>();
	for (const line of lines) {
		const bucket = linesBySchedule.get(line.delivery_schedule_id) ?? [];
		bucket.push(line);
		linesBySchedule.set(line.delivery_schedule_id, bucket);
	}

	const plantIds = collectPlantIds(schedules, errors);

	if (plantIds.size > 1) {
		errors.push(
			`Manufacturing plan spans multiple plants (${[...plantIds].join(', ')}). Use delivery schedules from one plant only.`
		);
	}

	const activeLines: DeliveryScheduleLineRow[] = [];
	for (const link of links) {
		const scheduleLines = linesBySchedule.get(link.delivery_schedule_id) ?? [];
		const selected = link.selected_lines ?? {};
		const selectedKeys = Object.keys(selected);
		const active =
			selectedKeys.length > 0
				? scheduleLines.filter((line) => selectedKeys.includes(line.delivery_schedule_line_id))
				: scheduleLines;
		activeLines.push(...active);
	}

	const unpinnedLines = countUnpinnedLines(activeLines);
	if (unpinnedLines > 0) {
		warnings.push(
			`${unpinnedLines} delivery schedule line(s) have no pinned cutting-plan run. Scheduling may mix CP versions.`
		);
	}

	await appendSelectedBomReadinessErrors(
		activeLines.map((line) => line.bom_id),
		errors,
		signal
	);

	return { ok: errors.length === 0, errors, warnings };
}
