/**
 * Horizontal sticky columns — cells stay pinned on the left or right while the table scrolls sideways.
 */

import { cn } from '$lib/utils/cn';
import {
	tableStickyColumnBodyClass,
	tableStickyColumnHeadClass,
	tableStickyColumnShadowClass,
	tableStickyColumnShadowRightClass
} from './table.styles';

export const STICKY_SELECTION_SLOT = '__selection__';

export type StickyColumnSide = 'left' | 'right';

/** `true` means left (legacy). Prefer `'left' | 'right'`. */
export type StickyColumnProp = boolean | StickyColumnSide;

export type StickyColumnOffsets = {
	left: Record<string, number>;
	right: Record<string, number>;
};

export function stickySelectionSlot(): string {
	return STICKY_SELECTION_SLOT;
}

export function isColumnSticky(sticky?: StickyColumnProp): sticky is true | StickyColumnSide {
	return sticky === true || sticky === 'left' || sticky === 'right';
}

export function resolveStickySide(sticky?: StickyColumnProp): StickyColumnSide | null {
	if (sticky === true || sticky === 'left') return 'left';
	if (sticky === 'right') return 'right';
	return null;
}

/** Pin this many leading leaf columns on the left when they omit `sticky`. */
export const DEFAULT_STICKY_LEADING_COLUMNS = 2;

type MaybeGroupedColumn<T> = T & {
	sticky?: StickyColumnProp;
	columns?: MaybeGroupedColumn<T>[];
};

/**
 * Apply left sticky to the first `count` leaf columns that do not set `sticky`.
 * Explicit `sticky` (including `'right'` / `false`) is left alone.
 * Nested group columns are walked so only leaves are counted.
 */
export function withStickyLeadingColumns<T extends { sticky?: StickyColumnProp }>(
	columns: readonly T[],
	count: number = DEFAULT_STICKY_LEADING_COLUMNS
): T[] {
	if (count <= 0) return columns as T[];

	let leafIndex = 0;

	function mapColumn(column: MaybeGroupedColumn<T>): MaybeGroupedColumn<T> {
		if (Array.isArray(column.columns) && column.columns.length > 0) {
			return { ...column, columns: column.columns.map(mapColumn) };
		}

		if (column.sticky !== undefined) {
			leafIndex += 1;
			return column;
		}

		const next = leafIndex < count ? { ...column, sticky: true as const } : column;
		leafIndex += 1;
		return next;
	}

	return columns.map((column) => mapColumn(column as MaybeGroupedColumn<T>)) as T[];
}

export function tableHasStickyColumns(
	columns: ReadonlyArray<{ sticky?: StickyColumnProp }>,
	options: {
		selectionEnabled?: boolean;
		stickySelectionColumn?: boolean;
		stickyLeadingColumns?: number;
	} = {}
): boolean {
	const {
		selectionEnabled = false,
		stickySelectionColumn = true,
		stickyLeadingColumns = 0
	} = options;
	const resolved =
		stickyLeadingColumns > 0 ? withStickyLeadingColumns(columns, stickyLeadingColumns) : columns;
	return (
		resolved.some((column) => isColumnSticky(column.sticky)) ||
		(Boolean(selectionEnabled) && stickySelectionColumn)
	);
}

function measureSideOffsets(
	stickyCells: HTMLTableCellElement[],
	side: StickyColumnSide
): Record<string, number> {
	if (stickyCells.length === 0) return {};

	const cellBySlot = new Map<string, HTMLTableCellElement>();
	for (const cell of stickyCells) {
		const slot = cell.getAttribute('data-sticky-col');
		if (!slot) continue;
		const existing = cellBySlot.get(slot);
		if (!existing || cell.getBoundingClientRect().width > existing.getBoundingClientRect().width) {
			cellBySlot.set(slot, cell);
		}
	}

	const uniqueCells = Array.from(cellBySlot.values()).sort((a, b) => {
		const aRect = a.getBoundingClientRect();
		const bRect = b.getBoundingClientRect();
		return side === 'left' ? aRect.left - bRect.left : bRect.right - aRect.right;
	});

	const offsets: Record<string, number> = {};
	let inset = 0;
	for (const cell of uniqueCells) {
		const slot = cell.getAttribute('data-sticky-col');
		if (!slot) continue;
		offsets[slot] = inset;
		inset += cell.getBoundingClientRect().width;
	}
	return offsets;
}

/** Measure sticky header cells and return cumulative `left` / `right` offsets by slot id. */
export function bindStickyColumnOffsets(
	table: HTMLTableElement,
	onChange: (offsets: StickyColumnOffsets) => void
): () => void {
	let raf = 0;

	const measure = () => {
		raf = 0;
		const head = table.tHead;
		if (!head) return;

		const leftCells = Array.from(
			head.querySelectorAll<HTMLTableCellElement>('th[data-sticky-col][data-sticky-side="left"]')
		);
		const rightCells = Array.from(
			head.querySelectorAll<HTMLTableCellElement>('th[data-sticky-col][data-sticky-side="right"]')
		);

		// Legacy markup without data-sticky-side — treat as left.
		const legacyCells = Array.from(
			head.querySelectorAll<HTMLTableCellElement>('th[data-sticky-col]:not([data-sticky-side])')
		);

		onChange({
			left: measureSideOffsets([...leftCells, ...legacyCells], 'left'),
			right: measureSideOffsets(rightCells, 'right')
		});
	};

	const schedule = () => {
		if (raf) return;
		raf = requestAnimationFrame(measure);
	};

	const observer = new ResizeObserver(schedule);
	observer.observe(table);
	if (table.tHead) observer.observe(table.tHead);
	window.addEventListener('resize', schedule);
	schedule();

	return () => {
		observer.disconnect();
		window.removeEventListener('resize', schedule);
		if (raf) cancelAnimationFrame(raf);
	};
}

/** @deprecated Prefer {@link bindStickyColumnOffsets}. */
export function bindStickyColumnLeftOffsets(
	table: HTMLTableElement,
	onChange: (offsets: Record<string, number>) => void
): () => void {
	return bindStickyColumnOffsets(table, (offsets) => onChange(offsets.left));
}

export function stickyColumnInsetStyle(
	slot: string,
	side: StickyColumnSide,
	offsets: StickyColumnOffsets,
	headerTopPx?: number
): string | undefined {
	const sideOffsets = offsets[side];
	const parts: string[] = [];
	if (slot in sideOffsets) {
		parts.push(`${side}: ${sideOffsets[slot]}px`);
	} else if (Object.keys(sideOffsets).length === 0) {
		// Before the first measure pass, pin at 0 so nested group headers stick immediately.
		parts.push(`${side}: 0px`);
	}
	if (headerTopPx !== undefined) parts.push(`top: ${headerTopPx}px`);
	return parts.length > 0 ? parts.join('; ') : undefined;
}

/** @deprecated Prefer {@link stickyColumnInsetStyle}. */
export function stickyColumnLeftStyle(
	slot: string,
	offsets: Record<string, number>,
	headerTopPx?: number
): string | undefined {
	return stickyColumnInsetStyle(slot, 'left', { left: offsets, right: {} }, headerTopPx);
}

export function stickyHeaderCellClasses(
	stickyHeader: boolean,
	stickyColumn: boolean,
	extra = '',
	side: StickyColumnSide = 'left'
): string {
	if (stickyColumn) {
		return cn(
			extra,
			tableStickyColumnHeadClass,
			side === 'right' ? tableStickyColumnShadowRightClass : tableStickyColumnShadowClass,
			stickyHeader && 'z-[20]'
		);
	}
	return extra;
}

export function stickyBodyCellClasses(
	stickyColumn: boolean,
	extra = '',
	side: StickyColumnSide = 'left'
): string {
	if (!stickyColumn) return extra;
	// Sticky defaults first so caller `extra` (e.g. row highlight bg) wins via twMerge.
	return cn(
		tableStickyColumnBodyClass,
		side === 'right' ? tableStickyColumnShadowRightClass : tableStickyColumnShadowClass,
		extra
	);
}
