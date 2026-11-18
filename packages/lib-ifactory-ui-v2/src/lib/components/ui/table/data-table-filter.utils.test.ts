import { describe, expect, it } from 'vitest';
import {
	applyColumnFilters,
	buildAppliedColumnFilter,
	collectUniqueColumnValues,
	isColumnFilterActive,
	matchesColumnCondition,
	matchesColumnFilter,
	upsertColumnFilter
} from './data-table-filter.utils';
import type { ColumnFilterConditionOperator, DataTableColumn } from './data-table.constants';

type Row = {
	name: string;
	status: string;
	qty: number;
	syncedAt: string;
};

const columns: DataTableColumn<Row>[] = [
	{ key: 'name', header: 'Name', value: (row) => row.name },
	{ key: 'status', header: 'Status', value: (row) => row.status },
	{ key: 'qty', header: 'Qty', dataType: 'number', value: (row) => String(row.qty) },
	{ key: 'syncedAt', header: 'Synced', dataType: 'date', value: (row) => row.syncedAt }
];

const rows: Row[] = [
	{ name: 'Alpha', status: 'Open', qty: 10, syncedAt: '2026-07-01' },
	{ name: 'Beta', status: 'Done', qty: 5, syncedAt: '2026-07-03' },
	{ name: 'Gamma', status: '-', qty: 20, syncedAt: '2026-07-02' },
	{ name: 'Delta', status: 'Open', qty: 15, syncedAt: '2026-07-04' }
];

describe('data-table-filter.utils', () => {
	it('collects unique values with blanks first', () => {
		const values = collectUniqueColumnValues(rows, columns[1]!);
		expect(values[0]).toBe('');
		expect(values).toContain('Open');
		expect(values).toContain('Done');
	});

	it('filters by selected values', () => {
		const filtered = applyColumnFilters(rows, columns, {
			status: { selectedValues: ['Open'] }
		});
		expect(filtered.map((row) => row.name)).toEqual(['Alpha', 'Delta']);
	});

	it('ANDs multiple column filters', () => {
		const filtered = applyColumnFilters(rows, columns, {
			status: { selectedValues: ['Open'] },
			qty: { condition: { operator: 'greater_than', value: '12' } }
		});
		expect(filtered.map((row) => row.name)).toEqual(['Delta']);
	});

	it('ANDs value filter with condition on the same column', () => {
		const filtered = applyColumnFilters(rows, columns, {
			name: {
				selectedValues: ['Alpha', 'Beta', 'Delta'],
				condition: { operator: 'starts_with', value: 'A' }
			}
		});
		expect(filtered.map((row) => row.name)).toEqual(['Alpha']);
	});

	it('treats blanks as empty for value filters', () => {
		const filtered = applyColumnFilters(rows, columns, {
			status: { selectedValues: [''] }
		});
		expect(filtered.map((row) => row.name)).toEqual(['Gamma']);
	});

	it.each([
		['contains', 'prod', 'Production', true],
		['contains', 'prod', 'Breakdown', false],
		['not_contains', 'prod', 'Breakdown', true],
		['equals', 'Open', 'Open', true],
		['equals', 'Open', 'open', true],
		['not_equals', 'Open', 'Done', true],
		['starts_with', 'Al', 'Alpha', true],
		['ends_with', 'ta', 'Beta', true],
		['is_empty', '', '', true],
		['is_empty', '', 'Open', false],
		['is_not_empty', '', 'Open', true]
	] as const)('text condition %s("%s") on "%s"', (operator, query, value, expected) => {
		expect(
			matchesColumnCondition(value, {
				operator: operator as ColumnFilterConditionOperator,
				value: query
			})
		).toBe(expected);
	});

	it('filters by number comparison', () => {
		expect(
			matchesColumnFilter('15', { condition: { operator: 'greater_than', value: '10' } }, 'number')
		).toBe(true);
		expect(
			matchesColumnFilter('5', { condition: { operator: 'greater_than', value: '10' } }, 'number')
		).toBe(false);
		expect(
			matchesColumnFilter(
				'10',
				{ condition: { operator: 'greater_than_or_equal', value: '10' } },
				'number'
			)
		).toBe(true);
		expect(
			matchesColumnFilter('5', { condition: { operator: 'less_than', value: '10' } }, 'number')
		).toBe(true);
		expect(
			matchesColumnFilter(
				'10',
				{ condition: { operator: 'less_than_or_equal', value: '10' } },
				'number'
			)
		).toBe(true);
	});

	it('filters by date comparison', () => {
		const filtered = applyColumnFilters(rows, columns, {
			syncedAt: { condition: { operator: 'greater_than_or_equal', value: '2026-07-03' } }
		});
		expect(filtered.map((row) => row.name)).toEqual(['Beta', 'Delta']);
	});

	it('clears filter when all values selected and no condition', () => {
		const all = collectUniqueColumnValues(rows, columns[1]!);
		expect(buildAppliedColumnFilter(all, all, false, { operator: 'contains', value: '' })).toBe(
			null
		);
	});

	it('keeps partial value selection', () => {
		const all = collectUniqueColumnValues(rows, columns[1]!);
		const next = buildAppliedColumnFilter(['Open'], all, false, {
			operator: 'contains',
			value: ''
		});
		expect(next).toEqual({ selectedValues: ['Open'] });
	});

	it('keeps condition when conditions are enabled', () => {
		const all = collectUniqueColumnValues(rows, columns[1]!);
		const next = buildAppliedColumnFilter(all, all, true, {
			operator: 'contains',
			value: 'Open'
		});
		expect(next).toEqual({
			condition: { operator: 'contains', value: 'Open' }
		});
	});

	it('ignores empty condition value for operators that need a value', () => {
		const all = collectUniqueColumnValues(rows, columns[1]!);
		const next = buildAppliedColumnFilter(all, all, true, {
			operator: 'contains',
			value: '   '
		});
		expect(next).toBe(null);
	});

	it('keeps valueless condition operators', () => {
		const all = collectUniqueColumnValues(rows, columns[1]!);
		const next = buildAppliedColumnFilter(all, all, true, {
			operator: 'is_empty',
			value: ''
		});
		expect(next).toEqual({
			condition: { operator: 'is_empty', value: '' }
		});
	});

	it('upserts and clears column filters', () => {
		const withFilter = upsertColumnFilter({}, 'status', { selectedValues: ['Open'] });
		expect(isColumnFilterActive(withFilter.status)).toBe(true);

		const cleared = upsertColumnFilter(withFilter, 'status', null);
		expect(cleared).toEqual({});
	});

	it('returns original rows when no filters are active', () => {
		expect(applyColumnFilters(rows, columns, {})).toBe(rows);
	});
});
