import {
	bomNodeIdForDsLine,
	fetchShopFloorMonthJoined,
	listShopfloorPlanLines,
	monthKey,
	updateShopfloorPlanLineQty,
	type PlnCentralPlanRow,
	type PlnShopfloorPlanLineRow,
	type PlnShopfloorPlanRow
} from '../../central-planning-app/lib/pln.api.js';
import type {
	PlanningSheetDraft,
	PlanningSheetIncludes,
	PlanningSheetMonthQty
} from '../../central-planning-app/lib/planning-sheet.types.js';

export type ShopFloorPlanOverlay = {
	sourcePlanId: string;
	month: string;
	shopfloorPlanId: string;
	updatedAt: string;
	frozen: boolean;
	draft: PlanningSheetDraft;
	lines: PlnShopfloorPlanLineRow[];
};

function overlayKey(shopfloorPlanId: string): string {
	return shopfloorPlanId;
}

const overlays = new Map<string, ShopFloorPlanOverlay>();

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
		) as PlanningSheetIncludes
	};
}

export function draftFromShopfloorLines(
	lines: PlnShopfloorPlanLineRow[],
	month: string
): PlanningSheetDraft {
	const monthQtyByBomId: Record<string, PlanningSheetMonthQty> = {};
	const included: PlanningSheetIncludes = {};
	for (const line of lines) {
		if (!line.delivery_schedule_line_id) continue;
		const bomNodeId = bomNodeIdForDsLine(line.delivery_schedule_line_id);
		const qty = Math.max(0, Math.round(Number(line.quantity) || 0));
		if (qty > 0) monthQtyByBomId[bomNodeId] = { [month]: qty };
		included[bomNodeId] = { [month]: true };
	}
	return { months: [month], monthQtyByBomId, included };
}

/** Slice a multi-month draft to one month (qty + include only where qty > 0). */
export function draftForSingleMonth(source: PlanningSheetDraft, month: string): PlanningSheetDraft {
	const monthQtyByBomId: Record<string, PlanningSheetMonthQty> = {};
	const included: PlanningSheetIncludes = {};
	for (const [bomId, months] of Object.entries(source.monthQtyByBomId)) {
		const qty = months[month] ?? 0;
		if (qty > 0) {
			monthQtyByBomId[bomId] = { [month]: qty };
			included[bomId] = { [month]: true };
		}
	}
	return { months: [month], monthQtyByBomId, included };
}

export function getShopFloorPlanDraft(shopfloorPlanId: string): PlanningSheetDraft | undefined {
	const found = overlays.get(overlayKey(shopfloorPlanId));
	return found ? cloneDraft(found.draft) : undefined;
}

export function hasShopFloorPlanDraft(shopfloorPlanId: string): boolean {
	return overlays.has(overlayKey(shopfloorPlanId));
}

export function isShopFloorMonthFrozen(shopfloorPlanId: string): boolean {
	return overlays.get(overlayKey(shopfloorPlanId))?.frozen === true;
}

export async function loadShopFloorOverlay(
	shopfloorPlanId: string,
	sourcePlanId: string,
	month: string,
	frozen: boolean,
	signal?: AbortSignal
): Promise<ShopFloorPlanOverlay> {
	const lines = await listShopfloorPlanLines(shopfloorPlanId, signal);
	return seedShopFloorOverlay({
		sourcePlanId,
		month,
		shopfloorPlanId,
		frozen,
		lines
	});
}

function seedShopFloorOverlay(input: {
	sourcePlanId: string;
	month: string;
	shopfloorPlanId: string;
	frozen: boolean;
	lines: PlnShopfloorPlanLineRow[];
}): ShopFloorPlanOverlay {
	const draft = draftFromShopfloorLines(input.lines, input.month);
	const saved: ShopFloorPlanOverlay = {
		sourcePlanId: input.sourcePlanId,
		month: input.month,
		shopfloorPlanId: input.shopfloorPlanId,
		updatedAt: new Date().toISOString(),
		frozen: input.frozen,
		draft: cloneDraft(draft),
		lines: [...input.lines]
	};
	overlays.set(overlayKey(input.shopfloorPlanId), saved);
	return { ...saved, draft: cloneDraft(saved.draft), lines: [...saved.lines] };
}

/**
 * SFP month sheet open: one joined query (SF plan ⟕ lines ⟕ central).
 */
export async function loadShopFloorMonthContext(
	centralPlanId: string,
	month: string,
	signal?: AbortSignal
): Promise<{
	central: PlnCentralPlanRow;
	shopfloor: PlnShopfloorPlanRow;
	overlay: ShopFloorPlanOverlay;
} | null> {
	const joined = await fetchShopFloorMonthJoined(centralPlanId, month, signal);
	if (!joined) return null;
	const m = monthKey(month);
	const frozen = joined.shopfloor.status === 'frozen';
	const overlay = seedShopFloorOverlay({
		sourcePlanId: centralPlanId,
		month: m,
		shopfloorPlanId: joined.shopfloor.shopfloor_plan_id,
		frozen,
		lines: joined.lines
	});
	return { central: joined.central, shopfloor: joined.shopfloor, overlay };
}

/** Persist SF qty edits to pln_shopfloor_plan_lines (draft only). */
export async function saveShopFloorPlanDraft(
	shopfloorPlanId: string,
	month: string,
	draft: PlanningSheetDraft,
	signal?: AbortSignal
): Promise<ShopFloorPlanOverlay> {
	const existing = overlays.get(overlayKey(shopfloorPlanId));
	const lines = existing?.lines ?? (await listShopfloorPlanLines(shopfloorPlanId, signal));

	// Diff every existing SF line against the draft. Qty keys are deleted when set to 0
	// (`setBomMonthQty`), so iterating only `monthQtyByBomId` would skip zeroing writes.
	for (const line of lines) {
		if (!line.delivery_schedule_line_id) continue;
		const bomNodeId = bomNodeIdForDsLine(line.delivery_schedule_line_id);
		const included = draft.included[bomNodeId]?.[month] !== false;
		const qty = included
			? Math.max(0, Math.round(draft.monthQtyByBomId[bomNodeId]?.[month] ?? 0))
			: 0;
		if (Number(line.quantity) === qty) continue;
		await updateShopfloorPlanLineQty(line.shopfloor_plan_line_id, qty, signal);
		line.quantity = qty;
	}

	const refreshed = await listShopfloorPlanLines(shopfloorPlanId, signal);
	const nextDraft = draftFromShopfloorLines(refreshed, month);
	const saved: ShopFloorPlanOverlay = {
		sourcePlanId: existing?.sourcePlanId ?? '',
		month,
		shopfloorPlanId,
		updatedAt: new Date().toISOString(),
		frozen: existing?.frozen ?? false,
		draft: cloneDraft(nextDraft),
		lines: refreshed
	};
	overlays.set(overlayKey(shopfloorPlanId), saved);
	return { ...saved, draft: cloneDraft(saved.draft), lines: [...refreshed] };
}

export function markShopFloorMonthFrozen(shopfloorPlanId: string): void {
	const existing = overlays.get(overlayKey(shopfloorPlanId));
	if (!existing) return;
	overlays.set(overlayKey(shopfloorPlanId), {
		...existing,
		frozen: true,
		updatedAt: new Date().toISOString()
	});
}

export function markShopFloorMonthUnfrozen(shopfloorPlanId: string): void {
	const existing = overlays.get(overlayKey(shopfloorPlanId));
	if (!existing) return;
	overlays.set(overlayKey(shopfloorPlanId), {
		...existing,
		frozen: false,
		updatedAt: new Date().toISOString()
	});
}

export function clearShopFloorOverlay(shopfloorPlanId: string): void {
	overlays.delete(overlayKey(shopfloorPlanId));
}

export function bomQtyForMonth(draft: PlanningSheetDraft, month: string): Record<string, number> {
	const out: Record<string, number> = {};
	for (const [bomId, months] of Object.entries(draft.monthQtyByBomId)) {
		out[bomId] = months[month] ?? 0;
	}
	return out;
}
