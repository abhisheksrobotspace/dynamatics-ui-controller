import { cn } from '$lib/utils/cn';

export const dropdownMenuContentClass =
	'fixed z-50 flex w-max flex-col overflow-hidden border border-border bg-surface text-foreground shadow-md outline-none';

export const dropdownMenuScrollClass = 'overflow-y-auto overscroll-contain';

export const dropdownMenuItemClass =
	'relative flex w-full cursor-default select-none items-center gap-3 px-4 py-2.5 text-left text-sm outline-none transition-colors disabled:pointer-events-none disabled:opacity-50';

export const dropdownMenuItemActionClass =
	"text-foreground hover:bg-foreground/5 focus-visible:bg-foreground/5 [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 [&_svg:not([class*='text-'])]:text-muted-foreground";

export const dropdownMenuTriggerSelectClass =
	'min-w-[5rem] justify-between border border-border bg-surface px-4 py-2 text-sm text-foreground transition-colors';

export function dropdownMenuTriggerSelectOpenClass(open = false): string {
	return cn({
		'border-border bg-[#F3F4F6]': open
	});
}

export function dropdownMenuItemSelectionClass(selected = false): string {
	return cn({
		'bg-[#F3F4F6] font-medium text-foreground': selected,
		'text-muted-foreground hover:bg-[#F3F4F6] hover:text-foreground': !selected
	});
}

export const dropdownMenuItemCheckClass = 'size-4 shrink-0 text-foreground';
