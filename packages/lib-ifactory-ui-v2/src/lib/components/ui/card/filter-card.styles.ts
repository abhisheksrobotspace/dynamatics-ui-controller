import { cn } from '$lib/utils/cn';

/** Min-width (px) where the wide/single-row column count applies. Must be a known literal for Tailwind. */
export type FilterCardStripBreakpoint = 1025 | 1281 | 1441;

export type FilterCardStripLayout = {
	/** Columns below `wideMinWidth`. Default 3. */
	columns?: number;
	/** Columns at/above `wideMinWidth`. Default 5 (legacy); prefer passing item count. */
	wideColumns?: number;
	/**
	 * Viewport min-width for the wide layout. Default 1441 → ≤1440px uses `columns`.
	 * Allowed: 1025 | 1281 | 1441 (Tailwind needs static class strings).
	 */
	wideMinWidth?: FilterCardStripBreakpoint;
};

const BASE_COLS: Record<number, string> = {
	1: 'grid-cols-1',
	2: 'grid-cols-2',
	3: 'grid-cols-3',
	4: 'grid-cols-4',
	5: 'grid-cols-5',
	6: 'grid-cols-6'
};

/** Full literals so Tailwind JIT keeps them (do not concatenate prefixes). */
const WIDE_COLS: Record<FilterCardStripBreakpoint, Record<number, string>> = {
	1025: {
		1: 'min-[1025px]:grid-cols-1',
		2: 'min-[1025px]:grid-cols-2',
		3: 'min-[1025px]:grid-cols-3',
		4: 'min-[1025px]:grid-cols-4',
		5: 'min-[1025px]:grid-cols-5',
		6: 'min-[1025px]:grid-cols-6'
	},
	1281: {
		1: 'min-[1281px]:grid-cols-1',
		2: 'min-[1281px]:grid-cols-2',
		3: 'min-[1281px]:grid-cols-3',
		4: 'min-[1281px]:grid-cols-4',
		5: 'min-[1281px]:grid-cols-5',
		6: 'min-[1281px]:grid-cols-6'
	},
	1441: {
		1: 'min-[1441px]:grid-cols-1',
		2: 'min-[1441px]:grid-cols-2',
		3: 'min-[1441px]:grid-cols-3',
		4: 'min-[1441px]:grid-cols-4',
		5: 'min-[1441px]:grid-cols-5',
		6: 'min-[1441px]:grid-cols-6'
	}
};

const WIDE_BORDER_R: Record<FilterCardStripBreakpoint, string> = {
	1025: 'min-[1025px]:border-r',
	1281: 'min-[1281px]:border-r',
	1441: 'min-[1441px]:border-r'
};

const WIDE_BORDER_R_0: Record<FilterCardStripBreakpoint, string> = {
	1025: 'min-[1025px]:border-r-0',
	1281: 'min-[1281px]:border-r-0',
	1441: 'min-[1441px]:border-r-0'
};

const WIDE_BORDER_T_0: Record<FilterCardStripBreakpoint, string> = {
	1025: 'min-[1025px]:border-t-0',
	1281: 'min-[1281px]:border-t-0',
	1441: 'min-[1441px]:border-t-0'
};

function clampCols(n: number): number {
	return Math.min(6, Math.max(1, Math.round(n)));
}

function resolveLayout(layout: FilterCardStripLayout = {}): Required<FilterCardStripLayout> {
	return {
		columns: clampCols(layout.columns ?? 3),
		wideColumns: clampCols(layout.wideColumns ?? 5),
		wideMinWidth: layout.wideMinWidth ?? 1441
	};
}

/**
 * Strip grid classes from layout props.
 * Default: 3 cols at ≤1440px; `wideColumns` in one row from 1441px up.
 */
export function filterCardStripClassFor(
	itemCountOrLayout: number | FilterCardStripLayout = 5
): string {
	const layout =
		typeof itemCountOrLayout === 'number'
			? resolveLayout({ wideColumns: itemCountOrLayout })
			: resolveLayout(itemCountOrLayout);

	return cn(
		'grid border border-border bg-white',
		BASE_COLS[layout.columns],
		WIDE_COLS[layout.wideMinWidth][layout.wideColumns]
	);
}

/** @deprecated Prefer `filterCardStripClassFor({ wideColumns })` — defaults to 5-wide / 3-compact. */
export const filterCardStripClass = filterCardStripClassFor({ columns: 3, wideColumns: 5 });

/**
 * Responsive dividers matching `filterCardStripClassFor` layout.
 * Pass the same `{ columns, wideColumns, wideMinWidth }` as the strip.
 */
export function filterCardCellClass(
	index: number,
	wideColumnsOrLayout: number | FilterCardStripLayout = 5
): string {
	const layout =
		typeof wideColumnsOrLayout === 'number'
			? resolveLayout({ wideColumns: wideColumnsOrLayout })
			: resolveLayout(wideColumnsOrLayout);

	const { columns, wideColumns, wideMinWidth } = layout;
	const compactEnd = (index + 1) % columns === 0;
	const wideEnd = (index + 1) % wideColumns === 0;
	const compactFirstRow = index < columns;
	const wideFirstRow = index < wideColumns;

	return cn(
		!compactEnd && 'border-r',
		compactEnd && !wideEnd && WIDE_BORDER_R[wideMinWidth],
		!compactEnd && wideEnd && WIDE_BORDER_R_0[wideMinWidth],
		!compactFirstRow && 'border-t',
		!compactFirstRow && wideFirstRow && WIDE_BORDER_T_0[wideMinWidth]
	);
}

export function filterCardButtonClass(selected: boolean, className = '', clickable = true): string {
	return cn(
		'border-border px-6 py-5 text-left',
		clickable && 'cursor-pointer transition-colors',
		!clickable && 'cursor-default',
		clickable && selected ? 'bg-orange-50' : '',
		clickable && !selected ? 'hover:bg-slate-50' : '',
		className
	);
}
