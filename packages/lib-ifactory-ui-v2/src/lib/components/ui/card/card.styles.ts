import { cn } from '$lib/utils/cn';

export type CardVariant = 'default' | 'elevated' | 'online' | 'error' | 'loading' | 'offline';

export function cardShellClasses(variant: CardVariant, className = ''): string {
	return cn(
		'overflow-hidden border text-foreground',
		{
			'border-border bg-surface': variant === 'default',
			'border-border bg-surface shadow-sm': variant === 'elevated',
			'border-status-online/15 bg-status-online-bg': variant === 'online',
			'border-status-error/10 bg-status-error-bg': variant === 'error',
			'border-status-loading/15 bg-status-loading-bg': variant === 'loading',
			'border-status-offline/20 bg-status-offline-bg': variant === 'offline'
		},
		className
	);
}

export const cardHeaderClass = 'px-4 pt-4';
export const cardHeaderDividedClass = 'border-b border-foreground/[0.06] pb-3';
export const cardTitleClass = 'font-heading text-base font-semibold';
export const cardDescriptionClass = 'text-sm text-muted-foreground';
export const cardContentClass = 'px-4 pb-4';
export const cardFooterClass = 'px-4 pb-4 pt-0';
