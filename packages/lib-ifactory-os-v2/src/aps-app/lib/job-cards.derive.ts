import type { AccordionWithTableItem } from '@ifactory/ui-v2';
import { formatScheduleTaskLabel } from './production-schedule.derive.js';
import type {
	JobCardBundleGroup,
	JobCardCuttingBarRow,
	JobCardCuttingMarkTableRow,
	JobCardCuttingMarking,
	JobCardCuttingSummary,
	JobCardLoadingRow,
	JobCardRequisitionRow
} from './job-cards.types.js';

export type JobCardDrawingLineInput = {
	id: string;
	markNo: string;
	bomItemId?: string | null;
};

export type OcrDrawingInput = {
	bom_item_id?: string | null;
	bom_mark?: string | null;
	corrected_mark?: string | null;
	sketch_mark?: string | null;
	match_status?: string | null;
	page_id?: string | null;
	metadata?: {
		hole_images?: {
			full_page_file_id?: string | null;
		};
	} | null;
};

export type JobCardTaskInput = {
	task_id: string;
	task_kind?: string | null;
	step_code?: string | null;
	machine_id?: string | null;
	rm_id?: string | null;
	mark_no?: string | null;
	product?: string | null;
	qty?: number | null;
	unit_index?: number | null;
	bundle_index?: number | null;
	start_time?: string | null;
	end_time?: string | null;
};

export type SectionPlanInput = {
	section_plan_id: string;
	section: string;
	section_version: number;
};

export type SectionPlanBarInput = {
	bar_id?: string;
	section_plan_id: string;
	bar_index?: number | null;
	rmid?: string | null;
	rm_length_mm?: string | number | null;
	quantity?: number | null;
	markings?: Array<{ mark: string | null; length: number; quantity: number }> | null;
};

/** Letters after the first op, joined; template uses `HG` for heel grinding. */
export function operationLetters(stepCodes: string[]): string {
	return stepCodes
		.slice(1)
		.map((code) => (code === 'H' ? 'HG' : code))
		.join('');
}

export function parseBundles(value: unknown): JobCardBundleGroup[] {
	if (!Array.isArray(value)) return [];
	const groups: JobCardBundleGroup[] = [];
	for (const item of value) {
		if (!item || typeof item !== 'object') continue;
		const raw = item as { count?: unknown; pieces?: unknown };
		const pieces = Number(raw.pieces);
		if (!Number.isFinite(pieces)) continue;
		const count = Number(raw.count);
		groups.push({ count: Number.isFinite(count) ? count : 1, pieces });
	}
	return groups;
}

/** One group → just pieces; several → `4×6 + 1×2`. */
export function formatBundles(groups: JobCardBundleGroup[]): string {
	if (groups.length === 0) return '';
	if (groups.length === 1) return String(groups[0]!.pieces);
	return groups.map((group) => `${group.count}×${group.pieces}`).join(' + ');
}

/** Group steel requisition by stock-bar length (`rm_length_mm`), not mark cut length. */
export function groupSteelRequisition(
	section: string,
	lines: Array<{ lengthMm: number; totalPcs: number; totalWtKg: number }>
): JobCardRequisitionRow[] {
	const byLength = new Map<number, { quantity: number; weightKg: number }>();
	for (const line of lines) {
		const key = line.lengthMm;
		const current = byLength.get(key) ?? { quantity: 0, weightKg: 0 };
		current.quantity += line.totalPcs;
		current.weightKg += line.totalWtKg;
		byLength.set(key, current);
	}
	return [...byLength.entries()]
		.sort((a, b) => b[0] - a[0])
		.map(([lengthMm, totals]) => ({
			id: String(lengthMm),
			section,
			lengthMm,
			quantity: totals.quantity,
			weightKg: totals.weightKg
		}));
}

function lengthFromRmId(rmId: string): number | null {
	const parts = rmId.split('-');
	if (parts.length < 2) return null;
	const length = Number(parts[parts.length - 2]);
	return Number.isFinite(length) && length > 0 ? length : null;
}

function loadingMaterialId(task: JobCardTaskInput): string {
	const rmId = task.rm_id?.trim();
	if (task.task_kind !== 'bundle' && rmId) return rmId;
	return formatScheduleTaskLabel(task);
}

function loadingLengthMm(
	task: JobCardTaskInput,
	lengthByRmId: Map<string, number>,
	lengthByMark: Map<string, number>
): number | null {
	if (task.task_kind === 'bundle') {
		const mark = task.mark_no?.trim();
		if (mark && lengthByMark.has(mark)) return lengthByMark.get(mark) ?? null;
	}
	const rmId = task.rm_id?.trim();
	if (rmId && lengthByRmId.has(rmId)) return lengthByRmId.get(rmId) ?? null;
	return rmId ? lengthFromRmId(rmId) : null;
}

/** Collapse bars of the same RM (or the same bundle) on one machine+op into one row. */
export function buildMachineLoadingRows(
	tasks: JobCardTaskInput[],
	machineNameById: Map<string, string>,
	formatTime: (iso: string) => string,
	lengthByRmId: Map<string, number> = new Map(),
	lengthByMark: Map<string, number> = new Map()
): JobCardLoadingRow[] {
	const groups = new Map<
		string,
		{
			id: string;
			machineId: string;
			materialId: string;
			lengthMm: number | null;
			operation: string;
			qty: number;
			start: string;
			end: string;
		}
	>();

	for (const task of tasks) {
		const machineId = task.machine_id?.trim();
		const start = task.start_time?.trim();
		if (!machineId || !start) continue;
		const operation = task.step_code?.trim() || '';
		const materialId = loadingMaterialId(task);
		const key = `${machineId}\t${operation}\t${materialId}`;
		const qtyRaw = Number(task.qty);
		const qty = Number.isFinite(qtyRaw) && qtyRaw > 0 ? qtyRaw : 1;
		const end = task.end_time?.trim() ?? start;
		const current = groups.get(key);
		if (!current) {
			groups.set(key, {
				id: task.task_id,
				machineId,
				materialId,
				lengthMm: loadingLengthMm(task, lengthByRmId, lengthByMark),
				operation,
				qty,
				start,
				end
			});
			continue;
		}
		current.qty += qty;
		if (start < current.start) current.start = start;
		if (end > current.end) current.end = end;
	}

	return [...groups.values()]
		.sort((a, b) => a.start.localeCompare(b.start) || a.machineId.localeCompare(b.machineId))
		.map((row) => ({
			id: row.id,
			machineId: row.machineId,
			machineName: machineNameById.get(row.machineId) ?? row.machineId,
			plannedStart: formatTime(row.start),
			plannedEnd: formatTime(row.end),
			materialId: row.materialId,
			lengthMm: row.lengthMm,
			operation: row.operation,
			qty: row.qty
		}));
}

export function pickSectionPlans(
	plans: SectionPlanInput[],
	cardSection: string
): SectionPlanInput[] {
	const prefix = cardSection.trim();
	if (!prefix) return [];
	const matched = plans.filter((plan) => plan.section.startsWith(prefix));
	if (matched.length === 0) return [];
	const maxVersion = Math.max(...matched.map((plan) => plan.section_version));
	return matched.filter((plan) => plan.section_version === maxVersion);
}

export function filterBarsByRmIds(
	bars: SectionPlanBarInput[],
	rmIds: ReadonlySet<string>
): SectionPlanBarInput[] {
	if (rmIds.size === 0) return bars;
	const filtered = bars.filter((bar) => {
		const rmid = bar.rmid?.trim();
		return Boolean(rmid && rmIds.has(rmid));
	});
	return filtered.length > 0 ? filtered : bars;
}

export function unitWeightKgPerM(
	lines: Array<{ wtPerPieceKg: number; lengthMm: number }>
): number | null {
	const line = lines.find((row) => row.lengthMm > 0 && row.wtPerPieceKg > 0);
	if (!line) return null;
	return line.wtPerPieceKg / (line.lengthMm / 1000);
}

export function parseMarkingItems(
	markings: Array<{ mark: string | null; length: number; quantity: number }> | null | undefined
): JobCardCuttingMarking[] {
	if (!markings?.length) return [];
	return markings.map((item) => ({
		mark: (item.mark ?? '').trim(),
		lengthMm: Number(item.length) || 0,
		quantity: Number(item.quantity) || 0
	}));
}

export function markingLabel(item: JobCardCuttingMarking): string {
	return item.quantity > 0 ? `${item.mark} x${item.quantity}`.trim() : item.mark;
}

export function formatMarkings(
	markings: Array<{ mark: string | null; length: number; quantity: number }> | null | undefined
): string {
	return parseMarkingItems(markings).map(markingLabel).join(', ');
}

export function mapCuttingBar(
	bar: SectionPlanBarInput,
	numSets: number,
	unitKgM: number | null,
	id: string
): JobCardCuttingBarRow {
	const lengthMm = Number(bar.rm_length_mm);
	const safeLength = Number.isFinite(lengthMm) ? lengthMm : 0;
	const quantity = (bar.quantity ?? 0) * numSets;
	const markingItems = parseMarkingItems(bar.markings);
	const usedMm = markingItems.reduce((sum, item) => sum + item.lengthMm * item.quantity, 0);
	const wasteMm = safeLength - usedMm;
	const wastePct = safeLength > 0 ? Math.round((wasteMm / safeLength) * 10000) / 100 : 0;
	const wasteKg = unitKgM == null ? 0 : (wasteMm / 1000) * unitKgM;
	const weightKg = unitKgM == null ? 0 : (safeLength / 1000) * unitKgM;
	return {
		id,
		rmid: bar.rmid?.trim() || '-',
		lengthMm: safeLength,
		quantity,
		markings: markingItems.map(markingLabel).join(', '),
		markingItems,
		usedMm,
		wasteMm,
		wastePct,
		wasteKg,
		weightKg
	};
}

export function toCuttingPlanAccordionItems(
	rows: JobCardCuttingBarRow[]
): AccordionWithTableItem<JobCardCuttingMarkTableRow>[] {
	return rows.map((row, index) => {
		const markCount = row.markingItems.length;
		return {
			value: row.id,
			label: row.rmid,
			description: `${markCount} mark number${markCount === 1 ? '' : 's'}`,
			stats: [
				{
					label: 'RM Length',
					value: `${row.lengthMm} mm`,
					badgeVariant: 'secondary'
				},
				{
					label: 'Quantity',
					value: `${row.quantity} ${row.quantity === 1 ? 'bar' : 'bars'}`,
					badgeVariant: 'default'
				}
			],
			defaultOpen: index === 0,
			rowLabel: 'mark numbers',
			rows: row.markingItems.map((item, markIndex) => ({
				id: `${row.id}-m${markIndex}`,
				markNo: item.mark,
				lengthMm: item.lengthMm,
				pcsPerBar: item.quantity
			}))
		};
	});
}

export function cuttingSummary(rows: JobCardCuttingBarRow[]): JobCardCuttingSummary | null {
	if (rows.length === 0) return null;
	const quantity = rows.reduce((sum, row) => sum + row.quantity, 0);
	const wasteKg = rows.reduce((sum, row) => sum + row.wasteKg, 0);
	const weightKg = rows.reduce((sum, row) => sum + row.weightKg, 0);
	const denom = wasteKg + weightKg;
	return {
		quantity,
		wasteKg,
		weightKg,
		wastePct: denom > 0 ? Math.round((wasteKg / denom) * 10000) / 100 : 0
	};
}

function drawingFileId(
	result: OcrDrawingInput,
	pageImageById: ReadonlyMap<string, string>
): string | null {
	if (result.match_status === 'not_in_pdf') return null;
	const pageId = result.page_id?.trim();
	if (pageId) {
		const pageImage = pageImageById.get(pageId)?.trim();
		if (pageImage) return pageImage;
	}
	return result.metadata?.hole_images?.full_page_file_id?.trim() || null;
}

function pushIndexed(
	map: Map<string, OcrDrawingInput[]>,
	key: string | null | undefined,
	result: OcrDrawingInput
): void {
	const trimmed = key?.trim();
	if (!trimmed) return;
	const bucket = map.get(trimmed) ?? [];
	bucket.push(result);
	map.set(trimmed, bucket);
}

/** Uppercase + collapse spaces; also index the last token (e.g. `1810H` from `JA49 DA 1810H`). */
export function markLookupKeys(mark: string | null | undefined): string[] {
	const normalized = mark?.trim().toUpperCase().replace(/\s+/g, ' ');
	if (!normalized) return [];
	const keys = [normalized];
	const parts = normalized.split(' ');
	const last = parts[parts.length - 1];
	if (last && last !== normalized) keys.push(last);
	return keys;
}

function indexOcrResultByMark(
	byMark: Map<string, OcrDrawingInput[]>,
	result: OcrDrawingInput
): void {
	for (const mark of [result.bom_mark, result.corrected_mark, result.sketch_mark]) {
		for (const key of markLookupKeys(mark)) {
			pushIndexed(byMark, key, result);
		}
	}
}

function ocrCandidatesForLine(
	line: JobCardDrawingLineInput,
	byItemId: Map<string, OcrDrawingInput[]>,
	byMark: Map<string, OcrDrawingInput[]>
): OcrDrawingInput[] {
	const itemId = line.bomItemId?.trim();
	const byId = itemId ? byItemId.get(itemId) : undefined;
	if (byId && byId.length > 0) return byId;
	for (const key of markLookupKeys(line.markNo)) {
		const hit = byMark.get(key);
		if (hit && hit.length > 0) return hit;
	}
	return [];
}

function indexOcrResults(results: OcrDrawingInput[]): {
	byItemId: Map<string, OcrDrawingInput[]>;
	byMark: Map<string, OcrDrawingInput[]>;
} {
	const byItemId = new Map<string, OcrDrawingInput[]>();
	const byMark = new Map<string, OcrDrawingInput[]>();
	for (const result of results) {
		pushIndexed(byItemId, result.bom_item_id, result);
		indexOcrResultByMark(byMark, result);
	}
	return { byItemId, byMark };
}

/**
 * Page ids needed for this card's marks only — not every page in the BOM verification
 * (avoids 431 on huge `page_id__in` URLs).
 */
export function pageIdsForJobCardDrawings(
	lines: JobCardDrawingLineInput[],
	results: OcrDrawingInput[]
): string[] {
	const { byItemId, byMark } = indexOcrResults(results);
	const ids = new Set<string>();
	for (const line of lines) {
		for (const result of ocrCandidatesForLine(line, byItemId, byMark)) {
			if (result.match_status === 'not_in_pdf') continue;
			const pageId = result.page_id?.trim();
			if (pageId) ids.add(pageId);
		}
	}
	return [...ids];
}

/** One full drawing page per job-card line. Skip `not_in_pdf` / no page image. */
export function toJobCardDrawings(
	lines: JobCardDrawingLineInput[],
	results: OcrDrawingInput[],
	pageImageById: ReadonlyMap<string, string> = new Map()
): Array<{ id: string; markNo: string; fileId: string }> {
	const { byItemId, byMark } = indexOcrResults(results);
	const drawings: Array<{ id: string; markNo: string; fileId: string }> = [];
	for (const line of lines) {
		const candidates = ocrCandidatesForLine(line, byItemId, byMark);
		let fileId: string | null = null;
		for (const result of candidates) {
			fileId = drawingFileId(result, pageImageById);
			if (fileId) break;
		}
		if (!fileId) continue;
		drawings.push({ id: line.id, markNo: line.markNo, fileId });
	}
	return drawings;
}
