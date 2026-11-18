export const STOCK_REGISTER_CSV_SCHEMA = [
	{ key: 'primary_location', header: 'Primary Location' },
	{ key: 'project', header: 'Project #' },
	{ key: 'item', header: 'Item' },
	{ key: 'section', header: 'Section' },
	{ key: 'length', header: 'Length' },
	{ key: 'width', header: 'Width' },
	{ key: 'closing_summ_nos', header: 'Closing(Summ.) Nos.' },
	{ key: 'physical_location', header: 'Physical Location' },
	{ key: 'bundle_no', header: 'Bundle' },
	{ key: 'free', header: 'Free' },
	{ key: 'locked', header: 'Locked' },
	{ key: 'locked_against', header: 'Locked Against' },
	{ key: 'unit', header: 'Unit' },
	{ key: 'location_party', header: 'Location/Party' },
	{ key: 'batch', header: 'Batch' },
	{ key: 'closing_summ_qty_mt', header: 'Closing(Summ.) Qty. (MT)' }
] as const;

export type StockRegisterColumn = (typeof STOCK_REGISTER_CSV_SCHEMA)[number]['key'];

/** Derived columns shown in the table but not present in upload/export CSV. */
export const STOCK_REGISTER_CSV_OPTIONAL_COLUMNS = [
	'free',
	'locked',
	'locked_against'
] as const satisfies readonly StockRegisterColumn[];

const optionalColumnSet = new Set<string>(STOCK_REGISTER_CSV_OPTIONAL_COLUMNS);

export const STOCK_REGISTER_CSV_COLUMNS = STOCK_REGISTER_CSV_SCHEMA.map(
	(column) => column.key
) as StockRegisterColumn[];

export const STOCK_REGISTER_CSV_HEADERS = STOCK_REGISTER_CSV_SCHEMA.map((column) => column.header);

/** Columns required in uploaded/exported CSV files. */
export const STOCK_REGISTER_CSV_FILE_SCHEMA = STOCK_REGISTER_CSV_SCHEMA.filter(
	(column) => !optionalColumnSet.has(column.key)
);

export const STOCK_REGISTER_CSV_FILE_COLUMNS = STOCK_REGISTER_CSV_FILE_SCHEMA.map(
	(column) => column.key
) as StockRegisterColumn[];

export const STOCK_REGISTER_CSV_FILE_HEADERS = STOCK_REGISTER_CSV_FILE_SCHEMA.map(
	(column) => column.header
);

export type StockRegisterRow = Record<StockRegisterColumn, string> & {
	id: string;
};

export type StockFilter = 'total-stock' | 'free' | 'locked' | 'sections' | 'plants';

export function stockRegisterColumnHeader(column: StockRegisterColumn): string {
	return STOCK_REGISTER_CSV_SCHEMA.find((entry) => entry.key === column)?.header ?? column;
}
