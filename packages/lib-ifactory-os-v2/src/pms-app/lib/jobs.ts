/** Locked runtime `jobs` map shape (see docs/mqtt-controller-gaps.md). */

export type JobMarking = {
	marking: string;
	itemLength: number;
	/** Angle: pcs per bar. Plate: usually 1 (or omitted → treated as 1). */
	pcsPerBar: number;
	pcs?: number;
	/** Plate sheet width (mm). */
	widthMm?: number;
	/** UI alias for cloud `operationsPerPiece`. */
	operations?: number;
};

export type JobBar = {
	rmId: string;
	rmLength: number;
	quantity: number;
	markings: JobMarking[];
};

/** One manual card row: one marking in one bundle. `pcs` is pieces in that bundle. */
export type ManualMark = {
	marking: string;
	itemLength: number;
	pcs: number;
	bundleNo: number;
	/** Optional on manual cards; the piece drawing shows it when present. */
	widthMm?: number;
	weightPerPieceKg?: number;
	/** UI alias for cloud `operationsPerPiece`. */
	operations?: number;
};

/** Plate mark — `pcs` is PIECES. No `bundleNo`. */
export type PlateMark = {
	marking: string;
	itemLength: number;
	widthMm: number;
	pcs: number;
	weightPerPieceKg: number;
	/** UI alias for cloud `operationsPerPiece`. */
	operations?: number;
};

/** Cloud-stamped card type (`asset_class.jobCard`). */
export type HmiCardType = 'angle' | 'plate' | 'manual';

/** Opaque controller resume summary — pass through on `/iow/startJob`. */
export type JobSummary = Record<string, unknown>;

export type HmiJob = {
	jobId: string;
	section: string;
	/** Empty for plate cards (no bars). */
	bars: Record<string, JobBar>;
	/** Flat plate marks when `cardType === 'plate'`. */
	marks?: PlateMark[];
	/** Flat manual rows when `cardType === 'manual'`. */
	manualMarks?: ManualMark[];
	cardType?: HmiCardType;
	/** Cloud-stamped display code (`aps_card_steps.hmi_job_id`), e.g. `368-CDS`. */
	jobCode?: string;
	/** Cloud-stamped paper label (`M-${card_no}`), e.g. `M-368`. Prefer for HMI labels. */
	cardLabel?: string;
	/** Numeric `aps_cards.card_no`. Display-only. */
	cardNo?: number;
	/** kg/m — required on the angle HmiJobCard the controller validates. */
	sectionKgPerM?: number;
	/** Present when the card names its machine (docs job card). Cloud stamps `aid`. */
	assetId?: string;
	assetCode?: string;
	name?: string;
	/** Present on partially-completed jobs for resume. */
	jobSummary?: JobSummary;
	/**
	 * Verbatim nested card from KV (`jobs:<aid>`). Preferred as `/iow/startJob` `jobData`
	 * so the controller sees the same HmiJobCard the cloud published.
	 */
	sourceCard?: Record<string, unknown>;
	/** Plate card: thickness in mm. */
	thicknessMm?: number;
	/** Required on typed cards: due / schedule ISO timestamps. */
	dueAt?: string;
	scheduledAt?: string;
	/** Legacy / display fallbacks */
	thickness?: string;
	partSize?: string;
	operations?: string;
	startDateText?: string;
};

export type JobsMap = Record<string, HmiJob>;

/** Full HmiJobCard body for `/iow/startJob` (controller validates against the schema). */
export type StartJobData = Record<string, unknown>;

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asNumber(value: unknown): number | null {
	if (typeof value === 'number' && Number.isFinite(value)) return value;
	if (typeof value === 'string' && value.trim() !== '') {
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : null;
	}
	return null;
}

function optionalTrimmedString(value: unknown): string | undefined {
	return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/**
 * Picker key for one manual row. `bundleNo` restarts at 1 on every marking, so the
 * bundle number alone is not unique on the card.
 */
export function manualRowKey(marking: string, bundleNo: number): string {
	return JSON.stringify([marking, bundleNo]);
}

/**
 * Manual `marks[]` — one row per marking and bundle. A row repeated for the same bundle is one
 * row with its `pcs` summed, as the controller counts it.
 */
function parseManualMarks(raw: unknown): ManualMark[] {
	if (!Array.isArray(raw)) return [];
	const byKey = new Map<string, ManualMark>();
	for (const item of raw) {
		if (!isRecord(item)) continue;
		const marking = typeof item.marking === 'string' ? item.marking.trim() : '';
		const itemLength = asNumber(item.itemLength);
		const pcs = asNumber(item.pcs);
		const bundleNo = asNumber(item.bundleNo);
		if (
			!marking ||
			itemLength == null ||
			itemLength <= 0 ||
			pcs == null ||
			pcs < 1 ||
			bundleNo == null ||
			!Number.isInteger(bundleNo) ||
			bundleNo < 1
		) {
			continue;
		}
		const operations = asNumber(item.operationsPerPiece) ?? asNumber(item.operations) ?? undefined;
		const weightPerPieceKg = asNumber(item.weightPerPieceKg) ?? undefined;
		const widthMm = asNumber(item.widthMm) ?? undefined;
		const bundle = Math.trunc(bundleNo);
		const key = manualRowKey(marking, bundle);
		const earlier = byKey.get(key);
		byKey.set(key, {
			marking,
			itemLength,
			pcs: Math.trunc(pcs) + (earlier?.pcs ?? 0),
			bundleNo: bundle,
			...(widthMm != null && widthMm > 0 ? { widthMm } : {}),
			...(weightPerPieceKg != null && weightPerPieceKg > 0 ? { weightPerPieceKg } : {}),
			...(operations != null ? { operations } : {})
		});
	}
	return [...byKey.values()];
}

function parseCardType(raw: unknown): HmiCardType | undefined {
	return raw === 'angle' || raw === 'plate' || raw === 'manual' ? raw : undefined;
}

function parseMarkings(raw: unknown): JobMarking[] {
	if (!Array.isArray(raw)) return [];
	const markings: JobMarking[] = [];
	for (const item of raw) {
		if (!isRecord(item)) continue;
		const marking = typeof item.marking === 'string' ? item.marking.trim() : '';
		const itemLength = asNumber(item.itemLength);
		// Plate marks often omit pcsPerBar; treat as 1 so PL units still parse.
		const pcsPerBar = asNumber(item.pcsPerBar) ?? 1;
		if (!marking || itemLength == null) continue;
		const pcs = asNumber(item.pcs) ?? undefined;
		const widthMm = asNumber(item.widthMm) ?? undefined;
		const operations = asNumber(item.operationsPerPiece) ?? asNumber(item.operations) ?? undefined;
		markings.push({
			marking,
			itemLength,
			pcsPerBar,
			...(pcs != null ? { pcs } : {}),
			...(widthMm != null ? { widthMm } : {}),
			...(operations != null ? { operations } : {})
		});
	}
	return markings;
}

/** Typed plate `marks[]` — pcs are pieces; widthMm + weightPerPieceKg required. */
function parsePlateMarks(raw: unknown): PlateMark[] {
	if (!Array.isArray(raw)) return [];
	const marks: PlateMark[] = [];
	for (const item of raw) {
		if (!isRecord(item)) continue;
		const marking = typeof item.marking === 'string' ? item.marking.trim() : '';
		const itemLength = asNumber(item.itemLength);
		const widthMm = asNumber(item.widthMm);
		const pcs = asNumber(item.pcs);
		const weightPerPieceKg = asNumber(item.weightPerPieceKg);
		if (
			!marking ||
			itemLength == null ||
			itemLength <= 0 ||
			widthMm == null ||
			widthMm <= 0 ||
			pcs == null ||
			pcs < 1 ||
			weightPerPieceKg == null ||
			weightPerPieceKg <= 0
		) {
			continue;
		}
		const operations = asNumber(item.operationsPerPiece) ?? asNumber(item.operations) ?? undefined;
		marks.push({
			marking,
			itemLength,
			widthMm,
			pcs: Math.trunc(pcs),
			weightPerPieceKg,
			...(operations != null ? { operations } : {})
		});
	}
	return marks;
}

/** Plate display: `5` → `5 mm`. */
export function formatThicknessMm(mm: number | null | undefined): string | undefined {
	if (mm == null || !Number.isFinite(mm)) return undefined;
	return `${mm} mm`;
}

/** Plate display: length × width. */
export function formatPlatePartSize(
	lengthMm: number | null | undefined,
	widthMm: number | null | undefined
): string | undefined {
	if (lengthMm == null || !Number.isFinite(lengthMm)) return undefined;
	if (widthMm != null && Number.isFinite(widthMm)) {
		return `${lengthMm} × ${widthMm} mm`;
	}
	return `${lengthMm} mm`;
}

/** Plate/ISO due or schedule → short local date (or date+time if useful). */
export function formatJobTimestamp(iso: string | null | undefined): string | undefined {
	if (!iso?.trim()) return undefined;
	const trimmed = iso.trim();
	// Legacy angle meta like "Start 29 Aug 2026 · 08:30"
	if (!/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) {
		return trimmed.replace(/^Start\s+/i, '') || undefined;
	}
	const date = new Date(trimmed);
	if (Number.isNaN(date.getTime())) return trimmed;
	return date.toLocaleString('en-GB', {
		day: '2-digit',
		month: 'short',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	});
}

function plateMetaFields(
	raw: Record<string, unknown>
): Pick<HmiJob, 'thicknessMm' | 'dueAt' | 'scheduledAt'> {
	const thicknessMm = asNumber(raw.thicknessMm) ?? undefined;
	const dueAt = optionalTrimmedString(raw.dueAt);
	const scheduledAt = optionalTrimmedString(raw.scheduledAt);
	return {
		...(thicknessMm != null ? { thicknessMm } : {}),
		...(dueAt ? { dueAt } : {}),
		...(scheduledAt ? { scheduledAt } : {})
	};
}

function parseBar(rmId: string, raw: unknown): JobBar | null {
	if (!isRecord(raw)) return null;
	const id =
		(typeof raw.rmId === 'string' && raw.rmId.trim()) ||
		(typeof rmId === 'string' && rmId.trim()) ||
		'';
	const rmLength = asNumber(raw.rmLength);
	const quantity = asNumber(raw.quantity);
	const markings = parseMarkings(raw.markings);
	if (!id || rmLength == null || quantity == null) return null;
	return { rmId: id, rmLength, quantity, markings };
}

function parseJobSummary(raw: unknown): JobSummary | undefined {
	return isRecord(raw) ? { ...raw } : undefined;
}

function jobIdentityFields(
	raw: Record<string, unknown>
): Pick<
	HmiJob,
	| 'jobCode'
	| 'cardLabel'
	| 'cardNo'
	| 'sectionKgPerM'
	| 'assetId'
	| 'assetCode'
	| 'name'
	| 'jobSummary'
	| 'cardType'
> {
	const jobCode = optionalTrimmedString(raw.jobCode);
	const cardLabel = optionalTrimmedString(raw.cardLabel);
	const cardNo = asNumber(raw.cardNo) ?? undefined;
	const sectionKgPerM = asNumber(raw.sectionKgPerM) ?? undefined;
	// Cloud stamps `aid`; older fixtures may use `assetId`.
	const assetId = optionalTrimmedString(raw.aid) ?? optionalTrimmedString(raw.assetId);
	const assetCode = optionalTrimmedString(raw.assetCode);
	const name = optionalTrimmedString(raw.name);
	const jobSummary = parseJobSummary(raw.jobSummary);
	const cardType = parseCardType(raw.cardType);
	return {
		...(jobCode ? { jobCode } : {}),
		...(cardLabel ? { cardLabel } : {}),
		...(cardNo != null ? { cardNo } : {}),
		...(sectionKgPerM != null && sectionKgPerM > 0 ? { sectionKgPerM } : {}),
		...(assetId ? { assetId } : {}),
		...(assetCode ? { assetCode } : {}),
		...(name ? { name } : {}),
		...(jobSummary ? { jobSummary } : {}),
		...(cardType ? { cardType } : {})
	};
}

function parseJob(jobId: string, raw: unknown): HmiJob | null {
	if (!isRecord(raw)) return null;
	const id =
		(typeof raw.jobId === 'string' && raw.jobId.trim()) ||
		(typeof jobId === 'string' && jobId.trim()) ||
		'';
	if (!id) return null;

	const identity = jobIdentityFields(raw);
	const plateMeta = plateMetaFields(raw);
	const section = typeof raw.section === 'string' ? raw.section.trim() : '';

	// Manual: flat marks, one entry per marking and bundle.
	if (identity.cardType === 'manual') {
		const manualMarks = parseManualMarks(raw.marks);
		if (manualMarks.length === 0) return null;
		return {
			jobId: id,
			section,
			bars: {},
			manualMarks,
			...identity,
			cardType: 'manual' as const,
			...plateMeta,
			sourceCard: { ...raw, jobId: id, cardType: 'manual' }
		};
	}

	// Typed plate: flat `marks[]`, no bars, no section.
	const hasBars = isRecord(raw.bars);
	const plateMarks = parsePlateMarks(raw.marks);
	const isPlate =
		identity.cardType === 'plate' ||
		(!hasBars && plateMarks.length > 0 && Array.isArray(raw.marks));

	if (isPlate) {
		if (plateMarks.length === 0) return null;
		return {
			jobId: id,
			section,
			bars: {},
			marks: plateMarks,
			...identity,
			cardType: 'plate',
			...plateMeta,
			sourceCard: { ...raw, jobId: id, cardType: 'plate' }
		};
	}

	// Nested angle shape: { section, bars: { [rmId]: JobBar } }
	if (hasBars) {
		if (!section) return null;
		const bars: Record<string, JobBar> = {};
		for (const [barKey, barRaw] of Object.entries(raw.bars as Record<string, unknown>)) {
			const bar = parseBar(barKey, barRaw);
			if (bar) bars[bar.rmId] = bar;
		}
		if (Object.keys(bars).length === 0) return null;
		return {
			jobId: id,
			section,
			bars,
			...identity,
			cardType: identity.cardType ?? 'angle',
			...plateMeta,
			// Keep the cloud card verbatim for startJob validation.
			sourceCard: { ...raw, jobId: id, section }
		};
	}

	// Legacy flat cancel body: { section, rmId, rmLength, quantity, markings, jobSummary? }
	const flatRmId = typeof raw.rmId === 'string' ? raw.rmId.trim() : '';
	if (flatRmId && Array.isArray(raw.markings)) {
		if (!section) return null;
		const bar = parseBar(flatRmId, raw);
		if (!bar) return null;
		return {
			jobId: id,
			section,
			bars: { [bar.rmId]: bar },
			...identity,
			cardType: identity.cardType ?? 'angle',
			...plateMeta
		};
	}

	return null;
}

/** Normalize runtime / MQTT payload into a JobsMap (queued or partials). */
export function parseJobsMap(raw: unknown): JobsMap {
	if (!isRecord(raw) || 'error' in raw) return {};
	const jobs: JobsMap = {};
	for (const [key, value] of Object.entries(raw)) {
		const job = parseJob(key, value);
		if (job) jobs[job.jobId] = job;
	}
	return jobs;
}

/** Keys `jobId::rmId` for bars that came from partiallyCompletedJobs (resume). */
export function resumableBarKeys(partialJobs: JobsMap): Set<string> {
	const keys = new Set<string>();
	for (const job of Object.values(partialJobs)) {
		for (const rmId of Object.keys(job.bars)) {
			keys.add(`${job.jobId}::${rmId}`);
		}
	}
	return keys;
}

export function isResumableBar(
	resumable: Set<string> | Iterable<string>,
	jobId: string,
	rmId: string
): boolean {
	const set = resumable instanceof Set ? resumable : new Set(resumable);
	return set.has(`${jobId}::${rmId}`);
}

function withDisplayFields(
	job: HmiJob
): Pick<
	HmiJob,
	| 'jobCode'
	| 'cardLabel'
	| 'cardNo'
	| 'sectionKgPerM'
	| 'assetId'
	| 'assetCode'
	| 'name'
	| 'jobSummary'
	| 'sourceCard'
	| 'thicknessMm'
	| 'dueAt'
	| 'scheduledAt'
	| 'cardType'
	| 'marks'
	| 'manualMarks'
> {
	return {
		...(job.jobCode ? { jobCode: job.jobCode } : {}),
		...(job.cardLabel ? { cardLabel: job.cardLabel } : {}),
		...(job.cardNo != null ? { cardNo: job.cardNo } : {}),
		...(job.sectionKgPerM != null ? { sectionKgPerM: job.sectionKgPerM } : {}),
		...(job.assetId ? { assetId: job.assetId } : {}),
		...(job.assetCode ? { assetCode: job.assetCode } : {}),
		...(job.name ? { name: job.name } : {}),
		...(job.jobSummary ? { jobSummary: job.jobSummary } : {}),
		...(job.sourceCard ? { sourceCard: job.sourceCard } : {}),
		...(job.thicknessMm != null ? { thicknessMm: job.thicknessMm } : {}),
		...(job.dueAt ? { dueAt: job.dueAt } : {}),
		...(job.scheduledAt ? { scheduledAt: job.scheduledAt } : {}),
		...(job.cardType ? { cardType: job.cardType } : {}),
		...(job.marks ? { marks: job.marks } : {}),
		...(job.manualMarks ? { manualMarks: job.manualMarks } : {})
	};
}

export function mergeJobsMaps(...maps: JobsMap[]): JobsMap {
	const merged: JobsMap = {};
	for (const map of maps) {
		for (const [jobId, job] of Object.entries(map)) {
			const existing = merged[jobId];
			if (!existing) {
				merged[jobId] = {
					jobId: job.jobId,
					section: job.section,
					bars: { ...job.bars },
					...withDisplayFields(job)
				};
				continue;
			}
			const jobSummary = job.jobSummary ?? existing.jobSummary;
			const assetId = job.assetId ?? existing.assetId;
			const jobCode = job.jobCode ?? existing.jobCode;
			const cardLabel = job.cardLabel ?? existing.cardLabel;
			const cardNo = job.cardNo ?? existing.cardNo;
			const sectionKgPerM = job.sectionKgPerM ?? existing.sectionKgPerM;
			const assetCode = job.assetCode ?? existing.assetCode;
			const name = job.name ?? existing.name;
			const sourceCard = job.sourceCard ?? existing.sourceCard;
			const thicknessMm = job.thicknessMm ?? existing.thicknessMm;
			const dueAt = job.dueAt ?? existing.dueAt;
			const scheduledAt = job.scheduledAt ?? existing.scheduledAt;
			const cardType = job.cardType ?? existing.cardType;
			const marks = job.marks ?? existing.marks;
			const manualMarks = job.manualMarks ?? existing.manualMarks;
			merged[jobId] = {
				jobId: existing.jobId,
				section: job.section || existing.section,
				bars: { ...existing.bars, ...job.bars },
				...(jobCode ? { jobCode } : {}),
				...(cardLabel ? { cardLabel } : {}),
				...(cardNo != null ? { cardNo } : {}),
				...(sectionKgPerM != null ? { sectionKgPerM } : {}),
				...(assetId ? { assetId } : {}),
				...(assetCode ? { assetCode } : {}),
				...(name ? { name } : {}),
				...(jobSummary ? { jobSummary } : {}),
				...(sourceCard ? { sourceCard } : {}),
				...(thicknessMm != null ? { thicknessMm } : {}),
				...(dueAt ? { dueAt } : {}),
				...(scheduledAt ? { scheduledAt } : {}),
				...(cardType ? { cardType } : {}),
				...(marks ? { marks } : {}),
				...(manualMarks ? { manualMarks } : {})
			};
		}
	}
	return merged;
}

function markingForCard(mark: JobMarking, barQuantity: number): Record<string, unknown> {
	const pcs = mark.pcs ?? barQuantity;
	return {
		marking: mark.marking,
		itemLength: mark.itemLength,
		pcsPerBar: mark.pcsPerBar,
		pcs,
		...(mark.widthMm != null ? { widthMm: mark.widthMm } : {}),
		...(mark.operations != null ? { operationsPerPiece: mark.operations } : {})
	};
}

function manualMarkForCard(mark: ManualMark): Record<string, unknown> {
	return {
		marking: mark.marking,
		itemLength: mark.itemLength,
		pcs: mark.pcs,
		bundleNo: mark.bundleNo,
		weightPerPieceKg: mark.weightPerPieceKg,
		...(mark.operations != null ? { operationsPerPiece: mark.operations } : {})
	};
}

function plateMarkForCard(mark: PlateMark): Record<string, unknown> {
	return {
		marking: mark.marking,
		itemLength: mark.itemLength,
		widthMm: mark.widthMm,
		pcs: mark.pcs,
		weightPerPieceKg: mark.weightPerPieceKg,
		...(mark.operations != null ? { operationsPerPiece: mark.operations } : {})
	};
}

/**
 * Build the HmiJobCard `jobData` for `/iow/startJob`.
 *
 * Prefer the verbatim cloud card from KV. Reconstruct only when that is missing
 * (legacy flat / partials) — the controller validates against `hmi-job-card.schema.json`.
 */
export function buildStartJobData(job: HmiJob): StartJobData | null {
	if (job.sourceCard) {
		return { ...job.sourceCard, jobId: job.jobId };
	}

	const aid = job.assetId;
	const jobCode = job.jobCode;
	if (!aid || !jobCode) return null;

	if (job.cardType === 'manual') {
		const marks = job.manualMarks ?? [];
		if (marks.length === 0 || !job.scheduledAt || !job.dueAt) return null;
		if (marks.some((mark) => mark.weightPerPieceKg == null)) return null;
		return {
			jobId: job.jobId,
			jobCode,
			aid,
			cardType: 'manual',
			marks: marks.map(manualMarkForCard),
			scheduledAt: job.scheduledAt,
			dueAt: job.dueAt,
			...(job.assetCode ? { assetCode: job.assetCode } : {}),
			...(job.name ? { name: job.name } : {}),
			...(job.cardLabel ? { cardLabel: job.cardLabel } : {}),
			...(job.cardNo != null ? { cardNo: job.cardNo } : {})
		};
	}

	if (job.cardType === 'plate' || (job.marks && job.marks.length > 0)) {
		const thicknessMm = job.thicknessMm;
		const marks = job.marks ?? [];
		if (thicknessMm == null || thicknessMm <= 0 || marks.length === 0) return null;
		if (!job.scheduledAt || !job.dueAt) return null;
		return {
			jobId: job.jobId,
			jobCode,
			aid,
			cardType: 'plate',
			thicknessMm,
			marks: marks.map(plateMarkForCard),
			scheduledAt: job.scheduledAt,
			dueAt: job.dueAt,
			...(job.assetCode ? { assetCode: job.assetCode } : {}),
			...(job.name ? { name: job.name } : {}),
			...(job.cardLabel ? { cardLabel: job.cardLabel } : {}),
			...(job.cardNo != null ? { cardNo: job.cardNo } : {})
		};
	}

	const sectionKgPerM = job.sectionKgPerM;
	if (sectionKgPerM == null || sectionKgPerM <= 0) return null;
	// Header schema requires both schedule fields (same as plate).
	if (!job.scheduledAt || !job.dueAt) return null;

	const bars: Record<string, unknown> = {};
	for (const bar of Object.values(job.bars)) {
		bars[bar.rmId] = {
			rmId: bar.rmId,
			rmLength: bar.rmLength,
			quantity: bar.quantity,
			markings: bar.markings.map((mark) => markingForCard(mark, bar.quantity))
		};
	}
	if (Object.keys(bars).length === 0) return null;

	return {
		jobId: job.jobId,
		jobCode,
		aid,
		section: job.section,
		sectionKgPerM,
		bars,
		cardType: job.cardType ?? 'angle',
		scheduledAt: job.scheduledAt,
		dueAt: job.dueAt,
		...(job.assetCode ? { assetCode: job.assetCode } : {}),
		...(job.name ? { name: job.name } : {}),
		...(job.cardLabel ? { cardLabel: job.cardLabel } : {}),
		...(job.cardNo != null ? { cardNo: job.cardNo } : {})
	};
}

/** Human label for a job: prefer cloud `cardLabel` (`M-368`), then `jobCode`, then UUID. */
export function jobDisplayLabel(job: Pick<HmiJob, 'jobId' | 'jobCode' | 'cardLabel'>): string {
	return job.cardLabel || job.jobCode || job.jobId;
}

export function jobDropdownLabel(job: HmiJob): string {
	return `${job.section} - ${jobDisplayLabel(job)}`;
}

/** Epoch ms for a UTC ISO `scheduledAt`. Missing dates sort last. */
export function scheduleSortMs(scheduledAt: string | null | undefined): number {
	if (!scheduledAt?.trim()) return Number.POSITIVE_INFINITY;
	const parsed = Date.parse(scheduledAt.trim());
	return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
}

/** Earliest `scheduledAt` first. Undated jobs stay at the end; equal times keep card-label order. */
export function sortJobsBySchedule(jobs: JobsMap): JobsMap {
	const sorted = Object.values(jobs).sort((a, b) => {
		const aMs = scheduleSortMs(a.scheduledAt);
		const bMs = scheduleSortMs(b.scheduledAt);
		if (aMs !== bMs) return aMs < bMs ? -1 : 1;
		return jobDisplayLabel(a).localeCompare(jobDisplayLabel(b));
	});
	const next: JobsMap = {};
	for (const job of sorted) next[job.jobId] = job;
	return next;
}

export const DETAIL_PLACEHOLDER = '-';

/** Manual Start Job — primary combobox shows the card label only. */
export function manualJobDropdownLabel(job: HmiJob): string {
	return jobDisplayLabel(job);
}

export function rmDropdownLabel(bar: JobBar, resumable = false): string {
	const base = `${bar.rmId} - ${bar.rmLength}mm`;
	return resumable ? `${base} (Resume)` : base;
}

/** Manual Start Job — secondary combobox (`marking · bundleNo`). */
export function markBundleDropdownLabel(mark: ManualMark, resumable = false): string {
	const base = `${mark.marking} · ${mark.bundleNo}`;
	return resumable ? `${base} (Resume)` : base;
}

/** Pieces planned for one bar: Σ `pcs × pcsPerBar`, else the bar quantity. */
export function plannedPieceCount(bar: JobBar): number | null {
	let sum = 0;
	let any = false;
	for (const mark of bar.markings) {
		if (mark.pcs == null || mark.pcsPerBar == null) continue;
		sum += mark.pcs * mark.pcsPerBar;
		any = true;
	}
	if (any) return sum;
	return Number.isFinite(bar.quantity) ? bar.quantity : null;
}

/** Planned holes from active-job mark lines (`operations` × planned pieces). */
export function plannedOperationsFromMarks(
	marks: ReadonlyArray<{ operations?: number | null; progressTotal?: number | null }>
): number | null {
	let sum = 0;
	let any = false;
	for (const mark of marks) {
		const ops = mark.operations;
		const pieces = mark.progressTotal;
		if (ops == null || pieces == null) continue;
		if (!Number.isFinite(ops) || !Number.isFinite(pieces) || ops < 0 || pieces < 0) continue;
		sum += ops * pieces;
		any = true;
	}
	return any ? sum : null;
}

/** Whole pieces a manual job has made: holes ÷ ops per piece. Null when ops per piece is unknown. */
export function manualPiecesFromHoles(
	holes: number | null | undefined,
	opsPerPiece: number | null | undefined
): number | null {
	if (opsPerPiece == null || !Number.isFinite(opsPerPiece) || opsPerPiece <= 0) return null;
	return Math.floor(Math.max(0, holes ?? 0) / opsPerPiece);
}

/**
 * Manual live count. The machine counts holes; when the bundle has operations per piece the
 * plan is in holes too (Operation × planned pieces) and the count is coloured against it.
 * Without operations per piece there is no hole plan: show the planned pieces, and colour the
 * count blue once holes are made rather than leaving it grey.
 */
export function manualHoleProgress(
	job: {
		operationsCount?: number;
		piecesPlanned?: number | null;
		barsPlanned?: number | null;
		marks: ReadonlyArray<{ operations?: number | null; progressTotal?: number | null }>;
	} | null
): {
	holes: number | null;
	plannedLabel: 'Planned Holes' | 'Planned Qty';
	planned: number | null;
	tone: 'muted' | 'primary' | 'success';
} {
	const holes = typeof job?.operationsCount === 'number' ? job.operationsCount : null;
	const plannedHoles = job ? plannedOperationsFromMarks(job.marks) : null;
	const pieces = job?.piecesPlanned ?? job?.barsPlanned ?? null;
	const plannedPieces = typeof pieces === 'number' && Number.isFinite(pieces) ? pieces : null;
	const made = holes != null && holes > 0;

	if (plannedHoles != null && plannedHoles > 0) {
		return {
			holes,
			plannedLabel: 'Planned Holes',
			planned: plannedHoles,
			tone: !made ? 'muted' : holes >= plannedHoles ? 'success' : 'primary'
		};
	}
	return {
		holes,
		plannedLabel: 'Planned Qty',
		planned: plannedPieces,
		tone: made ? 'primary' : 'muted'
	};
}

export function lengthMmLabel(value: number | null | undefined): string {
	if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return DETAIL_PLACEHOLDER;
	return `${value} mm`;
}

export function countLabel(value: number | null | undefined): string {
	if (typeof value !== 'number' || !Number.isFinite(value)) return DETAIL_PLACEHOLDER;
	return String(value);
}

/**
 * True when the job still has markings (plate), bars (angle) or bundles (manual) that are not
 * already finished.
 */
export function jobHasAvailableMarkings(
	job: HmiJob | undefined | null,
	donePlateMarks?: Iterable<string>,
	doneRms?: Iterable<string>,
	manualTasks?: Record<string, ManualTaskProgress>
): boolean {
	if (!job) return false;
	if (job.cardType === 'manual') return unfinishedManualMarks(job, manualTasks).length > 0;
	if (
		job.cardType === 'plate' ||
		(job.marks && job.marks.length > 0 && !Object.keys(job.bars).length)
	) {
		return (job.marks ?? []).some(
			(mark) => !plateMarkIsDone(donePlateMarks ?? [], job.jobId, mark.marking)
		);
	}
	if (!job.bars) return false;
	return Object.values(job.bars).some(
		(bar) =>
			Array.isArray(bar.markings) &&
			bar.markings.length > 0 &&
			!rmIsDone(doneRms ?? [], job.jobId, bar.rmId)
	);
}

export function findManualMark(job: HmiJob, selection: string): ManualMark | undefined {
	const key = selection.trim();
	if (!key || !job.manualMarks) return undefined;
	return job.manualMarks.find((mark) => manualRowKey(mark.marking, mark.bundleNo) === key);
}

/** One bundle's saved progress on a parked manual card. */
export type ManualTaskProgress = { operations: number; done: boolean };

/** `jobId` + picker key — one bundle of one manual card. */
export function manualTaskKey(jobId: string, marking: string, bundleNo: number): string {
	return `${jobId}::${manualRowKey(marking, bundleNo)}`;
}

/**
 * Bundles saved on a parked manual card (`partialJobs:<aid>[jobId].progress.tasks`), keyed by
 * `manualTaskKey`. A bundle that is not `done` can be started again and carries on from
 * `operations`.
 */
export function manualTaskProgress(raw: unknown): Record<string, ManualTaskProgress> {
	if (!isRecord(raw) || 'error' in raw) return {};
	const tasks: Record<string, ManualTaskProgress> = {};
	for (const [jobId, entry] of Object.entries(raw)) {
		if (!isRecord(entry)) continue;
		const progress = isRecord(entry.progress) ? entry.progress : null;
		const rows = Array.isArray(progress?.tasks) ? progress.tasks : [];
		for (const row of rows) {
			if (!isRecord(row)) continue;
			const marking = typeof row.marking === 'string' ? row.marking.trim() : '';
			const bundleNo = asNumber(row.bundleNo);
			if (!marking || bundleNo == null || !Number.isInteger(bundleNo)) continue;
			const operations = asNumber(row.operations);
			tasks[manualTaskKey(jobId, marking, bundleNo)] = {
				operations: operations != null && operations > 0 ? operations : 0,
				done: row.done === true
			};
		}
	}
	return tasks;
}

/** Manual rows the operator can still start: every row whose bundle is not finished. */
export function unfinishedManualMarks(
	job: HmiJob,
	manualTasks?: Record<string, ManualTaskProgress>
): ManualMark[] {
	return (job.manualMarks ?? []).filter(
		(mark) => !manualTasks?.[manualTaskKey(job.jobId, mark.marking, mark.bundleNo)]?.done
	);
}

export function findPlateMark(job: HmiJob, marking: string): PlateMark | undefined {
	const key = marking.trim();
	if (!key || !job.marks) return undefined;
	return job.marks.find((mark) => mark.marking === key);
}

/**
 * Marks already finished on a parked plate card (`partialJobs:<aid>[jobId].progress.marks`).
 * Keys are `jobId::marking`. A mark that is not `done` stays selectable.
 */
export function donePlateMarkKeys(raw: unknown): string[] {
	if (!isRecord(raw) || 'error' in raw) return [];
	const keys: string[] = [];
	for (const [jobId, entry] of Object.entries(raw)) {
		if (!isRecord(entry)) continue;
		const progress = isRecord(entry.progress) ? entry.progress : null;
		const marks = Array.isArray(progress?.marks) ? progress.marks : [];
		for (const mark of marks) {
			if (!isRecord(mark) || mark.done !== true) continue;
			const marking = typeof mark.marking === 'string' ? mark.marking.trim() : '';
			if (!marking) continue;
			keys.push(`${jobId}::${marking}`);
		}
	}
	return keys;
}

/**
 * RMs already finished on a parked angle card (`partialJobs:<aid>[jobId].progress.rms`).
 * Keys are `jobId::rmId`. An RM that is not `done` stays selectable.
 */
export function doneRmKeys(raw: unknown): string[] {
	if (!isRecord(raw) || 'error' in raw) return [];
	const keys: string[] = [];
	for (const [jobId, entry] of Object.entries(raw)) {
		if (!isRecord(entry)) continue;
		const progress = isRecord(entry.progress) ? entry.progress : null;
		const rms = isRecord(progress?.rms) ? progress.rms : null;
		if (!rms) continue;
		for (const [rmId, record] of Object.entries(rms)) {
			if (!isRecord(record) || record.done !== true) continue;
			const id = rmId.trim();
			if (!id) continue;
			keys.push(`${jobId}::${id}`);
		}
	}
	return keys;
}

/** Angle RMs whose next start must ask which bar is on the machine, keyed `jobId::rmId`. */
export function barsToConfirmKeys(raw: unknown): string[] {
	if (!isRecord(raw)) return [];
	const keys: string[] = [];
	for (const [jobId, entry] of Object.entries(raw)) {
		if (!isRecord(entry)) continue;
		const progress = isRecord(entry.progress) ? entry.progress : null;
		const list = progress?.barsToConfirm;
		if (!Array.isArray(list)) continue;
		for (const rmId of list) {
			if (typeof rmId !== 'string') continue;
			const id = rmId.trim();
			if (!id) continue;
			keys.push(`${jobId}::${id}`);
		}
	}
	return keys;
}

/**
 * Whole bars finished: the least `floor(count / pcsPerBar)` over the marks that carry a bar size.
 * Each mark's count is the pieces it has, so a bar is only whole once every mark on it is cut.
 */
export function wholeBarsFromMarks<T extends { pcsPerBar: number | null | undefined }>(
	marks: readonly T[],
	countOf: (mark: T) => number | null | undefined
): number | null {
	let whole: number | null = null;
	for (const mark of marks) {
		if (mark.pcsPerBar == null || mark.pcsPerBar <= 0) continue;
		const count = Math.max(0, countOf(mark) ?? 0);
		const bars = Math.floor(count / mark.pcsPerBar);
		whole = whole == null ? bars : Math.min(whole, bars);
	}
	return whole;
}

export function rmIsDone(done: Iterable<string>, jobId: string, rmId: string): boolean {
	const set = done instanceof Set ? done : new Set(done);
	return set.has(`${jobId}::${rmId.trim()}`);
}

export function plateMarkIsDone(done: Iterable<string>, jobId: string, marking: string): boolean {
	const set = done instanceof Set ? done : new Set(done);
	return set.has(`${jobId}::${marking.trim()}`);
}

/** Plates already clamped on a parked card, keyed `jobId::marking`. */
export function plateMarkPieces(raw: unknown): Record<string, number> {
	if (!isRecord(raw) || 'error' in raw) return {};
	const pieces: Record<string, number> = {};
	for (const [jobId, entry] of Object.entries(raw)) {
		if (!isRecord(entry)) continue;
		const progress = isRecord(entry.progress) ? entry.progress : null;
		const marks = Array.isArray(progress?.marks) ? progress.marks : [];
		for (const mark of marks) {
			if (!isRecord(mark)) continue;
			const marking = typeof mark.marking === 'string' ? mark.marking.trim() : '';
			const made = asNumber(mark.pieces);
			if (!marking || made == null) continue;
			pieces[`${jobId}::${marking}`] = made;
		}
	}
	return pieces;
}
