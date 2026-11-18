import type { TreeTableNode } from '@ifactory/ui-v2';
import { apiClient } from '../../lib/api/api-client.js';
import { rowsFromEnvelope, type ApiEnvelope } from '../../lib/api/types.js';
import { rememberManufacturingPlanLabel } from './manufacturing-plans.js';
import type {
	ReviewInputPartRow,
	ReviewInputPlanDetail,
	ReviewInputSummary
} from './review-input.types.js';

type PlanRow = {
	plan_id: string;
	name?: string | null;
	created_at?: string;
	summary?: Record<string, unknown>;
};

type PlanProductionPlanLinkRow = {
	aps_production_plan_id: string;
	plan_id: string;
	project_id: string;
	production_plan_id: string;
	selected_lines?: Record<string, number> | null;
};

type PlanDeliveryScheduleLinkRow = {
	aps_delivery_schedule_id: string;
	plan_id: string;
	project_id: string;
	delivery_schedule_id: string;
	selected_lines?: Record<string, number> | null;
};

type DeliveryScheduleRow = {
	delivery_schedule_id: string;
	name?: string | null;
	delivery_date: string;
};

type DeliveryScheduleLineRow = {
	delivery_schedule_line_id: string;
	delivery_schedule_id: string;
	bom_id: string;
	quantity: number;
	cp_run_id?: string | null;
};

type ReviewInputBundleLink = {
	treeRootId: string;
	project_id: string;
	woLabel: string;
	activeLines: Array<{ bom_id: string; cp_run_id?: string | null }>;
};

type ProjectRow = {
	project_id: string;
	name: string;
	metadata?: Record<string, unknown>;
};

type ProjProductionPlanRow = {
	production_plan_id: string;
	project_id: string;
	plan_name: string;
};

type ProductionPlanLineRow = {
	production_plan_line_id: string;
	production_plan_id: string;
	bom_id: string;
	quantity: number;
	cp_run_id?: string | null;
};

type BomItemRow = {
	bom_item_id: string;
	bom_id: string;
	mark_no: string;
	section: string | null;
	length_mm: number | string | null;
	section_thickness_mm: number | string | null;
	num_pieces: number | string | null;
	remark: string | null;
};

type CpPlanRunRow = {
	run_id: string;
	bom_id: string;
	status: string;
	section_plan_ids?: string[];
	version?: number;
};

type CpSectionPlanRow = {
	section_plan_id: string;
	bom_id: string;
	section: string;
};

type CpSectionPlanBarRow = {
	section_plan_id: string;
	bar_index: number;
	rmid?: string | null;
	rm_length_mm: number | string | null;
	quantity?: number | null;
	markings?: Array<{ mark: string | null; length: number; quantity: number }>;
};

type OcrResultRow = {
	bom_item_id?: string | null;
	bom_mark?: string | null;
	hole_count?: number | null;
	corrected_hole_count?: number | null;
};

function idListParam(ids: string[]): string {
	return ids.map((id) => encodeURIComponent(id)).join(',');
}

function num(value: number | string | null | undefined): number {
	if (value === null || value === undefined || value === '') return 0;
	const n = typeof value === 'number' ? value : Number(value);
	return Number.isFinite(n) ? n : 0;
}

function formatLengthMm(mm: number): string {
	return String(mm);
}

function formatCreatedAt(iso: string | undefined): string {
	if (!iso) return '-';
	const parsed = new Date(iso);
	if (Number.isNaN(parsed.getTime())) return iso.slice(0, 10);
	return parsed.toLocaleDateString('en-CA', { timeZone: 'UTC' });
}

function workOrderCode(metadata: Record<string, unknown> | undefined): string {
	const value = metadata?.work_order_no;
	return typeof value === 'string' ? value.trim() : '';
}

/** Interim process label: thickness gate + remark letters (APS design §10). */
function decodeProcess(thicknessMm: number, remark: string | null | undefined): string {
	const steps = [thicknessMm > 12 ? 'CDS' : 'CPS'];
	for (const ch of (remark ?? '').toUpperCase()) {
		if (ch === 'N' || ch === 'B' || ch === 'H') steps.push(ch);
	}
	return steps.join('→');
}

async function getPlan(planId: string, signal?: AbortSignal): Promise<PlanRow | undefined> {
	const select = 'plan_id,name,created_at,summary';
	const envelope = await apiClient.get<ApiEnvelope<PlanRow[]>>(
		apiClient.datahub(
			`aps_manufacturing_plans?plan_id=${encodeURIComponent(planId)}&select=${select}&limit=1`
		),
		{ signal }
	);
	return rowsFromEnvelope<PlanRow>(envelope.data)[0];
}

async function listPlanProductionPlans(
	planId: string,
	signal?: AbortSignal
): Promise<PlanProductionPlanLinkRow[]> {
	const select = 'aps_production_plan_id,plan_id,project_id,production_plan_id,selected_lines';
	const envelope = await apiClient.get<ApiEnvelope<PlanProductionPlanLinkRow[]>>(
		apiClient.datahub(
			`aps_production_plans?plan_id=${encodeURIComponent(planId)}&select=${select}&limit=5000`
		),
		{ signal }
	);
	return rowsFromEnvelope<PlanProductionPlanLinkRow>(envelope.data);
}

async function listPlanDeliverySchedules(
	planId: string,
	signal?: AbortSignal
): Promise<PlanDeliveryScheduleLinkRow[]> {
	const select = 'aps_delivery_schedule_id,plan_id,project_id,delivery_schedule_id,selected_lines';
	const envelope = await apiClient.get<ApiEnvelope<PlanDeliveryScheduleLinkRow[]>>(
		apiClient.datahub(
			`aps_delivery_schedules?plan_id=${encodeURIComponent(planId)}&select=${select}&limit=5000`
		),
		{ signal }
	);
	return rowsFromEnvelope<PlanDeliveryScheduleLinkRow>(envelope.data);
}

function formatDeliveryScheduleLabel(
	name: string | null | undefined,
	deliveryDate: string
): string {
	const datePart = deliveryDate.slice(0, 10);
	const [year, month, day] = datePart.split('-');
	const dateLabel = year && month && day ? `${day}-${month}-${year}` : deliveryDate;
	const trimmedName = name?.trim();
	return trimmedName ? `${trimmedName} - ${dateLabel}` : dateLabel;
}

/** Keep `__in=` query strings under proxy/header limits (Vite/Node 431). */
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

async function listByIds<T extends Record<string, unknown>>(
	entity: string,
	idColumn: string,
	ids: string[],
	select: string,
	signal?: AbortSignal
): Promise<T[]> {
	if (ids.length === 0) return [];
	const rows: T[] = [];
	for (const chunk of chunkIds(ids)) {
		const envelope = await apiClient.get<ApiEnvelope<T[]>>(
			apiClient.datahub(
				`${entity}?limit=5000&${idColumn}__in=${idListParam(chunk)}&select=${select}`
			),
			{ signal }
		);
		rows.push(...rowsFromEnvelope<T>(envelope.data));
	}
	return rows;
}

/** Resolve section_plan_ids per BOM from pinned cp_run_id on plan lines (fallback: latest completed). */
async function sectionPlanIdsByBomFromLines(
	lines: Array<{ bom_id: string; cp_run_id?: string | null }>,
	signal?: AbortSignal
): Promise<Map<string, string[]>> {
	const byBom = new Map<string, string[]>();
	const cpRunIds = [
		...new Set(
			lines.map((line) => line.cp_run_id?.trim()).filter((id): id is string => Boolean(id))
		)
	];

	const cpRunById = new Map<string, CpPlanRunRow>();
	if (cpRunIds.length > 0) {
		const rows = await listByIds<CpPlanRunRow>(
			'cp_plan_runs',
			'run_id',
			cpRunIds,
			'run_id,bom_id,status,section_plan_ids,version',
			signal
		);
		for (const row of rows) {
			cpRunById.set(row.run_id, row);
		}
	}

	const bomIdsNeedingFallback = new Set<string>();
	for (const line of lines) {
		const cpRunId = line.cp_run_id?.trim();
		if (cpRunId) {
			const run = cpRunById.get(cpRunId);
			if (run) {
				byBom.set(line.bom_id, run.section_plan_ids ?? []);
				continue;
			}
		}
		bomIdsNeedingFallback.add(line.bom_id);
	}

	if (bomIdsNeedingFallback.size > 0) {
		const fallback = await latestSectionPlanIdsByBom([...bomIdsNeedingFallback], signal);
		for (const [bomId, sectionPlanIds] of fallback) {
			if (!byBom.has(bomId)) byBom.set(bomId, sectionPlanIds);
		}
	}

	return byBom;
}

/** Latest completed CP run per BOM → section_plan_ids. */
async function latestSectionPlanIdsByBom(
	bomIds: string[],
	signal?: AbortSignal
): Promise<Map<string, string[]>> {
	const byBom = new Map<string, string[]>();
	if (bomIds.length === 0) return byBom;

	const select = 'run_id,bom_id,status,section_plan_ids,version';
	for (const chunk of chunkIds(bomIds)) {
		const envelope = await apiClient.get<ApiEnvelope<CpPlanRunRow[]>>(
			apiClient.datahub(
				`cp_plan_runs?limit=5000&bom_id__in=${idListParam(chunk)}&status=completed&orderBy=version:desc&select=${select}`
			),
			{ signal }
		);

		for (const row of rowsFromEnvelope<CpPlanRunRow>(envelope.data)) {
			if (byBom.has(row.bom_id)) continue;
			byBom.set(row.bom_id, row.section_plan_ids ?? []);
		}
	}
	return byBom;
}

function normalizeSectionLabel(section: string | null | undefined): string {
	return section?.trim() || 'Unknown section';
}

function bomItemMarkLeaf(
	link: ReviewInputBundleLink,
	bomId: string,
	item: BomItemRow,
	holesByBomItemId: Map<string, number>,
	holesByMark: Map<string, number>
): TreeTableNode<ReviewInputPartRow> {
	const markName = item.mark_no.trim();
	const holes =
		holesByBomItemId.get(item.bom_item_id) ??
		(markName ? holesByMark.get(markName.toUpperCase()) : undefined);
	return {
		id: `${link.treeRootId}-${bomId}-${item.bom_item_id}`,
		label: markName || item.bom_item_id,
		data: {
			markLength: item.length_mm != null ? formatLengthMm(num(item.length_mm)) : undefined,
			qty: item.num_pieces != null ? String(num(item.num_pieces)) : undefined,
			holes: holes != null ? String(holes) : undefined,
			process: decodeProcess(num(item.section_thickness_mm), item.remark)
		}
	};
}

/** Builds Review Input tree nodes; exported for unit tests. */
export function buildReviewInputTreeNodes(args: {
	bundleLinks: ReviewInputBundleLink[];
	itemsByBom: Map<string, BomItemRow[]>;
	barsByBomSection: Map<string, CpSectionPlanBarRow[]>;
	holesByBomItemId: Map<string, number>;
	holesByMark: Map<string, number>;
}): TreeTableNode<ReviewInputPartRow>[] {
	const { bundleLinks, itemsByBom, barsByBomSection, holesByBomItemId, holesByMark } = args;

	const nodes: TreeTableNode<ReviewInputPartRow>[] = [];

	for (const link of bundleLinks) {
		const sectionNodes: TreeTableNode<ReviewInputPartRow>[] = [];
		const activeBomIds = new Set(link.activeLines.map((line) => line.bom_id));
		const cpSectionsByBom = new Map<string, Set<string>>();

		for (const [sectionKey, bars] of barsByBomSection) {
			if (bars.length === 0) continue;
			const sep = sectionKey.indexOf('::');
			if (sep < 0) continue;
			const bomId = sectionKey.slice(0, sep);
			const section = sectionKey.slice(sep + 2);
			if (!activeBomIds.has(bomId)) continue;

			const items = itemsByBom.get(bomId) ?? [];
			const itemByMark = new Map(items.map((item) => [item.mark_no.trim().toUpperCase(), item]));

			const rmNodes: TreeTableNode<ReviewInputPartRow>[] = [];
			for (const bar of bars) {
				const barKey = `${sectionKey}-bar-${bar.bar_index}`;
				const rmid = (bar.rmid ?? '').trim() || `bar-${bar.bar_index}`;
				const rmLenMm = num(bar.rm_length_mm);
				const lengthLabel = formatLengthMm(rmLenMm);
				const markings = Array.isArray(bar.markings) ? bar.markings : [];
				const barQty = bar.quantity ?? 1;

				const markLeaves: TreeTableNode<ReviewInputPartRow>[] = [];
				for (let markIndex = 0; markIndex < markings.length; markIndex++) {
					const marking = markings[markIndex];
					const markName = (marking.mark ?? '').trim();
					if (!markName) continue;
					const item = itemByMark.get(markName.toUpperCase());
					const holes =
						(item && holesByBomItemId.get(item.bom_item_id)) ??
						holesByMark.get(markName.toUpperCase());
					const qty = marking.quantity * barQty;
					markLeaves.push({
						id: `${barKey}-m-${markIndex}`,
						label: markName,
						data: {
							markLength: formatLengthMm(marking.length),
							qty: String(qty),
							holes: holes != null ? String(holes) : undefined,
							process: item ? decodeProcess(num(item.section_thickness_mm), item.remark) : undefined
						}
					});
				}

				if (markLeaves.length === 0) continue;

				rmNodes.push({
					id: barKey,
					label: rmid,
					children: [
						{
							id: `${barKey}-len`,
							label: lengthLabel,
							children: [
								{
									id: `${barKey}-g1`,
									label: 'Group 1',
									children: markLeaves
								}
							]
						}
					]
				});
			}

			if (rmNodes.length === 0) continue;

			const sectionLabel = normalizeSectionLabel(section);
			let cpSections = cpSectionsByBom.get(bomId);
			if (!cpSections) {
				cpSections = new Set();
				cpSectionsByBom.set(bomId, cpSections);
			}
			cpSections.add(sectionLabel);

			sectionNodes.push({
				id: sectionKey,
				label: sectionLabel,
				children: rmNodes
			});
		}

		// BOMs without CP bars (or sections missing from CP) still appear as flat mark lists.
		for (const bomId of activeBomIds) {
			const items = itemsByBom.get(bomId) ?? [];
			if (items.length === 0) continue;

			const coveredSections = cpSectionsByBom.get(bomId) ?? new Set<string>();
			const bySection = new Map<string, BomItemRow[]>();
			for (const item of items) {
				const sectionLabel = normalizeSectionLabel(item.section);
				const bucket = bySection.get(sectionLabel) ?? [];
				bucket.push(item);
				bySection.set(sectionLabel, bucket);
			}

			for (const [sectionLabel, sectionItems] of bySection) {
				if (coveredSections.has(sectionLabel)) continue;

				const markLeaves = sectionItems.map((item) =>
					bomItemMarkLeaf(link, bomId, item, holesByBomItemId, holesByMark)
				);
				if (markLeaves.length === 0) continue;

				sectionNodes.push({
					id: `${link.treeRootId}-${bomId}-bom-${sectionLabel}`,
					label: sectionLabel,
					children: markLeaves
				});
			}
		}

		if (sectionNodes.length === 0) {
			if (link.activeLines.length === 0) continue;
			sectionNodes.push({
				id: `${link.treeRootId}-no-data`,
				label: 'No marks for selected BOMs',
				children: [
					{
						id: `${link.treeRootId}-no-data-hint`,
						label: 'Verify BOM items or complete cutting plan',
						data: {}
					}
				]
			});
		}

		nodes.push({
			id: link.treeRootId,
			label: link.woLabel,
			children: sectionNodes
		});
	}

	return nodes;
}

function countMarks(nodes: TreeTableNode<ReviewInputPartRow>[]): number {
	let count = 0;
	const walk = (list: TreeTableNode<ReviewInputPartRow>[]) => {
		for (const node of list) {
			if (node.children?.length) walk(node.children);
			else count += 1;
		}
	};
	walk(nodes);
	return count;
}

function buildSummary(
	plan: PlanRow,
	releaseLabel: string,
	nodes: TreeTableNode<ReviewInputPartRow>[]
): ReviewInputSummary {
	const woLabels = new Set(nodes.map((n) => n.label));

	return {
		releaseLabel,
		createdAt: formatCreatedAt(plan.created_at),
		workOrderCount: woLabels.size,
		markCount: countMarks(nodes)
	};
}

async function composeReviewInputTree(
	plan: PlanRow,
	releaseLabel: string,
	bundleLinks: ReviewInputBundleLink[],
	signal?: AbortSignal
): Promise<ReviewInputPlanDetail> {
	if (bundleLinks.length === 0) {
		return {
			summary: buildSummary(plan, releaseLabel, []),
			nodes: []
		};
	}

	const bomIds = new Set<string>();
	const activeLines: Array<{ bom_id: string; cp_run_id?: string | null }> = [];
	for (const link of bundleLinks) {
		for (const line of link.activeLines) {
			bomIds.add(line.bom_id);
			activeLines.push(line);
		}
	}

	const bomIdList = [...bomIds];
	const bomItems = await listByIds<BomItemRow>(
		'proj_bom_items',
		'bom_id',
		bomIdList,
		'bom_item_id,bom_id,mark_no,section,length_mm,section_thickness_mm,num_pieces,remark',
		signal
	);

	const itemsByBom = new Map<string, BomItemRow[]>();
	for (const item of bomItems) {
		const bucket = itemsByBom.get(item.bom_id) ?? [];
		bucket.push(item);
		itemsByBom.set(item.bom_id, bucket);
	}

	const sectionPlanIdsByBom = await sectionPlanIdsByBomFromLines(activeLines, signal);
	const allSectionPlanIds = [...new Set([...sectionPlanIdsByBom.values()].flat())];

	const [sectionPlans, bars] = await Promise.all([
		listByIds<CpSectionPlanRow>(
			'cp_section_plans',
			'section_plan_id',
			allSectionPlanIds,
			'section_plan_id,bom_id,section',
			signal
		),
		listByIds<CpSectionPlanBarRow>(
			'cp_section_plan_bars',
			'section_plan_id',
			allSectionPlanIds,
			'section_plan_id,bar_index,rmid,rm_length_mm,quantity,markings',
			signal
		)
	]);

	const sectionByPlanId = new Map(sectionPlans.map((p) => [p.section_plan_id, p]));
	const barsByBomSection = new Map<string, CpSectionPlanBarRow[]>();
	for (const bar of bars) {
		const sectionPlan = sectionByPlanId.get(bar.section_plan_id);
		if (!sectionPlan) continue;
		const key = `${sectionPlan.bom_id}::${sectionPlan.section}`;
		const bucket = barsByBomSection.get(key) ?? [];
		bucket.push(bar);
		barsByBomSection.set(key, bucket);
	}
	for (const list of barsByBomSection.values()) {
		list.sort((a, b) => a.bar_index - b.bar_index);
	}

	const bomItemIds = bomItems.map((i) => i.bom_item_id);
	const holesByBomItemId = new Map<string, number>();
	const holesByMark = new Map<string, number>();
	if (bomItemIds.length > 0) {
		const ocrRows = await listByIds<OcrResultRow>(
			'ocr_results',
			'bom_item_id',
			bomItemIds,
			'bom_item_id,bom_mark,hole_count,corrected_hole_count',
			signal
		);
		for (const row of ocrRows) {
			const holes = row.corrected_hole_count ?? row.hole_count;
			if (holes == null) continue;
			if (row.bom_item_id) holesByBomItemId.set(row.bom_item_id, holes);
			if (row.bom_mark) holesByMark.set(row.bom_mark.trim().toUpperCase(), holes);
		}
	}

	const nodes = buildReviewInputTreeNodes({
		bundleLinks,
		itemsByBom,
		barsByBomSection,
		holesByBomItemId,
		holesByMark
	});

	return {
		summary: buildSummary(plan, releaseLabel, nodes),
		nodes
	};
}

async function loadReviewInputFromDeliverySchedules(
	plan: PlanRow,
	planId: string,
	signal?: AbortSignal
): Promise<ReviewInputPlanDetail | null> {
	const bundleLinks = await bundleLinksFromDeliverySchedules(planId, signal);
	if (!bundleLinks) return null;

	const dsLinks = await listPlanDeliverySchedules(planId, signal);
	const schedules = await listByIds<DeliveryScheduleRow>(
		'proj_delivery_schedules',
		'delivery_schedule_id',
		[...new Set(dsLinks.map((l) => l.delivery_schedule_id))],
		'delivery_schedule_id,name,delivery_date',
		signal
	);

	return composeReviewInputTree(
		plan,
		releaseLabelFromDeliverySchedules(schedules),
		bundleLinks,
		signal
	);
}

async function bundleLinksFromDeliverySchedules(
	planId: string,
	signal?: AbortSignal
): Promise<ReviewInputBundleLink[] | null> {
	const dsLinks = await listPlanDeliverySchedules(planId, signal);
	if (dsLinks.length === 0) return null;

	const scheduleIds = [...new Set(dsLinks.map((link) => link.delivery_schedule_id))];
	const projectIds = [...new Set(dsLinks.map((link) => link.project_id))];

	const [projects, schedules, lines] = await Promise.all([
		listByIds<ProjectRow>(
			'proj_projects',
			'project_id',
			projectIds,
			'project_id,name,metadata',
			signal
		),
		listByIds<DeliveryScheduleRow>(
			'proj_delivery_schedules',
			'delivery_schedule_id',
			scheduleIds,
			'delivery_schedule_id,name,delivery_date',
			signal
		),
		listByIds<DeliveryScheduleLineRow>(
			'proj_delivery_schedule_lines',
			'delivery_schedule_id',
			scheduleIds,
			'delivery_schedule_line_id,delivery_schedule_id,bom_id,quantity,cp_run_id',
			signal
		)
	]);

	const projectById = new Map(projects.map((p) => [p.project_id, p]));
	const scheduleById = new Map(schedules.map((s) => [s.delivery_schedule_id, s]));
	const linesBySchedule = new Map<string, DeliveryScheduleLineRow[]>();
	for (const line of lines) {
		const bucket = linesBySchedule.get(line.delivery_schedule_id) ?? [];
		bucket.push(line);
		linesBySchedule.set(line.delivery_schedule_id, bucket);
	}

	return dsLinks.flatMap((link) => {
		const project = projectById.get(link.project_id);
		if (!project) return [];

		const schedule = scheduleById.get(link.delivery_schedule_id);
		const scheduleLabel = schedule
			? formatDeliveryScheduleLabel(schedule.name, schedule.delivery_date)
			: link.delivery_schedule_id;
		const code = workOrderCode(project.metadata);
		const woLabel = code
			? `${code} ${project.name} · ${scheduleLabel}`
			: `${project.name} · ${scheduleLabel}`;

		const scheduleLines = linesBySchedule.get(link.delivery_schedule_id) ?? [];
		const selected = link.selected_lines ?? {};
		const selectedKeys = Object.keys(selected);
		const activeLines =
			selectedKeys.length > 0
				? scheduleLines.filter((line) => selectedKeys.includes(line.delivery_schedule_line_id))
				: scheduleLines;

		return [
			{
				treeRootId: `${link.project_id}-${link.delivery_schedule_id}`,
				project_id: link.project_id,
				woLabel,
				activeLines
			}
		];
	});
}

async function bundleLinksFromProductionPlans(
	planId: string,
	signal?: AbortSignal
): Promise<ReviewInputBundleLink[]> {
	const planLinks = await listPlanProductionPlans(planId, signal);
	if (planLinks.length === 0) return [];

	const projectIds = [...new Set(planLinks.map((l) => l.project_id))];
	const productionPlanIds = [...new Set(planLinks.map((l) => l.production_plan_id))];

	const [projects, lines] = await Promise.all([
		listByIds<ProjectRow>(
			'proj_projects',
			'project_id',
			projectIds,
			'project_id,name,metadata',
			signal
		),
		listByIds<ProductionPlanLineRow>(
			'proj_production_plan_lines',
			'production_plan_id',
			productionPlanIds,
			'production_plan_line_id,production_plan_id,bom_id,quantity,cp_run_id',
			signal
		)
	]);

	const projectById = new Map(projects.map((p) => [p.project_id, p]));
	const linesByProductionPlan = new Map<string, ProductionPlanLineRow[]>();
	for (const line of lines) {
		const bucket = linesByProductionPlan.get(line.production_plan_id) ?? [];
		bucket.push(line);
		linesByProductionPlan.set(line.production_plan_id, bucket);
	}

	return planLinks.flatMap((link) => {
		const project = projectById.get(link.project_id);
		if (!project) return [];

		const code = workOrderCode(project.metadata);
		const woLabel = code ? `${code} ${project.name}` : project.name;

		const planLines = linesByProductionPlan.get(link.production_plan_id) ?? [];
		const selected = link.selected_lines ?? {};
		const selectedKeys = Object.keys(selected);
		const activeLines =
			selectedKeys.length > 0
				? planLines.filter((line) => selectedKeys.includes(line.production_plan_line_id))
				: planLines;

		return [
			{
				treeRootId: `${link.project_id}-${link.production_plan_id}`,
				project_id: link.project_id,
				woLabel,
				activeLines
			}
		];
	});
}

function releaseLabelFromDeliverySchedules(schedules: DeliveryScheduleRow[]): string {
	const labels = schedules
		.map((row) => formatDeliveryScheduleLabel(row.name, row.delivery_date))
		.filter(Boolean);
	return labels.length > 0 ? `DELIVERY SCHEDULE ${labels.join('/')}` : 'DELIVERY SCHEDULE -';
}

function releaseLabelFromProductionPlans(productionPlans: ProjProductionPlanRow[]): string {
	const names = productionPlans.map((r) => r.plan_name.trim()).filter(Boolean);
	return names.length > 0 ? `PRODUCTION PLAN ${names.join('/')}` : 'PRODUCTION PLAN -';
}

/**
 * Compose Review Input tree for a manufacturing plan from datahub entities
 * (plan → delivery schedules or production plans → BOM marks → CP bars → optional OCR holes).
 */
export async function loadReviewInputDetail(
	planId: string,
	signal?: AbortSignal
): Promise<ReviewInputPlanDetail | null> {
	const plan = await getPlan(planId, signal);
	if (!plan) return null;

	rememberManufacturingPlanLabel(plan.plan_id, plan.name?.trim() || plan.plan_id);

	const dsDetail = await loadReviewInputFromDeliverySchedules(plan, planId, signal);
	if (dsDetail) return dsDetail;

	const ppBundleLinks = await bundleLinksFromProductionPlans(planId, signal);
	if (ppBundleLinks.length === 0) {
		return composeReviewInputTree(plan, 'SCHEDULING INPUT -', [], signal);
	}

	const productionPlanIds = [
		...new Set(
			(await listPlanProductionPlans(planId, signal)).map((link) => link.production_plan_id)
		)
	];
	const productionPlans = await listByIds<ProjProductionPlanRow>(
		'proj_production_plans',
		'production_plan_id',
		productionPlanIds,
		'production_plan_id,project_id,plan_name',
		signal
	);

	return composeReviewInputTree(
		plan,
		releaseLabelFromProductionPlans(productionPlans),
		ppBundleLinks,
		signal
	);
}
