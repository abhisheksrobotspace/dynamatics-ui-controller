import { cn } from '$lib/utils/cn';
import type { DetailsCardColumns } from './details-card.types';

const panelGridClass: Record<DetailsCardColumns, string> = {
	2: 'grid-cols-2',
	3: 'grid-cols-3',
	4: 'grid-cols-4'
};

export function detailsCardClass(className = ''): string {
	return cn('box-border flex w-full flex-col gap-2', className);
}

export const detailsCardCaptionClass =
	'font-heading text-sm font-bold uppercase tracking-wide text-muted';

export function detailsCardPanelClass(columns: DetailsCardColumns, className = ''): string {
	return cn(
		'box-border grid w-full gap-x-8 gap-y-5 border border-border bg-status-offline-bg px-7 py-4',
		panelGridClass[columns],
		className
	);
}

export const detailsCardItemClass = 'flex min-w-0 flex-col gap-0.5';

export const detailsCardLabelClass =
	'font-heading text-sm font-bold uppercase tracking-wide text-muted';

export const detailsCardValueClass = 'font-heading text-xl font-bold text-foreground';
