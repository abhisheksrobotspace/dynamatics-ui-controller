import { cn } from '$lib/utils/cn';

export function kanbanBoardClass(className = '', isDragging = false): string {
	return cn(
		'flex h-full min-h-0 min-w-0 w-full gap-4 overflow-x-auto overflow-y-hidden overscroll-x-contain pb-1 snap-x snap-mandatory',
		isDragging && 'select-none',
		className
	);
}

export function kanbanColumnClass(className = ''): string {
	return cn(
		// Narrow: fixed column width + board scrolls horizontally.
		'flex h-full min-h-[24rem] w-72 min-w-64 shrink-0 snap-start flex-col border border-border bg-surface',
		// Wide: share the row and fill available width.
		'lg:w-auto lg:min-w-0 lg:flex-1 lg:shrink',
		className
	);
}

export function kanbanColumnHeaderClass(className = ''): string {
	return cn(
		'flex items-center justify-between gap-2 border-b border-border px-3 py-2.5',
		className
	);
}

export const kanbanColumnTitleClass = 'truncate text-sm font-semibold text-foreground';

export const kanbanColumnHeaderActionsClass = 'flex shrink-0 items-center gap-2';

export function kanbanColumnBodyClass(isDropTarget = false, className = ''): string {
	return cn(
		'flex flex-1 flex-col gap-2 overflow-y-auto p-2 transition-colors',
		isDropTarget && 'bg-muted/30 ring-2 ring-inset ring-primary/40',
		className
	);
}

export const kanbanColumnEmptyClass =
	'flex flex-1 items-center justify-center px-3 py-8 text-sm text-muted-foreground';

export function kanbanCardClass(
	options: {
		isDragging?: boolean;
		isDropIndicator?: boolean;
		disabled?: boolean;
		className?: string;
	} = {}
): string {
	const { isDragging = false, isDropIndicator = false, disabled = false, className = '' } = options;

	return cn(
		'w-full border border-border bg-background p-3 text-left transition-opacity',
		'focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none',
		!disabled && 'cursor-grab select-none active:cursor-grabbing',
		disabled && 'cursor-default opacity-60',
		isDragging && 'opacity-40',
		isDropIndicator && 'ring-2 ring-primary/40',
		className
	);
}

export const kanbanCardTitleRowClass = 'flex items-start justify-between gap-2';

export const kanbanCardTitleClass = 'min-w-0 flex-1 text-sm font-semibold text-foreground';

export const kanbanCardSubtitleClass = 'mt-0.5 text-xs text-muted-foreground';

export const kanbanCardBadgesClass = 'flex shrink-0 flex-col items-end gap-1';

export const kanbanCardFieldsClass = 'mt-2 flex flex-col gap-1';

export const kanbanCardFieldClass = 'text-sm text-muted-foreground';

export const kanbanCardFieldLabelClass = 'text-foreground';
