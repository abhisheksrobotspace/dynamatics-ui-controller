import type { DataTableColumn, DataTableColumnDataType } from './data-table.constants';
import type { SortState } from './table.constants';

const EMPTY_SORT_VALUES = new Set(['', '-', 'n/a', 'na']);

export function defaultRowFilter<T extends Record<string, unknown>>(
	row: T,
	query: string,
	columns: DataTableColumn<T>[]
): boolean {
	const normalizedQuery = query.trim().toLowerCase();
	if (!normalizedQuery) {
		return true;
	}

	return columns.some((column) => {
		if (column.type === 'actions') {
			return false;
		}

		if (column.type === 'input') {
			return column.value(row).toLowerCase().includes(normalizedQuery);
		}

		if (column.type === 'badge') {
			return column.badge(row).label.toLowerCase().includes(normalizedQuery);
		}

		if (column.type === 'multi-badge') {
			const label = column.label?.(row) ?? '';
			const badges = column
				.badges(row)
				.map((badge) => badge.label)
				.join(' ');
			return `${label} ${badges}`.toLowerCase().includes(normalizedQuery);
		}

		if (column.type === 'metric-bar') {
			return (
				column.label(row).toLowerCase().includes(normalizedQuery) ||
				column.segments(row).join(' ').toLowerCase().includes(normalizedQuery)
			);
		}

		const value =
			'value' in column && typeof column.value === 'function' ? column.value(row) : row[column.key];
		return String(value ?? '')
			.toLowerCase()
			.includes(normalizedQuery);
	});
}

export function getRawCellValue<T extends Record<string, unknown>>(
	row: T,
	column: DataTableColumn<T>
): unknown {
	if (column.type === 'actions') {
		return '';
	}

	if (column.type === 'input') {
		return column.value(row);
	}

	if (column.type === 'badge') {
		return column.badge(row).label;
	}

	if (column.type === 'multi-badge') {
		if (typeof column.label === 'function') {
			return column.label(row) ?? '';
		}

		return column
			.badges(row)
			.map((badge) => badge.label)
			.join(', ');
	}

	if (column.type === 'metric-bar') {
		return column.label(row);
	}

	if ('value' in column && typeof column.value === 'function') {
		return column.value(row);
	}

	return row[column.key];
}

export function isEmptySortValue(value: unknown): boolean {
	if (value === null || value === undefined) {
		return true;
	}

	return EMPTY_SORT_VALUES.has(String(value).trim().toLowerCase());
}

function compareNonEmptyValues(
	left: unknown,
	right: unknown,
	dataType: DataTableColumnDataType
): number {
	switch (dataType) {
		case 'number': {
			const leftNumber = typeof left === 'number' ? left : Number(left);
			const rightNumber = typeof right === 'number' ? right : Number(right);
			return leftNumber - rightNumber;
		}
		case 'date': {
			const leftTime = new Date(String(left)).getTime();
			const rightTime = new Date(String(right)).getTime();
			return leftTime - rightTime;
		}
		default:
			return String(left).localeCompare(String(right), undefined, {
				numeric: true,
				sensitivity: 'base'
			});
	}
}

export function compareSortValues(
	left: unknown,
	right: unknown,
	dataType: DataTableColumnDataType,
	direction: 1 | -1
): number {
	const leftEmpty = isEmptySortValue(left);
	const rightEmpty = isEmptySortValue(right);

	if (leftEmpty && rightEmpty) {
		return 0;
	}

	if (leftEmpty) {
		return 1;
	}

	if (rightEmpty) {
		return -1;
	}

	return compareNonEmptyValues(left, right, dataType) * direction;
}

export function sortRows<T extends Record<string, unknown>>(
	rows: T[],
	columns: DataTableColumn<T>[],
	sort: SortState,
	rowSortPriority?: (row: T) => number
): T[] {
	if (!sort) {
		return rows;
	}

	const column = columns.find((entry) => entry.key === sort.key);
	if (!column) {
		return rows;
	}

	const dataType = column.dataType ?? 'string';
	const direction = sort.direction === 'asc' ? 1 : -1;

	const comparePriority = (left: T, right: T): number => {
		if (!rowSortPriority) return 0;
		return rowSortPriority(left) - rowSortPriority(right);
	};

	return [...rows].sort((left, right) => {
		const priorityDiff = comparePriority(left, right);
		if (priorityDiff !== 0) return priorityDiff;

		const leftValue = getRawCellValue(left, column);
		const rightValue = getRawCellValue(right, column);
		return compareSortValues(leftValue, rightValue, dataType, direction);
	});
}

export function paginateRows<T>(rows: T[], pageIndex: number, pageSize: number): T[] {
	const start = pageIndex * pageSize;
	return rows.slice(start, start + pageSize);
}

export function getCellExportValue<T extends Record<string, unknown>>(
	row: T,
	column: DataTableColumn<T>
): string {
	const raw = getRawCellValue(row, column);
	return raw === null || raw === undefined ? '' : String(raw);
}

export function exportRowsToCsv<T extends Record<string, unknown>>(
	rows: T[],
	columns: DataTableColumn<T>[],
	fileName: string
): void {
	const exportableColumns = columns.filter(
		(column) => column.type !== 'actions' && column.exportable !== false
	);
	const headers = exportableColumns.map((column) => column.header);
	const lines = rows.map((row) =>
		exportableColumns
			.map((column) => `"${getCellExportValue(row, column).replace(/"/g, '""')}"`)
			.join(',')
	);
	const csv = [headers.join(','), ...lines].join('\n');
	const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = `${fileName}.csv`;
	link.click();
	URL.revokeObjectURL(url);
}

export function toggleSortState(current: SortState, key: string): SortState {
	if (current?.key !== key) {
		return { key, direction: 'asc' };
	}

	if (current.direction === 'asc') {
		return { key, direction: 'desc' };
	}

	return null;
}
