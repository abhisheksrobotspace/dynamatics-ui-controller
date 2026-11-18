import { tableShellClasses } from './table.styles';

export function dataTableShellClasses(className = '', stickyHeader = false) {
	return tableShellClasses('structured', className, stickyHeader ? 'sticky-page' : 'hidden');
}

export const dataTableShellClass = tableShellClasses('structured');
/** Toolbar stays above the scrolling table body when stickyHeader is on. */
export const dataTableStickyToolbarClass = 'shrink-0 bg-surface';
export const dataTableToolbarClass =
	'flex items-center gap-3 border-b border-border bg-surface px-3 py-2';
export const dataTableToolbarActionsClass = 'ml-auto flex items-center gap-2';
export const dataTableStickyFooterClass = 'shrink-0 bg-surface';
export const dataTableFooterClass =
	'flex items-center justify-end gap-3 border-t border-border bg-surface px-3 py-2';
export const dataTableSearchClass = 'w-full max-w-xs';
export const dataTablePageSizeLabelClass =
	'text-sm font-medium tracking-wide text-muted-foreground';
export const dataTablePageSizeTriggerClass = 'h-7 min-w-[4.5rem] justify-between px-2 py-0 text-sm';
export const dataTablePageSizeMenuClass = 'min-w-[5rem]';
export const dataTablePageInfoClass = 'text-sm font-medium tracking-wide text-muted-foreground';
export const dataTableEmptyClass = 'px-3 py-4 text-center text-sm text-muted-foreground';
