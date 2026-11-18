import { cn } from '$lib/utils/cn';
import type {
	MetricFieldAlign,
	MetricFieldSize,
	MetricFieldTone,
	MetricRowVariant
} from './metric-row.types';

export function metricRowClass(variant: MetricRowVariant, className = ''): string {
	return cn(
		'box-border flex min-h-[72px] w-full flex-nowrap items-center gap-3 px-4 py-1.5',
		{
			'border border-border bg-status-offline-bg': variant === 'default',
			/* Job Complete stepper rows: white + gray border (not primary) */
			'border-2 border-border bg-background': variant === 'emphasis'
		},
		className
	);
}

export const metricRowTitleClass =
	'box-border w-56 shrink-0 overflow-hidden truncate font-heading text-[25px] font-bold leading-none text-foreground';

export function metricRowFieldsClass(withStepper = false, className = ''): string {
	return cn(
		'flex min-w-0 flex-1 flex-nowrap items-center gap-4',
		withStepper ? 'justify-start' : 'justify-end',
		className
	);
}

export function metricRowFieldClass(
	align: MetricFieldAlign = 'start',
	size: MetricFieldSize = 'sm',
	className = ''
): string {
	return cn(
		'box-border flex shrink-0 flex-col gap-0.5 overflow-hidden',
		{
			'w-12': size === 'xs',
			'w-14': size === 'sm',
			'w-24': size === 'md',
			'w-28': size === 'lg'
		},
		align === 'end' ? 'items-end text-right' : 'items-start text-left',
		className
	);
}

export const metricRowFieldLabelClass =
	'w-full truncate font-heading text-sm font-bold uppercase tracking-wide text-muted';

export function metricRowFieldValueClass(
	tone: MetricFieldTone = 'default',
	size: MetricFieldSize = 'sm',
	className = ''
): string {
	return cn(
		'w-full font-bold tabular-nums',
		{
			'font-heading text-base text-foreground':
				(size === 'xs' || size === 'md') && tone === 'default',
			'font-heading text-base text-primary': (size === 'xs' || size === 'md') && tone === 'primary',
			'font-heading text-base text-muted': (size === 'xs' || size === 'md') && tone === 'muted',
			'font-heading text-base text-status-online':
				(size === 'xs' || size === 'md') && tone === 'success',
			'font-heading text-sm text-foreground': size === 'sm' && tone === 'default',
			'font-heading text-sm text-primary': size === 'sm' && tone === 'primary',
			'font-heading text-sm text-muted': size === 'sm' && tone === 'muted',
			'font-heading text-sm text-status-online': size === 'sm' && tone === 'success',
			'font-body text-3xl text-foreground leading-none': size === 'lg' && tone === 'default',
			'font-body text-3xl text-primary leading-none': size === 'lg' && tone === 'primary',
			'font-body text-3xl text-muted leading-none': size === 'lg' && tone === 'muted',
			'font-body text-3xl text-status-online leading-none': size === 'lg' && tone === 'success'
		},
		className
	);
}

export const metricRowStepperClass = 'ml-auto flex shrink-0 items-center gap-4';

export const metricRowStepperLabelClass =
	'font-heading text-sm font-bold uppercase tracking-wide text-muted';
