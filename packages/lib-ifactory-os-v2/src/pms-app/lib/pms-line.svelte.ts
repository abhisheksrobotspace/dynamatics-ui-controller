import { globalMqtt } from '$lib/os/lib/custom-scripts/mqtt.js';
import { extractPrimaryMachine, setSelectedAssetId } from '$lib/os/asset-context';
import { PMS_SUBSCRIBE_TOPICS } from './pms-topics';
import { lineIdFromAssetClass } from './line-from-class';
import type { PmsLineId } from '../lines/types';

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export type PmsLineState = {
	/**
	 * True when we have a decision for a present assetClass (supported or unsupported).
	 * False while waiting for machineSettings / assetClass — App shows Loading EmptyState.
	 */
	ready: boolean;
	/** Human-readable blocked message when ready and lineId is null (unsupported class). */
	error: string | null;
	lineId: PmsLineId | null;
	assetClass: string | null;
	aid: string | null;
	/** The machine's name from machineSettings (else its asset code), for display. */
	machineName: string | null;
	/** Bumps when `lineId` or `aid` changes so App can reset navigation. */
	revision: number;
};

export const pmsLineStore = $state<PmsLineState>({
	ready: false,
	error: null,
	lineId: null,
	assetClass: null,
	aid: null,
	machineName: null,
	revision: 0
});

/** What to show for "Machine": its name, else its asset code, else its id. */
export function machineDisplayName(): string {
	return pmsLineStore.machineName || pmsLineStore.aid || '—';
}

function applyWaiting(aid: string | null, message: string): void {
	const aidChanged = pmsLineStore.aid !== aid;
	pmsLineStore.ready = false;
	pmsLineStore.error = message;
	pmsLineStore.lineId = null;
	pmsLineStore.assetClass = null;
	pmsLineStore.aid = aid;
	if (!aid) pmsLineStore.machineName = null;
	if (aidChanged) pmsLineStore.revision += 1;
}

function applyResolved(next: {
	lineId: PmsLineId | null;
	assetClass: string | null;
	aid: string | null;
	error: string | null;
}): void {
	const lineChanged = pmsLineStore.lineId !== next.lineId;
	const aidChanged = pmsLineStore.aid !== next.aid;
	pmsLineStore.lineId = next.lineId;
	pmsLineStore.assetClass = next.assetClass;
	pmsLineStore.aid = next.aid;
	pmsLineStore.error = next.error;
	pmsLineStore.ready = true;
	if (lineChanged || aidChanged) {
		pmsLineStore.revision += 1;
	}
}

function resolveFromSettings(settings: Record<string, unknown>): void {
	const primary = extractPrimaryMachine(settings);
	if (!primary) {
		setSelectedAssetId(null);
		applyWaiting(null, 'Waiting for machineSettings…');
		return;
	}

	const { aid, assetClass } = primary;
	setSelectedAssetId(aid);
	pmsLineStore.machineName = primary.name ?? primary.assetCode;

	// No class yet — keep Loading EmptyState until machineSettings carries assetClass.
	if (!assetClass) {
		applyWaiting(aid, 'Waiting for machine class in machineSettings…');
		return;
	}

	const lineId = lineIdFromAssetClass(assetClass);
	if (!lineId) {
		console.error(`pms-line: unsupported assetClass "${assetClass}" — UI blocked`);
		applyResolved({
			lineId: null,
			assetClass,
			aid,
			error: `Unsupported machine class "${assetClass}".`
		});
		return;
	}

	applyResolved({ lineId, assetClass, aid, error: null });
}

export async function hydratePmsLine(): Promise<void> {
	try {
		const settings = await globalMqtt.get('machineSettings');
		if (!isRecord(settings) || 'error' in settings) {
			console.error('pms-line: machineSettings unavailable', settings);
			setSelectedAssetId(null);
			applyWaiting(null, 'Waiting for machineSettings…');
			return;
		}
		resolveFromSettings(settings);
	} catch (error) {
		console.error('pms-line: failed to read machineSettings', error);
		setSelectedAssetId(null);
		applyWaiting(null, 'Waiting for machineSettings…');
	}
}

/**
 * Hydrate once, then re-resolve when the controller echoes `/iow/machineSettings`.
 * Owned by PMS App.svelte (onMount / onDestroy).
 */
export function bindPmsLine(): () => void {
	const onEvent = (topic: string) => {
		if (topic === PMS_SUBSCRIBE_TOPICS.MACHINE_SETTINGS) {
			void hydratePmsLine();
		}
	};

	globalMqtt.subscribeTopics([PMS_SUBSCRIBE_TOPICS.MACHINE_SETTINGS]);
	globalMqtt.on('event', onEvent);

	void (async () => {
		if (typeof globalMqtt.waitUntilConnected === 'function') {
			await globalMqtt.waitUntilConnected(10_000);
		}
		await hydratePmsLine();
	})();

	return () => {
		globalMqtt.off('event', onEvent);
	};
}
