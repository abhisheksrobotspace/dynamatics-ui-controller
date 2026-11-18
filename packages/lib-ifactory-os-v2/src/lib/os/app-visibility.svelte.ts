import { extractPrimaryMachine } from './primary-machine.js';

/** Loaded only when ioWare binds readiness. Importing this module must not open a socket. */
async function loadMqtt() {
	const { globalMqtt } = await import('$lib/os/lib/custom-scripts/mqtt.js');
	return globalMqtt;
}

const MACHINE_SETTINGS_TOPIC = '/iow/machineSettings';

/** Minimal shape so this module does not import from index.svelte (avoids cycles). */
type VisibilityApp = {
	visibility?: 'always' | 'requiresAssetClass';
	supportedAssetClasses?: readonly string[];
	showInLauncher?: boolean;
	displayName?: string;
	appName?: string;
};

export type MachineReadiness = {
	/** True when primary machine in machineSettings has a non-empty assetClass. */
	hasAssetClass: boolean;
	/** Live primary-machine class, or null when missing. */
	assetClass: string | null;
	/** Primary-machine asset code (HMI top bar), or null when missing. */
	assetCode: string | null;
};

export const machineReadiness = $state<MachineReadiness>({
	hasAssetClass: false,
	assetClass: null,
	assetCode: null
});

export async function refreshMachineReadiness(): Promise<boolean> {
	try {
		const globalMqtt = await loadMqtt();
		const settings = await globalMqtt.get('machineSettings');
		const primary = extractPrimaryMachine(settings);
		const assetClass = primary?.assetClass ?? null;
		machineReadiness.assetClass = assetClass;
		machineReadiness.assetCode = primary?.assetCode ?? null;
		machineReadiness.hasAssetClass = Boolean(assetClass);
		return machineReadiness.hasAssetClass;
	} catch (error) {
		console.warn('app-visibility: failed to refresh machine readiness', error);
		return false;
	}
}

/**
 * Dock + window visibility.
 * `requiresAssetClass` is enforced only on ioware so cloud/tests never hide apps unexpectedly.
 * When the app lists `supportedAssetClasses`, a class outside that list hides it too.
 */
export function isAppVisible(app: VisibilityApp, isIoware: boolean): boolean {
	if (!isIoware || app.visibility !== 'requiresAssetClass') return true;
	const assetClass = machineReadiness.assetClass;
	if (!assetClass) return false;
	if (!app.supportedAssetClasses?.length) return true;
	return app.supportedAssetClasses.includes(assetClass);
}

export function filterVisibleApps<T extends VisibilityApp>(
	apps: Record<string, T>,
	isIoware: boolean
): Record<string, T> {
	const next: Record<string, T> = {};
	for (const [key, app] of Object.entries(apps)) {
		if (isAppVisible(app, isIoware)) next[key] = app;
	}
	return next;
}

export type BindMachineReadinessOptions = {
	/**
	 * Called when the primary assetClass string changes to a new non-empty value.
	 * Not called on later echoes of the same class.
	 */
	onRisingEdge?: () => void;
};

/**
 * Watch machineSettings and update {@link machineReadiness}.
 * Rising-edge callback is for deferred auto-launch only — not dock updates ($derived handles those).
 */
export function bindMachineReadiness(options: BindMachineReadinessOptions = {}): () => void {
	let previousClass: string | null = null;

	const apply = async () => {
		await refreshMachineReadiness();
		const next = machineReadiness.assetClass;
		// Fire only when the class string changes, so settings echoes do not re-focus.
		// launchAutoStartApps still skips apps the new class does not match.
		if (next && next !== previousClass) {
			previousClass = next;
			options.onRisingEdge?.();
		} else if (!next) {
			previousClass = null;
		}
	};

	const onEvent = (topic: string) => {
		if (topic === MACHINE_SETTINGS_TOPIC) {
			void apply();
		}
	};

	let mqtt: Awaited<ReturnType<typeof loadMqtt>> | null = null;
	let stopped = false;

	void (async () => {
		const client = await loadMqtt();
		if (stopped) return;
		mqtt = client;
		mqtt.subscribeTopics([MACHINE_SETTINGS_TOPIC]);
		mqtt.on('event', onEvent);
		if (typeof mqtt.waitUntilConnected === 'function') {
			await mqtt.waitUntilConnected(10_000);
		}
		if (stopped) return;
		await apply();
	})();

	return () => {
		stopped = true;
		mqtt?.off('event', onEvent);
		previousClass = null;
		machineReadiness.hasAssetClass = false;
		machineReadiness.assetClass = null;
		machineReadiness.assetCode = null;
	};
}
