import type { BadgeCell } from '@ifactory/ui-v2';
import type { BomExtractStatus } from '../bom-extract-status.js';
import { bomPublishStatusLabel } from './boms.api.js';
import type { BomConfig } from '../store.svelte.js';

const STATUS_BADGE_CLASS =
	'inline-flex w-[7rem] shrink-0 items-center justify-start whitespace-nowrap box-border';

export type BomFileDisplayStatus = 'Updated' | 'Published' | 'Uploading…';

/** BOM version list status from `proj_boms.stage`: Proto | Published. */
export function bomPublishStatusBadge(bom: Pick<BomConfig, 'stage'>): BadgeCell {
	const label = bomPublishStatusLabel(bom);
	if (label === 'Published') {
		return {
			variant: 'loading',
			label,
			class: STATUS_BADGE_CLASS
		};
	}
	return {
		variant: 'offline',
		label,
		class: STATUS_BADGE_CLASS
	};
}

/** BOM CSV extraction lifecycle on version detail. */
export function bomExtractStatusBadge(status: BomExtractStatus): BadgeCell {
	if (status === 'extracting') {
		return {
			variant: 'default',
			label: 'Extracting…',
			dot: true,
			class: STATUS_BADGE_CLASS
		};
	}
	if (status === 'extracted') {
		return {
			variant: 'online',
			label: 'Extracted',
			class: STATUS_BADGE_CLASS
		};
	}
	if (status === 'failed') {
		return {
			variant: 'offline',
			label: 'Failed',
			class: STATUS_BADGE_CLASS
		};
	}
	return {
		variant: 'offline',
		label: 'Pending',
		class: STATUS_BADGE_CLASS
	};
}

/** Uploaded file / drawing-set row status. */
export function bomFileDisplayStatusBadge(status: BomFileDisplayStatus): BadgeCell {
	if (status === 'Uploading…') {
		return {
			variant: 'default',
			label: status,
			dot: true,
			class: STATUS_BADGE_CLASS
		};
	}
	if (status === 'Published') {
		return {
			variant: 'loading',
			label: status,
			class: STATUS_BADGE_CLASS
		};
	}
	return {
		variant: 'online',
		label: status,
		class: STATUS_BADGE_CLASS
	};
}
