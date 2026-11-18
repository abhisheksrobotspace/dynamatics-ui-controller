import { ASYNC_STATUS_POLL_MS } from '../../lib/api/jobs.js';
import {
	reconcileBomExtractStatusFromItems,
	resolveBomExtractStatus,
	triggerBomExtract
} from './projects/boms.api.js';
import type { BomConfig } from './store.svelte.js';
import type { BomExtractStatus } from './bom-extract-status.js';
import { pmPushErrorToast, pmPushSuccessToast, pmPushToast } from './toast.js';
import { errorDescription } from '../../lib/api/types.js';
import { SvelteMap } from 'svelte/reactivity';

const polls = new SvelteMap<string, ReturnType<typeof setInterval>>();
const pollAttempts = new SvelteMap<string, number>();
/** Authoritative in-session extract status for list UI — survives handler/race glitches. */
const liveExtractStatus = new SvelteMap<string, BomExtractStatus>();
let extractStatusVersion = $state(0);

/** Reactive tick for list rows/columns when extract_status changes. */
export function bomExtractStatusVersion(): number {
	void liveExtractStatus.size;
	return extractStatusVersion;
}

export function resolveLiveExtractStatus(
	bomId: string,
	fallback: BomExtractStatus
): BomExtractStatus {
	void liveExtractStatus.size;
	return liveExtractStatus.get(bomId) ?? fallback;
}

export function seedLiveExtractStatuses(boms: BomConfig[]): void {
	for (const bom of boms) {
		if (bom.bomFileId) liveExtractStatus.set(bom.id, bom.extractStatus);
	}
	notifyExtractStatusChanged();
}

export function clearLiveExtractStatus(bomId: string): void {
	if (!liveExtractStatus.has(bomId)) return;
	liveExtractStatus.delete(bomId);
	notifyExtractStatusChanged();
}

function notifyExtractStatusChanged(): void {
	extractStatusVersion += 1;
}

function setLiveExtractStatus(bomId: string, status: BomExtractStatus): void {
	if (liveExtractStatus.get(bomId) === status) return;
	liveExtractStatus.set(bomId, status);
	notifyExtractStatusChanged();
}

const TERMINAL: BomExtractStatus[] = ['extracted', 'failed'];
/** ~2 minutes at ASYNC_STATUS_POLL_MS — stop polling if the sidecar never updates extract_status. */
const MAX_POLL_ATTEMPTS = 12;

export type BomExtractHandlers = {
	getBom: (bomId: string) => BomConfig | undefined;
	updateBom: (bom: BomConfig) => void;
};

let handlers: BomExtractHandlers | null = null;

export function bindBomExtractHandlers(next: BomExtractHandlers): void {
	handlers = next;
}

export function unbindBomExtractHandlers(): void {
	handlers = null;
}

function getHandlers(): BomExtractHandlers | null {
	return handlers;
}

function applyExtractStatus(
	bomId: string,
	resolvedStatus: BomExtractStatus
): { status: BomExtractStatus; updated: boolean } {
	const activeHandlers = getHandlers();
	const existing = activeHandlers?.getBom(bomId);

	let nextStatus = resolvedStatus;
	if (
		existing &&
		polls.has(bomId) &&
		resolvedStatus === 'pending' &&
		existing.extractStatus === 'extracting'
	) {
		nextStatus = 'extracting';
	}

	const previous = liveExtractStatus.get(bomId) ?? existing?.extractStatus ?? resolvedStatus;
	if (previous === nextStatus) {
		return { status: nextStatus, updated: false };
	}

	setLiveExtractStatus(bomId, nextStatus);

	if (!existing) {
		return { status: nextStatus, updated: true };
	}

	activeHandlers!.updateBom({ ...existing, extractStatus: nextStatus });
	return { status: nextStatus, updated: true };
}

export function stopBomExtractPoll(bomId: string) {
	const timer = polls.get(bomId);
	if (timer) clearInterval(timer);
	polls.delete(bomId);
	pollAttempts.delete(bomId);
}

/** Stop polling and mark a BOM as pending before CSV replacement re-extract. */
export function markBomExtractPending(bomId: string): void {
	stopBomExtractPoll(bomId);
	setLiveExtractStatus(bomId, 'pending');
	const activeHandlers = getHandlers();
	const existing = activeHandlers?.getBom(bomId);
	if (existing) {
		activeHandlers!.updateBom({ ...existing, extractStatus: 'pending' });
	}
}

export function stopAllBomExtractPolls() {
	for (const bomId of polls.keys()) stopBomExtractPoll(bomId);
}

/**
 * After list load: for BOMs still `pending` with a CSV, check items exist (`limit=1`).
 * Fixes Extract vs View when `extract_status` was never flipped by the sidecar.
 */
export async function hydrateBomExtractStatuses(boms: BomConfig[]) {
	const activeHandlers = getHandlers();
	if (!activeHandlers) return;

	await Promise.all(
		boms.map(async (bom) => {
			try {
				if (!bom.bomFileId) return;
				if (bom.extractStatus === 'extracted' || bom.extractStatus === 'failed') return;

				const status = await reconcileBomExtractStatusFromItems(bom);
				if (status === bom.extractStatus) return;
				setLiveExtractStatus(bom.id, status);
				activeHandlers.updateBom({ ...bom, extractStatus: status });
			} catch (error) {
				pmPushErrorToast({
					title: 'Could not refresh BOM extract status',
					description: errorDescription(error)
				});
			}
		})
	);
}

export async function queueBomExtraction(
	_projectId: string,
	_structureId: string,
	bom: BomConfig,
	bomFileId: string,
	options?: { force?: boolean }
) {
	const activeHandlers = getHandlers();
	if (!activeHandlers) return;

	const existing = activeHandlers.getBom(bom.id);

	if (options?.force) {
		stopBomExtractPoll(bom.id);
	} else {
		const resolved = await resolveBomExtractStatus(bom.id);

		if (resolved === 'extracted') {
			setLiveExtractStatus(bom.id, 'extracted');
			activeHandlers.updateBom({
				...bom,
				bomFileId,
				extractStatus: 'extracted',
				sNo: existing?.sNo ?? bom.sNo
			});
			pmPushToast({
				title: 'BOM already extracted',
				description: `${bom.bomName} already has extracted rows — ready for operations count.`
			});
			return;
		}
	}

	await triggerBomExtract(bom.id, bomFileId);
	setLiveExtractStatus(bom.id, 'extracting');
	activeHandlers.updateBom({
		...bom,
		bomFileId,
		extractStatus: 'extracting',
		sNo: existing?.sNo ?? bom.sNo
	});
	startBomExtractPoll(bom.id);
	pmPushToast({
		title: 'BOM extraction queued',
		description: 'BOM rows are being extracted in the background.'
	});
}

export function startBomExtractPoll(bomId: string) {
	if (polls.has(bomId)) return;

	const tick = async () => {
		const attempts = (pollAttempts.get(bomId) ?? 0) + 1;
		pollAttempts.set(bomId, attempts);
		const activeHandlers = getHandlers();

		try {
			const resolved = await resolveBomExtractStatus(bomId);
			if (!resolved) {
				stopBomExtractPoll(bomId);
				return;
			}

			if (attempts > MAX_POLL_ATTEMPTS && !TERMINAL.includes(resolved)) {
				stopBomExtractPoll(bomId);
				const existing = activeHandlers?.getBom(bomId);
				const finalStatus: BomExtractStatus = resolved === 'extracted' ? 'extracted' : 'failed';
				if (liveExtractStatus.get(bomId) !== finalStatus) {
					setLiveExtractStatus(bomId, finalStatus);
					if (existing) {
						activeHandlers?.updateBom({ ...existing, extractStatus: finalStatus });
					}
				}
				if (finalStatus === 'failed') {
					pmPushToast({
						title: 'BOM extraction timed out',
						description: `${existing?.bomName ?? 'BOM'} did not finish in time. Try Retry extract.`
					});
				}
				return;
			}

			const prev = liveExtractStatus.get(bomId) ?? activeHandlers?.getBom(bomId)?.extractStatus;
			const { status, updated } = applyExtractStatus(bomId, resolved);

			if (!TERMINAL.includes(status)) return;

			stopBomExtractPoll(bomId);
			if (!updated || prev === status) return;

			const bom = activeHandlers?.getBom(bomId);
			if (status === 'extracted') {
				pmPushSuccessToast({
					title: 'BOM extraction complete',
					description: `${bom?.bomName ?? 'BOM'} is ready for operations count.`
				});
			} else if (status === 'failed') {
				pmPushErrorToast({
					title: 'BOM extraction failed',
					description: `Retry extraction for ${bom?.bomName ?? 'BOM'} from the BOMs list.`
				});
			}
		} catch (err) {
			pmPushErrorToast({
				title: 'BOM extract status check failed',
				description: errorDescription(err)
			});
		}
	};

	pollAttempts.set(bomId, 0);
	polls.set(bomId, setInterval(tick, ASYNC_STATUS_POLL_MS));
	void tick();
}

export function resumeBomExtractPolls(boms: BomConfig[]) {
	for (const bom of boms) {
		const status = liveExtractStatus.get(bom.id) ?? bom.extractStatus;
		if (bom.bomFileId && status === 'extracting') {
			startBomExtractPoll(bom.id);
		}
	}
}
