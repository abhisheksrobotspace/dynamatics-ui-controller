export type MarkData = {
	id: string;
	sectionId: string;
	markName: string;
	length: number;
	qty: number;
	/** Total weight for this mark line from BOM (`total_weight` / Weight in Kgs black). */
	totalWeightKg?: number;
};

export type SectionData = {
	id: string;
	name: string;
	flange: number;
	thickness: number;
	unitWeightKgPerM?: number;
	marks: MarkData[];
	/** Original BOM section name before length-group suffixing. */
	baseName?: string;
	/** Length-group name appended when this section was split. */
	groupName?: string;
};

export type CuttingPlanDraft = {
	selectedMarks: string[];
	sections: SectionData[];
	/** When true, Select Sections shows only `sections` from the draft (partial replan). */
	replanSectionsOnly?: boolean;
	/** Set when entering replan from an existing BOM plan (BOM list / planner Replan All). */
	replanFromExisting?: boolean;
	/** Run whose Results page launched this replan — used for breadcrumb back-link + partial merge base. */
	replanSourceRunId?: string;
	/**
	 * Stock lengths to leave unselected by default on Stock Lengths (e.g. the short length
	 * the Lock row was replanning away from). Still shown so the user can re-add them.
	 */
	replanExcludeStockLengths?: number[];
	/**
	 * When true, Stock Lengths prefers free inventory (`inv_stock_available_lengths`) over the
	 * section-rule pitch grid. Set only for RMI / Lock single-section replan — not for Cutting
	 * Plan new plan or Replan All.
	 */
	useAvailableStockLengths?: boolean;
};

export type PlanMarking = {
	mark: string | null;
	length: number;
	quantity: number;
};

export type PlanSectionParts = {
	size: string;
	type: string;
	shape: string;
	thickness: number | null;
	end_trim?: number;
	/** Unit weight in kg/m from imported BOM. */
	unit_weight?: number;
	markings: PlanMarking[];
};

export type PlannerConfig = {
	time_limit_per_section: number;
	max_unique_lengths_per_bar: number;
	max_unique_stock_lengths: number;
	/**
	 * When true, all pieces of a mark must come from bars of the same RM length.
	 * Null/omit → solver uses its server default (`solver.enforce_mark_cohesion`).
	 */
	enforce_mark_cohesion?: boolean | null;
};

export type StockEntry = number | { length: number; quantity: number };

export type PlanRequest = {
	bom_id: string;
	parts_by_section: Record<string, PlanSectionParts>;
	/** Bare number = unlimited supply of that length; `{length,quantity}` caps register stock. */
	stock: Record<string, StockEntry[]>;
	config: PlannerConfig;
};

export type PlanBarRow = {
	/** Present when loaded from datahub detail selects. */
	bar_id?: string;
	rmid: string;
	rm_length: number;
	quantity: number;
	markings: PlanMarking[];
};

export type PlanSectionResult = {
	status?: string;
	num_bars?: number;
	total_stock_length?: number;
	waste?: number;
	runtime?: number;
	total_required_length?: number;
	total_stock_weight_kg?: number;
	total_waste_weight_kg?: number;
	total_required_weight_kg?: number;
};

export type PlanSectionOutput = {
	result?: PlanSectionResult;
	plan?: PlanBarRow[];
};

export type PlanResultSummary = {
	total_sections?: number;
	total_bars?: number;
	total_stock?: number;
	total_waste?: number;
	total_required_length?: number;
	total_stock_weight_kg?: number | null;
	total_waste_weight_kg?: number | null;
	total_required_weight_kg?: number | null;
	waste_pct_length?: number;
	waste_pct_weight?: number | null;
	optimal_sections?: number;
	feasible_sections?: number;
};

export type PlanResponse = {
	bom_id?: string;
	result?: PlanResultSummary;
	output?: Record<string, PlanSectionOutput>;
};
