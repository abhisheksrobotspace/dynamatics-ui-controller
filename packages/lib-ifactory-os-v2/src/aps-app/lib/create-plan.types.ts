export type PartRowKind = 'tower' | 'stub' | 'bom';

export type PartRow = {
	key: string;
	kind: PartRowKind;
	depth: number;
	sr?: string;
	description: string;
	unit?: string;
	qtySurvey?: string;
	cleared?: string;
	release?: string;
	cumulative?: string;
	holdLabel?: string;
	/** Line weight in MT (BOM set kg × qty / 1000). */
	weightMt?: number;
	structureId?: string;
	bomId?: string;
	dueDate?: string | null;
};

export type PlanReleaseStatus = 'available' | 'confirmed' | 'unavailable';

export type PlanRelease = {
	id: string;
	projectId: string;
	label: string;
	meta?: string;
	status: PlanReleaseStatus;
	disabledReason?: string;
	selectable: boolean;
	workOrderCode: string;
	sets: number;
	batchWeightMt: number;
	plants: string;
	zincReqMt: number;
	/** release_line_id → quantity for Save `selected_lines`. */
	selectedLines: Record<string, number>;
	structureCount: number;
	towerParts: PartRow[];
	stubs: PartRow[];
	sourceNote?: string;
	dueDate?: string | null;
};

export type PlanProject = {
	id: string;
	title: string;
	subtitle: string;
	workOrderCode: string;
	releases: PlanRelease[];
};

export type PlanSummary = {
	releases: number;
	projects: number;
	workOrders: string;
	sets: number;
	batchWeightMt: number;
	plants: string;
	zincReqMt: number;
	structures: number;
};
