import { globalMqtt } from '$lib/os/lib/custom-scripts/mqtt.js';
import { extractPrimaryMachine } from './primary-machine.js';

export { extractPrimaryMachine, type PrimaryMachine } from './primary-machine.js';

/**
 * Current machine for `/iow/*` payloads (docs: every Path B body carries `aid`).
 * V1: first non-`_shared` entry from `machineSettings`. Multi-machine picker is a later slice.
 */
let selectedAssetId: string | null = null;

export function getSelectedAssetId(): string | null {
	return selectedAssetId;
}

export function setSelectedAssetId(assetId: string | null | undefined) {
	const next = typeof assetId === 'string' ? assetId.trim() : '';
	selectedAssetId = next || null;
}

/** Merge `aid` into a publish body (PMS_UI_LOCAL_MQTT — never `assetId` on the wire). */
export function withAssetId<T extends Record<string, unknown>>(payload: T): T & { aid?: string } {
	const aid = selectedAssetId;
	if (!aid) {
		console.error(
			'MQTT publish missing aid — call ensureSelectedAssetId() after machineSettings load'
		);
		return payload;
	}
	return { ...payload, aid };
}

/**
 * Resolve and cache the selected machine aid from runtime `machineSettings`.
 * Prefers `aid` on the machine block; accepts legacy `assetId` when reading settings.
 */
export async function ensureSelectedAssetId(): Promise<string | null> {
	if (selectedAssetId) return selectedAssetId;

	try {
		const settings = await globalMqtt.get('machineSettings');
		const primary = extractPrimaryMachine(settings);
		if (!primary?.aid) {
			console.error('asset-context: no machine entries in machineSettings');
			return null;
		}
		selectedAssetId = primary.aid;
		return selectedAssetId;
	} catch (error) {
		console.error('asset-context: failed to read machineSettings', error);
		return null;
	}
}
