import { globalMqtt } from '$lib/os/lib/custom-scripts/mqtt.js';
import { bringAppToFront } from '$lib/os/index.svelte';
import { getUUID } from '$lib/os/lib/utils/getUUID.js';
import { drawingFetchMessage, drawingFetchesFromJobs } from './drawing-files.js';
import { type ActiveJob, type MarkLine } from './job-types';
import {
	barsToConfirmKeys,
	buildStartJobData,
	donePlateMarkKeys,
	doneRmKeys,
	findManualMark,
	findPlateMark,
	manualTaskKey,
	manualTaskProgress,
	plateMarkPieces,
	formatJobTimestamp,
	formatPlatePartSize,
	formatThicknessMm,
	mergeJobsMaps,
	parseJobsMap,
	resumableBarKeys,
	sortJobsBySchedule,
	wholeBarsFromMarks,
	type HmiJob,
	type JobBar,
	type JobsMap,
	type ManualMark,
	type ManualTaskProgress,
	type PlateMark
} from './jobs';
import { PMS_PUBLISH_TOPICS, PMS_SUBSCRIBE_TOPICS } from './pms-topics';
import { STOPPAGE_REASONS, type StoppageReason } from '$lib/stoppage-reasons';
import {
	setMachineIdleHasActiveJob,
	syncIdleAutoAlertTimeoutFromSettings
} from '$lib/os/machine-idle/machine-idle-store.svelte';
import { syncInterlockWithActiveJob } from '$lib/os/interlock/interlock-store.svelte';
import {
	ensureSelectedAssetId,
	getSelectedAssetId,
	setSelectedAssetId,
	withAssetId
} from '$lib/os/asset-context.js';
import {
	findCatalogReasonByCode,
	findCatalogReasonById,
	loadReasonsCatalog
} from '$lib/os/reasons-catalog.svelte.js';
import { getOperatorSession } from '$lib/os/session.js';
import { publishClitReport } from '$lib/os/cloud-events.js';

/** `appName` of the PMS app in the OS (see app.svelte.ts). */
export const PMS_APP_NAME = 'PMS';

export const pmsStore = $state({
	operatorId: '0192',
	operatorName: 'Shivam',
	jobs: {} as JobsMap,
	jobsLoading: false,
	/** `jobId::rmId` keys that came from partiallyCompletedJobs. */
	resumableBars: [] as string[],
	/** `jobId::marking` keys finished on a parked plate card (`partialJobs:<aid>`). */
	donePlateMarks: [] as string[],
	/** `jobId::rmId` keys finished on a parked angle card (`partialJobs:<aid>`). */
	doneRmIds: [] as string[],
	/** Angle RMs on a parked card whose next start must ask which bar is on the machine, keyed `jobId::rmId`. */
	barsToConfirm: [] as string[],
	/** Plates already made on a parked plate card, keyed `jobId::marking`. */
	plateMarkPieces: {} as Record<string, number>,
	/** Bundles saved on a parked manual card, keyed `manualTaskKey` (`partialJobs:<aid>`). */
	manualTasks: {} as Record<string, ManualTaskProgress>,
	activeJob: null as ActiveJob | null,
	selectedReason: null as StoppageReason | null,
	autoAlertSelectedId: null as number | null,
	jobCompleteFailedMessage: null as string | null,
	/** Controller refused startJob (e.g. breakdown awaits Close Ticket). */
	jobRejectedMessage: null as string | null,
	showSummarySuccess: false,
	totalSeconds: null as number | null,
	uptimeSeconds: 0,
	downtimeSeconds: 0,
	stoppedSeconds: 0,
	jobCompleteAt: '-',
	/** When set, Start Job pre-selects this jobId (e.g. Select New RM from summary). */
	startJobPrefillJobId: null as string | null,
	/** Manual summary: bundles still to do on the card (`/iow/bundleCompleted.remaining`); null when not known. */
	summaryBundlesLeft: null as number | null,
	/** The summary's card was parked with work left (`/iow/jobParked`), not completed. */
	summaryCardParked: false
});

/** The summary on screen ends a bundle (or task) of a card that has more left, not the card. */
export function summaryLeavesCardOpen(): boolean {
	return (pmsStore.summaryBundlesLeft ?? 0) > 0 || pmsStore.summaryCardParked;
}

let mqttBound = false;
let mqttRefCount = 0;
let onMqttEvent: ((topic: string, data: unknown) => void) | null = null;
let navigateToPage: ((page: string) => void) | null = null;
let stoppedTimer: ReturnType<typeof setInterval> | null = null;
let availabilityTimer: ReturnType<typeof setInterval> | null = null;
let increaseUptime = false;
let increaseDowntime = false;
let autoAlertClearTimer: ReturnType<typeof setTimeout> | null = null;

function formatJobCompleteAt(date = new Date()): string {
	return date.toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function asOptionalNumber(value: unknown): number | null {
	if (typeof value === 'number' && Number.isFinite(value)) return value;
	if (typeof value === 'string' && value.trim() !== '') {
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : null;
	}
	return null;
}

/** Epoch ms or ISO timestamp (controller jobSummary uses ISO strings). */
function asOptionalTimestampMs(value: unknown): number | null {
	const asNumber = asOptionalNumber(value);
	if (asNumber != null) return asNumber;
	if (typeof value === 'string' && value.trim() !== '') {
		const parsed = Date.parse(value);
		return Number.isFinite(parsed) ? parsed : null;
	}
	return null;
}

function asOptionalString(value: unknown): string | undefined {
	if (value == null) return undefined;
	const next = String(value).trim();
	return next || undefined;
}

function sumKnown(values: Array<number | null | undefined>): number | null {
	const known = values.filter((value): value is number => value != null && Number.isFinite(value));
	return known.length > 0 ? known.reduce((sum, value) => sum + value, 0) : null;
}

type PlanMark = {
	pcsPerBar: number | null;
	pcs: number | null;
	partLength: number | null;
	progressTotal: number | null;
	operations: number | null;
};

/**
 * Plan columns for summary rows — from the RMs this job ran (not the whole card).
 * See controller `docs/UI_JOB_SUMMARY_MARKS.md`.
 */
function planMarksForRunRms(
	jobId: string | undefined,
	runRmIds: string[]
): Record<string, PlanMark> {
	const out: Record<string, PlanMark> = {};
	const job = jobId ? pmsStore.jobs[jobId] : undefined;
	if (!job) return out;

	// Plate: flat marks — plan from the card (optionally narrowed by active markNo via runRmIds unused).
	if (job.cardType === 'plate' || (job.marks && job.marks.length > 0)) {
		for (const mark of job.marks ?? []) {
			out[mark.marking] = {
				pcsPerBar: null,
				pcs: mark.pcs,
				partLength: mark.itemLength,
				progressTotal: mark.pcs,
				operations: mark.operations ?? null
			};
		}
		return out;
	}

	for (const rmId of runRmIds) {
		const bar = job.bars[rmId];
		if (!bar) continue;
		for (const mark of bar.markings) {
			const piecePlan =
				mark.pcs != null && mark.pcsPerBar != null
					? mark.pcs * mark.pcsPerBar
					: mark.pcsPerBar * bar.quantity;
			const prev = out[mark.marking];
			if (!prev) {
				out[mark.marking] = {
					pcsPerBar: mark.pcsPerBar,
					pcs: mark.pcs ?? bar.quantity,
					partLength: mark.itemLength,
					progressTotal: piecePlan,
					operations: mark.operations ?? null
				};
				continue;
			}
			// Same mark on another run RM: sum planned pieces; keep first length / pcsPerBar.
			out[mark.marking] = {
				...prev,
				pcs: (prev.pcs ?? 0) + (mark.pcs ?? bar.quantity),
				progressTotal: (prev.progressTotal ?? 0) + piecePlan
			};
		}
	}
	return out;
}

/** Controller summary: `[{ marking, pieces, operations }]`. Legacy: keyed object with producedCount. */
function marksFromSummary(
	markings: unknown,
	existing: MarkLine[] = [],
	planByMarking: Record<string, PlanMark> = {}
): MarkLine[] {
	const prior: Record<string, MarkLine> = Object.fromEntries(
		existing.map((mark) => [mark.id, mark])
	);

	const fromRow = (
		marking: string,
		pieces: number | null,
		operations: number | null,
		extra?: Partial<MarkLine>
	): MarkLine => {
		const prev = prior[marking];
		const plan = planByMarking[marking];
		return {
			id: marking,
			pcsPerBar: extra?.pcsPerBar ?? plan?.pcsPerBar ?? prev?.pcsPerBar ?? null,
			operations: operations ?? plan?.operations ?? prev?.operations ?? null,
			pcs: extra?.pcs ?? plan?.pcs ?? prev?.pcs ?? null,
			partLength: extra?.partLength ?? plan?.partLength ?? prev?.partLength ?? null,
			progressCurrent: pieces,
			progressTotal: extra?.progressTotal ?? plan?.progressTotal ?? prev?.progressTotal ?? null,
			produced: pieces
		};
	};

	if (Array.isArray(markings)) {
		const rows: MarkLine[] = [];
		for (const raw of markings) {
			if (!raw || typeof raw !== 'object') continue;
			const row = raw as Record<string, unknown>;
			const marking = asOptionalString(row.marking);
			if (!marking) continue;
			rows.push(fromRow(marking, asOptionalNumber(row.pieces), asOptionalNumber(row.operations)));
		}
		return rows;
	}

	if (!markings || typeof markings !== 'object') return [];

	return Object.entries(markings as Record<string, unknown>).map(([key, raw]) => {
		const info = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
		const pcsPerBar = asOptionalNumber(info.pcsPerBar);
		const pcs = asOptionalNumber(info.pcs);
		const produced = asOptionalNumber(info.pieces) ?? asOptionalNumber(info.producedCount);
		const planned =
			asOptionalNumber(info.quantity) ??
			(pcs != null && pcsPerBar != null ? pcs * pcsPerBar : null);

		return fromRow(
			key,
			produced,
			asOptionalNumber(info.totalOperations) ?? asOptionalNumber(info.operations),
			{
				pcsPerBar,
				pcs,
				partLength: asOptionalNumber(info.markingLength),
				progressTotal: planned
			}
		);
	});
}

type JobProgressRow = {
	marking: string;
	markingProgress: number | null;
	operations: number | null;
	planned: number | null;
};

/** Controller: `{ aid, marks: [...] }` (bar) or `{ aid, operations, marks: [...] }` (ops). */
function parseProgressRows(data: unknown): JobProgressRow[] {
	const rawRows = Array.isArray(data)
		? data
		: data && typeof data === 'object'
			? Array.isArray((data as { marks?: unknown }).marks)
				? (data as { marks: unknown[] }).marks
				: Array.isArray((data as { progress?: unknown }).progress)
					? (data as { progress: unknown[] }).progress
					: null
			: null;
	if (!rawRows) return [];

	const rows: JobProgressRow[] = [];
	for (const raw of rawRows) {
		if (!raw || typeof raw !== 'object') continue;
		const row = raw as Record<string, unknown>;
		const marking = asOptionalString(row.marking);
		if (!marking) continue;
		rows.push({
			marking,
			markingProgress: asOptionalNumber(row.markingProgress) ?? asOptionalNumber(row.pieces),
			operations: asOptionalNumber(row.operations),
			planned: asOptionalNumber(row.planned)
		});
	}
	return rows;
}

function payloadForSelectedAid(data: unknown): Record<string, unknown> | null {
	if (!data || typeof data !== 'object') return null;
	const payload = data as Record<string, unknown>;
	const aid = asOptionalString(payload.aid);
	const selected = getSelectedAssetId();
	if (aid && selected && aid !== selected) return null;
	return payload;
}

function plateFieldsFrom(existing: ActiveJob | null | undefined): Partial<ActiveJob> {
	if (!existing) return {};
	return {
		...(existing.markNo ? { markNo: existing.markNo } : {}),
		...(existing.bundleNo ? { bundleNo: existing.bundleNo } : {}),
		...(existing.thickness ? { thickness: existing.thickness } : {}),
		...(existing.partSize ? { partSize: existing.partSize } : {}),
		...(existing.operationsText ? { operationsText: existing.operationsText } : {}),
		...(existing.dueDate ? { dueDate: existing.dueDate } : {}),
		...(existing.holes != null ? { holes: existing.holes } : {}),
		...(existing.plannedPlates != null ? { plannedPlates: existing.plannedPlates } : {}),
		...(existing.elapsedLabel ? { elapsedLabel: existing.elapsedLabel } : {})
	};
}

function markMatchesProgress(mark: MarkLine, row: JobProgressRow): boolean {
	return mark.id === row.marking;
}

function mergeProgressMarks(existing: MarkLine[], rows: JobProgressRow[]): MarkLine[] {
	const next = existing.map((mark) => ({ ...mark }));

	for (const row of rows) {
		const index = next.findIndex((mark) => markMatchesProgress(mark, row));
		if (index >= 0) {
			const mark = next[index];
			const planned =
				row.planned ??
				mark.progressTotal ??
				(mark.pcs != null && mark.pcsPerBar != null ? mark.pcs * mark.pcsPerBar : null);
			// Angle: `markingProgress` = parts made. Ops marks only carry `planned` — do not
			// clear piece progress, and never overwrite plan `operations` (ops-per-piece) with live counts.
			next[index] = {
				...mark,
				...(row.markingProgress != null
					? { progressCurrent: row.markingProgress, produced: row.markingProgress }
					: {}),
				progressTotal: planned
			};
			continue;
		}

		next.push({
			id: row.marking,
			pcsPerBar: null,
			operations: null,
			pcs: null,
			partLength: null,
			progressCurrent: row.markingProgress,
			progressTotal: row.planned,
			produced: row.markingProgress
		});
	}

	return next;
}

/**
 * Plate `/iow/jobProgress` names the mark in progress (`selected`) and sends `planned` on every
 * mark. Angle progress has neither. Scope plate updates to that one mark.
 */
function plateMarkingFromProgress(
	data: unknown,
	existing: ActiveJob | null | undefined,
	rows: JobProgressRow[]
): string | null {
	if (!rows.some((row) => row.planned != null)) return null;
	if (data && typeof data === 'object' && !Array.isArray(data)) {
		const selected = asOptionalString((data as { selected?: unknown }).selected);
		if (selected) return selected;
	}
	const markNo = existing?.markNo?.trim();
	return markNo ? markNo : null;
}

function barsCompletedFromMarks(marks: MarkLine[]): number | null {
	const perMark = marks.map((mark) => {
		if (mark.pcsPerBar == null || mark.pcsPerBar <= 0 || mark.progressCurrent == null) return null;
		return Math.floor(mark.progressCurrent / mark.pcsPerBar);
	});
	if (perMark.some((value) => value == null)) return null;
	if (perMark.length === 0) return null;
	return Math.min(...(perMark as number[]));
}

function topLevelField(data: unknown, key: string): unknown {
	if (!data || typeof data !== 'object' || Array.isArray(data)) return undefined;
	return (data as Record<string, unknown>)[key];
}

/**
 * The mark this progress update cut: the last one (card order) whose count went up. Progress carries
 * no current-mark field, so this is read from the counts; null when nothing went up.
 */
function lastCutMark(before: MarkLine[], after: MarkLine[]): string | null {
	const previous = new Map(before.map((mark) => [mark.id, mark.progressCurrent ?? 0]));
	let cut: string | null = null;
	for (const mark of after) {
		if ((mark.progressCurrent ?? 0) > (previous.get(mark.id) ?? 0)) cut = mark.id;
	}
	return cut;
}

function applyJobProgress(data: unknown) {
	if (data && typeof data === 'object' && !Array.isArray(data)) {
		const aid = asOptionalString((data as { aid?: unknown }).aid);
		const selected = getSelectedAssetId();
		if (aid && selected && aid !== selected) return;
	}

	const rows = parseProgressRows(data);
	const operations =
		data && typeof data === 'object' && !Array.isArray(data)
			? asOptionalNumber((data as { operations?: unknown }).operations)
			: null;
	if (rows.length === 0 && operations == null) return;

	const existing = pmsStore.activeJob;
	// Plate progress lists every mark on the card, each with its own `planned` and `pieces`.
	// The running screen is one selected mark: keep that mark's counts, and do not fold the
	// other marks into the active job (Save would then send them all).
	const plateMarking = plateMarkingFromProgress(data, existing, rows);
	const rowsForJob = plateMarking ? rows.filter((row) => row.marking === plateMarking) : rows;
	const selectedRow = plateMarking ? (rowsForJob[0] ?? null) : null;
	const marks =
		rowsForJob.length > 0
			? mergeProgressMarks(existing?.marks ?? [], rowsForJob)
			: (existing?.marks ?? []);
	const piecesCut = selectedRow
		? selectedRow.markingProgress
		: sumKnown(marks.map((mark) => mark.progressCurrent));
	const piecesPlanned = selectedRow
		? (selectedRow.planned ?? existing?.piecesPlanned ?? null)
		: (sumKnown(marks.map((mark) => mark.progressTotal)) ?? existing?.piecesPlanned ?? null);
	const completePercent =
		piecesCut != null && piecesPlanned != null && piecesPlanned > 0
			? Math.min(100, Math.round((piecesCut / piecesPlanned) * 100))
			: null;
	const plannedFromProgress = selectedRow
		? selectedRow.planned
		: sumKnown(rows.map((row) => row.planned));
	// Plate: `operations` is the hole count for the selected mark.
	// Manual: the same field is the live hole count, kept in `operationsCount`.
	const manual = existing?.cardType === 'manual';
	const holes = manual
		? null
		: selectedRow?.operations != null
			? selectedRow.operations
			: operations;
	// Angle: the controller's whole-bar count and bar plan are authoritative; keep the local fallbacks.
	const barInProgress = topLevelField(data, 'barInProgress') === true;
	const barsCompleted =
		asOptionalNumber(topLevelField(data, 'barsCompleted')) ?? barsCompletedFromMarks(marks);
	const barsPlanned =
		asOptionalNumber(topLevelField(data, 'barsPlanned')) ?? existing?.barsPlanned ?? null;
	const lastCutMarkId = lastCutMark(existing?.marks ?? [], marks) ?? existing?.lastCutMarkId;

	pmsStore.activeJob = {
		jobId: existing?.jobId || '-',
		...(existing?.cardLabel ? { cardLabel: existing.cardLabel } : {}),
		...(existing?.jobCode ? { jobCode: existing.jobCode } : {}),
		section: existing?.section || '-',
		rmLength: existing?.rmLength || '-',
		rmId: existing?.rmId || '-',
		runRmIds:
			existing?.runRmIds ?? (existing?.rmId && existing.rmId !== '-' ? [existing.rmId] : []),
		piecesCut,
		piecesPlanned,
		barsCompleted,
		barsPlanned,
		barInProgress,
		completePercent,
		startTimeLabel: existing?.startTimeLabel || '-',
		marks,
		...(lastCutMarkId && marks.some((mark) => mark.id === lastCutMarkId) ? { lastCutMarkId } : {}),
		...plateFieldsFrom(existing),
		...(existing?.cardType ? { cardType: existing.cardType } : {}),
		...(holes != null ? { holes } : {}),
		...(manual ? { operationsCount: operations ?? existing?.operationsCount ?? 0 } : {}),
		...(plannedFromProgress != null ? { plannedPlates: plannedFromProgress } : {})
	};
}

function applyJobSummary(data: unknown, success: boolean) {
	if (!data || typeof data !== 'object') return;

	const payload = data as Record<string, unknown>;
	if (typeof payload.failedMessage === 'string' && payload.failedMessage) {
		pmsStore.jobCompleteFailedMessage = payload.failedMessage;
		return;
	}

	pmsStore.jobCompleteFailedMessage = null;
	pmsStore.showSummarySuccess = success;

	const endMs = asOptionalTimestampMs(payload.jobEndTime);
	pmsStore.jobCompleteAt = endMs != null ? formatJobCompleteAt(new Date(endMs)) : '-';

	// Controller jobSummary uses `durationMs`; accept legacy `duration` too.
	const durationMs = asOptionalNumber(payload.durationMs) ?? asOptionalNumber(payload.duration);
	pmsStore.totalSeconds = durationMs != null ? Math.floor(durationMs / 1000) : null;

	const existing = pmsStore.activeJob;
	const runRmIds =
		existing?.runRmIds?.length && existing.runRmIds.length > 0
			? existing.runRmIds
			: existing?.rmId && existing.rmId !== '-'
				? [existing.rmId]
				: [];
	const planByMarking = planMarksForRunRms(
		asOptionalString(payload.jid) ?? existing?.jobId,
		runRmIds
	);
	const summaryMarks = marksFromSummary(payload.markings, existing?.marks ?? [], planByMarking);
	const marks =
		summaryMarks.length > 0
			? summaryMarks
			: (existing?.marks.map((mark) => ({
					...mark,
					produced: mark.produced ?? mark.progressCurrent ?? 0
				})) ?? []);
	const piecesCut = asOptionalNumber(payload.totalParts) ?? existing?.piecesCut ?? null;
	const piecesPlanned =
		sumKnown(marks.map((mark) => mark.progressTotal)) ?? existing?.piecesPlanned ?? null;
	// Angle: prefer the controller's bar plan. `mark.pcs` is the bars carrying that mark, so the sum is
	// only the last resort (plate/manual active jobs keep barsPlanned null and rely on it, as before).
	const barsPlanned =
		asOptionalNumber(payload.barsPlanned) ??
		existing?.barsPlanned ??
		sumKnown(marks.map((mark) => mark.pcs));
	const barsCompleted =
		asOptionalNumber(payload.barsCompleted) ??
		wholeBarsFromMarks(marks, (mark) => mark.produced) ??
		existing?.barsCompleted ??
		null;
	const completePercent =
		piecesCut != null && piecesPlanned != null && piecesPlanned > 0
			? Math.min(100, Math.round((piecesCut / piecesPlanned) * 100))
			: (existing?.completePercent ?? null);

	const startMs = asOptionalTimestampMs(payload.jobStartTime);
	// Ops `/iow/jobCompleted` summary field (live progress uses top-level `operations`).
	// Both show it as holes; manual keeps it in `operationsCount`.
	const totalOperations = asOptionalNumber(payload.totalOperations);
	const manual = existing?.cardType === 'manual';

	pmsStore.activeJob = {
		jobId: asOptionalString(payload.jid) ?? existing?.jobId ?? '-',
		...(existing?.cardLabel ? { cardLabel: existing.cardLabel } : {}),
		...(existing?.jobCode ? { jobCode: existing.jobCode } : {}),
		section: asOptionalString(payload.sectionDimensions) ?? existing?.section ?? '-',
		rmLength: existing?.rmLength || '-',
		rmId: asOptionalString(payload.rmId) ?? existing?.rmId ?? '-',
		runRmIds,
		piecesCut,
		piecesPlanned,
		barsCompleted,
		barsPlanned,
		completePercent,
		startTimeLabel:
			startMs != null ? formatJobCompleteAt(new Date(startMs)) : (existing?.startTimeLabel ?? '-'),
		marks,
		...plateFieldsFrom(existing),
		...(existing?.cardType ? { cardType: existing.cardType } : {}),
		...(manual && totalOperations != null ? { operationsCount: totalOperations } : {}),
		...(!manual && totalOperations != null ? { holes: totalOperations } : {})
	};
}

function parseAlertId(data: unknown): number | null {
	if (typeof data === 'number' && Number.isFinite(data)) return data;
	if (typeof data === 'string' && data.trim() !== '') {
		const parsed = Number(data);
		return Number.isFinite(parsed) ? parsed : null;
	}
	if (data && typeof data === 'object' && 'alertId' in data) {
		return parseAlertId((data as { alertId: unknown }).alertId);
	}
	return null;
}

function resolveStoppageReason(data: unknown): StoppageReason | null {
	if (!data || typeof data !== 'object') {
		const asId = parseAlertId(data);
		return asId != null
			? (findCatalogReasonById(asId) ?? STOPPAGE_REASONS.find((entry) => entry.id === asId) ?? null)
			: null;
	}
	const payload = data as { alertCode?: unknown; alertId?: unknown };
	if (typeof payload.alertCode === 'string' && payload.alertCode.trim()) {
		const code = payload.alertCode.trim().toLowerCase();
		const byCode =
			findCatalogReasonByCode(code) ?? STOPPAGE_REASONS.find((entry) => entry.alertCode === code);
		if (byCode) return byCode;
	}
	const alertId = parseAlertId(payload.alertId ?? data);
	if (alertId == null) return null;
	return (
		findCatalogReasonById(alertId) ?? STOPPAGE_REASONS.find((entry) => entry.id === alertId) ?? null
	);
}

function clearStoppedTimer() {
	if (stoppedTimer) {
		clearInterval(stoppedTimer);
		stoppedTimer = null;
	}
}

function startStoppedTimer() {
	clearStoppedTimer();
	pmsStore.stoppedSeconds = 0;
	stoppedTimer = setInterval(() => {
		pmsStore.stoppedSeconds += 1;
	}, 1000);
}

function ensureAvailabilityTimer() {
	if (availabilityTimer) return;
	availabilityTimer = setInterval(() => {
		if (increaseUptime) pmsStore.uptimeSeconds += 1;
		if (increaseDowntime) pmsStore.downtimeSeconds += 1;
	}, 1000);
}

function clearAvailabilityTimer() {
	if (availabilityTimer) {
		clearInterval(availabilityTimer);
		availabilityTimer = null;
	}
}

function beginJobUptime() {
	increaseUptime = true;
	increaseDowntime = false;
	ensureAvailabilityTimer();
}

function beginJobDowntime() {
	increaseUptime = false;
	increaseDowntime = true;
	ensureAvailabilityTimer();
}

function stopAvailabilityCounters() {
	increaseUptime = false;
	increaseDowntime = false;
}

function clearAutoAlertTimer() {
	if (autoAlertClearTimer) {
		clearTimeout(autoAlertClearTimer);
		autoAlertClearTimer = null;
	}
}

function resetStoppageSelection() {
	pmsStore.selectedReason = null;
	pmsStore.autoAlertSelectedId = null;
	clearAutoAlertTimer();
}

function handleJobStopped() {
	beginJobDowntime();
	startStoppedTimer();
	navigateToPage?.('StoppageReasons');
	// The operator may be in another app (e.g. About Device): put PMS in front so the stop is seen.
	bringAppToFront(PMS_APP_NAME);
}

function handleJobResumed() {
	clearStoppedTimer();
	resetStoppageSelection();
	beginJobUptime();
	navigateToPage?.('JobRunning');
}

function handleJobCancelled(data: unknown) {
	const payload = data && typeof data === 'object' ? (data as Record<string, unknown>) : null;
	if (typeof payload?.failedMessage === 'string' && payload.failedMessage) {
		pmsStore.jobCompleteFailedMessage = payload.failedMessage;
		navigateToPage?.('JobComplete');
		return;
	}

	clearStoppedTimer();
	stopAvailabilityCounters();
	resetStoppageSelection();
	applyJobSummary(data, false);
	setMachineIdleHasActiveJob(false, { deferOverlayUntilNextHeartbeat: true });
	navigateToPage?.('JobComplete');
}

function handleJobCompleted(data: unknown) {
	if (data && typeof data === 'object' && !payloadForSelectedAid(data)) return;
	clearStoppedTimer();
	stopAvailabilityCounters();
	resetStoppageSelection();
	applyJobSummary(data, true);
	setMachineIdleHasActiveJob(false, { deferOverlayUntilNextHeartbeat: true });
	navigateToPage?.('JobComplete');
}

function handleJobProgress(data: unknown) {
	applyJobProgress(data);
}

function handleBundleCompleted(data: unknown) {
	const payload = payloadForSelectedAid(data);
	if (!payload) return;
	pmsStore.summaryBundlesLeft = Array.isArray(payload.remaining) ? payload.remaining.length : null;
}

function handleJobParked(data: unknown) {
	if (!payloadForSelectedAid(data)) return;
	pmsStore.summaryCardParked = true;
}

function handleJobRejected(data: unknown) {
	const payload = payloadForSelectedAid(data);
	if (!payload) return;

	// Controller refused End Job / cancel on a running bar: the job keeps running, nothing is cleared.
	if (payload.request === 'cancelJob') {
		pmsStore.jobCompleteFailedMessage =
			'The bar in progress is not finished. Cut its remaining pieces, then End Job.';
		navigateToPage?.('JobRunning');
		return;
	}

	const reason =
		asOptionalString(payload.reason) ??
		'This job could not be started. Close any open ticket, then try again.';
	pmsStore.jobRejectedMessage = reason;
	clearStoppedTimer();
	stopAvailabilityCounters();
	resetStoppageSelection();
	clearJobSummary();
	setMachineIdleHasActiveJob(false, { deferOverlayUntilNextHeartbeat: true });
	navigateToPage?.('StartJob');
}

/** Controller restart ended the operator session — clear job UI under the lockscreen. */
function handleOperatorSessionEnded(data: unknown) {
	if (data && typeof data === 'object' && !payloadForSelectedAid(data)) return;

	clearStoppedTimer();
	stopAvailabilityCounters();
	resetStoppageSelection();
	clearJobSummary();
	setMachineIdleHasActiveJob(false, { deferOverlayUntilNextHeartbeat: true });
	navigateToPage?.('StartJob');
}

function handleAutoAlertSelected(data: unknown) {
	const reason = resolveStoppageReason(data);
	if (!reason) return;

	pmsStore.autoAlertSelectedId = reason.id;
	selectStoppageReason(reason);
	navigateToPage?.('StoppedDetail');

	clearAutoAlertTimer();
	autoAlertClearTimer = setTimeout(() => {
		pmsStore.autoAlertSelectedId = null;
		autoAlertClearTimer = null;
	}, 1000);
}

function handleMachineSettingsChanged() {
	void loadReasonsCatalog();
	void syncIdleAutoAlertTimeoutFromSettings();
}

/** Machine binding withdrawn — clear this aid's job UI (controller ignores further HMI for it). */
function handleDecommissioned(data: unknown) {
	const payload = data && typeof data === 'object' ? (data as { aid?: unknown }) : null;
	const aid = asOptionalString(payload?.aid);
	const selected = getSelectedAssetId();
	if (aid && selected && aid !== selected) return;

	clearJobSummary();
	navigateToPage?.('StartJob');
}

const topicHandlers: Record<string, (data: unknown) => void> = {
	[PMS_SUBSCRIBE_TOPICS.JOB_STOPPED]: handleJobStopped,
	[PMS_SUBSCRIBE_TOPICS.JOB_RESUMED]: handleJobResumed,
	[PMS_SUBSCRIBE_TOPICS.JOB_CANCELLED]: handleJobCancelled,
	[PMS_SUBSCRIBE_TOPICS.JOB_COMPLETED]: handleJobCompleted,
	[PMS_SUBSCRIBE_TOPICS.BUNDLE_COMPLETED]: handleBundleCompleted,
	[PMS_SUBSCRIBE_TOPICS.JOB_PARKED]: handleJobParked,
	[PMS_SUBSCRIBE_TOPICS.JOB_REJECTED]: handleJobRejected,
	[PMS_SUBSCRIBE_TOPICS.AUTO_ALERT_SELECTED]: handleAutoAlertSelected,
	[PMS_SUBSCRIBE_TOPICS.JOB_PROGRESS]: handleJobProgress,
	[PMS_SUBSCRIBE_TOPICS.MACHINE_SETTINGS]: handleMachineSettingsChanged,
	[PMS_SUBSCRIBE_TOPICS.DECOMMISSIONED]: handleDecommissioned,
	[PMS_SUBSCRIBE_TOPICS.OPERATOR_SESSION_ENDED]: handleOperatorSessionEnded
};

export function bindPmsMqttEvents(navigateTo: (page: string) => void): () => void {
	mqttRefCount += 1;
	navigateToPage = navigateTo;

	if (!mqttBound) {
		onMqttEvent = (topic: string, data: unknown) => {
			topicHandlers[topic]?.(data);
		};
		globalMqtt.subscribeTopics(Object.values(PMS_SUBSCRIBE_TOPICS));
		globalMqtt.on('event', onMqttEvent);
		mqttBound = true;
	}

	return () => {
		mqttRefCount = Math.max(0, mqttRefCount - 1);
		if (mqttRefCount > 0 || !onMqttEvent) {
			return;
		}

		globalMqtt.off('event', onMqttEvent);
		onMqttEvent = null;
		mqttBound = false;
		navigateToPage = null;
		clearStoppedTimer();
		clearAvailabilityTimer();
		stopAvailabilityCounters();
		clearAutoAlertTimer();
	};
}

export function formatHms(totalSeconds: number | null | undefined): string {
	if (typeof totalSeconds !== 'number' || !Number.isFinite(totalSeconds)) return '-';
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;
	return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function displayMetric(value: number | string | null | undefined): string {
	if (value == null) return '-';
	if (typeof value === 'string') return value.trim() === '' ? '-' : value;
	if (typeof value === 'number' && Number.isFinite(value)) return String(value);
	return '-';
}

/** 0 → muted (gray), in progress → primary, complete → success. */
export function progressTone(
	current: number | null | undefined,
	total: number | null | undefined
): 'muted' | 'primary' | 'success' {
	if (
		typeof current !== 'number' ||
		typeof total !== 'number' ||
		!Number.isFinite(current) ||
		!Number.isFinite(total) ||
		total <= 0 ||
		current <= 0
	) {
		return 'muted';
	}
	if (current >= total) return 'success';
	return 'primary';
}

export function progressToneClass(tone: 'muted' | 'primary' | 'success'): string {
	if (tone === 'success') return 'text-status-online';
	if (tone === 'primary') return 'text-primary';
	return 'text-muted';
}

export function formatHmsParts(totalSeconds: number) {
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;
	return {
		hours: String(hours).padStart(2, '0'),
		minutes: String(minutes).padStart(2, '0'),
		seconds: String(seconds).padStart(2, '0')
	};
}

function formatStartTimeLabel(date = new Date()): string {
	return date.toLocaleString('en-US', {
		hour: 'numeric',
		minute: '2-digit',
		hour12: true
	});
}

function activeJobFromSelection(job: HmiJob, bar: JobBar): ActiveJob {
	const marks: MarkLine[] = bar.markings.map((mark) => {
		const planned =
			mark.pcs != null
				? mark.pcs * (mark.pcsPerBar || 1)
				: mark.pcsPerBar != null
					? mark.pcsPerBar * bar.quantity
					: bar.quantity;
		return {
			id: mark.marking,
			pcsPerBar: mark.pcsPerBar,
			operations: mark.operations ?? null,
			pcs: mark.pcs ?? bar.quantity,
			partLength: mark.itemLength,
			progressCurrent: 0,
			progressTotal: planned,
			produced: 0
		};
	});

	const piecesPlanned = sumKnown(marks.map((mark) => mark.progressTotal));
	const selectedMark = bar.markings[0];
	const thickness = formatThicknessMm(job.thicknessMm) ?? job.thickness ?? undefined;
	const partSize =
		formatPlatePartSize(selectedMark?.itemLength, selectedMark?.widthMm) ??
		job.partSize ??
		undefined;
	const dueDate = formatJobTimestamp(job.dueAt) ?? formatJobTimestamp(job.scheduledAt) ?? undefined;
	const plannedPlates = selectedMark?.pcs ?? bar.quantity;

	return {
		jobId: job.jobId,
		...(job.cardLabel ? { cardLabel: job.cardLabel } : {}),
		...(job.jobCode ? { jobCode: job.jobCode } : {}),
		section: job.section,
		rmLength: String(bar.rmLength),
		rmId: bar.rmId,
		runRmIds: [bar.rmId],
		piecesCut: 0,
		piecesPlanned: piecesPlanned || plannedPlates,
		barsCompleted: 0,
		barsPlanned: bar.quantity,
		completePercent: 0,
		startTimeLabel: formatStartTimeLabel(),
		marks,
		...(selectedMark?.marking ? { markNo: selectedMark.marking } : {}),
		...(thickness ? { thickness } : {}),
		...(partSize ? { partSize } : {}),
		...(dueDate ? { dueDate } : {}),
		holes: 0,
		...(plannedPlates != null ? { plannedPlates } : {})
	};
}

/** `operationsCount` is the bundle's saved count when it resumes from a park, else 0. */
function activeJobFromManualMark(job: HmiJob, mark: ManualMark, operationsCount = 0): ActiveJob {
	const dueDate = formatJobTimestamp(job.dueAt) ?? formatJobTimestamp(job.scheduledAt) ?? undefined;
	const marks: MarkLine[] = [
		{
			id: mark.marking,
			pcsPerBar: null,
			operations: mark.operations ?? null,
			pcs: mark.pcs,
			partLength: mark.itemLength,
			progressCurrent: 0,
			progressTotal: mark.pcs,
			produced: 0
		}
	];

	return {
		jobId: job.jobId,
		...(job.cardLabel ? { cardLabel: job.cardLabel } : {}),
		...(job.jobCode ? { jobCode: job.jobCode } : {}),
		section: job.section || '',
		rmLength: String(mark.itemLength),
		rmId: '-',
		runRmIds: [],
		piecesCut: 0,
		piecesPlanned: mark.pcs,
		barsCompleted: null,
		barsPlanned: null,
		completePercent: 0,
		startTimeLabel: formatStartTimeLabel(),
		marks,
		markNo: mark.marking,
		bundleNo: String(mark.bundleNo),
		cardType: 'manual',
		operationsCount,
		...(dueDate ? { dueDate } : {})
	};
}

function activeJobFromPlateMark(job: HmiJob, mark: PlateMark): ActiveJob {
	const thickness = formatThicknessMm(job.thicknessMm) ?? job.thickness ?? undefined;
	const partSize = formatPlatePartSize(mark.itemLength, mark.widthMm) ?? job.partSize ?? undefined;
	const dueDate = formatJobTimestamp(job.dueAt) ?? formatJobTimestamp(job.scheduledAt) ?? undefined;
	const marks: MarkLine[] = [
		{
			id: mark.marking,
			pcsPerBar: null,
			operations: mark.operations ?? null,
			pcs: mark.pcs,
			partLength: mark.itemLength,
			progressCurrent: 0,
			progressTotal: mark.pcs,
			produced: 0
		}
	];

	return {
		jobId: job.jobId,
		...(job.cardLabel ? { cardLabel: job.cardLabel } : {}),
		...(job.jobCode ? { jobCode: job.jobCode } : {}),
		section: job.section || '',
		rmLength: '-',
		rmId: '-',
		runRmIds: [],
		piecesCut: 0,
		piecesPlanned: mark.pcs,
		barsCompleted: null,
		barsPlanned: null,
		completePercent: 0,
		startTimeLabel: formatStartTimeLabel(),
		marks,
		markNo: mark.marking,
		...(thickness ? { thickness } : {}),
		...(partSize ? { partSize } : {}),
		...(dueDate ? { dueDate } : {}),
		holes: 0,
		plannedPlates: mark.pcs
	};
}

/** Ask the runtime to download each drawing on the cards just read from `jobs:<aid>`. */
function prefetchJobDrawings(jobs: JobsMap): void {
	for (const item of drawingFetchesFromJobs(jobs)) {
		const message = drawingFetchMessage(item, getUUID());
		globalMqtt.publish(message.topic, message.body);
	}
}

export async function loadJobs(): Promise<JobsMap> {
	pmsStore.jobsLoading = true;
	try {
		await ensureSelectedAssetId();
		const assetId = getSelectedAssetId();
		const jobsKey = assetId ? `jobs:${assetId}` : 'jobs';
		const partialPlateKey = assetId ? `partialJobs:${assetId}` : 'partialJobs';
		const [queuedRaw, partialRaw, platePartialRaw] = await Promise.all([
			globalMqtt.get(jobsKey),
			globalMqtt.get('partiallyCompletedJobs'),
			globalMqtt.get(partialPlateKey)
		]);
		const queued = parseJobsMap(queuedRaw);
		const partial = parseJobsMap(partialRaw);
		pmsStore.donePlateMarks = donePlateMarkKeys(platePartialRaw);
		pmsStore.doneRmIds = doneRmKeys(platePartialRaw);
		pmsStore.barsToConfirm = barsToConfirmKeys(platePartialRaw);
		pmsStore.plateMarkPieces = plateMarkPieces(platePartialRaw);
		pmsStore.manualTasks = manualTaskProgress(platePartialRaw);
		// `jobs:<aid>` is the live queue (controller deletes a card after 8002). A stale
		// `partiallyCompletedJobs` row must not resurrect a finished job into the dropdown —
		// only enrich bars for jobs still queued.
		const partialForQueued: JobsMap = {};
		for (const [jobId, job] of Object.entries(partial)) {
			if (queued[jobId]) partialForQueued[jobId] = job;
		}
		pmsStore.resumableBars = [...resumableBarKeys(partialForQueued)];
		pmsStore.jobs = sortJobsBySchedule(mergeJobsMaps(queued, partialForQueued));
		prefetchJobDrawings(pmsStore.jobs);
		return pmsStore.jobs;
	} catch (error) {
		console.error('Failed to load jobs from runtime:', error);
		pmsStore.jobs = {};
		pmsStore.resumableBars = [];
		pmsStore.donePlateMarks = [];
		pmsStore.doneRmIds = [];
		pmsStore.barsToConfirm = [];
		pmsStore.plateMarkPieces = {};
		pmsStore.manualTasks = {};
		return pmsStore.jobs;
	} finally {
		pmsStore.jobsLoading = false;
	}
}

/** Re-read only the parked progress: the controller writes `barsToConfirm` when a summary closes. */
export async function refreshBarsToConfirm(): Promise<void> {
	try {
		await ensureSelectedAssetId();
		const assetId = getSelectedAssetId();
		const raw = await globalMqtt.get(assetId ? `partialJobs:${assetId}` : 'partialJobs');
		pmsStore.barsToConfirm = barsToConfirmKeys(raw);
	} catch (error) {
		console.error('Failed to refresh parked bars:', error);
		pmsStore.barsToConfirm = [];
	}
}

/**
 * Start a queued job.
 * - Angle: `selection` is the bar `rmId` → `/iow/startJob { jobId, rmId, jobData }`.
 * - Plate: `selection` is the Mark No. (`marking`) → `/iow/startJob { jobId, jobData, marking }` (no rmId).
 * - Manual: `selection` is the picker key (`marking` + `bundleNo`) → `/iow/startJob { jobId, marking, bundleNo }`.
 * `barOnMachine` (angle only) answers "which bar is on the machine?" for a parked RM; absent = `partial`.
 */
export function startJob(
	jobId: string,
	selection: string,
	opts: { barOnMachine?: 'partial' | 'new' } = {}
) {
	const job = pmsStore.jobs[jobId];
	if (!job) {
		console.error('startJob: missing job in UI store', { jobId });
		return;
	}

	const jobData = buildStartJobData(job);
	if (!jobData) {
		console.error('startJob: cannot build HmiJobCard jobData (need identity fields from KV)', {
			jobId,
			cardType: job.cardType,
			hasSourceCard: Boolean(job.sourceCard)
		});
		return;
	}

	if (job.cardType === 'manual') {
		const mark = findManualMark(job, selection);
		if (!mark) {
			console.error('startJob: mark and bundle not on manual card', { jobId, selection });
			return;
		}

		if (job.assetId) setSelectedAssetId(job.assetId);

		const saved = pmsStore.manualTasks[manualTaskKey(jobId, mark.marking, mark.bundleNo)];
		pmsStore.activeJob = activeJobFromManualMark(job, mark, saved?.operations ?? 0);
		setMachineIdleHasActiveJob(true);
		syncInterlockWithActiveJob(true);
		pmsStore.uptimeSeconds = 0;
		pmsStore.downtimeSeconds = 0;
		pmsStore.stoppedSeconds = 0;
		pmsStore.totalSeconds = null;
		pmsStore.jobCompleteFailedMessage = null;
		pmsStore.jobCompleteAt = '-';
		clearStoppedTimer();
		beginJobUptime();

		void ensureSelectedAssetId().then(() => {
			globalMqtt.publish(
				PMS_PUBLISH_TOPICS.START_JOB,
				// The controller runs the card in jobs:<aid>; `jobData` is deprecated and ignored.
				withAssetId({ jobId, marking: mark.marking, bundleNo: mark.bundleNo })
			);
		});
		return;
	}

	const isPlate =
		job.cardType === 'plate' || Boolean(job.marks?.length && !Object.keys(job.bars).length);

	if (isPlate) {
		const marking = selection.trim();
		const mark = findPlateMark(job, marking);
		if (!mark) {
			console.error('startJob: marking not on plate card', { jobId, marking });
			return;
		}

		if (job.assetId) setSelectedAssetId(job.assetId);

		const active = activeJobFromPlateMark(job, mark);
		const made = pmsStore.plateMarkPieces[`${jobId}::${marking}`];
		if (typeof made === 'number') {
			active.piecesCut = made;
			active.completePercent =
				active.piecesPlanned != null && active.piecesPlanned > 0
					? Math.min(100, Math.round((made / active.piecesPlanned) * 100))
					: 0;
			active.marks = active.marks.map((line) =>
				line.id === marking ? { ...line, progressCurrent: made, produced: made } : line
			);
		}
		pmsStore.activeJob = active;
		setMachineIdleHasActiveJob(true);
		syncInterlockWithActiveJob(true);
		pmsStore.uptimeSeconds = 0;
		pmsStore.downtimeSeconds = 0;
		pmsStore.stoppedSeconds = 0;
		pmsStore.totalSeconds = null;
		pmsStore.jobCompleteFailedMessage = null;
		pmsStore.jobCompleteAt = '-';
		clearStoppedTimer();
		beginJobUptime();

		void ensureSelectedAssetId().then(() => {
			globalMqtt.publish(PMS_PUBLISH_TOPICS.START_JOB, withAssetId({ jobId, jobData, marking }));
		});
		return;
	}

	const rmId = selection.trim();
	const bar = job.bars?.[rmId];
	if (!bar) {
		console.error('startJob: missing job/bar in UI store', { jobId, rmId });
		return;
	}

	if (job.assetId) setSelectedAssetId(job.assetId);

	pmsStore.activeJob = activeJobFromSelection(job, bar);
	setMachineIdleHasActiveJob(true);
	syncInterlockWithActiveJob(true);
	pmsStore.uptimeSeconds = 0;
	pmsStore.downtimeSeconds = 0;
	pmsStore.stoppedSeconds = 0;
	pmsStore.totalSeconds = null;
	pmsStore.jobCompleteFailedMessage = null;
	pmsStore.jobCompleteAt = '-';
	clearStoppedTimer();
	beginJobUptime();

	void ensureSelectedAssetId().then(() => {
		globalMqtt.publish(
			PMS_PUBLISH_TOPICS.START_JOB,
			withAssetId({
				jobId,
				rmId,
				jobData,
				...(opts.barOnMachine ? { barOnMachine: opts.barOnMachine } : {})
			})
		);
	});
}

/** Mid-job RM switch — controller `/iow/selectRmId`; keeps summary plan enrichment in sync. */
export function selectRmId(rmId: string) {
	const next = rmId.trim();
	const job = pmsStore.activeJob;
	if (!next || !job) return;

	const bar = pmsStore.jobs[job.jobId]?.bars?.[next];
	if (!bar) {
		console.error('selectRmId: rmId not on active job card', { jobId: job.jobId, rmId: next });
		return;
	}

	const runRmIds = job.runRmIds.includes(next) ? job.runRmIds : [...job.runRmIds, next];
	pmsStore.activeJob = {
		...job,
		rmId: next,
		rmLength: String(bar.rmLength),
		runRmIds
	};

	void ensureSelectedAssetId().then(() => {
		globalMqtt.publish(PMS_PUBLISH_TOPICS.SELECT_RM_ID, withAssetId({ rmId: next }));
	});
}

export function cancelJob() {
	pmsStore.showSummarySuccess = false;
	pmsStore.jobCompleteFailedMessage = null;
	const jobId = pmsStore.activeJob?.jobId;
	void ensureSelectedAssetId().then(() => {
		if (!jobId || jobId === '-') {
			console.error('cancelJob: missing jobId on activeJob');
			globalMqtt.publish(PMS_PUBLISH_TOPICS.CANCEL_JOB, withAssetId({}));
			return;
		}
		globalMqtt.publish(PMS_PUBLISH_TOPICS.CANCEL_JOB, withAssetId({ jobId }));
	});
}

/**
 * Plate / manual (operations profile): operator ends the job.
 * Controller freezes the summary and publishes `/iow/jobCompleted` — navigate from that handler.
 * Ignored on angle (bar) machines; those use cancel or auto-complete.
 */
export function endJob() {
	pmsStore.showSummarySuccess = false;
	pmsStore.jobCompleteFailedMessage = null;
	void ensureSelectedAssetId().then(() => {
		globalMqtt.publish(PMS_PUBLISH_TOPICS.END_JOB, withAssetId({}));
	});
}

export function selectStoppageReason(reason: StoppageReason) {
	const isChangingReason = pmsStore.selectedReason != null;
	pmsStore.selectedReason = reason;
	// Only reset stopped timer when changing reason during an active job stoppage
	if (isChangingReason && pmsStore.activeJob) {
		startStoppedTimer();
	}
}

export function publishReasonSelected(reason: StoppageReason) {
	void ensureSelectedAssetId().then(() => {
		globalMqtt.publish(
			PMS_PUBLISH_TOPICS.REASON_SELECTED,
			withAssetId({
				alertCode: reason.alertCode
			})
		);
	});
}

export function publishCurrentScreen(screen: string) {
	void ensureSelectedAssetId().then(() => {
		globalMqtt.publish(PMS_PUBLISH_TOPICS.CURRENT_SCREEN, withAssetId({ screen }));
	});
}

export function publishUnlock() {
	void ensureSelectedAssetId().then(() => {
		globalMqtt.publish(PMS_PUBLISH_TOPICS.UNLOCK, withAssetId({}));
	});
}

/** Operator-initiated stop — Path B `{ aid, alertCode }`. */
export function publishJobStopped(alertCode: string) {
	void ensureSelectedAssetId().then(() => {
		globalMqtt.publish(
			PMS_PUBLISH_TOPICS.JOB_STOPPED,
			withAssetId({ alertCode: alertCode.trim().toLowerCase() })
		);
	});
}

/** Resume on a new run — Path B `{ aid, jobId }`. */
export function publishJobResumed(jobId?: string) {
	const id = jobId ?? pmsStore.activeJob?.jobId;
	void ensureSelectedAssetId().then(() => {
		if (!id || id === '-') {
			console.error('publishJobResumed: missing jobId');
			globalMqtt.publish(PMS_PUBLISH_TOPICS.JOB_RESUMED, withAssetId({}));
			return;
		}
		globalMqtt.publish(PMS_PUBLISH_TOPICS.JOB_RESUMED, withAssetId({ jobId: id }));
	});
}

/** Operator raises a reason while running — Path B `{ aid, alertCode }`. */
export function publishRaiseAlert(alertCode: string) {
	void ensureSelectedAssetId().then(() => {
		globalMqtt.publish(
			PMS_PUBLISH_TOPICS.RAISE_ALERT,
			withAssetId({ alertCode: alertCode.trim().toLowerCase() })
		);
	});
}

export function closeStoppedJobBreakdownTicket(reason: StoppageReason | null | undefined) {
	if (reason?.requiresAck !== true) return;

	void ensureSelectedAssetId().then(() => {
		globalMqtt.publish(PMS_PUBLISH_TOPICS.CLOSE_TICKET, withAssetId({}));
	});
}

/**
 * CLIT checklist: Path A `11003` on `/rt/d2c` plus Path B `/iow/clitCompleted` for the controller.
 */
export function publishClitCompleted(items: Array<{ key: string; ok: boolean; note?: string }>) {
	const session = getOperatorSession();
	void (async () => {
		await ensureSelectedAssetId();
		await publishClitReport({
			items,
			...(session ? { oid: session.oid, sid: session.sid } : {})
		});
		globalMqtt.publish(PMS_PUBLISH_TOPICS.CLIT_COMPLETED, withAssetId({ items }));
	})();
}

/**
 * Publish operator-confirmed counts before leaving `jobSummary`.
 * Only meaningful after `/iow/jobCompleted` (controller holds `pendingSummary`), or a plate's Job Cancelled
 * summary with `evenIfCancelled` (the controller keeps that count on the parked mark).
 */
export async function publishUpdatePartsProduced(
	opts: { evenIfCancelled?: boolean } = {}
): Promise<void> {
	const job = pmsStore.activeJob;
	if ((!pmsStore.showSummarySuccess && !opts.evenIfCancelled) || !job?.jobId || job.jobId === '-')
		return;

	const markings = job.marks.map((mark) => ({
		marking: mark.id,
		pieces: Math.max(0, Math.floor(mark.produced ?? mark.progressCurrent ?? 0))
	}));
	const totalParts = markings.reduce((sum, row) => sum + row.pieces, 0);
	job.piecesCut = totalParts;
	if (job.piecesPlanned != null && job.piecesPlanned > 0) {
		job.completePercent = Math.min(100, Math.round((totalParts / job.piecesPlanned) * 100));
	}

	await ensureSelectedAssetId();
	globalMqtt.publish(
		PMS_PUBLISH_TOPICS.UPDATE_PARTS_PRODUCED,
		withAssetId({ jid: job.jobId, markings, totalParts })
	);
}

/** Clear summary / job context. Machine Idle is owned by the OS shell overlay. */
export function clearJobSummary() {
	clearStoppedTimer();
	stopAvailabilityCounters();
	pmsStore.activeJob = null;
	pmsStore.jobCompleteFailedMessage = null;
	pmsStore.summaryBundlesLeft = null;
	pmsStore.summaryCardParked = false;
	setMachineIdleHasActiveJob(false);
	syncInterlockWithActiveJob(false);
}
