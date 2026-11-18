import type { BadgeCell } from '@ifactory/ui-v2';
import { isExtractionRunning } from './operations-count-extraction.svelte.js';
import type { OcrDrawingFileRow, OcrFileOcrStatus } from './ocr-drawings.api.js';

const STATUS_BADGE_CLASS =
	'inline-flex w-[7rem] shrink-0 items-center justify-start whitespace-nowrap box-border';

/**
 * Same labels/variants as PM BOMs `operationsCountStatusBadge`, scoped to one drawing file.
 * Running / Verified / Ready / Blocked / Not started yet.
 */
export function drawingFileStatusBadge(row: OcrDrawingFileRow): BadgeCell {
	if (isExtractionRunning(row.bomId)) {
		return {
			variant: 'default',
			dot: true,
			label: 'Running',
			class: STATUS_BADGE_CLASS
		};
	}
	if (row.ocrStatus === 'verified' && row.hasResults) {
		return {
			variant: 'loading',
			label: 'Verified',
			class: STATUS_BADGE_CLASS
		};
	}
	if (row.hasResults) {
		return {
			variant: 'online',
			label: 'Ready',
			class: STATUS_BADGE_CLASS
		};
	}
	if (row.statusBlocked) {
		return {
			variant: 'offline',
			label: 'Blocked',
			class: STATUS_BADGE_CLASS
		};
	}
	return {
		variant: 'offline',
		label: 'Not started yet',
		class: STATUS_BADGE_CLASS
	};
}

export function parseOcrFileStatus(value: string | null | undefined): OcrFileOcrStatus {
	if (value === 'verified' || value === 'action_needed') return value;
	return 'not_verified';
}
