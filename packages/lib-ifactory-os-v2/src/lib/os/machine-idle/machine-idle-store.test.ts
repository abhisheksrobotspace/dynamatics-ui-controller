import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/custom-scripts/mqtt.js', () => ({
	globalMqtt: {
		publish: vi.fn(),
		get: vi.fn(async () => null),
		on: vi.fn(),
		off: vi.fn(),
		subscribeTopics: vi.fn()
	}
}));

vi.mock('../asset-context.js', () => ({
	ensureSelectedAssetId: vi.fn(async () => 'asset-1'),
	withAssetId: vi.fn((payload: unknown) => payload)
}));

vi.mock('../reasons-catalog.svelte.js', () => ({
	findCatalogReasonByCode: vi.fn(() => undefined),
	findCatalogReasonById: vi.fn(() => undefined),
	loadReasonsCatalog: vi.fn(async () => undefined)
}));

import {
	machineStoppedOverlay,
	onOperatorLoggedInForIdle,
	onOperatorLoggedOutForIdle,
	selectedOverlayAlert,
	SYNTHETIC_ALERT
} from './machine-idle-store.svelte.js';

function resetOverlay() {
	selectedOverlayAlert.id = '';
	selectedOverlayAlert.label = '';
	machineStoppedOverlay.isOpen = false;
	machineStoppedOverlay.canOpen = true;
	machineStoppedOverlay.pickingReason = false;
	machineStoppedOverlay.reasonLocked = false;
	machineStoppedOverlay.productionAlert = false;
}

describe('machine idle overlay: operator login / logout', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		resetOverlay();
	});

	afterEach(() => {
		vi.clearAllTimers();
		vi.useRealTimers();
	});

	it('keeps a held "No Operator" (7) reason across login', () => {
		selectedOverlayAlert.id = SYNTHETIC_ALERT.NO_OPERATOR;
		selectedOverlayAlert.label = 'No Operator';
		machineStoppedOverlay.canOpen = false;

		onOperatorLoggedInForIdle();

		expect(selectedOverlayAlert.id).toBe(7);
		expect(selectedOverlayAlert.label).toBe('No Operator');
		expect(machineStoppedOverlay.canOpen).toBe(false);
	});

	it('keeps a held "No Operator" (7) reason across logout', () => {
		selectedOverlayAlert.id = SYNTHETIC_ALERT.NO_OPERATOR;
		selectedOverlayAlert.label = 'No Operator';
		machineStoppedOverlay.canOpen = false;

		onOperatorLoggedOutForIdle();

		expect(selectedOverlayAlert.id).toBe(7);
		expect(selectedOverlayAlert.label).toBe('No Operator');
		expect(machineStoppedOverlay.canOpen).toBe(false);
	});

	it('clears the HMI-only "No Login" (103) alert on login', () => {
		selectedOverlayAlert.id = SYNTHETIC_ALERT.NO_LOGIN;
		selectedOverlayAlert.label = 'No Login';
		machineStoppedOverlay.canOpen = false;

		onOperatorLoggedInForIdle();

		expect(selectedOverlayAlert.id).toBe('');
		expect(selectedOverlayAlert.label).toBe('');
		expect(machineStoppedOverlay.canOpen).toBe(true);
	});

	it('clears the HMI-only "No Job" (102) alert on logout', () => {
		selectedOverlayAlert.id = SYNTHETIC_ALERT.NO_JOB;
		selectedOverlayAlert.label = 'No Job';
		machineStoppedOverlay.canOpen = false;

		onOperatorLoggedOutForIdle();

		expect(selectedOverlayAlert.id).toBe('');
		expect(selectedOverlayAlert.label).toBe('');
		expect(machineStoppedOverlay.canOpen).toBe(true);
	});

	it('clears a production alarm showing "No Login" (103) on login', () => {
		selectedOverlayAlert.id = SYNTHETIC_ALERT.NO_LOGIN;
		selectedOverlayAlert.label = 'No Login';
		machineStoppedOverlay.reasonLocked = true;
		machineStoppedOverlay.isOpen = true;

		onOperatorLoggedInForIdle();

		expect(machineStoppedOverlay.isOpen).toBe(false);
		expect(selectedOverlayAlert.id).toBe('');
	});
});

/** A fresh store (module state reset) bound to a fake broker. */
async function bindFreshStore() {
	vi.resetModules();
	vi.clearAllMocks();
	const { globalMqtt } = await import('../lib/custom-scripts/mqtt.js');
	const store = await import('./machine-idle-store.svelte.js');
	store.bindMachineIdleMqttEvents();
	const onEvent = vi
		.mocked(globalMqtt.on)
		.mock.calls.findLast(([name]) => name === 'event')?.[1] as (
		topic: string,
		data: unknown
	) => void;
	const published = (topic: string) =>
		vi.mocked(globalMqtt.publish).mock.calls.filter(([t]) => t === topic);
	const stateChanged = (pl: Record<string, unknown>) => onEvent('/rt/d2c', { eid: 7001, pl });
	return { store, onEvent, published, stateChanged };
}

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

describe('machine idle overlay: auto-pick deadline, production alert', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.clearAllTimers();
		vi.useRealTimers();
	});

	it('auto-picks 5 min after the picker opened, however often it is re-armed', async () => {
		const { stateChanged, onEvent, published } = await bindFreshStore();

		stateChanged({ machineState: 1, reason: 'awaiting_job', enteredAt: minutesAgo(0) });
		await vi.advanceTimersByTimeAsync(4 * 60_000);
		// The controller's 7001 after overlayOpened re-arms the auto-pick.
		onEvent('/rt/d2c', {
			eid: 7001,
			pl: { machineState: 4, reason: 'no_operator', enteredAt: minutesAgo(0) }
		});
		await vi.advanceTimersByTimeAsync(59_000);
		expect(published('/iow/overlayAlert')).toHaveLength(0);

		await vi.advanceTimersByTimeAsync(1_000);
		expect(published('/iow/overlayAlert')).toHaveLength(1);
	});

	it('counts the Production Alert from when job-less production began', async () => {
		const { store, stateChanged, onEvent } = await bindFreshStore();

		stateChanged({ machineState: 3, reason: 'production', enteredAt: minutesAgo(1) });
		onEvent('/iow/productionWithNoJob', { aid: 'asset-1' });

		expect(store.machineStoppedOverlay.productionAlert).toBe(true);
		expect(store.machineIdleStore.idleSeconds).toBeGreaterThanOrEqual(60);
	});
});
