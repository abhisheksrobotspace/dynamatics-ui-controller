export const columnFilterTriggerClass =
	'inline-flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary/40';

export function columnFilterTriggerActiveClass(active = false): string {
	return active ? 'text-primary hover:text-primary' : '';
}

export const columnFilterPanelClass =
	'fixed z-50 flex w-[22rem] flex-col overflow-hidden border border-border bg-surface text-foreground shadow-md outline-none';

export const columnFilterSectionClass = 'border-b border-border px-3 py-2';

export const columnFilterSectionTitleClass =
	'text-xs font-medium uppercase tracking-wide text-muted-foreground';

export const columnFilterConditionRowClass = 'mt-2 flex flex-col gap-2';

export const columnFilterSelectClass =
	'w-full border border-border bg-surface px-2 py-1.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/40';

export const columnFilterValuesListClass =
	'mt-2 max-h-48 space-y-1 overflow-y-auto overscroll-contain';

export const columnFilterValueRowClass =
	'flex w-full cursor-pointer items-center gap-2 rounded px-1 py-1 text-left text-sm text-foreground hover:bg-foreground/5';

export const columnFilterFooterClass =
	'flex items-center justify-end gap-2 border-t border-border px-3 py-2';

export const columnFilterHeaderCellClass = 'inline-flex items-center gap-1';
