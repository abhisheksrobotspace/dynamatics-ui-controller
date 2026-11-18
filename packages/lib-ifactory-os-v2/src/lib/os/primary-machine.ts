/**
 * First non-`_shared` machine in a `machineSettings` slice.
 * Pure: no MQTT. Shared by OS visibility, asset-context, and PMS line hydrate.
 */
export type PrimaryMachine = {
	aid: string | null;
	assetClass: string | null;
	/** Display name, e.g. "Test Machine - manual". */
	name: string | null;
	/** Plant code, e.g. "RS/MNL". */
	assetCode: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function trimmedString(value: unknown): string | null {
	return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function extractPrimaryMachine(settings: unknown): PrimaryMachine | null {
	if (!isRecord(settings) || 'error' in settings) return null;

	const machines = Object.entries(settings).filter(
		(entry): entry is [string, Record<string, unknown>] =>
			entry[0] !== '_shared' && isRecord(entry[1])
	);

	if (machines.length > 0) {
		const [key, machine] = machines[0];
		const fromAid = typeof machine.aid === 'string' && machine.aid.trim() ? machine.aid.trim() : '';
		const fromAssetId =
			typeof machine.assetId === 'string' && machine.assetId.trim() ? machine.assetId.trim() : '';
		const aid = fromAid || fromAssetId || key;
		const assetClass =
			typeof machine.assetClass === 'string' && machine.assetClass.trim()
				? machine.assetClass.trim()
				: null;
		return {
			aid: aid || null,
			assetClass,
			name: trimmedString(machine.name),
			assetCode: trimmedString(machine.assetCode)
		};
	}

	const fromAid =
		typeof settings.aid === 'string' && settings.aid.trim() ? settings.aid.trim() : '';
	const fromAssetId =
		typeof settings.assetId === 'string' && settings.assetId.trim() ? settings.assetId.trim() : '';
	const aid = fromAid || fromAssetId || null;
	const assetClass =
		typeof settings.assetClass === 'string' && settings.assetClass.trim()
			? settings.assetClass.trim()
			: null;

	if (!aid && !assetClass) return null;
	return {
		aid,
		assetClass,
		name: trimmedString(settings.name),
		assetCode: trimmedString(settings.assetCode)
	};
}
