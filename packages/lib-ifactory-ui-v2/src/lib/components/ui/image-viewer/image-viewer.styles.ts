import { cn } from '$lib/utils/cn';

export function imageViewerRootClass(className = ''): string {
	return cn('flex min-h-0 min-w-0 flex-1 flex-col gap-3', className);
}

export const imageViewerToolbarClass = 'flex items-center justify-between gap-3';

export const imageViewerLabelClass = 'min-w-0 truncate text-sm font-medium text-foreground';

export const imageViewerControlsClass = 'flex shrink-0 items-center gap-2';

export const imageViewerCounterClass = 'min-w-12 text-center text-xs text-muted-foreground';

export const imageViewerZoomLabelClass = 'min-w-12 text-center text-xs text-muted-foreground';

export const imageViewerStageClass =
	'flex min-h-0 min-w-0 flex-1 cursor-grab touch-none items-center justify-center overflow-hidden border border-border bg-surface active:cursor-grabbing';

export const imageViewerImageClass =
	'max-h-full max-w-full object-contain select-none pointer-events-none will-change-transform';

/* HMI variant: keycap controls, 24 px label, framed stage. */

export const imageViewerHmiLabelClass =
	'min-w-0 truncate font-body text-2xl leading-[31px] font-bold text-[#1b2028]';

export const imageViewerHmiReadoutClass =
	'min-w-16 text-center font-body text-lg leading-[23px] font-bold text-[#5a616c]';

export const imageViewerHmiStageClass =
	'flex min-h-0 min-w-0 flex-1 cursor-grab touch-none items-center justify-center overflow-hidden rounded-xl border-2 border-[#c3c8cf] bg-white active:cursor-grabbing';
