import { cn } from '$lib/utils/cn';

export const accordionWithTableClass = 'flex w-full flex-col gap-2';

export const accordionWithTableClassWithHeadings = 'flex w-full flex-col gap-0';

export const accordionWithTableItemClass = 'rounded-none border border-border bg-surface';

export const accordionWithTableItemFlushClass = 'border-t-0';

export const accordionWithTableTriggerClass =
	'flex w-full items-center gap-4 rounded-none bg-surface px-4 py-3 text-left text-sm text-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50';

export const accordionWithTableTriggerTitleClass = 'min-w-0 flex-1 font-semibold text-foreground';

export const accordionWithTableTriggerHeadingClass = 'min-w-[12rem] flex-1';

export const accordionWithTableTriggerSubtitleClass = 'text-sm text-muted-foreground';

export const accordionWithTableTriggerStatsClass =
	'hidden min-w-0 flex-[2.5] items-center justify-between gap-4 sm:flex';

export const accordionWithTableTriggerStatBlockClass = 'min-w-0 flex-1 text-right';

export const accordionWithTableTriggerStatLabelClass =
	'whitespace-nowrap text-[11px] font-medium tracking-wide text-muted-foreground uppercase';

export const accordionWithTableTriggerStatValueClass =
	'text-sm font-semibold tabular-nums text-foreground';

export const accordionWithTableTriggerStatSublabelClass =
	'mt-0.5 text-xs tabular-nums text-muted-foreground';

export const accordionWithTableTriggerProgressClass = 'min-w-[7rem] flex-1 text-right';

export const accordionWithTableHeaderRowClass =
	'hidden w-full items-center gap-4 border border-border bg-[#F2F2F2] px-4 py-2.5 sm:flex';

export const accordionWithTableHeaderSectionClass =
	'min-w-[12rem] flex-1 whitespace-nowrap text-sm font-medium tracking-wide text-muted-foreground uppercase';

export const accordionWithTableHeaderCellClass =
	'whitespace-nowrap text-sm font-medium tracking-wide text-muted-foreground uppercase';

export const accordionWithTableItemExcludedClass = 'opacity-60';

export const accordionWithTableTriggerSummaryClass =
	'hidden min-w-0 truncate text-sm text-muted-foreground lg:block';

export function accordionWithTableBadgeClass(tone: 'primary' | 'success' = 'primary'): string {
	return cn(
		'inline-flex shrink-0 items-center rounded-none px-2 py-0.5 text-xs font-semibold capitalize',
		tone === 'success' ? 'bg-status-online/15 text-status-online' : 'bg-primary/10 text-primary'
	);
}

export const accordionWithTableTriggerActionsClass = 'flex shrink-0 items-center gap-2';

export const accordionWithTableIconClass = 'size-4 shrink-0 text-foreground';

export function accordionWithTableContentWrapperClass(open = false): string {
	return cn(
		'grid transition-[grid-template-rows] duration-300 ease-in-out',
		open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
	);
}

export const accordionWithTableContentInnerClass = 'overflow-hidden';
