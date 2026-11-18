import { describe, expect, it } from 'vitest';
import { buildStockRegisterCsv } from './export-stock-register-csv';
import type { StockRegisterRow } from './stock-register.types';
import { STOCK_REGISTER_CSV_FILE_HEADERS } from './stock-register.types';

function emptyStockRow(overrides: Partial<StockRegisterRow> = {}): StockRegisterRow {
	return {
		id: '1',
		primary_location: '',
		project: '',
		item: '',
		section: '',
		unit: '',
		length: '',
		width: '',
		location_party: '',
		batch: '',
		physical_location: '',
		bundle_no: '',
		closing_summ_nos: '',
		closing_summ_qty_mt: '',
		free: '',
		locked: '',
		locked_against: '',
		...overrides
	};
}

describe('buildStockRegisterCsv', () => {
	it('exports stock register rows with expected headers', () => {
		const rows: StockRegisterRow[] = [
			emptyStockRow({
				id: '1',
				primary_location: 'Plant A',
				section: 'ISMB 200',
				closing_summ_nos: '8',
				free: '8',
				locked: 'Yes',
				locked_against: 'Indent 101'
			})
		];

		const headerLine = STOCK_REGISTER_CSV_FILE_HEADERS.map((header) => `"${header}"`).join(',');
		expect(buildStockRegisterCsv(rows)).toBe(
			[headerLine, '"Plant A","","","ISMB 200","","","8","","","","","",""'].join('\n')
		);
		expect(buildStockRegisterCsv(rows)).not.toContain('Free');
		expect(buildStockRegisterCsv(rows)).not.toContain('Locked');
	});
});
