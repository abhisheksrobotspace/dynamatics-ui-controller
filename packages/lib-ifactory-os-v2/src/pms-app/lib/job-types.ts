/** Plate HMI — operations are not driven from job/KV; always this label. */
export const PLATE_OPERATIONS_LABEL = 'Punch / Drill / Mark';

/** Angle StartJob cutting-plan table row. */
export interface CuttingPlanRow {
	markNo: string;
	profile: string;
	/** Part length in mm (matches controller marking.itemLength). */
	length: number;
	qty: number;
	pcsPerBar: number;
}

export interface MarkLine {
	id: string;
	pcsPerBar: number | null;
	operations: number | null;
	pcs: number | null;
	partLength: number | null;
	progressCurrent: number | null;
	progressTotal: number | null;
	produced?: number | null;
}

export interface ActiveJob {
	jobId: string;
	/** Paper / HMI display label when cloud stamped it (`M-368`). */
	cardLabel?: string;
	jobCode?: string;
	section: string;
	rmLength: string;
	rmId: string;
	/**
	 * RMs this job ran: startJob `rmId` plus every `/iow/selectRmId`.
	 * Used to fill summary plan columns (controller `UI_JOB_SUMMARY_MARKS.md`).
	 */
	runRmIds: string[];
	piecesCut: number | null;
	piecesPlanned: number | null;
	barsCompleted: number | null;
	barsPlanned: number | null;
	/** Angle: a bar is on the machine and not finished (`/iow/jobProgress.barInProgress`). */
	barInProgress?: boolean;
	completePercent: number | null;
	startTimeLabel: string;
	marks: MarkLine[];
	/** Angle: the mark the latest progress update cut (`applyJobProgress`). */
	lastCutMarkId?: string;
	/** Plate CNC fields */
	markNo?: string;
	bundleNo?: string;
	thickness?: string;
	partSize?: string;
	operationsText?: string;
	dueDate?: string;
	/** Plate CNC: live hole count from job progress. */
	holes?: number;
	/** Manual: live hole count from job progress (`operations`). */
	operationsCount?: number;
	cardType?: 'angle' | 'plate' | 'manual';
	plannedPlates?: number;
	elapsedLabel?: string;
}
