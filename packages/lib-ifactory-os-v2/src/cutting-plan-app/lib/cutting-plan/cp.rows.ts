/**
 * Row shapes returned by the core datahub `GET /api/v2/datahub/cp_*` endpoints.
 * `numeric` columns can serialize as strings from Postgres — the `.api.ts` mappers coerce.
 */

/** `GET /api/v2/datahub/cp_section_rules` */
export type CpSectionRuleRow = {
	rule_id: string;
	project_id: string;
	from_flg_mm: number | string | null;
	to_flg_mm: number | string | null;
	from_thk_mm: number | string | null;
	to_thk_mm: number | string | null;
	min_length_mm: number | string | null;
	max_length_mm: number | string | null;
	pitch_mm: number | string | null;
	end_trim_mm: number | string | null;
	sort_order: number;
	metadata?: Record<string, unknown>;
	created_at?: string;
	updated_at?: string | null;
};

/** `GET /api/v2/datahub/cp_length_groups` */
export type CpLengthGroupRow = {
	length_group_id: string;
	project_id: string;
	name: string;
	min_length_mm: number | string | null;
	max_length_mm: number | string | null;
	sort_order: number;
	metadata?: Record<string, unknown>;
	created_at?: string;
	updated_at?: string | null;
};

/** `GET /api/v2/datahub/cp_planner_settings` (one row per project) */
export type CpPlannerSettingsRow = {
	settings_id: string;
	project_id: string;
	time_limit_per_section: number;
	max_unique_lengths_per_bar: number;
	max_unique_stock_lengths: number;
	/** `marking_cohesion` / `enforce_mark_cohesion` lives here (no dedicated column). */
	metadata?: Record<string, unknown>;
	created_at?: string;
	updated_at?: string | null;
};

/** `GET /api/v2/datahub/cp_plan_runs` (versioned run header + flattened summary + manifest) */
export type CpPlanRunRow = {
	run_id: string;
	bom_id: string;
	version: number;
	run_type: 'full' | 'partial';
	status?: 'queued' | 'solving' | 'completed' | 'failed' | 'cancelled' | 'published';
	plan_job_id?: string | null;
	sections_planned?: string[];
	/** Present on single-run header selects; omitted from All-Plans list selects. */
	section_plan_ids?: string[];
	request?: Record<string, unknown> | null;
	total_bars?: number;
	total_sections?: number;
	total_stock_mm?: number | string | null;
	total_waste_mm?: number | string | null;
	total_required_mm?: number | string | null;
	total_stock_weight_kg?: number | string | null;
	total_waste_weight_kg?: number | string | null;
	total_required_weight_kg?: number | string | null;
	waste_pct_length?: number | string | null;
	waste_pct_weight?: number | string | null;
	optimal_sections?: number;
	feasible_sections?: number;
	error?: string | null;
	/** Set when UI publishes this run for APS / production plans. */
	published_at?: string | null;
	published_by?: string | null;
	metadata?: Record<string, unknown>;
	created_at?: string;
	updated_at?: string | null;
	/** Client enrichment when header is joined to `proj_boms` (not a run-table column). */
	bom_name?: string | null;
};

/** `GET /api/v2/datahub/cp_section_plans` (immutable per-section result) */
export type CpSectionPlanRow = {
	section_plan_id: string;
	bom_id: string;
	section: string;
	section_version: number;
	produced_by_run_id: string | null;
	status: 'optimal' | 'feasible' | 'infeasible';
	num_bars: number;
	total_stock_length_mm: number | string | null;
	waste_mm: number | string | null;
	total_required_length_mm: number | string | null;
	total_stock_weight_kg: number | string | null;
	total_waste_weight_kg: number | string | null;
	total_required_weight_kg: number | string | null;
	runtime_ms: number | null;
	metadata?: Record<string, unknown>;
	created_at?: string;
};

/** `GET /api/v2/datahub/cp_section_plan_bars` (bars for one section-version) */
export type CpSectionPlanBarRow = {
	bar_id?: string;
	section_plan_id: string;
	bar_index: number;
	/** Present on detail selects; omitted on summary (stock-length only) reads. */
	rmid?: string;
	rm_length_mm: number | string | null;
	quantity: number;
	/** Present on detail selects; omitted on summary reads. */
	markings?: Array<{ mark: string | null; length: number; quantity: number }>;
	metadata?: Record<string, unknown>;
	created_at?: string;
};
