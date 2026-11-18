export type WifiSignalLabel = 'excellent' | 'good' | 'fair' | 'poor';

/** Network visible in the current Wi-Fi scan (`nmcli dev wifi`). */
export interface WifiNetwork {
	id: string;
	name: string;
	signal: number;
	signalLabel: WifiSignalLabel;
	security: string;
	secured: boolean;
	/** True when NetworkManager has a saved profile for this SSID. */
	saved?: boolean;
}

/**
 * Saved connection profile (`nmcli connection show`).
 * May appear in the list when not in the current scan — merged separately by the controller.
 */
export interface SavedWifiNetwork {
	name: string;
	security: string;
	secured: boolean;
	inRange: false;
}

export function signalLabelFromScore(signal: number): WifiSignalLabel {
	if (signal >= 80) return 'excellent';
	if (signal >= 60) return 'good';
	if (signal >= 40) return 'fair';
	return 'poor';
}

export function formatWifiSignalLabel(label: WifiSignalLabel): string {
	const labels: Record<WifiSignalLabel, string> = {
		excellent: 'Excellent',
		good: 'Good',
		fair: 'Fair',
		poor: 'Poor'
	};
	return labels[label];
}

/** Tailwind text class for signal quality (excellent→green, good→yellow, fair→primary, poor→red). */
export function wifiSignalTextClass(label: WifiSignalLabel | string): string {
	const normalized = String(label).trim().toLowerCase();
	if (normalized === 'excellent') return 'text-status-online';
	if (normalized === 'good') return 'text-status-warning';
	if (normalized === 'fair') return 'text-primary';
	if (
		normalized === 'poor' ||
		normalized === 'weak' ||
		normalized === 'low' ||
		normalized === 'no wifi'
	) {
		return 'text-status-error';
	}
	if (normalized === 'lan') return 'text-status-online';
	return 'text-heading';
}

export function wifiSignalBars(label: WifiSignalLabel): number {
	const bars: Record<WifiSignalLabel, number> = {
		excellent: 4,
		good: 3,
		fair: 2,
		poor: 1
	};
	return bars[label];
}

export function isWifiSecured(security: string): boolean {
	const normalized = security.trim();
	return normalized !== '' && normalized !== '--';
}

/** Parse one line from `nmcli -t -f SSID,SIGNAL,SECURITY dev wifi`. */
export function parseNmcliScanLine(line: string): WifiNetwork | null {
	const trimmed = line.trim();
	if (!trimmed) return null;

	const parts = trimmed.split(':');
	if (parts.length < 2) return null;

	const securityRaw = (parts.pop() ?? '--').trim();
	const signalRaw = (parts.pop() ?? '').trim();
	const name = parts.join(':');
	const signal = Number(signalRaw);

	if (!name.trim() || !Number.isFinite(signal) || signal <= 0) return null;

	const security = securityRaw || '--';
	const displayName = name || 'Hidden network';

	return {
		id: displayName,
		name: displayName,
		signal,
		signalLabel: signalLabelFromScore(signal),
		security,
		secured: isWifiSecured(security),
		saved: false
	};
}

/** Parse full scan output; dedupes duplicate SSIDs, keeping the strongest signal. */
export function parseNmcliScan(output: string): WifiNetwork[] {
	const parsed = output
		.split('\n')
		.map(parseNmcliScanLine)
		.filter((network): network is WifiNetwork => network !== null);

	return mergeScanResults(parsed);
}

export function mergeScanResults(networks: WifiNetwork[]): WifiNetwork[] {
	const byName = new Map<string, WifiNetwork>();

	for (const network of networks) {
		const key = network.name.trim().toLowerCase();
		const existing = byName.get(key);
		if (!existing || network.signal > existing.signal) {
			byName.set(key, network);
		}
	}

	return [...byName.values()].sort((a, b) => b.signal - a.signal);
}

/** Sample captured from ioWare Pro — used until the new controller feeds live scan data. */
export const SAMPLE_NMCLI_SCAN = `RS-Pro:100:WPA2
wifi 6:100:
RS-Expo:99:WPA2
RS-Devices:99:WPA2
RS-Guest:99:WPA2
RS-Staff:97:WPA2
RS-Scoot:94:WPA2
AIRTEL_0696:92:WPA1 WPA2
RS-EXPERIEINCE-CENTER :87:WPA2
DIRECT-d8-HP 1200 Neverstop:85:WPA2
L8:67:WPA2
RS-Backup :62:WPA2
RS-Scoot:59:WPA2
AIRTEL_0696:57:WPA1 WPA2`;
