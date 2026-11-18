import { cn } from '$lib/utils/cn';

export type InputVariant = 'default' | 'outline' | 'ghost';
export type InputSize = 'sm' | 'md' | 'lg';

export function inputClasses(
	variant: InputVariant = 'default',
	size: InputSize = 'md',
	error = false,
	className = ''
): string {
	return cn(
		'w-full border bg-background text-foreground placeholder:text-placeholder transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50',
		{
			'border-border focus-visible:ring-primary/20': variant === 'default' && !error,
			'border-foreground/20 focus-visible:ring-primary/20': variant === 'outline' && !error,
			'border-transparent bg-foreground/5 focus-visible:ring-primary/20':
				variant === 'ghost' && !error,
			'border-status-error focus-visible:ring-status-error/20': error,
			'h-8 px-2.5 text-xs': size === 'sm',
			'h-9 px-3 text-sm': size === 'md',
			'h-10 px-3.5 text-base': size === 'lg'
		},
		className
	);
}
