import { cn } from '$lib/utils/cn';

export function listRowClass(className = '', disabled = false): string {
	return cn(
		'box-border flex min-h-16 w-full items-center gap-4 border border-border bg-background px-4 text-left transition',
		'focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none',
		'hover:bg-status-offline-bg',
		disabled && 'pointer-events-none opacity-60',
		className
	);
}

export const listRowLeadingClass = 'flex size-6 shrink-0 items-center justify-center sm:size-7';
export const listRowLabelClass = 'min-w-0 flex-1 font-heading text-base font-bold sm:text-lg';
export const listRowTrailingClass = 'flex shrink-0 items-center gap-2';
