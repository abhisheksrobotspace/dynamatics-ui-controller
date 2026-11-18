import { cn } from '$lib/utils/cn';

export function quantityStepperRootClass(className = ''): string {
	return cn('flex items-stretch', className);
}

/** Figma: 70×70, #F5F6F8 fill, primary border, 32px glyph */
export function quantityStepperButtonClass(className = ''): string {
	return cn(
		'box-border flex size-[70px] shrink-0 items-center justify-center border-2 border-primary',
		'bg-status-offline-bg font-heading text-[32px] font-bold leading-none text-primary transition-colors',
		'hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
		'disabled:cursor-not-allowed disabled:opacity-50',
		className
	);
}

/** Figma: 120×70, white fill, border #DDE1E5, Space Grotesk 32px */
export function quantityStepperValueClass(className = ''): string {
	return cn(
		'box-border flex h-[70px] min-w-[120px] items-center justify-center border-2 border-border bg-background',
		'px-3 font-body text-[32px] font-bold leading-none text-foreground',
		className
	);
}
