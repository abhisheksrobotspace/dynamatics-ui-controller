import { cn } from '$lib/utils/cn';

export const comboboxWrapperClass = 'relative block w-full';

export const comboboxTriggerClass =
	'flex w-full items-center justify-between gap-2 border border-border bg-surface px-3 py-2 text-left text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50';

export function comboboxTriggerOpenClass(open = false): string {
	return cn({
		'border-border bg-[#F3F4F6]': open
	});
}

export const comboboxTriggerLabelClass = 'min-w-0 truncate';

export const comboboxTriggerMetaClass = 'shrink-0 font-medium text-foreground';

export const comboboxTriggerPlaceholderClass = 'text-placeholder';

export const comboboxTriggerIconClass = 'size-4 shrink-0 text-muted-foreground';

export const comboboxContentClass =
	'fixed z-50 flex w-max min-w-0 flex-col overflow-hidden border border-border bg-surface text-sm text-foreground shadow-md outline-none';

export const comboboxSearchWrapperClass = 'relative shrink-0 px-2 py-2';

export function comboboxSearchWrapperEdgeClass(opensUpward: boolean): string {
	return opensUpward ? 'border-t border-border' : 'border-b border-border';
}

export const comboboxSearchInputClass =
	'w-full border border-border bg-background py-1.5 pr-3 pl-9 text-sm text-foreground outline-none placeholder:text-placeholder focus-visible:ring-2 focus-visible:ring-primary/20';

export const comboboxSearchIconClass =
	'pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground';

export const comboboxScrollClass = 'overflow-y-auto overscroll-contain py-1';

export const comboboxOptionClass =
	'relative flex w-full cursor-default items-center gap-2 px-3 py-2 text-left text-sm outline-none transition-colors disabled:pointer-events-none disabled:opacity-50';

export function comboboxOptionStateClass(selected: boolean, highlighted: boolean): string {
	return cn({
		'bg-[#F3F4F6] font-medium text-foreground': selected,
		'bg-foreground/5 text-foreground': highlighted && !selected,
		'text-foreground hover:bg-foreground/5': !selected && !highlighted
	});
}

export const comboboxOptionCheckClass = 'size-4 shrink-0 text-foreground';

export const comboboxOptionLabelClass = 'min-w-0 truncate';

export const comboboxOptionMetaClass = 'shrink-0 font-medium text-foreground';

export const comboboxEmptyClass = 'px-3 py-2 text-muted-foreground';
