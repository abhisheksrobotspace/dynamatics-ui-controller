/** Manufacturing plan Delivery Schedule tree types (APS). */

export type MfgDsRowLevel = 'project' | 'schedule' | 'structure' | 'bom';

export type MfgDsBomLine = {
	/** Unique leaf id: scheduleId + bomId. */
	id: string;
	scheduleId: string;
	projectId: string;
	structureId: string;
	bomId: string;
	/** `proj_delivery_schedule_lines.delivery_schedule_line_id` for APS `selected_lines`. */
	scheduleLineId: string;
	bomName: string;
	unit: string;
	qty: number;
	/** Line weight in MT from `inv_ds_requirement_rollup`; null when unknown. */
	weightMt: number | null;
};

export type MfgDsStructureGroup = {
	id: string;
	structureId: string;
	name: string;
	type: 'tower' | 'stub' | string;
	boms: MfgDsBomLine[];
	weightMt: number | null;
};

export type MfgDsScheduleGroup = {
	id: string;
	scheduleId: string;
	projectId: string;
	/** ISO date YYYY-MM-DD. */
	deliveryDate: string;
	/** Display label e.g. Lot A - 15-07-2026. */
	label: string;
	name: string;
	structures: MfgDsStructureGroup[];
	weightMt: number | null;
};

export type MfgDsProjectGroup = {
	id: string;
	projectId: string;
	title: string;
	workOrderCode?: string;
	schedules: MfgDsScheduleGroup[];
	weightMt: number | null;
};

export type MfgDsTreeRowData = {
	level: MfgDsRowLevel;
	unit?: string;
	qty?: string;
	weightMt?: number | null;
	projectId?: string;
	scheduleId?: string;
	structureId?: string;
	bomId?: string;
};

export type MfgDsProjectWeight = {
	projectId: string;
	title: string;
	weightMt: number;
};

export type MfgPlanDsSummary = {
	projects: MfgDsProjectWeight[];
	selectedWeightMt: number | null;
	capacityMt: number | null;
	maxLoading: number | null;
	maxMt: number | null;
};

/** APS junction row input when saving a manufacturing plan. */
export type CreatePlanDeliveryScheduleInput = {
	projectId: string;
	deliveryScheduleId: string;
	plantId: string;
	selectedLines: Record<string, number>;
};
