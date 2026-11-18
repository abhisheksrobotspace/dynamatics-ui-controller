export type ExtruderTempVariant = 'green' | 'yellow' | 'red';

export type ExtruderFillTone = 'online' | 'loading' | 'error';

/**
 * Zone chip tone rules relative to setpoint (°C).
 * Defaults match demo-ui ExtruderCard (±10 °C band).
 */
export type ExtruderTempThresholds = {
	/** |actual − set| ≤ this → green (ok). Default `10`. */
	okToleranceDeg: number;
	/** Treat `set === 0` as a missing setpoint. Default `true`. */
	treatZeroSetAsMissing: boolean;
	/** Tone when setpoint is missing / non-finite. Default `'yellow'`. */
	missingSetVariant: ExtruderTempVariant;
};
