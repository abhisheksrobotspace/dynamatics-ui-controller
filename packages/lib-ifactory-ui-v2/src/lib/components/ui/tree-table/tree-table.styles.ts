import { cn } from '$lib/utils/cn';
import {
	tableSerialColumnClass,
	tableShellClasses,
	tableScrollWrapClasses
} from '../table/table.styles';

export function treeTableShellClasses(className = '', stickyHeader = false) {
	return cn(
		tableShellClasses('structured', className, stickyHeader ? 'sticky-page' : 'hidden'),
		'rounded-none'
	);
}

export const treeTableShellClass = treeTableShellClasses();
export function treeTableScrollWrapClasses(options?: {
	stickyHeader?: boolean;
	maxHeight?: string;
}): string {
	return tableScrollWrapClasses(options);
}
export const treeTableScrollWrapClass = treeTableScrollWrapClasses();
export const treeTableElementClass = 'relative w-max min-w-full';
export const treeTableTheadClass = 'bg-[#F2F2F2]';
export const treeTableHeaderCellClass =
	'whitespace-nowrap border-b border-border px-3 py-1.5 text-left text-sm font-medium tracking-wide text-muted-foreground';
export const treeTableHeaderGroupCellClass =
	'whitespace-nowrap border-b border-border px-3 py-1.5 text-center text-sm font-medium tracking-wide text-muted-foreground';
export const treeTableBodyClass = '';
export const treeTableRowClass =
	'border-b border-border transition-colors hover:bg-foreground/[0.03]';
export const treeTableCellClass =
	'whitespace-nowrap border-b border-border px-3 py-2 text-sm text-foreground';
/** Absorb leftover table width so measure columns stay content-sized. */
export const treeTableTreeColumnClass = 'w-full';
/** Shrink-wrap Qty / Weight / actions so extra width does not sit between them. */
export const treeTableCompactColumnClass = 'w-px';
export const treeTableSerialColumnClass = tableSerialColumnClass;
export const treeTableTreeCellInnerClass = 'flex w-full min-w-0 items-center gap-1';
export const treeTableExpandButtonClass =
	'inline-flex size-6 shrink-0 items-center justify-center rounded-none text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary/40';
export const treeTableExpandSpacerClass = 'inline-block size-6 shrink-0';
export const treeTableLabelClass = 'min-w-0 truncate text-foreground';
export const treeTableParentLabelClass = 'min-w-0 truncate font-medium text-foreground';
/** Label + expand control — grows so trailing can sit at the cell’s right edge. */
export const treeTableTreeLabelRowClass = 'flex min-w-0 flex-1 items-center gap-1';

export const treeTableGroupHeaderRowClass = 'border-b border-border bg-[#FFF1E8]';
export const treeTableGroupHeaderCellClass =
	'border-b border-border px-3 py-1.5 text-left text-sm font-semibold text-foreground';
export const treeTableGroupFooterRowClass = 'border-b border-border bg-[#F7F7F8]';
export const treeTableGroupFooterCellClass =
	'border-b border-border px-3 py-2 text-right text-sm font-medium text-foreground';
export const treeTableDetailRowClass = 'border-b border-border bg-[#FAFAFA]';
export const treeTableDetailCellClass = 'border-b border-border px-3 py-1.5';
export const treeTableDetailListClass =
	'space-y-1 pl-10 text-sm text-muted-foreground bg-[#FAFAFA]';
export const treeTableDetailItemClass = 'leading-5 bg-[#FAFAFA]';
export const treeTableFooterRowClass = 'border-t border-border bg-[#EEF2F6]';
export const treeTableFooterCellClass =
	'px-3 py-2 text-right text-sm font-semibold text-foreground';

export function treeTableIndentStyle(depth: number): string {
	return `padding-left: ${depth * 1.25}rem`;
}

export function treeTableActionsInnerClass(align: 'start' | 'center' | 'end' = 'start'): string {
	// Shrink-wrap only — no pointer-events-none (same as tableActionsCellInnerClass).
	return cn('inline-flex flex-nowrap items-center gap-2', {
		'justify-start': align === 'start',
		'mx-auto justify-center': align === 'center',
		'ml-auto justify-end': align === 'end'
	});
}

export function treeTableInputInnerClass(align: 'start' | 'center' | 'end' = 'start'): string {
	return cn('flex min-w-[4.5rem] max-w-[8rem]', {
		'justify-start': align === 'start',
		'justify-center mx-auto': align === 'center',
		'justify-end ml-auto': align === 'end'
	});
}

export const treeTableInputClass = 'rounded-none text-center tabular-nums';
