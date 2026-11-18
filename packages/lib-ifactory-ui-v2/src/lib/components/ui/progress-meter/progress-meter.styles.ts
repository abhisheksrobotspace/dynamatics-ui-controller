import { cn } from '$lib/utils/cn';
import type { ProgressMeterBorderTone, ProgressMeterTone } from './progress-meter.constants';

export const progressMeterToneClass: Record<ProgressMeterTone, string> = {
	online: 'bg-status-online',
	error: 'bg-status-error',
	primary: 'bg-primary',
	muted: 'bg-muted',
	loading: 'bg-status-loading',
	offline: 'bg-status-offline-bg'
};

export const progressMeterToneTextClass: Record<ProgressMeterTone, string> = {
	online: 'text-status-online',
	error: 'text-status-error',
	primary: 'text-primary',
	muted: 'text-muted',
	loading: 'text-status-loading',
	offline: 'text-status-offline'
};

const progressMeterBorderClass: Record<Exclude<ProgressMeterBorderTone, 'none'>, string> = {
	online: 'border-2 border-status-online',
	error: 'border-2 border-status-error',
	primary: 'border-2 border-primary',
	muted: 'border-2 border-muted',
	loading: 'border-2 border-status-loading',
	offline: 'border-2 border-status-offline'
};

export function progressMeterRootClass(className = ''): string {
	return cn('w-full', className);
}

export function progressMeterHeaderClass(className = ''): string {
	return cn('flex items-baseline justify-between gap-3', className);
}

export function progressMeterTitleClass(className = ''): string {
	return cn('font-heading text-sm font-bold uppercase tracking-wide text-muted', className);
}

export function progressMeterPercentClass(fillTone: ProgressMeterTone, className = ''): string {
	return cn(
		'font-heading text-sm font-bold tabular-nums',
		progressMeterToneTextClass[fillTone],
		className
	);
}

export function progressMeterTrackClass(
	remainderTone: ProgressMeterTone,
	borderTone: ProgressMeterBorderTone = 'none',
	className = ''
): string {
	return cn(
		'relative w-full overflow-hidden rounded-none',
		borderTone === 'none' ? 'h-2' : 'box-border h-6',
		progressMeterToneClass[remainderTone],
		borderTone !== 'none' && progressMeterBorderClass[borderTone],
		className
	);
}

export function progressMeterFillClass(fillTone: ProgressMeterTone, className = ''): string {
	return cn('h-full transition-[width]', progressMeterToneClass[fillTone], className);
}

export function progressMeterLabelClass(className = ''): string {
	return cn('mt-1 text-xs tabular-nums text-muted-foreground', className);
}
