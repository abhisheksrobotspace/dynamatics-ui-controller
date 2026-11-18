import type {
	ExtruderFillTone,
	ExtruderTempThresholds,
	ExtruderTempVariant
} from './extruder-card.types';

/** Demo-ui ExtruderCard defaults: within ±10 °C = green; over = red; under / missing set = yellow. */
export const DEFAULT_EXTRUDER_TEMP_THRESHOLDS: ExtruderTempThresholds = {
	okToleranceDeg: 10,
	treatZeroSetAsMissing: true,
	missingSetVariant: 'yellow'
};

export function resolveExtruderTempThresholds(
	partial?: Partial<ExtruderTempThresholds>
): ExtruderTempThresholds {
	return {
		...DEFAULT_EXTRUDER_TEMP_THRESHOLDS,
		...partial
	};
}

function isMissingSetpoint(setVal: number, thresholds: ExtruderTempThresholds): boolean {
	if (!Number.isFinite(setVal)) return true;
	if (thresholds.treatZeroSetAsMissing && setVal === 0) return true;
	return false;
}

export function getTempVariant(
	actualVal: number,
	setVal: number,
	thresholds: Partial<ExtruderTempThresholds> = {}
): ExtruderTempVariant {
	const cfg = resolveExtruderTempThresholds(thresholds);
	if (isMissingSetpoint(setVal, cfg)) return cfg.missingSetVariant;

	const diff = actualVal - setVal;
	const tolerance = Math.max(0, cfg.okToleranceDeg);
	if (Math.abs(diff) <= tolerance) return 'green';
	if (diff > tolerance) return 'red';
	return 'yellow';
}

export function barPercent(
	actualVal: number,
	setVal: number,
	thresholds: Partial<ExtruderTempThresholds> = {}
): number {
	const cfg = resolveExtruderTempThresholds(thresholds);
	if (isMissingSetpoint(setVal, cfg)) return 0;
	return Math.min(100, Math.round((actualVal / setVal) * 100));
}

export const fillToneByVariant: Record<ExtruderTempVariant, ExtruderFillTone> = {
	green: 'online',
	yellow: 'loading',
	red: 'error'
};
