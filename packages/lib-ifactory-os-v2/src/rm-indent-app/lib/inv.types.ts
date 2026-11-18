/** Inv entity + job result shapes (datahub REST - numerics often strings). */

export type InvStockLineRow = {
	stock_line_id: string;
	item_id: string;
	project_id: string;
	plant_id: string;
	location_id?: string | null;
	location_ref?: string;
	physical_location?: string | null;
	bundle_no?: string;
	variant_key?: string;
	lot_code?: string;
	serial_no?: string;
	expiry_date?: string | null;
	qty_base: string | number;
	locked_base: string | number;
	free_base: string | number;
	base_uom: string;
	source_qty?: string | number | null;
	source_uom?: string | null;
	weight_kg?: string | number | null;
	/** BOM section of this line's project, as the BOM spells it (D5b). NULL = unresolved. */
	bom_section?: string | null;
	bom_material_grade?: string | null;
	last_upload_id?: string | null;
	metadata?: Record<string, unknown>;
	created_at?: string;
	updated_at?: string | null;
};

export type InvItemRow = {
	item_id: string;
	item_code: string;
	name?: string | null;
	material_grade?: string | null;
	item_class?: string;
	stock_archetype?: string;
	tracking_mode?: string;
	base_uom?: string;
};

export type InvItemAliasRow = {
	alias_id?: string;
	alias: string;
	item_id: string;
	source?: string;
};

export type InvStockUploadRow = {
	upload_id: string;
	project_id?: string | null;
	plant_id: string;
	project_map?: Record<string, string>;
	status: string;
	rows_total?: number | string;
	is_initial_load?: boolean;
	uploaded_by?: string | null;
	applied_at?: string | null;
	rows_imported?: number | string | null;
	rows_rejected?: number | string | null;
	lines_zeroed?: number | string | null;
	locks_released?: number | string | null;
};

export type InvStockUploadRowInput = {
	upload_row_id?: string;
	upload_id: string;
	row_number: number;
	raw: Record<string, unknown>;
	plant_ref?: string | null;
	project_ref?: string | null;
	item_code?: string | null;
	name?: string | null;
	material_grade?: string | null;
	qty?: number | string | null;
	qty_uom?: string | null;
	lot_code?: string | null;
	serial_no?: string | null;
	expiry_date?: string | null;
	length_mm?: number | string | null;
	width_mm?: number | string | null;
	thickness_mm?: number | string | null;
	location_ref?: string | null;
	physical_location?: string | null;
	bundle_no?: string | null;
	weight_mt?: number | string | null;
	remark?: string | null;
	validation_status?: 'ok' | 'warning' | 'error';
	validation_code?: string | null;
	metadata?: Record<string, unknown>;
};

export type InvStockUploadRowRecord = InvStockUploadRowInput & {
	upload_row_id: string;
	validation_status: string;
	validation_code?: string | null;
	validation_message?: string | null;
};

export type InvStockLockRow = {
	lock_id: string;
	lock_group: string;
	owner_type: string;
	owner_id?: string | null;
	owner_ref?: string | null;
	owner_line_id?: string | null;
	owner_line_ref?: string | null;
	item_id: string;
	stock_line_id?: string | null;
	project_id?: string | null;
	plant_id: string;
	variant_key?: string;
	required_base: string | number;
	locked_base: string | number;
	short_base: string | number;
	base_uom: string;
	status: string;
	release_reason?: string | null;
	locked_by?: string | null;
	locked_at?: string | null;
};

export type InvActor = {
	name?: string;
	user_id?: string;
};

export type ApplyUploadResult = {
	upload_id: string;
	already_applied?: boolean;
	rows_imported: number;
	rows_rejected: number;
	rows_warned?: number;
	lines_zeroed: number;
	locks_released: number;
	projects?: Array<{
		project_id: string;
		name?: string;
		rows: number;
		lines_zeroed: number;
		locks_released: number;
		/** Rows whose item did not resolve to any section of this project's BOMs (D5b). */
		rows_without_bom_section?: number;
	}>;
	unresolved_projects?: Array<{
		project_ref: string;
		rows: number;
		code: string;
	}>;
};

export type ConfirmLockResult = {
	lock_group: string;
	locked_bars: number;
	short_bars: number;
	short_refs: string[];
	already_active?: boolean;
};

export type BuildStockMapResult = {
	stock: Record<string, Array<{ length: number; quantity: number }>>;
	stock_basis: Record<string, unknown>;
	unmatched_sections: string[];
	exhausted_sections: string[];
	warnings: string[];
};

/** @deprecated Rev 3: required is server-side; do not send sources to jobs. */
export type InvSource = {
	run_id: string;
	sets: number;
};

/** Assign & Lock / Select Sections row from GET inv_plan_lock_summary. */
export type PlanLockSummaryRow = {
	row_key: string;
	/** Null when the month is committed to shop floor (view stamps null on purpose). */
	central_plan_id: string | null;
	month: string | null;
	project_id: string;
	project_name: string;
	delivery_schedule_id: string;
	delivery_schedule_name: string;
	delivery_schedule_line_id: string;
	structure_id: string | null;
	tower_label: string;
	bom_id: string;
	bom_name: string;
	item_id: string | null;
	item_code: string;
	section: string;
	length_mm: number;
	variant_key: string;
	required_qty_base: number;
	remaining_qty_base: number;
	indented_qty_base: number;
	procure_qty_base: number;
	free_qty_base: number;
	locked_qty_base: number;
	unit_weight_kg_m: number | null;
	required_weight_kg: number | null;
	procure_weight_kg: number | null;
	free_weight_kg: number | null;
	locked_weight_kg: number | null;
	unresolved: boolean;
	runs_unpinned: number;
	/** Quantity came from a frozen shop-floor plan, not a central-plan cell. */
	committed: boolean;
	/** >1 means two central plans both claim this DS line in this month (view sums them). */
	plan_count: number;
	run_id?: string | null;
};

/** @deprecated Use PlanLockSummaryRow. */
export type MpLockSummaryRow = PlanLockSummaryRow;
/** @deprecated Use PlanLockSummaryRow. */
export type BuildLockSummaryRow = PlanLockSummaryRow;

export type StockAvailableLengthRow = {
	item_id: string;
	length_mm: number;
	bundles: number;
	free_qty_base: number;
};

/** One requirement row from GET inv_ds_requirements (DS line × plan section × RM length). */
export type DsRequirementRow = {
	row_key: string;
	delivery_schedule_line_id: string;
	delivery_schedule_id: string;
	project_id: string;
	structure_id: string | null;
	bom_id: string;
	run_id: string | null;
	run_version: number | null;
	run_pinned: boolean;
	plan_section: string;
	base_section: string | null;
	item_id: string | null;
	item_code: string | null;
	length_mm: number;
	variant_key: string;
	sets: number;
	per_set_qty_base: number;
	required_qty_base: number;
	unit_weight_kg_m: number | null;
	required_weight_kg: number | null;
};

/** DS-line rollup for tonnage cards (GET inv_ds_requirement_rollup). */
export type DsRequirementRollupRow = {
	central_plan_id: string;
	/** @deprecated alias of central_plan_id */
	mfg_plan_ref: string;
	month: string | null;
	delivery_schedule_id: string;
	delivery_schedule_line_id: string;
	project_id: string;
	structure_id: string | null;
	bom_id: string | null;
	run_id: string | null;
	sets: number;
	required_qty_base: number;
	required_weight_kg: number | null;
	marking_weight_kg: number | null;
	lines_without_weight: number;
	unresolved_sections: number;
};

export type LockStockResult = {
	lock_group: string;
	locked_picks: number;
	locked_qty: number;
	already_locked_picks: number;
	version?: number;
};

export type ReleaseLockResult = {
	released: number;
	unwound_lines: number;
	already_released: number;
	versions?: Record<string, number>;
};

export type ApplyToLockResult = {
	run_id: string;
	published: boolean;
	pinned_line_ids: string[];
	stale_locks: Array<{
		lock_id: string;
		item_code?: string;
		length_mm?: number;
		locked_qty_base?: number;
	}>;
	affected_indents: Array<{
		indent_id: string;
		indent_no?: string | number;
		status?: string;
		line_count?: number;
	}>;
	warnings: string[];
};

export type BuildIndentLine = {
	item_id: string;
	item_code?: string;
	section?: string;
	/** Present when length is encoded separately; otherwise use variant_key `L=…`. */
	length_mm?: number | string;
	variant_key: string;
	base_uom: string;
	sort_order?: number;
	required_qty_base: number | string;
	stock_qty_base: number | string;
	locked_qty_base?: number | string;
	carried_shortfall_base?: number | string;
	allowance_pct?: number | string;
	cp_recommended_length_mm?: number | string | null;
	overridden_length_mm?: number | string | null;
	procure_length_mm?: number | string | null;
	procure_qty_base: number | string;
	unit_weight_kg_m?: number | string | null;
	required_weight_kg?: number | string | null;
	procure_weight_kg?: number | string | null;
	scheme_snapshot?: unknown;
	components?: Array<Record<string, unknown>>;
};

export type BuildIndentResult = {
	indent: Record<string, unknown>;
	sources: Array<Record<string, unknown>>;
	lines: BuildIndentLine[];
	warnings: string[];
	totals?: {
		required_weight_kg: number | null;
		procure_weight_kg: number | null;
		lines_without_weight: number;
	};
};

export type PlantRow = {
	plant_id: string;
	name: string;
	is_active?: boolean;
};

export type StockPickRow = {
	id: string;
	bundle_no: string;
	batch: string;
	physical_location: string;
	free_pcs: number;
	free_label: string;
	/** Pcs the user wants to take from this bundle in the Assign pick modal. */
	take_qty: number;
	/** Present when loaded from inv_stock_lines (Assign pick modal). */
	plant_id?: string;
};
