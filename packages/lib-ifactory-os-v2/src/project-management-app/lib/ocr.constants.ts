import { ASYNC_STATUS_POLL_MS } from '../../lib/api/jobs.js';

/** PoC OCR / csv_extractor base path (Cutting Plan CSV extract still uses this). */
export const OCR_BASE = '/api/ocr';

/** Default engine when contractor metadata has none (Operations Count Configuration). */
export const DEFAULT_OCR_ENGINE = 'nemo';

/** Alias kept for any remaining poll helpers; prefer `ASYNC_STATUS_POLL_MS`. */
export const OCR_STATUS_POLL_MS = ASYNC_STATUS_POLL_MS;
