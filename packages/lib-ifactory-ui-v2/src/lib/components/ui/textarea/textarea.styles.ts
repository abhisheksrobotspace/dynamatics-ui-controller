import { cn } from '$lib/utils/cn';

export type TextareaVariant = 'default' | 'outline' | 'ghost';
export type TextareaSize = 'sm' | 'md' | 'lg';

export function textareaClasses(
	variant: TextareaVariant = 'default',
	size: TextareaSize = 'md',
	error = false,
	className = ''
): string {
	return cn(
		'w-full rounded-md border bg-background text-foreground placeholder:text-placeholder transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50',
		{
			'border-border focus-visible:ring-primary/20': variant === 'default' && !error,
			'border-foreground/20 focus-visible:ring-primary/20': variant === 'outline' && !error,
			'border-transparent bg-foreground/5 focus-visible:ring-primary/20':
				variant === 'ghost' && !error,
			'border-status-error focus-visible:ring-status-error/20': error,
			'min-h-16 px-2.5 py-1.5 text-xs': size === 'sm',
			'min-h-20 px-3 py-2 text-sm': size === 'md',
			'min-h-24 px-3.5 py-2.5 text-base': size === 'lg'
		},
		className
	);
}
