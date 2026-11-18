import { globalMqtt } from '$lib/os/lib/custom-scripts/mqtt.js';
import { ensureSelectedAssetId, withAssetId } from '$lib/os/asset-context.js';
import { formatHmiSyncTime } from './format';
import { DEVICE_PUBLISH_TOPICS, DEVICE_SUBSCRIBE_TOPICS } from './device-topics';
import {
	formatWifiSignalLabel,
	parseNmcliScan,
	signalLabelFromScore,
	type WifiNetwork,
	type WifiSignalLabel
} from './wifi-network';

export type { SavedWifiNetwork, WifiNetwork, WifiSignalLabel } from './wifi-network';
export {
	formatWifiSignalLabel,
	parseNmcliScan,
	parseNmcliScanLine,
	signalLabelFromScore,
	wifiSignalBars,
	wifiSignalTextClass
} from './wifi-network';

function publishDevice(topic: string, payload: Record<string, unknown> = {}) {
	void ensureSelectedAssetId().then(() => {
		globalMqtt.publish(topic, withAssetId(payload));
	});
}

export interface DeviceInfoData {
	machineId: string;
	deviceLanMac: string;
	wifiMac: string;
	fwVersion: string;
	network: string;
	ipAddress: string;
	signalStrength: string;
	signalScore: string;
	internetStatus: string;
	/** Drives which network icon to show in DeviceInfo. */
	connectionKind: 'wifi' | 'lan' | 'wifi-no-internet' | 'lan-no-internet' | 'none';
	dataSentAt: string;
	settingsReceivedAt: string;
}

export const deviceStore = $state({
	networks: [] as WifiNetwork[],
	isScanning: false,
	selectedNetwork: null as WifiNetwork | null,
	/** The password screen is for a network typed in by hand (SSID not in the scan list). */
	manualNetwork: false,
	password: '',
	isConnecting: false,
	isForgetting: false,
	connectError: '',
	isConnected: false,
	connectedIp: '-',
	connectedSecurity: '-',
	connectedSignal: '-',
	deviceInfo: {
		machineId: '-',
		deviceLanMac: '-',
		wifiMac: '-',
		fwVersion: '-',
		network: '-',
		ipAddress: '-',
		signalStrength: 'No WiFi',
		signalScore: '',
		internetStatus: '-',
		connectionKind: 'none',
		dataSentAt: '-',
		settingsReceivedAt: '-'
	} as DeviceInfoData
});

let mqttBound = false;
let mqttRefCount = 0;
let onMqttEvent: ((topic: string, data: unknown) => void) | null = null;
let pendingLogin: {
	resolve: (ok: boolean) => void;
	timer: ReturnType<typeof setTimeout>;
} | null = null;
let pendingForget: {
	resolve: (ok: boolean) => void;
	timer: ReturnType<typeof setTimeout>;
	ssid: string;
} | null = null;

const WIFI_LOGIN_TIMEOUT_MS = 45_000;
const WIFI_FORGET_TIMEOUT_MS = 20_000;

function asString(value: unknown, fallback = '-'): string {
	if (value == null) return fallback;
	const next = String(value).trim();
	return next || fallback;
}

/** Keep trailing spaces in SSIDs — nmcli treats `prime` and `prime ` as different. */
function preserveSsid(value: unknown): string {
	if (value == null) return '';
	return String(value).replace(/^\n+|\n+$/g, '');
}

function qualityToSignal(quality: unknown): {
	label: string;
	score: string;
	signalLabel: WifiSignalLabel;
} {
	if (typeof quality === 'number' && Number.isFinite(quality)) {
		const signal = Math.max(0, Math.min(100, Math.round(quality)));
		const signalLabel = signalLabelFromScore(signal);
		return {
			label: formatWifiSignalLabel(signalLabel),
			score: `${signal}/100`,
			signalLabel
		};
	}

	const raw = asString(quality, '');
	if (!raw || raw.includes('No Signal') || raw.includes('No Internet')) {
		return { label: 'No WiFi', score: '', signalLabel: 'poor' };
	}

	const match = raw.match(/(\d+)\s*\/\s*(\d+)/);
	if (match) {
		const current = Number(match[1]);
		const max = Number(match[2]) || 100;
		const signal = Math.max(0, Math.min(100, Math.round((current / max) * 100)));
		const signalLabel = signalLabelFromScore(signal);
		return {
			label: formatWifiSignalLabel(signalLabel),
			score: `${signal}/100`,
			signalLabel
		};
	}

	const pct = raw.match(/(\d+)\s*%/);
	if (pct) {
		const signal = Number(pct[1]);
		const signalLabel = signalLabelFromScore(signal);
		return {
			label: formatWifiSignalLabel(signalLabel),
			score: `${signal}/100`,
			signalLabel
		};
	}

	return { label: raw, score: '', signalLabel: 'fair' };
}

function networksFromPayload(data: unknown): WifiNetwork[] {
	if (typeof data === 'string') {
		return parseNmcliScan(data);
	}

	if (!Array.isArray(data)) {
		return [];
	}

	if (data.length === 0) {
		return [];
	}

	if (typeof data[0] === 'string') {
		const lines = data as string[];
		// Rich nmcli lines (`SSID:SIGNAL:SECURITY`) or bare SSIDs
		if (lines.some((line) => line.includes(':'))) {
			return parseNmcliScan(lines.join('\n'));
		}

		return lines
			.map((name) => preserveSsid(name))
			.filter((name) => name.trim())
			.map((name) => ({
				id: name,
				name,
				signal: 50,
				signalLabel: 'fair' as const,
				security: 'WPA2',
				secured: true,
				saved: false
			}));
	}

	return data
		.flatMap((entry) => {
			if (!entry || typeof entry !== 'object') return [];
			const row = entry as Record<string, unknown>;
			const name = preserveSsid(row.ssid ?? row.name ?? row.SSID);
			if (!name.trim()) return [];
			const signal = Number(row.signal ?? row.SIGNAL ?? 50);
			const security = asString(row.security ?? row.SECURITY, 'WPA2');
			const signalLabel = signalLabelFromScore(Number.isFinite(signal) ? signal : 50);
			return [
				{
					id: name,
					name,
					signal: Number.isFinite(signal) ? signal : 50,
					signalLabel,
					security,
					secured: security !== '' && security !== '--',
					saved: Boolean(row.saved)
				} satisfies WifiNetwork
			];
		})
		.sort((a, b) => b.signal - a.signal);
}

function handleWifiNetworks(data: unknown) {
	deviceStore.networks = networksFromPayload(data).map((entry) =>
		markNetworkSaved(entry, deviceStore.deviceInfo.network)
	);
	deviceStore.isScanning = false;
}

function markNetworkSaved(network: WifiNetwork, connectedSsid: string): WifiNetwork {
	if (network.saved) return network;
	if (isSameWifiSsid(network.name, connectedSsid)) {
		return { ...network, saved: true };
	}
	return network;
}

function isSameWifiSsid(a: string, b: string): boolean {
	const left = a.trim().toLowerCase();
	const right = b.trim().toLowerCase();
	if (!left || !right) return false;
	if (right.includes('<') || right === '-') return false;
	return left === right;
}

export function isSavedOrConnectedNetwork(name: string): boolean {
	const network = deviceStore.networks.find((entry) => isSameWifiSsid(entry.name, name));
	if (network?.saved) return true;
	return isSameWifiSsid(name, deviceStore.deviceInfo.network);
}

/** True for the Wi-Fi network this device is connected to right now. */
export function isConnectedNetwork(name: string): boolean {
	const kind = deviceStore.deviceInfo.connectionKind;
	if (kind !== 'wifi' && kind !== 'wifi-no-internet') return false;
	return isSameWifiSsid(name, deviceStore.deviceInfo.network);
}

function handleWifiLoginStatus(data: unknown) {
	const payload = (data ?? {}) as { status?: string; message?: string };
	const ok = payload.status === 'success';

	deviceStore.isConnecting = false;
	deviceStore.connectError = ok ? '' : asString(payload.message, 'Wi-Fi connection failed');

	if (ok) {
		const network = deviceStore.selectedNetwork;
		deviceStore.isConnected = true;
		if (network) {
			deviceStore.connectedSecurity = network.secured ? network.security : 'Open';
			deviceStore.connectedSignal = formatWifiSignalLabel(network.signalLabel);
			deviceStore.deviceInfo.network = network.name;
			deviceStore.deviceInfo.signalStrength = formatWifiSignalLabel(network.signalLabel);
			deviceStore.deviceInfo.signalScore = `${network.signal}/100`;
			network.saved = true;
		}
		publishDevice(DEVICE_PUBLISH_TOPICS.GET_DEVICE_SETTINGS);
	}

	if (pendingLogin) {
		clearTimeout(pendingLogin.timer);
		pendingLogin.resolve(ok);
		pendingLogin = null;
	}
}

function handleWifiForgetStatus(data: unknown) {
	const payload = (data ?? {}) as { status?: string; message?: string };
	const ok = payload.status === 'success';
	const ssid = pendingForget?.ssid ?? deviceStore.selectedNetwork?.name ?? '';

	deviceStore.isForgetting = false;

	if (ok) {
		deviceStore.connectError = '';
		if (ssid) {
			deviceStore.networks = deviceStore.networks.map((network) =>
				network.name === ssid ? { ...network, saved: false } : network
			);
			if (deviceStore.selectedNetwork?.name === ssid) {
				deviceStore.selectedNetwork = {
					...deviceStore.selectedNetwork,
					saved: false
				};
			}
			if (deviceStore.deviceInfo.network === ssid) {
				deviceStore.isConnected = false;
				deviceStore.connectedIp = '-';
				deviceStore.connectedSecurity = '-';
				deviceStore.connectedSignal = '-';
			}
		}
		publishDevice(DEVICE_PUBLISH_TOPICS.GET_DEVICE_SETTINGS);
	} else {
		deviceStore.connectError = asString(payload.message, 'Failed to forget network');
	}

	if (pendingForget) {
		clearTimeout(pendingForget.timer);
		pendingForget.resolve(ok);
		pendingForget = null;
	}
}

function handleDeviceSettings(data: unknown) {
	if (!data || typeof data !== 'object') return;

	const payload = data as Record<string, unknown>;
	const ssid = asString(payload.ssid, '');
	const wifiIp = asString(payload.wifiIp, '');
	const lanIp = asString(payload.lanIp, '');
	const legacyIp = asString(payload.ip, '');
	const isLan = ssid.includes('LAN Connected');
	const ipAddress = isLan ? lanIp || legacyIp : wifiIp || lanIp || legacyIp;
	const signal = qualityToSignal(payload.quality);

	deviceStore.deviceInfo.machineId = asString(
		payload.mid || payload.machineId,
		deviceStore.deviceInfo.machineId
	);
	deviceStore.deviceInfo.deviceLanMac = asString(payload.did, deviceStore.deviceInfo.deviceLanMac);
	deviceStore.deviceInfo.wifiMac = asString(payload.mac, deviceStore.deviceInfo.wifiMac);
	deviceStore.deviceInfo.fwVersion = asString(
		payload.fwVersion ?? payload.hmiFwVersion,
		deviceStore.deviceInfo.fwVersion
	);
	deviceStore.deviceInfo.network = ssid || deviceStore.deviceInfo.network;
	deviceStore.deviceInfo.ipAddress = ipAddress || deviceStore.deviceInfo.ipAddress;

	if (isLan) {
		deviceStore.deviceInfo.signalStrength = 'LAN';
		deviceStore.deviceInfo.signalScore = '';
		if (deviceStore.deviceInfo.connectionKind === 'none') {
			deviceStore.deviceInfo.connectionKind = 'lan';
		}
	} else if (signal.label === 'No WiFi') {
		deviceStore.deviceInfo.signalStrength = 'No WiFi';
		deviceStore.deviceInfo.signalScore = '';
		if (!wifiIp) {
			deviceStore.deviceInfo.connectionKind = 'none';
		}
	} else {
		deviceStore.deviceInfo.signalStrength = signal.label;
		deviceStore.deviceInfo.signalScore = signal.score;
		if (deviceStore.deviceInfo.connectionKind === 'none') {
			deviceStore.deviceInfo.connectionKind = 'wifi';
		}
	}

	deviceStore.deviceInfo.settingsReceivedAt = formatHmiSyncTime();

	if (wifiIp || (ssid && !isLan)) {
		deviceStore.isConnected = true;
		deviceStore.connectedIp = wifiIp || ipAddress || deviceStore.connectedIp;
		if (!isLan && signal.label !== 'No WiFi') {
			deviceStore.connectedSignal = signal.label;
		}

		deviceStore.networks = deviceStore.networks.map((entry) =>
			isSameWifiSsid(entry.name, ssid) ? { ...entry, saved: true } : entry
		);
		if (deviceStore.selectedNetwork && isSameWifiSsid(deviceStore.selectedNetwork.name, ssid)) {
			deviceStore.selectedNetwork = { ...deviceStore.selectedNetwork, saved: true };
		}
	}
}

function handleInternetConnectionStatus(data: unknown) {
	if (!data || typeof data !== 'object') return;

	const payload = data as {
		type?: string;
		wifiStatus?: number | string;
		signalStrength?: number;
	};

	const status = Number(payload.wifiStatus);
	const type = asString(payload.type, 'none');

	if (status === 1) {
		deviceStore.deviceInfo.internetStatus = type === 'lan' ? 'Reachable (LAN)' : 'Reachable';
		deviceStore.deviceInfo.connectionKind = type === 'lan' ? 'lan' : 'wifi';
	} else if (status === 3) {
		deviceStore.deviceInfo.internetStatus = 'Linked · No Internet';
		deviceStore.deviceInfo.connectionKind = type === 'lan' ? 'lan-no-internet' : 'wifi-no-internet';
	} else {
		deviceStore.deviceInfo.internetStatus = 'Unreachable';
		deviceStore.deviceInfo.connectionKind = 'none';
		deviceStore.deviceInfo.signalStrength = 'No WiFi';
		deviceStore.deviceInfo.signalScore = '';
	}

	if (type === 'wifi' && typeof payload.signalStrength === 'number' && status !== 2) {
		const bars = payload.signalStrength;
		const signal = bars >= 3 ? 85 : bars >= 2 ? 55 : bars >= 1 ? 30 : 0;
		const signalLabel = signalLabelFromScore(signal);
		deviceStore.connectedSignal = formatWifiSignalLabel(signalLabel);
		deviceStore.deviceInfo.signalStrength = formatWifiSignalLabel(signalLabel);
		deviceStore.deviceInfo.signalScore = `${signal}/100`;
	}

	if (type === 'lan') {
		deviceStore.deviceInfo.signalStrength = 'LAN';
		deviceStore.deviceInfo.signalScore = '';
	}
}

const topicHandlers: Record<string, (data: unknown) => void> = {
	[DEVICE_SUBSCRIBE_TOPICS.WIFI_NETWORKS]: handleWifiNetworks,
	[DEVICE_SUBSCRIBE_TOPICS.WIFI_LOGIN_STATUS]: handleWifiLoginStatus,
	[DEVICE_SUBSCRIBE_TOPICS.WIFI_FORGET_STATUS]: handleWifiForgetStatus,
	[DEVICE_SUBSCRIBE_TOPICS.DEVICE_SETTINGS]: handleDeviceSettings,
	[DEVICE_SUBSCRIBE_TOPICS.INTERNET_CONNECTION_STATUS]: handleInternetConnectionStatus
};

export function bindDeviceMqttEvents(): () => void {
	mqttRefCount += 1;

	if (!mqttBound) {
		onMqttEvent = (topic: string, data: unknown) => {
			topicHandlers[topic]?.(data);
		};
		globalMqtt.subscribeTopics(Object.values(DEVICE_SUBSCRIBE_TOPICS));
		globalMqtt.on('event', onMqttEvent);
		mqttBound = true;
		requestDeviceSettings();
	}

	return () => {
		mqttRefCount = Math.max(0, mqttRefCount - 1);
		if (mqttRefCount > 0 || !onMqttEvent) {
			return;
		}

		globalMqtt.off('event', onMqttEvent);
		onMqttEvent = null;
		mqttBound = false;
	};
}

export function requestDeviceSettings() {
	publishDevice(DEVICE_PUBLISH_TOPICS.GET_DEVICE_SETTINGS);
}

export function scanWifiNetworks() {
	deviceStore.isScanning = true;
	deviceStore.networks = [];
	deviceStore.connectError = '';
	publishDevice(DEVICE_PUBLISH_TOPICS.GET_WIFI_NETWORKS);
}

/** Called with raw `nmcli` text or HAL wifiNetworks payload. */
export function setWifiScanResults(nmcliOutput: string) {
	deviceStore.networks = parseNmcliScan(nmcliOutput);
	deviceStore.isScanning = false;
}

export function selectWifiNetwork(network: WifiNetwork) {
	const saved = network.saved || isSavedOrConnectedNetwork(network.name);
	deviceStore.selectedNetwork = { ...network, saved };
	deviceStore.manualNetwork = false;
	deviceStore.password = '';
	deviceStore.connectError = '';
}

/** Connect to a network whose name is typed in: a blank entry the password screen fills in. */
export function startManualWifiNetwork() {
	deviceStore.selectedNetwork = {
		id: '',
		name: '',
		signal: 0,
		signalLabel: 'poor',
		security: '--',
		secured: true,
		saved: false
	};
	deviceStore.manualNetwork = true;
	deviceStore.password = '';
	deviceStore.connectError = '';
}

export function clearWifiConnectError() {
	if (deviceStore.connectError) {
		deviceStore.connectError = '';
	}
}

export async function connectWifi(password: string): Promise<boolean> {
	const network = deviceStore.selectedNetwork;
	if (!network) return false;
	if (network.secured && !password.trim()) {
		deviceStore.connectError = 'Password required';
		return false;
	}

	if (pendingLogin) {
		clearTimeout(pendingLogin.timer);
		pendingLogin.resolve(false);
		pendingLogin = null;
	}

	deviceStore.isConnecting = true;
	deviceStore.connectError = '';
	deviceStore.password = password;

	const result = await new Promise<boolean>((resolve) => {
		const timer = setTimeout(() => {
			pendingLogin = null;
			deviceStore.isConnecting = false;
			deviceStore.connectError = 'Connection timed out';
			resolve(false);
		}, WIFI_LOGIN_TIMEOUT_MS);

		pendingLogin = { resolve, timer };

		publishDevice(DEVICE_PUBLISH_TOPICS.WIFI_LOGIN, {
			wifiSSID: network.name,
			password: password.trim()
		});
	});

	return result;
}

export async function forgetWifiNetwork(ssid?: string): Promise<boolean> {
	const target = preserveSsid(ssid ?? deviceStore.selectedNetwork?.name ?? '');
	if (!target.trim()) return false;

	if (pendingForget) {
		clearTimeout(pendingForget.timer);
		pendingForget.resolve(false);
		pendingForget = null;
	}

	deviceStore.isForgetting = true;
	deviceStore.connectError = '';

	const result = await new Promise<boolean>((resolve) => {
		const timer = setTimeout(() => {
			pendingForget = null;
			deviceStore.isForgetting = false;
			deviceStore.connectError = 'Forget network timed out';
			resolve(false);
		}, WIFI_FORGET_TIMEOUT_MS);

		pendingForget = { resolve, timer, ssid: target };

		publishDevice(DEVICE_PUBLISH_TOPICS.WIFI_FORGET, {
			wifiSSID: target
		});
	});

	if (result) {
		deviceStore.password = '';
	}

	return result;
}

export function syncDeviceNow() {
	deviceStore.deviceInfo.dataSentAt = formatHmiSyncTime();
	requestDeviceSettings();
}
