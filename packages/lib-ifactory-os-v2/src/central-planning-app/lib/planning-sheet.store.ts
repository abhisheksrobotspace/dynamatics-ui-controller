import type { TreeTableNode } from '@ifactory/ui-v2';
import {
	bomNodeIdForDsLine,
	createCentralPlan,
	deleteCentralPlan,
	deleteShopfloorPlan,
	dsLineIdFromBomNodeId,
	duplicateCentralPlan,
	freezeShopfloorMonth,
	getCentralPlan,
	listAllCentralPlans,
	listCentralPlanLines,
	listCentralPlans,
	listFrozenShopfloorPlans,
	listShopfloorPlanLinesForPlans,
	listShopfloorPlans,
	monthKey,
	saveCentralPlanLines,
	sendToShopfloor,
	unfreezeShopfloorMonth,
	type DesiredCentralLine,
	type PlnCentralPlanRow,
	type PlnShopfloorPlanRow
} from './pln.api.js';
import type {
	FrozenMonthQtyByBomId,
	PlanningSheetCarriedFrom,
	PlanningSheetDraft,
	PlanningSheetIncludes,
	PlanningSheetMonthQty,
	PlanningSheetPlan,
	PlanningSheetRowData,
	SentPlanMonthRow
} from './planning-sheet.types.js';

/** In-memory cache of hydrated plans (draft filled from lines + frozen overlay). */
let planCache: PlanningSheetPlan[] = [];
/** Lightweight name cache for breadcrumbs when planCache is cold (refresh / deep-link). */
const planLabelById = new Map<string, string>();
/** plantId → frozen YYYY-MM set */
const frozenByPlant: Record<string, string[]> = {};
/** plantId|YYYY-MM → bomNodeId → qty from SF frozen lines */
const frozenQtyByPlantMonth: Record<string, FrozenMonthQtyByBomId> = {};
/** shopfloor plan id by plant|month */
const shopfloorIdByPlantMonth: Record<string, string> = {};

let workingDraft: PlanningSheetDraft | null = null;
let pendingPlanName: string | null = null;
let pendingPlanPlantId: string | null = null;

function cloneDraft(draft: PlanningSheetDraft): PlanningSheetDraft {
	return {
		months: [...draft.months],
		monthQtyByBomId: Object.fromEntries(
			Object.entries(draft.monthQtyByBomId).map(([bomId, months]) => [
				bomId,
				{ ...months } satisfies PlanningSheetMonthQty
			])
		),
		included: Object.fromEntries(
			Object.entries(draft.included).map(([nodeId, months]) => [nodeId, { ...months }])
		) as PlanningSheetIncludes,
		carriedFromMonthByBomId: draft.carriedFromMonthByBomId
			? (Object.fromEntries(
					Object.entries(draft.carriedFromMonthByBomId).map(([bomId, months]) => [
						bomId,
						{ ...months }
					])
				) as PlanningSheetCarriedFrom)
			: undefined
	};
}

function clonePlan(plan: PlanningSheetPlan): PlanningSheetPlan {
	return {
		...plan,
		sentToShopFloorMonths: [...plan.sentToShopFloorMonths],
		draft: cloneDraft(plan.draft)
	};
}

function emptyDraft(months: string[] = []): PlanningSheetDraft {
	return { months: [...months], monthQtyByBomId: {}, included: {} };
}

function planFromRow(
	row: PlnCentralPlanRow,
	draft: PlanningSheetDraft,
	sentMonths: string[]
): PlanningSheetPlan {
	const label = row.name?.trim() || row.central_plan_id;
	if (label) planLabelById.set(row.central_plan_id, label);
	return {
		id: row.central_plan_id,
		plan: 0,
		label,
		plantId: row.plant_id,
		createdAt: row.created_at,
		createdBy: row.created_by ?? '',
		updatedAt: row.updated_at ?? row.created_at,
		updatedBy: row.updated_by ?? row.created_by ?? '',
		status: 'draft',
		publishedAt: null,
		sentToShopFloorMonths: [...sentMonths].sort(),
		draft: cloneDraft(draft)
	};
}

function desiredLinesFromDraft(draft: PlanningSheetDraft): DesiredCentralLine[] {
	const out: DesiredCentralLine[] = [];
	for (const [bomNodeId, months] of Object.entries(draft.monthQtyByBomId)) {
		const dsLineId = dsLineIdFromBomNodeId(bomNodeId);
		if (!dsLineId) continue;
		for (const [m, qty] of Object.entries(months)) {
			if ((qty ?? 0) <= 0) continue;
			if (draft.included[bomNodeId]?.[m] === false) continue;
			out.push({
				deliveryScheduleLineId: dsLineId,
				month: m,
				quantity: qty
			});
		}
	}
	return out;
}

function plantMonthKey(plantId: string, month: string): string {
	return `${plantId}|${monthKey(month)}`;
}

export function getWorkingDraft(): PlanningSheetDraft | null {
	return workingDraft ? cloneDraft(workingDraft) : null;
}

export function setWorkingDraft(draft: PlanningSheetDraft): void {
	workingDraft = cloneDraft(draft);
}

export function clearWorkingDraft(): void {
	workingDraft = null;
}

export function getPendingPlanName(): string | null {
	return pendingPlanName;
}

export function setPendingPlanName(name: string): void {
	const trimmed = name.trim();
	pendingPlanName = trimmed.length > 0 ? trimmed : null;
}

export function clearPendingPlanName(): void {
	pendingPlanName = null;
}

export function getPendingPlanPlantId(): string | null {
	return pendingPlanPlantId;
}

export function setPendingPlanPlantId(plantId: string): void {
	const trimmed = plantId.trim();
	pendingPlanPlantId = trimmed.length > 0 ? trimmed : null;
}

export function clearPendingPlanPlantId(): void {
	pendingPlanPlantId = null;
}

/** All months included; each BOM qty placed in its delivery-schedule month. */
export function createDefaultDraft(
	months: string[],
	nodes: TreeTableNode<PlanningSheetRowData>[],
	nodeIds: string[]
): PlanningSheetDraft {
	const included: PlanningSheetIncludes = {};
	for (const nodeId of nodeIds) {
		included[nodeId] = Object.fromEntries(months.map((m) => [m, true]));
	}

	const monthQtyByBomId: Record<string, PlanningSheetMonthQty> = {};
	const walk = (list: TreeTableNode<PlanningSheetRowData>[]) => {
		for (const node of list) {
			if (node.data?.kind === 'bom') {
				const month = node.data.deliveryMonth;
				const qty = node.data.qtySets;
				if (month && months.includes(month) && qty > 0) {
					monthQtyByBomId[node.id] = { [month]: qty };
				}
			}
			if (node.children?.length) walk(node.children);
		}
	};
	walk(nodes);

	return {
		months: [...months],
		monthQtyByBomId,
		included
	};
}

export function listPlanningSheetPlans(): PlanningSheetPlan[] {
	return planCache.map(clonePlan);
}

export function listPublishedPlanningSheetPlans(): PlanningSheetPlan[] {
	return listPlanningSheetPlans();
}

export function getPlanningSheetPlan(id: string): PlanningSheetPlan | undefined {
	const found = planCache.find((p) => p.id === id);
	return found ? clonePlan(found) : undefined;
}

/** Prefer cached plan name for breadcrumbs; fall back to id. */
export function getPlanningSheetPlanLabel(id: string): string {
	return getPlanningSheetPlan(id)?.label ?? planLabelById.get(id) ?? id;
}

/**
 * Fetch central-plan name for breadcrumbs on refresh / deep-link when caches are cold.
 * Avoids a full hydrate — header row only.
 */
export async function ensurePlanningSheetPlanLabel(
	id: string,
	signal?: AbortSignal
): Promise<string> {
	const trimmed = id.trim();
	if (!trimmed || trimmed === 'new') return trimmed;
	const cached = getPlanningSheetPlanLabel(trimmed);
	if (cached !== trimmed) return cached;

	const row = await getCentralPlan(trimmed, signal);
	const label = row?.name?.trim();
	if (label) {
		planLabelById.set(trimmed, label);
		return label;
	}
	return trimmed;
}

export function isMonthFrozen(month: string, plantId?: string): boolean {
	const m = monthKey(month);
	if (plantId) return (frozenByPlant[plantId] ?? []).includes(m);
	return Object.values(frozenByPlant).some((list) => list.includes(m));
}

export function listFrozenMonths(plantId?: string): string[] {
	if (plantId) return [...(frozenByPlant[plantId] ?? [])];
	return [...new Set(Object.values(frozenByPlant).flat())].sort();
}

export function getFrozenMonthQty(plantId: string, month: string): FrozenMonthQtyByBomId {
	return { ...(frozenQtyByPlantMonth[plantMonthKey(plantId, month)] ?? {}) };
}

export function getShopfloorPlanId(plantId: string, month: string): string | undefined {
	return shopfloorIdByPlantMonth[plantMonthKey(plantId, month)];
}

/** Ensure plant-month → shopfloor_plan_id map is populated (from list if needed). */
export async function resolveShopfloorPlanId(
	plantId: string,
	month: string,
	signal?: AbortSignal
): Promise<string | null> {
	const m = monthKey(month);
	const cached = getShopfloorPlanId(plantId, m);
	if (cached) return cached;
	const plans = await listShopfloorPlans(plantId, signal);
	for (const sf of plans) {
		shopfloorIdByPlantMonth[plantMonthKey(plantId, String(sf.month))] = sf.shopfloor_plan_id;
	}
	return getShopfloorPlanId(plantId, m) ?? null;
}

/** Load frozen months + SF qty overlays for a plant. */
export async function refreshFrozenStateForPlant(
	plantId: string,
	signal?: AbortSignal,
	/** Skip the frozen-plans GET when caller already listed shopfloor plans. */
	frozenPlans?: PlnShopfloorPlanRow[]
): Promise<void> {
	const frozen = frozenPlans ?? (await listFrozenShopfloorPlans(plantId, signal));
	const months: string[] = [];
	const allLines = await listShopfloorPlanLinesForPlans(
		frozen.map((p) => p.shopfloor_plan_id),
		signal
	);
	const linesByPlan = new Map<string, typeof allLines>();
	for (const line of allLines) {
		const bucket = linesByPlan.get(line.shopfloor_plan_id) ?? [];
		bucket.push(line);
		linesByPlan.set(line.shopfloor_plan_id, bucket);
	}
	for (const plan of frozen) {
		const m = monthKey(String(plan.month));
		months.push(m);
		shopfloorIdByPlantMonth[plantMonthKey(plantId, m)] = plan.shopfloor_plan_id;
		const qty: FrozenMonthQtyByBomId = {};
		for (const line of linesByPlan.get(plan.shopfloor_plan_id) ?? []) {
			if (!line.delivery_schedule_line_id) continue;
			const bomNodeId = bomNodeIdForDsLine(line.delivery_schedule_line_id);
			qty[bomNodeId] = (qty[bomNodeId] ?? 0) + Math.max(0, Math.round(Number(line.quantity) || 0));
		}
		frozenQtyByPlantMonth[plantMonthKey(plantId, m)] = qty;
	}
	frozenByPlant[plantId] = [...new Set(months)].sort();
}

async function hydratePlan(
	row: PlnCentralPlanRow,
	treeMonths: string[],
	bomNodeIds: string[],
	sfPlans: PlnShopfloorPlanRow[],
	lines: Awaited<ReturnType<typeof listCentralPlanLines>>
): Promise<PlanningSheetPlan> {
	const frozenSet = new Set(frozenByPlant[row.plant_id] ?? []);

	const monthQtyByBomId: Record<string, PlanningSheetMonthQty> = {};
	const carriedFromMonthByBomId: PlanningSheetCarriedFrom = {};
	const months = new Set<string>(treeMonths);

	for (const line of lines) {
		const m = monthKey(String(line.month));
		months.add(m);
		const bomNodeId = bomNodeIdForDsLine(line.delivery_schedule_line_id);
		if (frozenSet.has(m)) continue;
		const qty = Math.max(0, Math.round(Number(line.quantity) || 0));
		if (qty > 0) {
			monthQtyByBomId[bomNodeId] = { ...(monthQtyByBomId[bomNodeId] ?? {}), [m]: qty };
		}
		const carried = line.carried_from_month ? monthKey(String(line.carried_from_month)) : null;
		if (carried) {
			carriedFromMonthByBomId[bomNodeId] = {
				...(carriedFromMonthByBomId[bomNodeId] ?? {}),
				[m]: carried
			};
		}
	}

	for (const m of frozenSet) {
		months.add(m);
		const overlay = frozenQtyByPlantMonth[plantMonthKey(row.plant_id, m)] ?? {};
		for (const [bomNodeId, qty] of Object.entries(overlay)) {
			if (qty <= 0) continue;
			monthQtyByBomId[bomNodeId] = { ...(monthQtyByBomId[bomNodeId] ?? {}), [m]: qty };
		}
	}

	const sortedMonths = [...months].sort();
	const included: PlanningSheetIncludes = {};
	for (const nodeId of bomNodeIds) {
		included[nodeId] = Object.fromEntries(sortedMonths.map((mo) => [mo, true]));
	}
	for (const bomNodeId of Object.keys(monthQtyByBomId)) {
		included[bomNodeId] = {
			...(included[bomNodeId] ?? {}),
			...Object.fromEntries(sortedMonths.map((mo) => [mo, true]))
		};
	}

	const draft: PlanningSheetDraft = {
		months: sortedMonths,
		monthQtyByBomId,
		included,
		carriedFromMonthByBomId:
			Object.keys(carriedFromMonthByBomId).length > 0 ? carriedFromMonthByBomId : undefined
	};

	const sentMonths = sfPlans
		.filter((p) => p.source_central_plan_id === row.central_plan_id)
		.map((p) => monthKey(String(p.month)));

	return planFromRow(row, draft, sentMonths);
}

/**
 * Refresh plan list for a plant — **headers only** (name / actors / timestamps / sent months).
 * Full line + frozen hydrate happens in {@link loadPlanningSheetPlan} when a sheet opens.
 */
export async function refreshPlanningSheetPlans(
	plantId: string,
	opts?: {
		treeMonths?: string[];
		bomNodeIds?: string[];
		signal?: AbortSignal;
	}
): Promise<PlanningSheetPlan[]> {
	const signal = opts?.signal;
	const [rows, sfPlans] = await Promise.all([
		listCentralPlans(plantId, signal),
		listShopfloorPlans(plantId, signal)
	]);

	for (const sf of sfPlans) {
		shopfloorIdByPlantMonth[plantMonthKey(plantId, String(sf.month))] = sf.shopfloor_plan_id;
	}

	const headers = rows.map((row) => {
		const sentMonths = sfPlans
			.filter((p) => p.source_central_plan_id === row.central_plan_id)
			.map((p) => monthKey(String(p.month)));
		return planFromRow(row, emptyDraft(), sentMonths);
	});

	// List does not need lines — keep only already-hydrated drafts in cache (metadata refreshed).
	const rowIds = new Set(rows.map((r) => r.central_plan_id));
	const otherPlants = planCache.filter((p) => p.plantId !== plantId);
	const refreshedHydrated = planCache
		.filter((p) => p.plantId === plantId && rowIds.has(p.id))
		.filter((p) => Object.keys(p.draft.monthQtyByBomId).length > 0 || p.draft.months.length > 0)
		.map((existing) => {
			const header = headers.find((h) => h.id === existing.id);
			if (!header) return existing;
			return {
				...existing,
				label: header.label,
				createdAt: header.createdAt,
				createdBy: header.createdBy,
				updatedAt: header.updatedAt,
				updatedBy: header.updatedBy,
				sentToShopFloorMonths: header.sentToShopFloorMonths
			};
		});
	planCache = [...otherPlants, ...refreshedHydrated];

	return headers.map(clonePlan);
}

/**
 * Register central + this-month SF identity after {@link loadShopFloorMonthContext}.
 * Does not fetch — maps / cache only.
 */
export function registerShopFloorMonthPlan(
	central: PlnCentralPlanRow,
	shopfloorPlanId: string,
	month: string,
	frozen: boolean
): PlanningSheetPlan {
	const m = monthKey(month);
	shopfloorIdByPlantMonth[plantMonthKey(central.plant_id, m)] = shopfloorPlanId;
	const prev = frozenByPlant[central.plant_id] ?? [];
	frozenByPlant[central.plant_id] = frozen
		? [...new Set([...prev, m])].sort()
		: prev.filter((x) => x !== m);
	const plan = planFromRow(central, emptyDraft(), [m]);
	const idx = planCache.findIndex((p) => p.id === plan.id);
	if (idx >= 0) planCache = [...planCache.slice(0, idx), plan, ...planCache.slice(idx + 1)];
	else planCache = [plan, ...planCache];
	return clonePlan(plan);
}

/** Load one plan into cache (for sheet open). */
export async function loadPlanningSheetPlan(
	centralPlanId: string,
	opts?: {
		treeMonths?: string[];
		bomNodeIds?: string[];
		signal?: AbortSignal;
		/**
		 * Shop-floor month view: only need plant + SF map + frozen flags.
		 * Skips central plan lines and frozen SF line overlays (draft comes from SF overlay).
		 */
		shopFloorMonth?: string;
	}
): Promise<PlanningSheetPlan | null> {
	const signal = opts?.signal;
	const row = await getCentralPlan(centralPlanId, signal);
	if (!row) return null;

	const sfPlans = await listShopfloorPlans(row.plant_id, signal);
	for (const sf of sfPlans) {
		shopfloorIdByPlantMonth[plantMonthKey(row.plant_id, String(sf.month))] = sf.shopfloor_plan_id;
	}

	if (opts?.shopFloorMonth) {
		// Flags only — qty overlay is loaded per-month in loadShopFloorOverlay.
		frozenByPlant[row.plant_id] = [
			...new Set(sfPlans.filter((p) => p.status === 'frozen').map((p) => monthKey(String(p.month))))
		].sort();
		const sentMonths = sfPlans
			.filter((p) => p.source_central_plan_id === row.central_plan_id)
			.map((p) => monthKey(String(p.month)));
		const plan = planFromRow(row, emptyDraft(), sentMonths);
		const idx = planCache.findIndex((p) => p.id === plan.id);
		if (idx >= 0) planCache = [...planCache.slice(0, idx), plan, ...planCache.slice(idx + 1)];
		else planCache = [plan, ...planCache];
		return clonePlan(plan);
	}

	const lines = await listCentralPlanLines(row.central_plan_id, signal);
	await refreshFrozenStateForPlant(
		row.plant_id,
		signal,
		sfPlans.filter((p) => p.status === 'frozen')
	);
	const plan = await hydratePlan(
		row,
		opts?.treeMonths ?? [],
		opts?.bomNodeIds ?? [],
		sfPlans,
		lines
	);
	const idx = planCache.findIndex((p) => p.id === plan.id);
	if (idx >= 0) planCache = [...planCache.slice(0, idx), plan, ...planCache.slice(idx + 1)];
	else planCache = [plan, ...planCache];
	return clonePlan(plan);
}

/** Put a plan into the in-memory cache (e.g. synthetic Stock Assignment view). */
export function upsertCachedPlanningSheetPlan(plan: PlanningSheetPlan): PlanningSheetPlan {
	const next = clonePlan(plan);
	const idx = planCache.findIndex((p) => p.id === next.id);
	if (idx >= 0) planCache = [...planCache.slice(0, idx), next, ...planCache.slice(idx + 1)];
	else planCache = [next, ...planCache];
	return clonePlan(next);
}

export async function savePlanningSheetPlan(
	draft: PlanningSheetDraft,
	opts?: { name?: string; plantId?: string; signal?: AbortSignal }
): Promise<PlanningSheetPlan> {
	const name = (opts?.name ?? pendingPlanName ?? '').trim();
	const plantId = (opts?.plantId ?? pendingPlanPlantId ?? '').trim();
	if (!name) throw new Error('Plan name is required.');
	if (!plantId) throw new Error('Plant is required.');

	const created = await createCentralPlan({ name, plantId }, opts?.signal);
	const frozen = new Set(frozenByPlant[plantId] ?? []);
	await saveCentralPlanLines(
		created.central_plan_id,
		desiredLinesFromDraft(draft),
		frozen,
		opts?.signal
	);

	pendingPlanName = null;
	pendingPlanPlantId = null;
	workingDraft = null;

	const loaded = await loadPlanningSheetPlan(created.central_plan_id, {
		treeMonths: draft.months,
		bomNodeIds: Object.keys(draft.monthQtyByBomId),
		signal: opts?.signal
	});
	if (!loaded) throw new Error('Plan created but could not be reloaded.');
	return loaded;
}

export async function updatePlanningSheetPlanDraft(
	id: string,
	draft: PlanningSheetDraft,
	signal?: AbortSignal
): Promise<PlanningSheetPlan | undefined> {
	const existing =
		planCache.find((p) => p.id === id) ?? (await loadPlanningSheetPlan(id, { signal }));
	if (!existing) return undefined;
	const frozen = new Set(frozenByPlant[existing.plantId] ?? []);
	await saveCentralPlanLines(id, desiredLinesFromDraft(draft), frozen, signal);
	return (
		(await loadPlanningSheetPlan(id, {
			treeMonths: draft.months,
			bomNodeIds: Object.keys(draft.monthQtyByBomId),
			signal
		})) ?? undefined
	);
}

export async function duplicatePlanningSheetPlan(
	sourceId: string,
	name: string,
	signal?: AbortSignal
): Promise<PlanningSheetPlan | undefined> {
	const created = await duplicateCentralPlan(sourceId, name, signal);
	return (await loadPlanningSheetPlan(created.central_plan_id, { signal })) ?? undefined;
}

export async function deletePlanningSheetPlan(id: string, signal?: AbortSignal): Promise<boolean> {
	await deleteCentralPlan(id, signal);
	planCache = planCache.filter((p) => p.id !== id);
	return true;
}

/** Removes a sent shop-floor month plan (header + cascaded lines). Frozen months must be unfrozen first. */
export async function deleteSentShopFloorPlan(
	shopfloorPlanId: string,
	signal?: AbortSignal
): Promise<void> {
	await deleteShopfloorPlan(shopfloorPlanId, signal);

	for (const [key, id] of Object.entries(shopfloorIdByPlantMonth)) {
		if (id === shopfloorPlanId) {
			delete shopfloorIdByPlantMonth[key];
			const plantId = key.split('|')[0] ?? '';
			const month = key.split('|')[1] ?? '';
			if (plantId && month) {
				frozenByPlant[plantId] = (frozenByPlant[plantId] ?? []).filter((m) => m !== month);
				delete frozenQtyByPlantMonth[key];
			}
		}
	}

	planCache = planCache.map((plan) => {
		const stillSent = plan.sentToShopFloorMonths.filter((m) => {
			const sfId = shopfloorIdByPlantMonth[plantMonthKey(plan.plantId, m)];
			return Boolean(sfId);
		});
		if (stillSent.length === plan.sentToShopFloorMonths.length) return plan;
		return { ...plan, sentToShopFloorMonths: stillSent };
	});
}

export type SendToShopFloorResult =
	| { ok: true; plan: PlanningSheetPlan; shopfloorPlanId: string }
	| { ok: false; reason: string; message?: string };

export async function sendPlanMonthToShopFloor(
	planId: string,
	month: string,
	signal?: AbortSignal
): Promise<SendToShopFloorResult> {
	try {
		const result = await sendToShopfloor(planId, month, signal);
		const m = monthKey(result.month ?? month);
		const plan = await loadPlanningSheetPlan(planId, { signal });
		if (!plan) return { ok: false, reason: 'not_found' };
		shopfloorIdByPlantMonth[plantMonthKey(plan.plantId, m)] = result.shopfloor_plan_id;
		return { ok: true, plan, shopfloorPlanId: result.shopfloor_plan_id };
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Send failed.';
		const code =
			error && typeof error === 'object' && 'code' in error
				? String((error as { code: unknown }).code)
				: '';
		return { ok: false, reason: code || 'failed', message };
	}
}

export async function listSentPlanMonths(
	plantId?: string,
	signal?: AbortSignal
): Promise<SentPlanMonthRow[]> {
	const sfPlans = plantId
		? await listShopfloorPlans(plantId, signal)
		: (
				await Promise.all(
					[...new Set((await listAllCentralPlans(signal)).map((p) => p.plant_id))].map((pid) =>
						listShopfloorPlans(pid, signal)
					)
				)
			).flat();

	const rows: SentPlanMonthRow[] = [];
	for (const sf of sfPlans) {
		const m = monthKey(String(sf.month));
		shopfloorIdByPlantMonth[plantMonthKey(sf.plant_id, m)] = sf.shopfloor_plan_id;
		const orphaned = !sf.source_central_plan_id;
		let plan = planCache.find((p) => p.id === sf.source_central_plan_id);
		if (!plan && sf.source_central_plan_id) {
			plan = (await loadPlanningSheetPlan(sf.source_central_plan_id, { signal })) ?? undefined;
		}
		if (!plan) {
			plan = {
				id: sf.source_central_plan_id ?? sf.shopfloor_plan_id,
				plan: 0,
				label: sf.name ?? 'Shop Floor',
				plantId: sf.plant_id,
				createdAt: sf.created_at ?? '',
				createdBy: sf.sent_by ?? '',
				updatedAt: sf.updated_at ?? sf.edited_at ?? sf.sent_at ?? '',
				updatedBy: sf.sent_by ?? '',
				status: 'draft',
				sentToShopFloorMonths: [m],
				draft: emptyDraft([m])
			};
		}
		rows.push({
			plan: clonePlan(plan),
			month: m,
			shopfloorPlanId: sf.shopfloor_plan_id,
			status: sf.status,
			sentAt: sf.sent_at,
			editedAt: sf.edited_at,
			frozenAt: sf.frozen_at,
			orphaned
		});
	}

	return rows.sort((a, b) => {
		const byMonthCmp = b.month.localeCompare(a.month);
		if (byMonthCmp !== 0) return byMonthCmp;
		return a.plan.label.localeCompare(b.plan.label);
	});
}

/** @deprecated Prefer carried_from_month marker; returns 0 (server owns carry). */
export function carryForwardKey(planId: string, bomNodeId: string, month: string): string {
	return `${planId}|${bomNodeId}|${month}`;
}

/**
 * Carry display: when the cell was freeze-written, show its planned qty in the
 * Carry Forward column as a hint (qty also lives in the month cell).
 */
export function getCarryForward(planId: string, bomNodeId: string, month: string): number {
	const plan = planCache.find((p) => p.id === planId);
	if (!plan) return 0;
	const carried = plan.draft.carriedFromMonthByBomId?.[bomNodeId]?.[monthKey(month)];
	if (!carried) return 0;
	return plan.draft.monthQtyByBomId[bomNodeId]?.[monthKey(month)] ?? 0;
}

export function isCarriedCell(planId: string, bomNodeId: string, month: string): boolean {
	const plan = planCache.find((p) => p.id === planId);
	return Boolean(plan?.draft.carriedFromMonthByBomId?.[bomNodeId]?.[monthKey(month)]);
}

export function nextMonthKey(month: string): string {
	const [y, m] = monthKey(month).split('-').map(Number);
	const date = new Date(Date.UTC(y, m - 1 + 1, 1));
	const yy = date.getUTCFullYear();
	const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
	return `${yy}-${mm}`;
}

export type FreezeResult =
	| {
			ok: true;
			nextMonth: string;
			carryTotal: number;
			result: Awaited<ReturnType<typeof freezeShopfloorMonth>>;
	  }
	| { ok: false; reason: string; message?: string };

/** Persist SF line edits then freeze via planning job; re-hydrate plant state. */
export async function freezeShopFloorMonth(
	shopfloorPlanId: string,
	plantId: string,
	signal?: AbortSignal
): Promise<FreezeResult> {
	try {
		const result = await freezeShopfloorMonth(shopfloorPlanId, signal);
		await refreshFrozenStateForPlant(plantId, signal);
		const m = monthKey(String(result.month ?? ''));
		return {
			ok: true,
			nextMonth: m ? nextMonthKey(m) : nextMonthKey(new Date().toISOString().slice(0, 7)),
			carryTotal: Number(result.carry_total ?? 0),
			result
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Freeze failed.';
		const code =
			error && typeof error === 'object' && 'code' in error
				? String((error as { code: unknown }).code)
				: '';
		return { ok: false, reason: code || 'failed', message };
	}
}

export async function unfreezeShopFloorMonth(
	shopfloorPlanId: string,
	plantId: string,
	signal?: AbortSignal
): Promise<{ ok: true } | { ok: false; message: string }> {
	try {
		await unfreezeShopfloorMonth(shopfloorPlanId, signal);
		await refreshFrozenStateForPlant(plantId, signal);
		return { ok: true };
	} catch (error) {
		return {
			ok: false,
			message: error instanceof Error ? error.message : 'Unfreeze failed.'
		};
	}
}

export function formatPlanCreatedAt(iso: string): string {
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return '-';
	return d.toLocaleString('en-IN', {
		day: '2-digit',
		month: 'short',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	});
}
