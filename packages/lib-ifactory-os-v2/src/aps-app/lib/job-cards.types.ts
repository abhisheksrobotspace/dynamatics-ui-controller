/** Job card status persisted on `aps_cards.status`. */
export type JobCardStatus =
	'draft' | 'published' | 'pushed' | 'material_issued' | 'completed' | 'cancelled';

export type JobCardSummary = {
	/** `aps_job_cards.job_card_id` - used for routing. */
	jobId: string;
	runId: string;
	planId: string;
	/** Display JC / SR No. (`card_ref` or `M-${card_no}`). */
	jcSrNo: string;
	workOrder: string;
	towerType: string;
	subtype: string;
	section: string;
	sets: number;
	markCount: number;
	/** Canonical weight in kg - display may show kg or MT. */
	totalWeightKg: number;
	date: string;
	status: JobCardStatus;
	sortOrder: number;
};

export type JobCardBundleGroup = {
	count: number;
	pieces: number;
};

export type JobCardMarkRow = {
	id: string;
	towerType: string;
	subtype: string;
	markNo: string;
	lengthMm: number;
	/** Null / ≤0 when width does not apply (e.g. angles). */
	widthMm: number | null;
	wtPerPieceKg: number;
	totalPcs: number;
	/** Canonical weights in kg - display may show kg or MT; export always kg. */
	totalWtKg: number;
	notchingWtKg: number | null;
	bendingWtKg: number | null;
	heelGrindingWtKg: number | null;
	holes: number;
	stepCodes: string[];
	/** Letters after the first op; `H` → `HG`. */
	operation: string;
	numBundles: number | null;
	bundlesLabel: string;
	sortOrder: number;
};

export type JobCardLoadingRow = {
	id: string;
	machineId: string;
	machineName: string;
	plannedStart: string;
	plannedEnd: string;
	materialId: string;
	lengthMm: number | null;
	operation: string;
	qty: number;
};

export type JobCardRequisitionRow = {
	id: string;
	section: string;
	lengthMm: number;
	quantity: number;
	weightKg: number;
};

export type JobCardCuttingMarking = {
	mark: string;
	lengthMm: number;
	quantity: number;
};

export type JobCardCuttingBarRow = {
	id: string;
	rmid: string;
	lengthMm: number;
	quantity: number;
	markings: string;
	markingItems: JobCardCuttingMarking[];
	usedMm: number;
	wasteMm: number;
	wastePct: number;
	wasteKg: number;
	weightKg: number;
};

export type JobCardCuttingMarkTableRow = {
	id: string;
	markNo: string;
	lengthMm: number;
	pcsPerBar: number;
};

export type JobCardCuttingSummary = {
	quantity: number;
	wasteKg: number;
	weightKg: number;
	wastePct: number;
};

export type JobCardDrawingRow = {
	id: string;
	markNo: string;
	imageUrl: string;
};

export type JobCardDetail = {
	jobId: string;
	runId: string;
	planId: string;
	jcSrNo: string;
	workOrder: string;
	towerType: string;
	subtype: string;
	section: string;
	sets: number;
	status: JobCardStatus;
	date: string;
	/** Display name from `proj_projects` via card `project_id`. */
	projectName: string;
	customerName: string;
	rmGrade: string;
	batchNo: string;
	plantId: string;
	cardFy: number | null;
	solverJobId: string;
	piecesTotal: number;
	numBundles: number | null;
	rows: JobCardMarkRow[];
	loadingRows: JobCardLoadingRow[];
	requisitionRows: JobCardRequisitionRow[];
	cuttingRows: JobCardCuttingBarRow[];
	cuttingSummary: JobCardCuttingSummary | null;
	drawings: JobCardDrawingRow[];
};
