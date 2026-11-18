import { cn } from '$lib/utils/cn';
import type {
	RowTone,
	TableRowVariant,
	TableShellVariant,
	TableTheadVariant
} from './table.constants';

export type TableShellOverflowMode = 'hidden' | 'sticky-page';

export function tableShellClasses(
	variant: TableShellVariant,
	className = '',
	overflow: TableShellOverflowMode = 'hidden'
): string {
	return cn(
		'bg-surface text-foreground',
		overflow === 'sticky-page'
			? 'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden'
			: 'overflow-hidden',
		{
			'border border-border': variant === 'structured',
			'border border-border shadow-sm': variant === 'card',
			'': variant === 'plain'
		},
		className
	);
}

/** Sticky header cells — opaque bg so rows do not show through while scrolling. */
export const tableStickyHeaderClass = 'sticky z-10 bg-[#F2F2F2]';
export const tableStickyHeaderTopClass = 'top-0';

/** Pinned left during horizontal scroll (body cells). */
export const tableStickyColumnBodyClass = 'sticky z-[2] bg-surface';
/** Pinned left on header row only. */
export const tableStickyColumnHeadClass = 'sticky z-[11] bg-[#F2F2F2]';
/** @deprecated Prefer {@link tableStickyColumnHeadClass} + inline `top` from row offsets. */
export const tableStickyColumnCornerClass = 'sticky z-[20] bg-[#F2F2F2]';
export const tableStickyColumnShadowClass = 'border-r border-border/70';
/** Divider for columns pinned on the right. */
export const tableStickyColumnShadowRightClass = 'border-l border-border/70';
/** Sticky + collapse shares borders with scrolling neighbors, so the divider moves. */
export const tableStickyColumnsTableClass = 'border-separate border-spacing-0';

export function tableScrollWrapClasses(options?: {
	stickyHeader?: boolean;
	maxHeight?: string;
}): string {
	if (options?.maxHeight) {
		// overflow-anchor:none — row enable/disable (e.g. date inputs) must not jump scroll
		return 'min-w-0 max-w-full overflow-auto [overflow-anchor:none]';
	}
	if (options?.stickyHeader) {
		// flex-1 — fills the page so the pagination footer sits at the bottom, not under the last row
		return 'min-h-0 min-w-0 max-w-full flex-1 overflow-auto [overflow-anchor:none]';
	}
	return 'min-w-0 max-w-full overflow-x-auto [overflow-anchor:none]';
}

export function tableTheadClasses(_variant: TableTheadVariant, className = ''): string {
	return cn('bg-[#F2F2F2]', className);
}

export function rowToneClasses(tone?: RowTone): string {
	return cn({
		'bg-surface': !tone || tone === 'offline',
		'bg-status-online-bg': tone === 'online',
		'bg-status-loading-bg': tone === 'loading',
		'bg-status-error-bg': tone === 'error'
	});
}

/**
 * Row background class that combines tone (status colour) and stripe variant.
 *
 * Priority:
 * 1. Semantic `tone` (online / loading / error) — always wins.
 * 2. `rowVariant === 'striped'` — alternates `bg-surface` / `bg-surface-alt` by index.
 * 3. Default — `bg-surface` (or `bg-surface` for `offline`).
 *
 * Pass this to both the `<tr>` class **and** the sticky `<td>` baseClass so that
 * opaque sticky cells inherit the correct stripe colour (twMerge overrides `bg-surface`).
 */
export function rowBgClasses(
	tone?: RowTone,
	rowVariant: TableRowVariant = 'default',
	rowIndex = 0
): string {
	// Semantic status tones override the stripe for that row
	if (tone && tone !== 'offline') {
		return rowToneClasses(tone);
	}
	if (rowVariant === 'striped') {
		return rowIndex % 2 === 1 ? 'bg-surface-alt' : 'bg-surface';
	}
	return rowToneClasses(tone);
}

export const tableHeaderBlockClass = 'sm:flex sm:items-center';
export const tableTitleClass = 'text-base font-semibold text-foreground';
export const tableDescriptionClass = 'mt-2 text-sm text-muted-foreground';
export const tableToolbarClass = 'mt-4 sm:mt-0 sm:ml-16 sm:flex-none';

export const tableScrollWrapClass = 'min-w-0 max-w-full overflow-x-auto';

export const tableElementClass = 'relative w-max min-w-full';
export const tableHeaderCellClass =
	'whitespace-nowrap border-b border-border px-3 py-1.5 text-left text-sm font-medium tracking-wide text-muted-foreground';
export const tableHeaderCellCardClass =
	'whitespace-nowrap border-b border-border px-3 py-1.5 text-left text-sm font-medium text-foreground';
export const tableSortButtonClass =
	'inline-flex items-center gap-1.5 whitespace-nowrap transition-colors hover:text-foreground';
export const tableBodyClass = '';
export const tableRowClass = 'border-b border-border';
export const tableClickableRowClass =
	'cursor-pointer transition-colors hover:bg-foreground/[0.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary/40';
export const tableCellClass =
	'whitespace-nowrap border-b border-border px-3 py-2 text-sm font-medium text-foreground';
export const tableCellCardClass =
	'whitespace-nowrap border-b border-border px-3 py-2 text-sm text-foreground';
export const tableSelectionCellClass =
	'w-10 min-w-10 max-w-10 cursor-pointer border-b border-border px-2 text-center';
export const tableSelectionHeaderCellClass =
	'w-10 min-w-10 max-w-10 border-b border-border px-2 text-center';

/** Single-select control: empty circle, filled primary when selected. */
export function tableRowRadioClass(checked: boolean, disabled: boolean): string {
	return cn(
		'relative inline-flex size-4 shrink-0 rounded-full border bg-surface',
		checked
			? 'border-primary after:pointer-events-none after:absolute after:inset-0.5 after:rounded-full after:bg-primary after:content-[""]'
			: 'border-muted-foreground/70',
		'focus-within:ring-2 focus-within:ring-primary/40',
		disabled && 'cursor-not-allowed opacity-50'
	);
}
export const tableSerialColumnClass = 'w-24 min-w-24 max-w-24 tabular-nums';
export const tableMetricBarCellInnerClass = 'flex flex-nowrap items-center gap-4';

export function tableActionsCellInnerClass(align: 'start' | 'center' | 'end' = 'end'): string {
	// inline-flex + ml-auto: wrapper is only as wide as the controls so empty
	// Actions-cell padding hits the <tr> and can fire onRowClick.
	// Do not use pointer-events-none here — it eats button clicks when
	// pointer-events-auto fails to land on the control (Replan/View break).
	return cn('inline-flex flex-nowrap items-center gap-2', {
		'justify-start': align === 'start',
		'mx-auto justify-center': align === 'center',
		'ml-auto justify-end': align === 'end'
	});
}

export function tableInputInnerClass(align: 'start' | 'center' | 'end' = 'start'): string {
	return cn('flex min-w-[4.5rem] max-w-[8rem]', {
		'justify-start': align === 'start',
		'justify-center mx-auto': align === 'center',
		'justify-end ml-auto': align === 'end'
	});
}

export const tableInputClass = 'rounded-none text-center tabular-nums';

const TABLE_SKELETON_LONG_WIDTHS = [
	'w-52',
	'w-40',
	'w-56',
	'w-36',
	'w-48',
	'w-44',
	'w-32',
	'w-60'
] as const;
const TABLE_SKELETON_SHORT_WIDTHS = [
	'w-20',
	'w-14',
	'w-24',
	'w-12',
	'w-16',
	'w-28',
	'w-10',
	'w-18'
] as const;
const TABLE_SKELETON_TREE_LABEL_WIDTHS = ['w-52', 'w-44', 'w-36', 'w-48'] as const;
const TABLE_SKELETON_TREE_LEAF_WIDTHS = ['w-28', 'w-24', 'w-20', 'w-32'] as const;

export function tableSkeletonBarClass(rowIndex: number, columnIndex: number): string {
	const widths = columnIndex <= 1 ? TABLE_SKELETON_LONG_WIDTHS : TABLE_SKELETON_SHORT_WIDTHS;
	const width = widths[(rowIndex + columnIndex * 3) % widths.length];
	return cn('h-4 max-w-full rounded-full', width);
}

export function tableSkeletonTreeLabelClass(depth: number, rowIndex: number): string {
	const widths = depth < 2 ? TABLE_SKELETON_TREE_LABEL_WIDTHS : TABLE_SKELETON_TREE_LEAF_WIDTHS;
	const width = widths[(rowIndex + depth) % widths.length];
	return cn('h-4 max-w-full rounded-full', width, depth === 0 && 'h-[1.125rem]');
}

export const tableSkeletonCircleClass = 'size-4 rounded-full';
export const tableSkeletonSelectionClass = 'size-4 rounded-sm';
export const tableSkeletonBadgeClass = 'h-5 w-20 max-w-full rounded-full';
export const tableSkeletonMultiBadgeClass = 'flex min-w-0 max-w-full flex-col gap-1.5';
export const tableSkeletonMultiBadgeLabelClass = 'h-4 w-28 max-w-full rounded-full';
export const tableSkeletonMultiBadgeChipClass = 'h-5 max-w-full rounded-sm';
const TABLE_SKELETON_MULTI_BADGE_CHIP_WIDTHS = ['w-36', 'w-28', 'w-24'] as const;

export function tableSkeletonMultiBadgeChipWidth(index: number): string {
	return TABLE_SKELETON_MULTI_BADGE_CHIP_WIDTHS[
		index % TABLE_SKELETON_MULTI_BADGE_CHIP_WIDTHS.length
	];
}
export const tableSkeletonInputClass = 'h-8 w-full max-w-full rounded-sm';
export const tableSkeletonMetricLabelClass = 'h-4 w-12 max-w-full rounded-full';
export const tableSkeletonMetricBarClass = 'h-3 w-40 max-w-full rounded-full';
export const tableSkeletonActionButtonClass = 'h-6 w-24 max-w-full shrink-0 rounded-sm';
export const tableSkeletonActionIconButtonClass = 'size-6 shrink-0 rounded-sm';
export const tableSkeletonActionChipClass = 'h-6 w-12 max-w-full shrink-0 rounded-sm';
export const tableSkeletonLeadingClass = 'h-4 w-[6.5rem] max-w-full rounded-full';
export const tableSkeletonActionIconClass = 'size-4 text-muted-foreground/50';
export const tableSkeletonExpandIconClass = 'size-4 text-muted-foreground/40';
export const tableSkeletonTreeInnerClass = 'flex min-w-0 items-center gap-1';
export const tableSkeletonExpandButtonClass =
	'inline-flex size-6 shrink-0 items-center justify-center';
export const tableSkeletonExpandSpacerClass = 'inline-block size-6 shrink-0';

export function tableSkeletonIndentStyle(depth: number): string {
	return `padding-left: ${depth * 1.25}rem`;
}
