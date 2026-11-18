import { cn } from '$lib/utils/cn';
import {
	accordionWithTableContentInnerClass,
	accordionWithTableContentWrapperClass
} from '../accordion-with-table/accordion-with-table.styles';

export const accordionWithContentClass = 'flex w-full flex-col gap-3';

export const accordionWithContentItemClass =
	'overflow-hidden rounded-none border border-border bg-surface';

export const accordionWithContentTriggerClass =
	'flex w-full items-center gap-4 rounded-none bg-surface px-4 py-3 text-left text-sm text-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50';

export const accordionWithContentTriggerTitleClass = 'truncate font-semibold text-foreground';

export const accordionWithContentIconClass = 'size-4 shrink-0 text-foreground';

export {
	accordionWithTableContentWrapperClass as accordionWithContentContentWrapperClass,
	accordionWithTableContentInnerClass as accordionWithContentContentInnerClass
};

export const accordionWithContentTriggerMetaClass = 'flex min-w-0 flex-1 flex-col gap-0.5';

export const accordionWithContentTriggerTitleRowClass = 'flex min-w-0 items-center gap-2';

export function accordionWithContentBadgeClass(tone: 'primary' | 'success' = 'primary'): string {
	return cn(
		'inline-flex shrink-0 items-center rounded-none px-2 py-0.5 text-xs font-semibold tabular-nums',
		tone === 'success' ? 'bg-status-online/15 text-status-online' : 'bg-primary text-white'
	);
}

export const accordionWithContentDescriptionClass = 'text-sm text-muted-foreground tabular-nums';

export const accordionWithContentSummaryClass =
	'hidden min-w-0 shrink text-sm text-muted-foreground sm:block';

export const accordionWithContentTextClass = 'p-4 text-sm text-muted-foreground';

export const accordionWithContentToolbarClass =
	'flex flex-wrap items-center gap-2 border-b border-border px-5 py-3';

export const accordionWithContentSearchClass = 'border-b border-border px-5 py-3';

export const accordionWithContentCheckboxGridClass =
	'grid grid-cols-2 gap-2 p-5 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6';

export const accordionWithContentCheckboxLabelClass = cn(
	'flex cursor-pointer items-center gap-2 rounded-none border border-border bg-surface p-2 text-sm font-medium tabular-nums text-foreground hover:bg-muted/30',
	'focus-within:ring-2 focus-within:ring-primary/20'
);

export const accordionWithContentCheckboxClass = '';
