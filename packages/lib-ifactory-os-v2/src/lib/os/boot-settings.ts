import { globalMqtt } from '$lib/os/lib/custom-scripts/mqtt.js';
import { ensureSelectedAssetId } from '$lib/os/asset-context.js';
import {
	applyStaticReasonsFallback,
	loadReasonsCatalog,
	reasonsCatalog
} from '$lib/os/reasons-catalog.svelte.js';
import { restoreOpenAckOverlayFromLiveState } from '$lib/os/machine-idle/machine-idle-store.svelte.js';

const MQTT_CONNECT_TIMEOUT_MS = 10_000;
const MACHINE_SETTINGS_BOOT_TIMEOUT_MS = 8_000;

/**
 * Kick off at shell mount before idle bind (caller does not await). Updates aid +
 * reason catalog when machineSettings arrives; static fallback on timeout/failure.
 * After catalog settle, re-check liveState so plant-specific requiresAck reasons adopt.
 */
export async function hydrateOsMachineSettings(): Promise<void> {
	if (!reasonsCatalog.ready) {
		const connected = await globalMqtt.waitUntilConnected(MQTT_CONNECT_TIMEOUT_MS);
		if (!connected) {
			applyStaticReasonsFallback('MQTT not connected within boot timeout');
			await restoreOpenAckOverlayFromLiveState();
			return;
		}

		try {
			await Promise.race([
				(async () => {
					await ensureSelectedAssetId();
					await loadReasonsCatalog();
				})(),
				new Promise<never>((_, reject) => {
					setTimeout(
						() => reject(new Error('machineSettings boot timeout')),
						MACHINE_SETTINGS_BOOT_TIMEOUT_MS
					);
				})
			]);
		} catch (error) {
			console.warn('boot: machineSettings hydrate failed; using static fallback', error);
			if (!reasonsCatalog.ready) {
				applyStaticReasonsFallback('boot hydrate failed or timed out');
			}
		}
	}

	await restoreOpenAckOverlayFromLiveState();
}
