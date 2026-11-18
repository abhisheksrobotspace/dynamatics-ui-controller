import { globalMqtt } from './lib/custom-scripts/mqtt.js';
import { ensureSelectedAssetId } from './asset-context.js';

/** PIN for switching the I/O app on when machineSettings has no `ioPIN` / `ioPassword`. */
export const DEFAULT_IO_PIN = '1478953';

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asString(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const next = value.trim();
	return next || null;
}

/** Per-aid machine block in KV `machineSettings`, or null when the slice is flat. */
export function findMachineEntry(
	settings: Record<string, unknown>,
	assetId: string | null
): { key: string; machine: Record<string, unknown> } | null {
	const machines = Object.entries(settings).filter(
		(entry): entry is [string, Record<string, unknown>] =>
			entry[0] !== '_shared' && isRecord(entry[1])
	);
	if (machines.length === 0) return null;

	if (assetId) {
		const match = machines.find(
			([key, m]) =>
				key === assetId || asString(m.aid) === assetId || asString(m.assetId) === assetId
		);
		if (match) return { key: match[0], machine: match[1] };
	}

	return { key: machines[0][0], machine: machines[0][1] };
}

/**
 * A PIN from machineSettings: the first of `keys` found on the machine block, then `_shared`,
 * then the flat slice; `fallback` when none is set.
 */
export function machinePinFromSettings(
	settings: Record<string, unknown>,
	machine: Record<string, unknown> | null,
	keys: string[],
	fallback: string
): string {
	const shared = isRecord(settings._shared) ? settings._shared : null;
	for (const source of [machine, shared, settings]) {
		if (!source) continue;
		for (const key of keys) {
			const pin = asString(source[key]);
			if (pin) return pin;
		}
	}
	return fallback;
}

/** The I/O app's PIN (`ioPIN` / `ioPassword` in machineSettings); the default when unreadable. */
export async function readIoPin(): Promise<string> {
	try {
		const settings = await globalMqtt.get('machineSettings');
		if (!isRecord(settings) || 'error' in settings) return DEFAULT_IO_PIN;
		const aid = await ensureSelectedAssetId();
		const machine = findMachineEntry(settings, aid)?.machine ?? null;
		return machinePinFromSettings(settings, machine, ['ioPIN', 'ioPassword'], DEFAULT_IO_PIN);
	} catch {
		return DEFAULT_IO_PIN;
	}
}
