import { cn } from '$lib/utils/cn';

export type NumberInputSize = 'sm' | 'md' | 'lg';

export function numberInputButtonClasses(size: NumberInputSize = 'md', className = ''): string {
	return cn(
		'flex shrink-0 select-none items-center justify-center border border-border bg-background text-foreground transition-colors hover:bg-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50',
		{
			'size-8': size === 'sm',
			'size-9': size === 'md',
			'size-10': size === 'lg'
		},
		className
	);
}

export function numberInputFieldClasses(size: NumberInputSize = 'md', className = ''): string {
	return cn(
		'min-w-0 flex-1 border border-border bg-background text-center text-foreground [appearance:textfield] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
		{
			'h-8 text-xs': size === 'sm',
			'h-9 text-sm': size === 'md',
			'h-10 text-base': size === 'lg'
		},
		className
	);
}
