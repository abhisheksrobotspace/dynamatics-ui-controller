import { globalMqtt } from '../lib/custom-scripts/mqtt.js';
import { machineIdleJobContext } from '../machine-idle/machine-idle-store.svelte';
import { ensureSelectedAssetId, getSelectedAssetId, withAssetId } from '../asset-context.js';
import { findMachineEntry, machinePinFromSettings } from '../machine-pin.js';

const IS_INTERLOCK_ON_TOPIC = '/iow/isInterlockOn';
const INTERLOCK_STATE_TOPIC = '/iow/interlockState';
const INTERLOCK_CONFIG_CHANGED_TOPIC = '/iow/interlockConfigChanged';
const INTERLOCK_ENABLED_STATUS_TOPIC = '/iow/interlockEnabledStatus';
const GET_INTERLOCK_STATE_TOPIC = '/iow/getInterlockState';
const INTERLOCK_STATE_CHANGED_TOPIC = '/iow/interlockStateChanged';
const MACHINE_SETTINGS_TOPIC = '/iow/machineSettings';

/** Default PIN when machineSettings has no interlockPIN / interlockPassword. */
export const DEFAULT_INTERLOCK_PIN = '147359';

export const interlockOverlay = $state({
	isOpen: false
});

export const interlockStore = $state({
	/** Feature flag from machineSettings / interlockEnabledStatus. */
	isEnabled: false,
	/** Config / `/iow/interlockState` — TaskBar IL. */
	isActive: false,
	/** Last `/iow/isInterlockOn` from controller — drives overlay. */
	isOn: false
});

/**
 * Soft dismiss until the next controller `/iow/isInterlockOn { status: true }`.
 * TaskBar / Lockscreen IL stay independent of this.
 */
let dismissedUntilNextControllerOn = false;
let mqttBound = false;
let mqttRefCount = 0;
let onMqttEvent: ((topic: string, data: unknown) => void) | null = null;

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/** Operational interlock fields live on the machine block; accept flat echo as fallback. */
function interlockFlagsFromSettings(
	settings: Record<string, unknown>,
	assetId: string | null
): { isEnabled: boolean; isActive: boolean } {
	const entry = findMachineEntry(settings, assetId);
	const machine = entry?.machine;
	const enabledSource = machine && 'isInterlockEnabled' in machine ? machine : settings;
	const activeSource = machine && 'isInterlockActive' in machine ? machine : settings;
	return {
		isEnabled: Boolean(enabledSource.isInterlockEnabled),
		isActive: Boolean(activeSource.isInterlockActive)
	};
}

function interlockPinFromSettings(
	settings: Record<string, unknown>,
	machine: Record<string, unknown> | null
): string {
	return machinePinFromSettings(
		settings,
		machine,
		['interlockPIN', 'interlockPassword'],
		DEFAULT_INTERLOCK_PIN
	);
}

/** Overlay only from controller isOn — not from settings isActive alone. */
export function canShowInterlockOverlay(): boolean {
	return (
		interlockStore.isEnabled &&
		interlockStore.isOn &&
		!machineIdleJobContext.hasActiveJob &&
		!dismissedUntilNextControllerOn
	);
}

function closeOverlay() {
	interlockOverlay.isOpen = false;
}

function applyOverlayFromController() {
	if (canShowInterlockOverlay()) {
		interlockOverlay.isOpen = true;
		return;
	}
	closeOverlay();
}

/** Soft dismiss — stays closed until controller sends isInterlockOn true again. */
export function dismissInterlockOverlay() {
	dismissedUntilNextControllerOn = true;
	closeOverlay();
}

/**
 * PMS: hide while job active; after job clear, reopen only if controller still
 * reports isOn and operator has not dismissed since that signal.
 */
export function syncInterlockWithActiveJob(hasActiveJob: boolean) {
	if (hasActiveJob) {
		closeOverlay();
		return;
	}
	applyOverlayFromController();
}

/**
 * Controller publishes `/iow/isInterlockOn` after enable/disable GPIO.
 * Each `status: true` is a new request → clear dismiss and show overlay.
 */
function handleIsInterlockOn(data: unknown) {
	if (!isRecord(data) || Object.keys(data).length === 0) {
		interlockStore.isOn = false;
		dismissedUntilNextControllerOn = false;
		closeOverlay();
		return;
	}

	const status = Boolean(data.status);
	interlockStore.isOn = status;

	if (status) {
		interlockStore.isActive = true;
		dismissedUntilNextControllerOn = false;
		applyOverlayFromController();
		return;
	}

	dismissedUntilNextControllerOn = false;
	closeOverlay();
}

function handleInterlockState(data: unknown) {
	if (!isRecord(data)) return;
	interlockStore.isActive = Boolean(data.status);
}

function handleInterlockConfigChanged(data: unknown) {
	if (!isRecord(data)) return;
	interlockStore.isActive = Boolean(data.enabled);
	if (!data.enabled) {
		interlockStore.isOn = false;
		dismissedUntilNextControllerOn = false;
		closeOverlay();
	}
}

function handleInterlockEnabledStatus(data: unknown) {
	if (!isRecord(data)) return;
	if ('isEnabled' in data) {
		interlockStore.isEnabled = Boolean(data.isEnabled);
	}
	if ('isActive' in data) {
		interlockStore.isActive = Boolean(data.isActive);
	}
	if (!interlockStore.isEnabled) {
		interlockStore.isOn = false;
		dismissedUntilNextControllerOn = false;
		closeOverlay();
		return;
	}
	// Feature just enabled while a prior isOn was buffered — apply overlay.
	applyOverlayFromController();
}

async function hydrateFromMachineSettings() {
	try {
		const settings = await globalMqtt.get('machineSettings');
		if (!isRecord(settings) || 'error' in settings) {
			console.warn('interlock: machineSettings unavailable for hydrate', settings);
			return;
		}
		await ensureSelectedAssetId();
		const flags = interlockFlagsFromSettings(settings, getSelectedAssetId());
		interlockStore.isEnabled = flags.isEnabled;
		interlockStore.isActive = flags.isActive;
		if (!interlockStore.isEnabled) {
			interlockStore.isOn = false;
			dismissedUntilNextControllerOn = false;
			closeOverlay();
		}
		// Do not open overlay from settings — wait for `/iow/isInterlockOn`.
	} catch (error) {
		console.error('interlock: failed to read machineSettings', error);
	}
}

/** Re-read enabled/active flags (About Device mount, late settings, MQTT connect). */
export async function refreshInterlockFromMachineSettings(): Promise<void> {
	await hydrateFromMachineSettings();
}

export function bindInterlockMqttEvents(): () => void {
	mqttRefCount += 1;
	if (mqttBound) {
		return () => {
			mqttRefCount = Math.max(0, mqttRefCount - 1);
		};
	}

	mqttBound = true;
	onMqttEvent = (topic, data) => {
		switch (topic) {
			case IS_INTERLOCK_ON_TOPIC:
				handleIsInterlockOn(data);
				break;
			case INTERLOCK_STATE_TOPIC:
				handleInterlockState(data);
				break;
			case INTERLOCK_CONFIG_CHANGED_TOPIC:
				handleInterlockConfigChanged(data);
				break;
			case INTERLOCK_ENABLED_STATUS_TOPIC:
				handleInterlockEnabledStatus(data);
				break;
			case MACHINE_SETTINGS_TOPIC:
				void hydrateFromMachineSettings();
				break;
			default:
				break;
		}
	};
	globalMqtt.subscribeTopics([
		IS_INTERLOCK_ON_TOPIC,
		INTERLOCK_STATE_TOPIC,
		INTERLOCK_CONFIG_CHANGED_TOPIC,
		INTERLOCK_ENABLED_STATUS_TOPIC,
		MACHINE_SETTINGS_TOPIC
	]);
	globalMqtt.on('event', onMqttEvent);

	void (async () => {
		if (typeof globalMqtt.waitUntilConnected === 'function') {
			await globalMqtt.waitUntilConnected(10_000);
		}
		await hydrateFromMachineSettings();
		await ensureSelectedAssetId();
		globalMqtt.publish(GET_INTERLOCK_STATE_TOPIC, withAssetId({}));
	})();

	return () => {
		mqttRefCount = Math.max(0, mqttRefCount - 1);
		if (mqttRefCount > 0 || !mqttBound) return;
		mqttBound = false;
		if (onMqttEvent) {
			globalMqtt.off('event', onMqttEvent);
			onMqttEvent = null;
		}
		dismissedUntilNextControllerOn = false;
		closeOverlay();
	};
}

/** TaskBar / Lockscreen: show IL indicator when feature is enabled. */
export function hasInterlockTaskBarChip(): boolean {
	return interlockStore.isEnabled;
}

/**
 * About Device: toggle `isInterlockActive` after PIN check (AI-OS parity).
 * Writes the per-aid machine block in runtime `machineSettings`, then wakes the
 * controller via `/iow/interlockStateChanged`. Overlay opens only when the
 * controller answers with `/iow/isInterlockOn`.
 */
export async function setInterlockActiveWithPin(
	nextActive: boolean,
	pin: string
): Promise<{ ok: true } | { ok: false; reason: 'pin' | 'settings' | 'update' | 'disabled' }> {
	const settingsRaw = await globalMqtt.get('machineSettings');
	if (!isRecord(settingsRaw) || 'error' in settingsRaw) {
		return { ok: false, reason: 'settings' };
	}

	const aid = await ensureSelectedAssetId();
	const entry = findMachineEntry(settingsRaw, aid);
	const machine = entry?.machine ?? null;
	const flags = interlockFlagsFromSettings(settingsRaw, aid);

	if (!flags.isEnabled) {
		return { ok: false, reason: 'disabled' };
	}

	const expectedPin = interlockPinFromSettings(settingsRaw, machine);
	if (pin.trim() !== expectedPin) {
		return { ok: false, reason: 'pin' };
	}

	const basePinConfig = isRecord(machine?.pinConfig)
		? { ...machine!.pinConfig }
		: isRecord(settingsRaw.pinConfig)
			? { ...settingsRaw.pinConfig }
			: {};
	if (basePinConfig.interlockPin == null || basePinConfig.interlockPin === '') {
		basePinConfig.interlockPin = 7;
	}

	let nextSettings: Record<string, unknown>;
	if (entry) {
		nextSettings = {
			...settingsRaw,
			[entry.key]: {
				...entry.machine,
				isInterlockActive: nextActive,
				pinConfig: basePinConfig
			}
		};
	} else {
		// Flat settings echo (no per-aid keys) — rare; still write operational fields.
		nextSettings = {
			...settingsRaw,
			isInterlockActive: nextActive,
			pinConfig: basePinConfig
		};
	}

	const result = await globalMqtt.update('machineSettings', nextSettings);
	if (isRecord(result) && 'error' in result && result.error) {
		return { ok: false, reason: 'update' };
	}

	interlockStore.isActive = nextActive;
	if (!nextActive) {
		interlockStore.isOn = false;
		dismissedUntilNextControllerOn = false;
		closeOverlay();
	}
	await ensureSelectedAssetId();
	globalMqtt.publish(INTERLOCK_STATE_CHANGED_TOPIC, withAssetId({ enabled: nextActive }));
	globalMqtt.publish(GET_INTERLOCK_STATE_TOPIC, withAssetId({}));

	return { ok: true };
}
