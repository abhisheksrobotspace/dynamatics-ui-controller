import { ASYNC_STATUS_POLL_MS } from '../../lib/api/jobs.js';

export const OCR_BASE = '/api/ocr';

export const DEFAULT_OCR_ENGINE = 'nemo';

/** Alias of `ASYNC_STATUS_POLL_MS` for OCR status polls. */
export const OCR_STATUS_POLL_MS = ASYNC_STATUS_POLL_MS;

/** UI labels for classified BOM match rows (`ocr_results.match_status` via ocr.backend STATUS_MAP). */
export const BOM_MATCH_STATUS = {
	MATCHED: 'MATCHED',
	MISSING_IN_BOM: 'MISSING IN BOM',
	DUPLICATE_SUFFIX: 'DUPLICATE_SUFFIX',
	MISSING_IN_SKETCH: 'MISSING IN SKETCH',
	OCR_NOT_FOUND: 'OCR NOT FOUND'
} as const;

export type BomMatchStatusLabel = (typeof BOM_MATCH_STATUS)[keyof typeof BOM_MATCH_STATUS];

export const OCR_ENGINE_OPTIONS = [
	{ value: 'nemo', label: 'NeMo' },
	{ value: 'tesseract', label: 'Tesseract' }
] as const;
