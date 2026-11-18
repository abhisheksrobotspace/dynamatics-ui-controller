import type { BomExtractStatus } from './bom-extract-status';

export type { BomExtractStatus };

export type OperationsCountConfig = {
	markNumberRegex: string;
	ocrEngine: string;
	sampleMarkNumbers?: string[];
	metadata?: Record<string, unknown>;
};

/** Minimal project label for breadcrumbs and route titles. */
export type ProjectBreadcrumb = {
	id: string;
	projectName: string;
	workOrderNo?: string;
};

/** Full project row used by feature pages (not stored in projectStore). */
export type Project = ProjectBreadcrumb & {
	sNo: number;
	/** UTC ISO timestamp from `proj_projects.created_at`. */
	createdAt?: string;
	/** Display name from `metadata.created_by` (stamped on create). */
	createdBy?: string;
	workOrderNo?: string;
	shortName?: string;
	projectDetails?: string;
	lineDetails?: string;
	loaNo?: string;
	customerId: string;
	customerName: string;
	/** Optional; assigned via Operations Count Configuration, not create/edit. */
	contractorId?: string;
	contractorName?: string;
	metadata?: Record<string, unknown>;
	operationsCountConfig?: OperationsCountConfig;
};

/** Minimal tower label for breadcrumbs and route titles. */
export type TowerBreadcrumb = {
	id: string;
	projectId: string;
	towerTypeName: string;
};

/** Full tower row used by the Towers page and other feature routes (not stored in projectStore). */
export type TowerType = TowerBreadcrumb & {
	sNo: number;
	extensionsConfigured: string;
};

export type StubBreadcrumb = {
	id: string;
	projectId: string;
	stubTypeName: string;
};

/** Full stub row used by the Stubs page (not stored in projectStore). */
export type StubType = StubBreadcrumb & {
	sNo: number;
};

export type SectionRule = {
	id: string;
	projectId: string;
	fromFlg: number | null;
	toFlg: number | null;
	fromThk: number | null;
	toThk: number | null;
	minLength: number | null;
	maxLength: number | null;
	endTrim: number | null;
	pitch: number | null;
};

/** Project-level length-range group for splitting BOM sections before planning. */
export type LengthGroup = {
	id: string;
	projectId: string;
	name: string;
	minLength: number;
	maxLength: number;
	sortOrder: number;
};

export type ReleaseBreadcrumb = {
	id: string;
	projectId: string;
	name: string;
	date: string;
};

export type ProjectRelease = ReleaseBreadcrumb & {
	sNo: number;
	date: string;
	notes: string;
};

export type DeliveryScheduleBreadcrumb = {
	id: string;
	projectId: string;
	name: string;
	date: string;
};

export type ProjectDeliverySchedule = DeliveryScheduleBreadcrumb & {
	sNo: number;
	status: string;
	description: string;
};

export type ProductionPlanBreadcrumb = {
	id: string;
	projectId: string;
	name: string;
};

export type ProjectProductionPlan = ProductionPlanBreadcrumb & {
	sNo: number;
	date: string;
	status: string;
	releases: string;
	totalQty: number;
	notes: string;
};

export type PlannerSettings = {
	projectId: string;
	timeLimit: number;
	maxUniqueLengthsPerBar: number;
	maxUniqueStockLengthsPerSection: number;
	/** Maps to job config `enforce_mark_cohesion` (persisted in settings metadata). */
	enforceMarkCohesion: boolean;
};

export type BomBreadcrumb = {
	id: string;
	towerId?: string;
	stubId?: string;
	bomName: string;
	/** Present when the crumb was seeded from a full `BomConfig` / list load. */
	bomLineageId?: string;
	version?: number;
	bomFileId?: string | null;
	bomFile?: string | null;
	/** ISO timestamp from `proj_boms.metadata.bom_file_uploaded_at`. */
	bomFileUploadedAt?: string | null;
};

/** Denormalized `proj_boms.ocr_status`. Release lines require `verified`. */
export type BomOcrStatus = 'not_verified' | 'action_needed' | 'verified';

export type BomConfig = BomBreadcrumb & {
	projectId?: string;
	sNo: number;
	/** Groups versions; equals v1 `bom_id` when omitted by older rows. */
	bomLineageId: string;
	/** Version number within the lineage (default 1). */
	version: number;
	/** User-controlled stage from `proj_boms.stage`. */
	stage: 'proto' | 'mass';
	bomFileId?: string | null;
	bomFile: string | null;
	/** ISO timestamp from `proj_boms.metadata.bom_file_uploaded_at`. */
	bomFileUploadedAt?: string | null;
	/** Manual set weight in MT from `proj_boms.metadata.bom_wt` (UI-owned; not extract rollup). */
	bomWt?: number | null;
	drawingsFile: string | null;
	drawingsPdfId?: string | null;
	extractStatus: BomExtractStatus;
	/** From `proj_boms.ocr_status` — Operations Count workflow status (not a release gate). */
	ocrStatus?: BomOcrStatus;
	/** From `proj_boms.cp_status` — drives Cutting Plan View without N× plan-run fetches. */
	cpStatus?: 'none' | 'planned';
	/** From published `cp_plan_runs` row for this BOM (`status=published`). */
	publishedCpRunId?: string | null;
	/** Version of the published `cp_plan_runs` row for this BOM. */
	publishedCpVersion?: number | null;
	operationsCountRoi?: {
		x: number;
		y: number;
		w: number;
		h: number;
	} | null;
	/** UTC ISO timestamp from `proj_boms.created_at`. */
	createdAt?: string | null;
};

export type ReleaseLineItem = {
	id: string;
	/** `proj_boms.bom_id` — required for Datahub persistence. */
	bomId: string;
	releaseLineId?: string;
	description: string;
	unit?: string;
	alreadyReleased: number;
	thisRelease: number;
	bold?: boolean;
	/** Optional UI message when a line cannot be edited (unused for OCR/CP — not release gates). */
	blockReason?: string | null;
};

export type ReleaseStructureKind = 'tower' | 'stub';

export type ReleaseTowerEntry = {
	id: string;
	releaseId: string;
	/** Structure id — tower or stub depending on `kind`. */
	towerTypeId: string;
	kind: ReleaseStructureKind;
	sNo: number;
	thisRelease: number;
	lineItems: ReleaseLineItem[];
};

import { createLineItemsFromBoms } from './release.utils';

export { createLineItemsFromBoms };

/**
 * In-memory label registry for shell navigation (breadcrumbs, route titles, param names).
 * Holds id → display-name only. Page tables and feature state live in route-local $state.
 */
export const projectStore = $state({
	projects: [] as ProjectBreadcrumb[],
	towerTypes: [] as TowerBreadcrumb[],
	stubTypes: [] as StubBreadcrumb[],
	releases: [] as ReleaseBreadcrumb[],
	deliverySchedules: [] as DeliveryScheduleBreadcrumb[],
	productionPlans: [] as ProductionPlanBreadcrumb[],
	bomConfigs: [] as BomBreadcrumb[]
});
