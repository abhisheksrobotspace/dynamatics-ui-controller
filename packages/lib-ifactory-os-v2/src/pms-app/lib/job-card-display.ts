/**
 * Read-only view of a rev-2 job card (`JOB_CARD_ARTIFACTS_UI_HANDOFF.md` §2.2).
 *
 * `display` is opaque JSON on the card in `jobs:<aid>`. This reads the keys the
 * HMI renders and ignores the rest. Drawings come from `artifacts[]` (mark, file,
 * mime). The signed `url` is never copied onto the panel.
 */

import { drawingArtifactDest, extFromMime } from './drawing-files.js';

export type JobCardDisplayHeader = {
	jcSrNo: string;
	date: string;
	customer: string;
	workOrder: string;
	batchNo: string;
	rmGrade: string;
	towerType: string;
	subtype: string;
	sets: string;
	projectName: string;
};

export type JobCardDisplayMark = {
	id: string;
	markNo: string;
	lengthMm: string;
	widthMm: string;
	wtPerPieceKg: string;
	totalPcs: string;
	totalWtKg: string;
	holes: string;
	operation: string;
	bundles: string;
};

export type JobCardDisplayRequisition = {
	id: string;
	section: string;
	lengthMm: string;
	quantity: string;
	weightKg: string;
};

export type JobCardDisplayCuttingRow = {
	id: string;
	rmId: string;
	lengthMm: string;
	quantity: string;
	markings: string;
	usedMm: string;
	wasteMm: string;
	wastePct: string;
	weightKg: string;
};

export type JobCardDisplayScheduleRow = {
	id: string;
	machine: string;
	plannedStart: string;
	plannedEnd: string;
	materialId: string;
	lengthMm: string;
	operation: string;
	qty: string;
};

export type JobCardDrawing = {
	id: string;
	markNo: string;
	fileId: string;
	/** `jpg`, `png`, or `webp` from `artifacts[].mime`. */
	ext: string;
	/** `jobs/<jobId>/<fileId>.<ext>` — the runtime destination. Empty when the path is not safe. */
	dest: string;
	/**
	 * Same-origin path the device serves at `/artifacts/…`.
	 * Empty when the mime is unknown or the link is past `expiresAt`.
	 */
	src: string;
	expired: boolean;
};

export type JobCardPanel = {
	/** `card.qr`. Empty when the card has no code (rev 1). */
	qr: string;
	header: JobCardDisplayHeader;
	marks: JobCardDisplayMark[];
	requisition: JobCardDisplayRequisition[];
	cuttingPlan: JobCardDisplayCuttingRow[];
	schedule: JobCardDisplayScheduleRow[];
	drawings: JobCardDrawing[];
};

function linkExpired(expiresAt: string): boolean {
	if (!expiresAt) return false;
	const at = Date.parse(expiresAt);
	return Number.isFinite(at) && at <= Date.now();
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/** String or finite number. Objects and arrays are dropped so they cannot be rendered as markup. */
function cell(value: unknown): string {
	if (typeof value === 'number' && Number.isFinite(value)) return String(value);
	if (typeof value === 'string') return value.trim();
	return '';
}

function rowsOf<T>(raw: unknown, map: (row: Record<string, unknown>, index: number) => T): T[] {
	if (!Array.isArray(raw)) return [];
	const rows: T[] = [];
	for (let index = 0; index < raw.length; index += 1) {
		const row = raw[index];
		if (!isRecord(row)) continue;
		rows.push(map(row, index));
	}
	return rows;
}

function emptyHeader(): JobCardDisplayHeader {
	return {
		jcSrNo: '',
		date: '',
		customer: '',
		workOrder: '',
		batchNo: '',
		rmGrade: '',
		towerType: '',
		subtype: '',
		sets: '',
		projectName: ''
	};
}

/** Panel for one card record. A missing `display` or `qr` yields empty strings and empty tables. */
export function jobCardPanelFromCard(card: Record<string, unknown> | undefined): JobCardPanel {
	const display = isRecord(card?.display) ? card.display : {};
	const headerRaw = isRecord(display.header) ? display.header : {};
	const qr = typeof card?.qr === 'string' ? card.qr.trim() : '';
	const jobId = cell(card?.jobId);

	return {
		qr,
		header: {
			...emptyHeader(),
			jcSrNo: cell(headerRaw.jcSrNo),
			date: cell(headerRaw.date),
			customer: cell(headerRaw.customer),
			workOrder: cell(headerRaw.workOrder),
			batchNo: cell(headerRaw.batchNo),
			rmGrade: cell(headerRaw.rmGrade),
			towerType: cell(headerRaw.towerType),
			subtype: cell(headerRaw.subtype),
			sets: cell(headerRaw.sets),
			projectName: cell(headerRaw.projectName)
		},
		marks: rowsOf(display.marks, (row, index) => ({
			id: `mark-${index}`,
			markNo: cell(row.markNo),
			lengthMm: cell(row.lengthMm),
			widthMm: cell(row.widthMm),
			wtPerPieceKg: cell(row.wtPerPieceKg),
			totalPcs: cell(row.totalPcs),
			totalWtKg: cell(row.totalWtKg),
			holes: cell(row.holes),
			operation: cell(row.operation),
			bundles: cell(row.bundles)
		})),
		requisition: rowsOf(display.requisition, (row, index) => ({
			id: `req-${index}`,
			section: cell(row.section),
			lengthMm: cell(row.lengthMm),
			quantity: cell(row.quantity),
			weightKg: cell(row.weightKg)
		})),
		cuttingPlan: rowsOf(display.cuttingPlan, (row, index) => ({
			id: `cut-${index}`,
			rmId: cell(row.rmId),
			lengthMm: cell(row.lengthMm),
			quantity: cell(row.quantity),
			markings: cell(row.markings),
			usedMm: cell(row.usedMm),
			wasteMm: cell(row.wasteMm),
			wastePct: cell(row.wastePct),
			weightKg: cell(row.weightKg)
		})),
		schedule: rowsOf(display.schedule, (row, index) => ({
			id: `sch-${index}`,
			machine: cell(row.machine),
			plannedStart: cell(row.plannedStart),
			plannedEnd: cell(row.plannedEnd),
			materialId: cell(row.materialId),
			lengthMm: cell(row.lengthMm),
			operation: cell(row.operation),
			qty: cell(row.qty)
		})),
		drawings: rowsOf(card?.artifacts, (row, index) => {
			const fileId = cell(row.fileId);
			if (!fileId) return null;
			const ext = extFromMime(cell(row.mime));
			const expired = linkExpired(cell(row.expiresAt));
			const dest = drawingArtifactDest(jobId, fileId, ext);
			const src =
				!expired && dest
					? `/artifacts/jobs/${encodeURIComponent(jobId)}/${encodeURIComponent(fileId)}.${ext}`
					: '';
			return {
				id: `drawing-${index}`,
				markNo: cell(row.markNo),
				fileId,
				ext,
				dest,
				src,
				expired
			};
		}).filter((row): row is JobCardDrawing => row !== null)
	};
}
