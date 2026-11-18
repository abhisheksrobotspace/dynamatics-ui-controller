export type PlanningSheetNodeKind = 'project' | 'schedule' | 'tower' | 'bom';

export type PlanningSheetBomLine = {
	kind: 'bom';
	projectId: string;
	scheduleId: string;
	structureId: string;
	bomId: string;
	/** Grain for pln_* allocations — one node per DS line. */
	deliveryScheduleLineId: string;
	/** `YYYY-MM` from the parent delivery schedule date — default allocation month. */
	deliveryMonth: string;
	qtySets: number;
	qtyMt: number | null;
	/** MT per set from BOM item `SUM(total_weight)` / 1000 (null = unknown). */
	weightMtPerSet: number | null;
};

export type PlanningSheetTowerLine = {
	kind: 'tower';
	projectId: string;
	scheduleId: string;
	structureId: string;
	qtySets: number;
	qtyMt: number | null;
};

export type PlanningSheetScheduleLine = {
	kind: 'schedule';
	projectId: string;
	scheduleId: string;
	deliveryDate: string;
	/** Delivery schedule display name from API (optional). */
	name?: string | null;
	qtySets: number;
	qtyMt: number | null;
};

export type PlanningSheetProjectLine = {
	kind: 'project';
	projectId: string;
	qtySets: number;
	qtyMt: number | null;
};

export type PlanningSheetRowData =
	| PlanningSheetBomLine
	| PlanningSheetTowerLine
	| PlanningSheetScheduleLine
	| PlanningSheetProjectLine;

/** Planned sets for a BOM under a month key (`YYYY-MM`). */
export type PlanningSheetMonthQty = Record<string, number>;

/** Include flags keyed by node id → month key → included. */
export type PlanningSheetIncludes = Record<string, Record<string, boolean>>;

/**
 * When set, this cell was written/topped by a freeze carry into this month
 * (`pln_central_plan_lines.carried_from_month` as `YYYY-MM`).
 */
export type PlanningSheetCarriedFrom = Record<string, Record<string, string>>;

export type PlanningSheetDraft = {
	/** Months present as columns, sorted ascending. */
	months: string[];
	/** BOM node id → month → planned sets. */
	monthQtyByBomId: Record<string, PlanningSheetMonthQty>;
	/** Node id → month → included (project / schedule / tower / bom). */
	included: PlanningSheetIncludes;
	/** BOM node id → month → source month key for carried cells. */
	carriedFromMonthByBomId?: PlanningSheetCarriedFrom;
};

export type PlanningSheetPlanStatus = 'draft' | 'published';

export type PlanningSheetPlan = {
	id: string;
	plan: number;
	label: string;
	plantId: string;
	createdAt: string;
	createdBy: string;
	updatedAt: string;
	updatedBy: string;
	status: PlanningSheetPlanStatus;
	publishedAt?: string | null;
	/** Months this plan last owns on the shop floor (`YYYY-MM`), derived from SF headers. */
	sentToShopFloorMonths: string[];
	draft: PlanningSheetDraft;
};

export type SentPlanMonthRow = {
	plan: PlanningSheetPlan;
	month: string;
	shopfloorPlanId: string;
	status: 'draft' | 'frozen' | string;
	sentAt?: string | null;
	editedAt?: string | null;
	frozenAt?: string | null;
	/** True when the source central plan is gone (FK set null) — cannot open sheet to unfreeze. */
	orphaned?: boolean;
};

export type PlanningSheetLoadedTree = {
	months: string[];
	/** Stable TreeTable nodes (structure only; qty/balance computed in UI). */
	nodes: import('@ifactory/ui-v2').TreeTableNode<PlanningSheetRowData>[];
	/** BOM node ids in tree order. */
	bomNodeIds: string[];
};

/** Frozen month overlay: qty by DS-line bom node id for a plant-month. */
export type FrozenMonthQtyByBomId = Record<string, number>;
