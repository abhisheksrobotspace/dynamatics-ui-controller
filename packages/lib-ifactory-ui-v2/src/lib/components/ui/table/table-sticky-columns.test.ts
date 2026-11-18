import { describe, expect, it } from 'vitest';
import {
	isColumnSticky,
	resolveStickySide,
	type StickyColumnProp,
	stickyColumnInsetStyle,
	stickyColumnLeftStyle,
	stickySelectionSlot,
	tableHasStickyColumns,
	withStickyLeadingColumns
} from './table-sticky-columns';

describe('tableHasStickyColumns', () => {
	it('is true when a column is marked sticky', () => {
		expect(tableHasStickyColumns([{ sticky: true }])).toBe(true);
	});

	it('is true when a column is sticky right', () => {
		expect(tableHasStickyColumns([{ sticky: 'right' }])).toBe(true);
	});

	it('is true when selection column should stick', () => {
		expect(tableHasStickyColumns([], { selectionEnabled: true, stickySelectionColumn: true })).toBe(
			true
		);
	});

	it('is false when nothing is sticky', () => {
		expect(tableHasStickyColumns([{}], { selectionEnabled: false })).toBe(false);
	});

	it('is true when leading columns are auto-stuck', () => {
		expect(
			tableHasStickyColumns([{}, {}], { selectionEnabled: false, stickyLeadingColumns: 2 })
		).toBe(true);
	});
});

describe('withStickyLeadingColumns', () => {
	it('pins the first two columns that omit sticky', () => {
		const next = withStickyLeadingColumns(
			[{ key: 'a' }, { key: 'b' }, { key: 'c', sticky: 'right' as const }],
			2
		);
		expect(next[0]?.sticky).toBe(true);
		expect(next[1]?.sticky).toBe(true);
		expect(next[2]?.sticky).toBe('right');
	});

	it('does not override explicit sticky false', () => {
		const next = withStickyLeadingColumns([{ key: 'a', sticky: false }, { key: 'b' }], 2);
		expect(next[0]?.sticky).toBe(false);
		expect(next[1]?.sticky).toBe(true);
	});

	it('counts nested leaf columns', () => {
		type TestColumn = { key: string; sticky?: StickyColumnProp; columns?: TestColumn[] };
		const columns: TestColumn[] = [
			{
				key: 'group',
				columns: [{ key: 'a' }, { key: 'b' }]
			},
			{ key: 'c' }
		];
		const next = withStickyLeadingColumns(columns, 2);
		expect(next[0]?.columns?.[0]?.sticky).toBe(true);
		expect(next[0]?.columns?.[1]?.sticky).toBe(true);
		expect(next[1]?.sticky).toBeUndefined();
	});
});

describe('resolveStickySide', () => {
	it('maps true and left to left', () => {
		expect(resolveStickySide(true)).toBe('left');
		expect(resolveStickySide('left')).toBe('left');
	});

	it('maps right to right', () => {
		expect(resolveStickySide('right')).toBe('right');
	});

	it('returns null when unset', () => {
		expect(resolveStickySide(undefined)).toBe(null);
		expect(isColumnSticky(undefined)).toBe(false);
	});
});

describe('stickyColumnLeftStyle', () => {
	it('returns left offset for a sticky slot', () => {
		expect(stickyColumnLeftStyle('label', { label: 48 })).toBe('left: 48px');
	});

	it('combines top and left for corner header cells', () => {
		expect(stickyColumnLeftStyle(stickySelectionSlot(), { __selection__: 0 }, 0)).toBe(
			'left: 0px; top: 0px'
		);
	});

	it('defaults left to 0 before the first measure pass', () => {
		expect(stickyColumnLeftStyle('name', {})).toBe('left: 0px');
	});
});

describe('stickyColumnInsetStyle', () => {
	it('returns right offset for a right sticky slot', () => {
		expect(stickyColumnInsetStyle('actions', 'right', { left: {}, right: { actions: 24 } })).toBe(
			'right: 24px'
		);
	});

	it('defaults right to 0 before the first measure pass', () => {
		expect(stickyColumnInsetStyle('actions', 'right', { left: {}, right: {} })).toBe('right: 0px');
	});
});
