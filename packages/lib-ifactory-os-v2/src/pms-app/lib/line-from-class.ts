import type { PmsLineId } from '../lines/types';

/**
 * `jobCard` on `@ifactory/datahub-core` `ASSET_CLASSES`:
 * angle → `angle_cnc` only, plate → `plate_cnc` and `plate_manual`, manual → every other class.
 */
const LINE_BY_CLASS = {
	angle_cnc: 'angle',
	plate_cnc: 'plate',
	plate_manual: 'plate',
	angle_manual: 'manual',
	punching: 'manual',
	drilling_radial: 'manual',
	notching: 'manual',
	bending: 'manual',
	bending_furnace: 'manual',
	stamping: 'manual',
	band_saw: 'manual',
	heel_cutting: 'manual'
} as const satisfies Record<string, PmsLineId>;

export const SUPPORTED_ASSET_CLASSES: readonly string[] = Object.keys(LINE_BY_CLASS);

/**
 * Map `machineSettings.<aid>.assetClass` → PMS UI line.
 */
export function lineIdFromAssetClass(assetClass: string | null | undefined): PmsLineId | null {
	const code = typeof assetClass === 'string' ? assetClass.trim() : '';
	if (!code || !(code in LINE_BY_CLASS)) return null;
	return LINE_BY_CLASS[code as keyof typeof LINE_BY_CLASS];
}
