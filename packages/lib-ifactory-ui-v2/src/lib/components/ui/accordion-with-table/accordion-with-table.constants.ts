export type { AccordionType } from '../accordion/accordion.constants';
import type { ProgressMeterTone } from '../progress-meter/progress-meter.constants';

/** Badge variants callers may pass for a stat value. Matches `@ifactory/ui-v2` Badge. */
export type AccordionWithTableStatBadgeVariant =
	'default' | 'secondary' | 'outline' | 'online' | 'error' | 'loading' | 'offline';

export type AccordionWithTableStat = {
	label: string;
	value: string;
	/** Optional secondary line under the value (e.g. waste weight). Caller-provided. */
	sublabel?: string;
	/**
	 * When set, `value` renders with the shared Badge component.
	 * Color/variant is caller-provided (OS decides); not inferred here.
	 */
	badgeVariant?: AccordionWithTableStatBadgeVariant;
};

/**
 * Right-side utilisation progress; headings/labels/colors are caller-provided.
 * Renders via shared ProgressMeter — AccordionWithTable does not hardcode tones.
 */
export type AccordionWithTableProgress = {
	/** Column heading shown above the bar when no shared `headings` row is used. */
	label: string;
	/** Used percent in the range 0–100. */
	value: number;
	/** Text shown below the bar (e.g. "99% used"). Caller-provided only. */
	valueLabel?: string;
	/** Filled segment color. Caller-provided; defaults to ProgressMeter default. */
	fillTone?: ProgressMeterTone;
	/** Remainder/track color. Caller-provided; defaults to ProgressMeter default. */
	remainderTone?: ProgressMeterTone;
	/** Optional class overrides for the filled segment. */
	fillClass?: string;
	/** Optional class overrides for the remainder/track. */
	remainderClass?: string;
};

/**
 * Shared header row for rich-trigger columns. All strings are caller-provided.
 * When set, per-item stat/progress labels are hidden so headings are not duplicated.
 */
export type AccordionWithTableHeadings = {
	/** Left column heading (e.g. "Section"). */
	section?: string;
	/** Right-side stat column headings, in the same order as each item's `stats`. */
	stats?: string[];
	/** Progress column heading (e.g. "Utilisation"). */
	progress?: string;
};

export type AccordionWithTableItem<T extends Record<string, unknown>> = {
	value: string;
	label: string;
	description?: string;
	summary?: string;
	badge?: string;
	badgeTone?: 'primary' | 'success';
	/** Right-side trigger stat cards; labels and values are provided by the caller. */
	stats?: AccordionWithTableStat[];
	/** Optional progress bar shown after stats; heading/label provided by the caller. */
	progress?: AccordionWithTableProgress;
	/** Optional status text after the title (e.g. selection state). Caller-provided only. */
	statusLabel?: string;
	/** Dims the item when true. Caller-provided; not inferred by the component. */
	inactive?: boolean;
	actionLabel?: string;
	rows: T[];
	rowCount?: number;
	disabled?: boolean;
	defaultOpen?: boolean;
	rowLabel?: string;
};
