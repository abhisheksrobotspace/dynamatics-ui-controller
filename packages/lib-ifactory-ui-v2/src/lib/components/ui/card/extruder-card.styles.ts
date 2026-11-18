import { cn } from '$lib/utils/cn';
import type { ExtruderTempVariant } from './extruder-card.types';

export function extruderCardClass(className = ''): string {
	return cn('overflow-hidden border border-border bg-surface shadow-sm', className);
}

export const extruderCardHeaderClass = 'px-6 pt-5 pb-3';

export const extruderCardHeaderInnerClass = 'flex items-start justify-between gap-4';

export const extruderCardTitleClass =
	'font-heading mb-3 text-lg font-bold tracking-tight text-foreground';

export const extruderCardMetricsRowClass = 'flex gap-6';

export const extruderCardMetricStackClass = 'flex flex-col gap-0.5';

export const extruderCardMetricLabelClass =
	'text-[10px] font-semibold tracking-wide text-muted uppercase';

export const extruderCardMetricValueClass =
	'font-body text-xl leading-none font-medium text-foreground';

export const extruderCardMetricUnitClass = 'ml-1 text-xs text-muted-foreground';

export const extruderCardBodyClass = 'px-6 pb-5';

export const extruderCardTableWrapClass = 'overflow-x-auto rounded-md border border-border';

export const extruderCardTableClass = 'w-full min-w-max border-collapse';

export const extruderCardHeaderRowClass = 'border-b border-border';

export const extruderCardCornerHeadClass =
	'w-16 py-3 pl-4 text-left text-[10px] font-semibold tracking-wide text-muted uppercase';

export const extruderCardZoneHeadClass =
	'px-1 py-3 text-center text-[10px] font-semibold tracking-wide text-muted uppercase';

export const extruderCardRowLabelClass =
	'pt-4 pb-1 pl-4 align-top text-sm font-semibold text-foreground';

export const extruderCardSetLabelClass = 'pt-1 pb-4 pl-4 text-sm font-medium text-muted-foreground';

export const extruderCardCellClass = 'px-2 pt-4 pb-1 text-center';

export const extruderCardBarSpacerClass = 'pt-1 pb-1 pl-4';

export const extruderCardBarCellClass = 'px-2 pt-1 pb-1';

export const extruderCardSetCellClass = 'px-2 pt-1 pb-4 text-center';

export const extruderCardSetValueClass = 'text-sm tabular-nums text-muted-foreground';

export const extruderCardDividerCellClass = 'px-4 py-2';

export const extruderCardDividerClass = 'h-px w-full bg-border';

const chipToneClass: Record<ExtruderTempVariant, string> = {
	green: 'border-status-online/30 bg-status-online-badge text-status-online',
	yellow: 'border-status-loading/30 bg-status-loading-badge text-status-loading',
	red: 'border-status-error/30 bg-status-error-badge text-status-error'
};

export function extruderCardChipClass(variant: ExtruderTempVariant, className = ''): string {
	return cn(
		'inline-flex min-w-13 flex-col items-center gap-0.5 border px-3 py-2',
		chipToneClass[variant],
		className
	);
}

export const extruderCardChipValueClass = 'font-body text-lg leading-none font-medium tabular-nums';

export const extruderCardChipUnitClass =
	'text-[9px] font-semibold tracking-wide uppercase opacity-60';
