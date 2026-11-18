export type ProgressMeterTone = 'online' | 'error' | 'primary' | 'muted' | 'loading' | 'offline';

export type ProgressMeterBorderTone = ProgressMeterTone | 'none';

export const PROGRESS_METER_DEFAULT_MAX = 100;
export const PROGRESS_METER_DEFAULT_FILL_TONE: ProgressMeterTone = 'online';
export const PROGRESS_METER_DEFAULT_REMAINDER_TONE: ProgressMeterTone = 'error';
export const PROGRESS_METER_DEFAULT_BORDER_TONE: ProgressMeterBorderTone = 'none';
