import {
	COLUMN_FILTER_BLANK_LABEL,
	COLUMN_FILTER_BLANK_VALUE,
	type ColumnFilter,
	type ColumnFilterCondition,
	type ColumnFilterConditionOperator,
	type ColumnFiltersState,
	type DataTableColumn,
	type DataTableColumnDataType
} from './data-table.constants';
import { getRawCellValue, isEmptySortValue } from './data-table.utils';

export type ColumnFilterConditionOption = {
	value: ColumnFilterConditionOperator;
	label: string;
};

const TEXT_CONDITION_OPTIONS: ColumnFilterConditionOption[] = [
	{ value: 'contains', label: 'Contains' },
	{ value: 'not_contains', label: 'Does not contain' },
	{ value: 'equals', label: 'Equals' },
	{ value: 'not_equals', label: 'Does not equal' },
	{ value: 'starts_with', label: 'Starts with' },
	{ value: 'ends_with', label: 'Ends with' },
	{ value: 'is_empty', label: 'Is empty' },
	{ value: 'is_not_empty', label: 'Is not empty' }
];

const COMPARISON_CONDITION_OPTIONS: ColumnFilterConditionOption[] = [
	{ value: 'equals', label: 'Equals' },
	{ value: 'not_equals', label: 'Does not equal' },
	{ value: 'greater_than', label: 'Greater than' },
	{ value: 'greater_than_or_equal', label: 'Greater than or equal' },
	{ value: 'less_than', label: 'Less than' },
	{ value: 'less_than_or_equal', label: 'Less than or equal' },
	{ value: 'is_empty', label: 'Is empty' },
	{ value: 'is_not_empty', label: 'Is not empty' }
];

export function getConditionOptionsForDataType(
	dataType: DataTableColumnDataType = 'string'
): ColumnFilterConditionOption[] {
	if (dataType === 'number' || dataType === 'date') {
		return COMPARISON_CONDITION_OPTIONS;
	}

	return TEXT_CONDITION_OPTIONS;
}

export function normalizeFilterValue(value: unknown): string {
	if (isEmptySortValue(value)) {
		return COLUMN_FILTER_BLANK_VALUE;
	}

	return String(value);
}

export function formatFilterValueLabel(value: string): string {
	return value === COLUMN_FILTER_BLANK_VALUE ? COLUMN_FILTER_BLANK_LABEL : value;
}

export function getColumnFilterDisplayValue<T extends Record<string, unknown>>(
	row: T,
	column: DataTableColumn<T>
): string {
	return normalizeFilterValue(getRawCellValue(row, column));
}

export function collectUniqueColumnValues<T extends Record<string, unknown>>(
	rows: T[],
	column: DataTableColumn<T>
): string[] {
	const values = new Set<string>();

	for (const row of rows) {
		values.add(getColumnFilterDisplayValue(row, column));
	}

	return [...values].sort((left, right) => {
		if (left === COLUMN_FILTER_BLANK_VALUE) {
			return -1;
		}

		if (right === COLUMN_FILTER_BLANK_VALUE) {
			return 1;
		}

		return left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' });
	});
}

export function isConditionOperatorValueless(operator: ColumnFilterConditionOperator): boolean {
	return operator === 'is_empty' || operator === 'is_not_empty';
}

export function isColumnFilterActive(filter: ColumnFilter | undefined): boolean {
	if (!filter) {
		return false;
	}

	if (filter.selectedValues !== undefined) {
		return true;
	}

	return Boolean(filter.condition);
}

export function isColumnFiltersStateActive(state: ColumnFiltersState): boolean {
	return Object.values(state).some((filter) => isColumnFilterActive(filter));
}

function compareTypedValues(
	left: string,
	right: string,
	dataType: DataTableColumnDataType
): number {
	if (dataType === 'number') {
		return Number(left) - Number(right);
	}

	if (dataType === 'date') {
		return new Date(left).getTime() - new Date(right).getTime();
	}

	return left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' });
}

export function matchesColumnCondition(
	displayValue: string,
	condition: ColumnFilterCondition,
	dataType: DataTableColumnDataType = 'string'
): boolean {
	const isBlank = displayValue === COLUMN_FILTER_BLANK_VALUE;
	const normalizedValue = displayValue.toLowerCase();
	const query = condition.value.trim();
	const normalizedQuery = query.toLowerCase();

	switch (condition.operator) {
		case 'contains':
			return !isBlank && normalizedValue.includes(normalizedQuery);
		case 'not_contains':
			return isBlank || !normalizedValue.includes(normalizedQuery);
		case 'equals':
			if (dataType === 'string') {
				return normalizedValue === normalizedQuery;
			}
			return !isBlank && compareTypedValues(displayValue, query, dataType) === 0;
		case 'not_equals':
			if (dataType === 'string') {
				return normalizedValue !== normalizedQuery;
			}
			return isBlank || compareTypedValues(displayValue, query, dataType) !== 0;
		case 'starts_with':
			return !isBlank && normalizedValue.startsWith(normalizedQuery);
		case 'ends_with':
			return !isBlank && normalizedValue.endsWith(normalizedQuery);
		case 'is_empty':
			return isBlank;
		case 'is_not_empty':
			return !isBlank;
		case 'greater_than':
			return !isBlank && compareTypedValues(displayValue, query, dataType) > 0;
		case 'greater_than_or_equal':
			return !isBlank && compareTypedValues(displayValue, query, dataType) >= 0;
		case 'less_than':
			return !isBlank && compareTypedValues(displayValue, query, dataType) < 0;
		case 'less_than_or_equal':
			return !isBlank && compareTypedValues(displayValue, query, dataType) <= 0;
		default:
			return true;
	}
}

export function matchesColumnFilter(
	displayValue: string,
	filter: ColumnFilter,
	dataType: DataTableColumnDataType = 'string'
): boolean {
	if (filter.condition && !matchesColumnCondition(displayValue, filter.condition, dataType)) {
		return false;
	}

	if (filter.selectedValues !== undefined && !filter.selectedValues.includes(displayValue)) {
		return false;
	}

	return true;
}

export function applyColumnFilters<T extends Record<string, unknown>>(
	rows: T[],
	columns: DataTableColumn<T>[],
	filters: ColumnFiltersState
): T[] {
	const activeEntries = Object.entries(filters).filter(([, filter]) =>
		isColumnFilterActive(filter)
	);

	if (activeEntries.length === 0) {
		return rows;
	}

	const columnByKey = new Map(columns.map((column) => [column.key, column]));

	return rows.filter((row) =>
		activeEntries.every(([key, filter]) => {
			const column = columnByKey.get(key);
			if (!column) {
				return true;
			}

			const displayValue = getColumnFilterDisplayValue(row, column);
			return matchesColumnFilter(displayValue, filter, column.dataType ?? 'string');
		})
	);
}

export function buildAppliedColumnFilter(
	selectedValues: string[],
	allValues: string[],
	conditionEnabled: boolean,
	condition: ColumnFilterCondition
): ColumnFilter | null {
	const allSelected =
		allValues.length > 0 &&
		selectedValues.length === allValues.length &&
		allValues.every((value) => selectedValues.includes(value));

	const next: ColumnFilter = {};

	if (!allSelected) {
		next.selectedValues = [...selectedValues];
	}

	if (conditionEnabled) {
		const needsValue = !isConditionOperatorValueless(condition.operator);
		if (!needsValue || condition.value.trim().length > 0) {
			next.condition = {
				operator: condition.operator,
				value: needsValue ? condition.value : ''
			};
		}
	}

	if (next.selectedValues === undefined && next.condition === undefined) {
		return null;
	}

	return next;
}

export function upsertColumnFilter(
	state: ColumnFiltersState,
	columnKey: string,
	filter: ColumnFilter | null
): ColumnFiltersState {
	const next = { ...state };

	if (!filter) {
		delete next[columnKey];
		return next;
	}

	next[columnKey] = filter;
	return next;
}
