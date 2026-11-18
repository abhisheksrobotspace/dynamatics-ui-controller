import { cn } from '$lib/utils/cn';
import type { StatusMetricCardTone } from './status-metric-card.types';

const toneClass: Record<StatusMetricCardTone, string> = {
	online: 'bg-status-online',
	error: 'bg-status-error',
	loading: 'bg-status-loading',
	offline: 'bg-status-offline'
};

export function statusMetricCardClass(tone: StatusMetricCardTone, className = ''): string {
	return cn(
		'flex min-h-48 w-full flex-col items-center justify-center gap-3 p-6 text-white',
		toneClass[tone],
		className
	);
}

/** Figma: Space Grotesk Bold 50px → nearest token text-5xl (48px), line-height 100% */
export const statusMetricCardValueClass =
	'font-body text-5xl font-bold leading-none tracking-normal tabular-nums text-center';

/** Figma: Manrope Medium 18px → text-lg, line-height 100%, letter-spacing 0 */
export const statusMetricCardLabelClass =
	'font-heading text-lg font-medium leading-none tracking-normal uppercase text-center';
