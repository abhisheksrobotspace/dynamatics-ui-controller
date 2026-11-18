import { cn } from '$lib/utils/cn';
import type { ReasonCardIconTone } from './reason-card.types';

export function reasonCardClass(className = ''): string {
	return cn(
		'relative box-border flex min-h-28 w-full items-center gap-4 border border-border',
		'bg-status-offline-bg px-5 py-4 text-left transition',
		'hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
		'disabled:pointer-events-none disabled:opacity-60',
		className
	);
}

export function reasonCardIconClass(tone: ReasonCardIconTone = 'primary', className = ''): string {
	return cn(
		'size-9 shrink-0',
		{
			'text-primary': tone === 'primary',
			'text-status-error': tone === 'error'
		},
		className
	);
}

export const reasonCardLabelClass =
	'min-w-0 flex-1 font-heading text-xl font-bold leading-snug text-foreground';

export const reasonCardIndexClass =
	'absolute top-3 right-4 font-heading text-sm font-bold text-muted';
