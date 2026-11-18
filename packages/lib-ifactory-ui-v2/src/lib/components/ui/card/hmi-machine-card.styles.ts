import { cn } from '$lib/utils/cn';
import type { HmiMachineCardTone } from './hmi-machine-card.types';

/**
 * Shell only — no fixed height. Pass `class` (e.g. `h-full`) from the layout
 * so every tile in a grid shares one size.
 */
export function hmiMachineCardShellClass(className = ''): string {
	return cn(
		'flex h-full min-h-0 w-full overflow-hidden rounded-none border-2 border-border bg-surface text-foreground',
		className
	);
}

export function hmiMachineCardRailClass(tone: HmiMachineCardTone): string {
	return cn('w-1.5 shrink-0 self-stretch', {
		'bg-status-online': tone === 'online',
		'bg-status-error': tone === 'error',
		'bg-status-loading': tone === 'loading',
		'bg-status-offline': tone === 'offline'
	});
}

export const hmiMachineCardMainClass = 'flex min-h-0 min-w-0 flex-1 flex-col';

export function hmiMachineCardHeaderClass(className = ''): string {
	return cn('flex shrink-0 items-start justify-between gap-3 px-4 pt-4 pb-3', className);
}

export const hmiMachineCardTitleStackClass = 'flex min-w-0 flex-col gap-0.5';

export function hmiMachineCardAidClass(className = ''): string {
	return cn('truncate font-heading text-2xl font-bold text-foreground', className);
}

export function hmiMachineCardNameClass(className = ''): string {
	return cn('truncate font-heading text-sm text-muted', className);
}

/** Solid status chip — pass Badge `variant` separately; this only sets fill. */
export function hmiMachineCardBadgeClass(tone: HmiMachineCardTone, className = ''): string {
	return cn(
		'shrink-0 font-heading text-xs font-bold tracking-wide uppercase',
		{
			'bg-status-online text-white': tone === 'online',
			'bg-status-error text-white': tone === 'error',
			'bg-status-loading text-white': tone === 'loading',
			'bg-status-offline text-white': tone === 'offline'
		},
		className
	);
}

export const hmiMachineCardDividerClass = 'mx-4 shrink-0 border-b border-foreground/[0.06]';

export function hmiMachineCardBodyClass(className = ''): string {
	return cn('flex flex-1 flex-col gap-4 px-4 py-4', className);
}

export const hmiMachineCardFieldRowClass = 'grid grid-cols-2 gap-4';

export const hmiMachineCardFieldClass = 'flex min-w-0 flex-col gap-0.5';

export function hmiMachineCardFieldLabelClass(className = ''): string {
	return cn('font-heading text-sm font-bold tracking-wide text-muted uppercase', className);
}

export function hmiMachineCardFieldValueClass(className = ''): string {
	return cn('truncate font-heading text-sm font-medium text-foreground', className);
}

export const hmiMachineCardMetricsRowClass = 'grid grid-cols-2 gap-4';

export const hmiMachineCardMetricStackClass = 'flex min-w-0 flex-col gap-0.5';

export function hmiMachineCardMetricLabelClass(className = ''): string {
	return cn('font-heading text-sm font-bold tracking-wide text-muted uppercase', className);
}

export function hmiMachineCardPrimaryMetricValueClass(className = ''): string {
	return cn('truncate font-heading text-4xl font-bold text-primary sm:text-5xl', className);
}

export function hmiMachineCardSecondaryMetricValueClass(className = ''): string {
	return cn('truncate font-heading text-4xl font-bold text-foreground sm:text-5xl', className);
}

export function hmiMachineCardFooterClass(className = ''): string {
	return cn(
		'mt-auto flex items-end justify-between gap-3 border-t border-foreground/[0.06] px-4 py-3',
		className
	);
}

export function hmiMachineCardTimerLabelClass(className = ''): string {
	return cn(
		'shrink-0 font-heading text-sm font-bold tracking-wide text-muted uppercase',
		className
	);
}

export function hmiMachineCardTimerValueClass(tone: HmiMachineCardTone, className = ''): string {
	return cn(
		'min-w-0 truncate text-right font-heading text-lg font-bold',
		{
			'text-status-online': tone === 'online',
			'text-status-error': tone === 'error',
			'text-status-loading': tone === 'loading',
			'text-status-offline': tone === 'offline'
		},
		className
	);
}

export function hmiMachineCardEmptyClass(className = ''): string {
	return cn(
		'flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-4 py-8 text-center',
		className
	);
}

export function hmiMachineCardEmptyMessageClass(className = ''): string {
	return cn('font-heading text-base font-medium text-muted', className);
}
