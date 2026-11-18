import { cn } from '$lib/utils/cn';
import type { ProgressBarStepColorSet } from './progress-bar.colors';
import type {
	ProgressBarAlign,
	ProgressBarButtonPlacement,
	ProgressBarLabelPlacement,
	ProgressBarVariant
} from './progress-bar.constants';
import type { ProgressBarStepStatus } from './progress-bar.utils';

export function progressBarPanelsOuterClass(align: ProgressBarAlign): string {
	return cn('w-full', {
		'lg:border-t lg:border-b lg:border-border': align === 'horizontal'
	});
}

export const progressBarPanelsNavClass = 'w-full';

export function progressBarPanelsListClass(align: ProgressBarAlign): string {
	return cn('w-full overflow-hidden', {
		'lg:flex lg:border-r lg:border-l lg:border-border': align === 'horizontal'
	});
}

export function progressBarPanelsItemClass(align: ProgressBarAlign): string {
	return cn('relative overflow-hidden', {
		'lg:flex-1': align === 'horizontal'
	});
}

export function progressBarPanelsStepShellClass(
	index: number,
	total: number,
	align: ProgressBarAlign
): string {
	if (align === 'vertical') {
		return cn('overflow-hidden border border-border', {
			'border-b-0': index < total - 1
		});
	}

	return cn('overflow-hidden border border-border lg:border-0', {
		'border-b-0': index === 0 && total > 1,
		'border-t-0': index === total - 1 && total > 1
	});
}

export function progressBarPanelsIndicatorClass(
	status: ProgressBarStepStatus,
	align: ProgressBarAlign,
	colors: ProgressBarStepColorSet
): string {
	return cn('absolute top-0 left-0 h-full w-1', {
		'lg:top-auto lg:bottom-0 lg:h-1 lg:w-full': align === 'horizontal',
		[colors.indicator]: status === 'current',
		'bg-transparent group-hover:bg-border': status !== 'current'
	});
}

export const progressBarPanelsContentClass = 'flex items-start px-6 py-5 text-sm font-medium';

export function progressBarPanelsContentOffsetClass(
	index: number,
	align: ProgressBarAlign
): string {
	return cn(progressBarPanelsContentClass, {
		'lg:pl-9': align === 'horizontal' && index > 0
	});
}

export const progressBarPanelsIconShellClass = 'shrink-0';

export function progressBarPanelsIconCompleteClass(colors: ProgressBarStepColorSet): string {
	return cn(
		'flex size-10 items-center justify-center rounded-full',
		colors.solid,
		colors.solidHover
	);
}

export function progressBarPanelsIconCurrentClass(colors: ProgressBarStepColorSet): string {
	return cn('flex size-10 items-center justify-center rounded-full border-2', colors.border);
}

export function progressBarPanelsIconUpcomingClass(colors: ProgressBarStepColorSet): string {
	return cn(
		'flex size-10 items-center justify-center rounded-full border-2',
		colors.upcomingBorder
	);
}

export function progressBarPanelsCheckIconClass(colors: ProgressBarStepColorSet): string {
	return cn('size-6', colors.checkIcon);
}

export function progressBarPanelsNumberCurrentClass(colors: ProgressBarStepColorSet): string {
	return colors.text;
}

export function progressBarPanelsNumberUpcomingClass(colors: ProgressBarStepColorSet): string {
	return colors.upcomingText;
}

export function progressBarPanelsTextClass(hasDescription = false): string {
	return cn('ml-4 flex min-w-0 flex-col', {
		'justify-center': !hasDescription
	});
}

export function progressBarPanelsTitleClass(
	status: ProgressBarStepStatus,
	colors: ProgressBarStepColorSet
): string {
	return cn('text-sm', {
		'font-semibold': status === 'complete',
		'font-medium': status !== 'complete',
		[colors.completeTitle]: status === 'complete',
		[colors.text]: status === 'current',
		[colors.upcomingText]: status === 'upcoming'
	});
}

export const progressBarPanelsDescriptionClass = 'text-sm font-medium text-muted-foreground';

export const progressBarPanelsVerticalBodyClass = 'group w-full px-6 py-5';

export function progressBarPanelsVerticalContentClass(
	placement: ProgressBarButtonPlacement
): string {
	return cn({
		flex: placement === 'beside',
		'items-center gap-4': placement === 'beside'
	});
}

export const progressBarPanelsVerticalClickableRowClass =
	'cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

export function progressBarPanelsVerticalStepTriggerClass(
	placement: ProgressBarButtonPlacement,
	hasDescription = false
): string {
	return cn('group flex text-left text-sm font-medium', {
		'items-center': placement === 'beside' && !hasDescription,
		'items-start': placement === 'below' || (placement === 'beside' && hasDescription),
		'w-full': placement === 'below',
		'min-w-0 flex-1': placement === 'beside'
	});
}

export function progressBarPanelsVerticalButtonRowClass(
	placement: ProgressBarButtonPlacement
): string {
	return cn({
		'mt-4 ml-14': placement === 'below',
		'shrink-0': placement === 'beside'
	});
}

export function progressBarCirclesVerticalContentClass(
	placement: ProgressBarButtonPlacement
): string {
	return cn({
		flex: placement === 'beside',
		'items-start gap-4': placement === 'beside'
	});
}

export function progressBarCirclesVerticalTextColumnClass(
	placement: ProgressBarButtonPlacement
): string {
	return cn(progressBarCirclesLabeledTextClass, {
		'min-w-0 flex-1': placement === 'beside'
	});
}

export function progressBarCirclesVerticalStepTriggerClass(
	placement: ProgressBarButtonPlacement
): string {
	return cn('text-left', {
		'w-full': placement === 'below',
		'min-w-0 flex-1': placement === 'beside'
	});
}

export function progressBarCirclesVerticalButtonRowClass(
	placement: ProgressBarButtonPlacement
): string {
	return cn({
		'mt-4': placement === 'below',
		'shrink-0 pt-0.5': placement === 'beside'
	});
}

export function progressBarPanelsSeparatorClass(align: ProgressBarAlign): string {
	return cn('absolute inset-0 top-0 left-0 w-3', {
		'hidden lg:block': align === 'horizontal',
		hidden: align === 'vertical'
	});
}

export const progressBarPanelsSeparatorIconClass = 'size-full text-border';

export function progressBarCirclesListClass(
	align: ProgressBarAlign,
	showLabels = false,
	labelPlacement: ProgressBarLabelPlacement = 'below'
): string {
	return cn({
		'flex w-full items-center': align === 'horizontal' && showLabels && labelPlacement === 'beside',
		'flex w-full items-start overflow-visible':
			align === 'horizontal' && showLabels && labelPlacement === 'below',
		'flex items-center': align === 'horizontal' && !showLabels,
		'overflow-hidden': align === 'vertical'
	});
}

export function progressBarCirclesItemClass(
	isLast: boolean,
	align: ProgressBarAlign,
	showLabels = false,
	labelPlacement: ProgressBarLabelPlacement = 'below'
): string {
	return cn('relative', {
		'flex min-w-0 flex-1 items-center last:flex-none':
			align === 'horizontal' && showLabels && labelPlacement === 'beside',
		'min-w-0 flex-1 overflow-visible':
			align === 'horizontal' && showLabels && labelPlacement === 'below',
		'pr-8 sm:pr-20': align === 'horizontal' && !isLast && !showLabels,
		'pb-10': align === 'vertical' && !isLast
	});
}

export const progressBarCirclesInlineStepClass = 'flex shrink-0 items-center gap-2';

export function progressBarCirclesInlineConnectorClass(colors: ProgressBarStepColorSet): string {
	return cn('mx-3 h-0.5 min-w-4 flex-1', colors.connector);
}

export function progressBarCirclesNumberedStepClass(
	status: ProgressBarStepStatus,
	stepColors: ProgressBarStepColorSet,
	interactive: boolean
): string {
	if (status === 'upcoming') {
		return cn(
			'relative flex size-7 shrink-0 items-center justify-center rounded-full border-2 bg-white text-xs font-semibold',
			stepColors.upcomingBorder,
			stepColors.upcomingText,
			interactive && stepColors.borderHover
		);
	}

	return cn(
		'relative flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white',
		stepColors.solid,
		interactive && stepColors.solidHover
	);
}

export function progressBarCirclesNumberTextClass(
	status: ProgressBarStepStatus,
	stepColors: ProgressBarStepColorSet
): string {
	return cn({
		'text-white': status !== 'upcoming',
		[stepColors.upcomingText]: status === 'upcoming'
	});
}

export const progressBarCirclesHorizontalLabeledStepClass =
	'relative z-10 flex w-full flex-col items-center';

export const progressBarCirclesHorizontalCircleTrackClass =
	'relative flex h-8 w-full shrink-0 items-center justify-center';

export const progressBarCirclesHorizontalLabelClass =
	'mt-2 flex w-full flex-col items-center gap-0.5 px-2 text-center';

export function progressBarCirclesHorizontalConnectorClass(
	colors: ProgressBarStepColorSet
): string {
	return cn(
		'pointer-events-none absolute top-4 left-1/2 z-0 h-0.5 w-full -translate-y-1/2',
		colors.connector
	);
}

export function progressBarCirclesConnectorClass(
	align: ProgressBarAlign,
	colors: ProgressBarStepColorSet
): string {
	if (align === 'vertical') {
		return cn('absolute top-4 left-4 mt-0.5 -ml-px h-full w-0.5', colors.connector);
	}

	return cn('h-0.5 w-full', colors.connector);
}

export const progressBarCirclesConnectorShellClass = 'absolute inset-0 flex items-center';

export function progressBarCirclesStepCompleteClass(
	colors: ProgressBarStepColorSet,
	interactive: boolean
): string {
	return cn(
		'relative flex size-8 items-center justify-center rounded-full',
		colors.solid,
		interactive && colors.solidHover
	);
}

export function progressBarCirclesStepCurrentClass(colors: ProgressBarStepColorSet): string {
	return cn(
		'relative flex size-8 items-center justify-center rounded-full border-2 bg-white',
		colors.border
	);
}

export function progressBarCirclesStepUpcomingClass(
	colors: ProgressBarStepColorSet,
	interactive: boolean
): string {
	return cn(
		'group relative flex size-8 items-center justify-center rounded-full border-2 bg-white',
		colors.upcomingBorder,
		interactive && colors.borderHover
	);
}

export function progressBarCirclesCheckIconClass(colors: ProgressBarStepColorSet): string {
	return cn('size-5', colors.checkIcon);
}

export function progressBarCirclesDotClass(colors: ProgressBarStepColorSet): string {
	return cn('size-2.5 rounded-full', colors.solid);
}

export function progressBarCirclesUpcomingDotClass(colors: ProgressBarStepColorSet): string {
	return cn('size-2.5 rounded-full bg-transparent', colors.upcomingDotHover);
}

export const progressBarCirclesLabeledStepClass = 'group relative flex items-start';

export const progressBarCirclesLabeledIconRowClass = 'flex h-9 items-center';

export function progressBarCirclesLabeledIconCompleteClass(
	colors: ProgressBarStepColorSet,
	interactive: boolean
): string {
	return cn(
		'relative z-10 flex size-8 items-center justify-center rounded-full',
		colors.solid,
		interactive && colors.solidHover
	);
}

export function progressBarCirclesLabeledIconCurrentClass(colors: ProgressBarStepColorSet): string {
	return cn(
		'relative z-10 flex size-8 items-center justify-center rounded-full border-2 bg-white',
		colors.border
	);
}

export function progressBarCirclesLabeledIconUpcomingClass(
	colors: ProgressBarStepColorSet,
	interactive: boolean
): string {
	return cn(
		'relative z-10 flex size-8 items-center justify-center rounded-full border-2 bg-white',
		colors.upcomingBorder,
		interactive && colors.borderHover
	);
}

export const progressBarCirclesLabeledTextClass = 'ml-4 flex min-w-0 flex-col';

export function progressBarCirclesLabeledTitleClass(
	status: ProgressBarStepStatus,
	colors: ProgressBarStepColorSet
): string {
	return progressBarPanelsTitleClass(status, colors);
}

export const progressBarCirclesLabeledDescriptionClass =
	'block text-center text-sm text-muted-foreground';

export const progressBarBulletsNavClass = 'flex justify-center';

export const progressBarBulletsListClass = 'space-y-6';

export const progressBarBulletsRowClass = 'flex items-start';

export const progressBarBulletsCompleteIconShellClass =
	'relative flex size-5 shrink-0 items-center justify-center';

export function progressBarBulletsCompleteIconClass(
	colors: ProgressBarStepColorSet,
	interactive: boolean
): string {
	return cn('size-full', colors.text, interactive && 'group-hover:opacity-90');
}

export const progressBarBulletsCurrentIconShellClass =
	'relative flex size-5 shrink-0 items-center justify-center';

export function progressBarBulletsCurrentOuterDotClass(colors: ProgressBarStepColorSet): string {
	return cn('absolute size-4 rounded-full', colors.soft);
}

export function progressBarBulletsCurrentInnerDotClass(colors: ProgressBarStepColorSet): string {
	return cn('relative block size-2 rounded-full', colors.solid);
}

export const progressBarBulletsUpcomingIconShellClass =
	'relative flex size-5 shrink-0 items-center justify-center';

export function progressBarBulletsUpcomingDotClass(
	colors: ProgressBarStepColorSet,
	interactive: boolean
): string {
	return cn('size-2 rounded-full', colors.upcomingDot, interactive && colors.upcomingDotHover);
}

export function progressBarBulletsLabelClass(
	status: ProgressBarStepStatus,
	colors: ProgressBarStepColorSet
): string {
	return cn('ml-3 text-sm font-medium', {
		[colors.text]: status === 'current',
		[colors.upcomingText]: status !== 'current',
		'group-hover:text-foreground': status !== 'current'
	});
}

export function progressBarNavClass(variant: ProgressBarVariant): string {
	return cn({
		[progressBarPanelsNavClass]: variant === 'panels',
		[progressBarBulletsNavClass]: variant === 'bullets'
	});
}
