import { cn } from '$lib/utils/cn';

export const accordionClass = 'w-full';

export const accordionItemClass = 'border-b border-border';

export const accordionTriggerClass =
	'flex w-full items-center justify-between gap-4 py-5 text-left text-sm font-medium text-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50';

export const accordionTriggerTitleClass = 'min-w-0 flex-1';

export const accordionIconClass =
	'size-4 shrink-0 text-foreground transition-transform duration-300';

export function accordionContentWrapperClass(open = false): string {
	return cn(
		'grid transition-[grid-template-rows] duration-300 ease-in-out',
		open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
	);
}

export const accordionContentInnerClass = 'overflow-hidden';

export const accordionContentClass = 'pb-5 text-sm text-muted-foreground';
