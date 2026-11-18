/** Row shape returned by `GET /api/v2/datahub/proj_customers`. */
export type ProjCustomerRow = {
	customer_id: string;
	name: string;
	active?: boolean;
	metadata?: Record<string, unknown>;
};

/** Row shape returned by `GET /api/v2/datahub/proj_contractors`. */
export type ProjContractorRow = {
	contractor_id: string;
	name: string;
	mark_number_regex?: string | null;
	sample_mark_numbers?: string[] | null;
	active?: boolean;
	metadata?: Record<string, unknown>;
};

/** Row shape returned by `GET /api/v2/datahub/proj_projects`. */
export type ProjProjectRow = {
	project_id: string;
	name: string;
	customer_id: string;
	contractor_id?: string | null;
	active: boolean;
	metadata: Record<string, unknown>;
	created_at?: string;
	updated_at?: string | null;
};

/** Row shape returned by `GET /api/v2/datahub/proj_structures`. */
export type ProjStructureRow = {
	structure_id: string;
	project_id: string;
	name: string;
	type: 'tower' | 'stub';
	sort_order: number;
	metadata?: Record<string, unknown>;
	created_at?: string;
	updated_at?: string | null;
};

/** `proj_boms.stage` — user-controlled proto→mass; no server gating. */
export type ProjBomStage = 'proto' | 'mass';

/** Row shape returned by `GET /api/v2/datahub/proj_boms`. */
export type ProjBomRow = {
	bom_id: string;
	structure_id: string;
	bom_name: string;
	/**
	 * Groups versions of one BOM. Equals v1's `bom_id` (trigger-defaulted on create).
	 * Plain uuid — not a self-FK.
	 */
	bom_lineage_id?: string;
	/** Sequence within the lineage (unique per lineage). */
	version?: number;
	/** User-controlled `proto` | `mass`. */
	stage?: ProjBomStage | string | null;
	bom_file_id?: string | null;
	extract_status?: string | null;
	ocr_status?: string | null;
	/** Denormalized cutting-plan cache: `none` | `planned`. */
	cp_status?: string | null;
	sort_order: number;
	metadata?: Record<string, unknown>;
	created_at?: string;
	updated_at?: string | null;
};

/** Row shape returned by `GET /api/v2/datahub/proj_bom_drawings`. */
export type ProjBomDrawingRow = {
	bom_drawing_id: string;
	bom_id: string;
	file_id: string;
	drawing_set?: string | null;
	set_sort_order?: number | null;
	sort_order: number;
	created_at?: string;
	/** Present when listed with `files` join (`f.file_name`). */
	file_name?: string | null;
};

/** Row shape returned by `GET /api/v2/datahub/proj_fabrication_releases`. */
export type ProjFabricationReleaseRow = {
	release_id: string;
	project_id: string;
	release_name: string;
	release_date: string;
	notes?: string | null;
	metadata?: Record<string, unknown>;
	created_at?: string;
	updated_at?: string | null;
};

/** Row shape returned by `GET /api/v2/datahub/proj_production_plans`. */
export type ProjProductionPlanRow = {
	production_plan_id: string;
	project_id: string;
	plan_name: string;
	plan_date: string;
	status: 'draft' | 'confirmed' | string;
	notes?: string | null;
	metadata?: Record<string, unknown>;
	created_at?: string;
	updated_at?: string | null;
	confirmed_at?: string | null;
};

/** Row shape returned by `GET /api/v2/datahub/proj_production_plan_lines`. */
export type ProjProductionPlanLineRow = {
	production_plan_line_id: string;
	production_plan_id: string;
	bom_id: string;
	quantity: number;
	tentative_order_qty?: number | null;
	unit: string;
	description?: string | null;
	cp_run_id?: string | null;
	metadata?: Record<string, unknown>;
	created_at?: string;
};

/** @deprecated Use {@link ProjProductionPlanLineRow}. */
export type ProjPlanLineRow = ProjProductionPlanLineRow;

export type ProductionPlanSummaryMetadata = {
	releases?: string;
	total_qty?: number;
};

/** Row shape returned by `GET /api/v2/datahub/proj_delivery_schedules`. */
export type ProjDeliveryScheduleRow = {
	delivery_schedule_id: string;
	project_id: string;
	delivery_date: string;
	status: 'draft' | 'confirmed' | 'frozen' | string;
	plant_id?: string | null;
	name?: string | null;
	description?: string | null;
	metadata?: Record<string, unknown>;
	created_at?: string;
	updated_at?: string | null;
	confirmed_at?: string | null;
	frozen_at?: string | null;
};

/** Row shape returned by `GET /api/v2/datahub/proj_delivery_schedule_lines`. */
export type ProjDeliveryScheduleLineRow = {
	delivery_schedule_line_id: string;
	delivery_schedule_id: string;
	bom_id: string;
	quantity: number;
	cp_run_id?: string | null;
	unit: string;
	description?: string | null;
	metadata?: Record<string, unknown>;
	created_at?: string;
};

/** Row shape returned by `GET /api/v2/datahub/proj_release_lines`. */
export type ProjReleaseLineRow = {
	release_line_id: string;
	release_id: string;
	bom_id: string;
	quantity: number;
	tentative_order_qty?: number | null;
	unit: string;
	description?: string | null;
	metadata?: Record<string, unknown>;
	created_at?: string;
};

export type Customer = {
	id: string;
	name: string;
};

export type Contractor = {
	id: string;
	name: string;
	/**
	 * Sample-marking image file ids (side-by-side on OCC).
	 * Reads `metadata.sample_markings_file_ids` and legacy `sample_markings_file_id`.
	 */
	sampleMarkingsFileIds: string[];
	/** @deprecated Prefer `sampleMarkingsFileIds[0]`. */
	sampleMarkingsFileId: string | null;
	metadata: Record<string, unknown>;
};

const PROJECT_METADATA_KEYS = {
	shortName: 'short_name',
	workOrderNo: 'work_order_no',
	projectDetails: 'project_details',
	lineDetails: 'line_details',
	loaNo: 'loa_no',
	createdBy: 'created_by'
} as const;

function stringFromMetadata(metadata: Record<string, unknown> | undefined, key: string): string {
	const value = metadata?.[key];
	return typeof value === 'string' ? value.trim() : '';
}

function setOrDeleteMetadataString(
	metadata: Record<string, unknown>,
	key: string,
	value: string
): void {
	const trimmed = value.trim();
	metadata[key] = trimmed;
}

export type ProjectSetupFields = {
	workOrderNo: string;
	projectDetails: string;
	lineDetails: string;
	loaNo: string;
};

export type ProjectMetadataInput = ProjectSetupFields & {
	shortName: string;
};

export function projectSetupFromMetadata(
	metadata: Record<string, unknown> | undefined
): ProjectSetupFields {
	return {
		workOrderNo: stringFromMetadata(metadata, PROJECT_METADATA_KEYS.workOrderNo),
		projectDetails: stringFromMetadata(metadata, PROJECT_METADATA_KEYS.projectDetails),
		lineDetails: stringFromMetadata(metadata, PROJECT_METADATA_KEYS.lineDetails),
		loaNo: stringFromMetadata(metadata, PROJECT_METADATA_KEYS.loaNo)
	};
}

export function shortNameFromMetadata(metadata: Record<string, unknown> | undefined): string {
	return stringFromMetadata(metadata, PROJECT_METADATA_KEYS.shortName);
}

export function createdByFromMetadata(metadata: Record<string, unknown> | undefined): string {
	return stringFromMetadata(metadata, PROJECT_METADATA_KEYS.createdBy);
}

export function metadataWithProjectFields(
	existing: Record<string, unknown> | undefined,
	input: ProjectMetadataInput
): Record<string, unknown> {
	const next = { ...(existing ?? {}) };
	setOrDeleteMetadataString(next, PROJECT_METADATA_KEYS.shortName, input.shortName);
	setOrDeleteMetadataString(next, PROJECT_METADATA_KEYS.workOrderNo, input.workOrderNo);
	setOrDeleteMetadataString(next, PROJECT_METADATA_KEYS.projectDetails, input.projectDetails);
	setOrDeleteMetadataString(next, PROJECT_METADATA_KEYS.lineDetails, input.lineDetails);
	setOrDeleteMetadataString(next, PROJECT_METADATA_KEYS.loaNo, input.loaNo);
	return next;
}

/** Stamp `created_by` once on create; leave existing value alone on edit. */
export function metadataWithCreatedBy(
	metadata: Record<string, unknown>,
	createdBy: string
): Record<string, unknown> {
	const existing = stringFromMetadata(metadata, PROJECT_METADATA_KEYS.createdBy);
	if (existing) return metadata;
	const trimmed = createdBy.trim();
	if (!trimmed) return metadata;
	return { ...metadata, [PROJECT_METADATA_KEYS.createdBy]: trimmed };
}

export function metadataWithShortName(
	existing: Record<string, unknown> | undefined,
	shortName: string
): Record<string, unknown> {
	return metadataWithProjectFields(existing, {
		shortName,
		...projectSetupFromMetadata(existing)
	});
}
