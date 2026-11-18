import { describe, expect, it } from 'vitest';
import { parseStockRegisterCsv } from './parse-stock-register-csv';
import { STOCK_REGISTER_CSV_FILE_HEADERS } from './stock-register.types';

const headerLine = STOCK_REGISTER_CSV_FILE_HEADERS.map((header) => `"${header}"`).join(',');

/** Values align with STOCK_REGISTER_CSV_FILE_HEADERS order. */
const sampleRow =
	'"Plant A","PRJ-101","ITEM-1","ISMB 200","12.5","200","8","Physical Loc A","BN-01","NOS","PARTY-1","B-01","80.0"';

describe('parseStockRegisterCsv', () => {
	it('parses stock register rows from expected headers', () => {
		const csv = [headerLine, sampleRow].join('\n');

		const rows = parseStockRegisterCsv(csv);
		expect(rows).toHaveLength(1);
		expect(rows[0].primary_location).toBe('Plant A');
		expect(rows[0].project).toBe('PRJ-101');
		expect(rows[0].section).toBe('ISMB 200');
		expect(rows[0].closing_summ_nos).toBe('8');
		expect(rows[0].closing_summ_qty_mt).toBe('80.0');
		expect(rows[0].free).toBe('');
		expect(rows[0].locked).toBe('');
		expect(rows[0].locked_against).toBe('');
	});

	it('maps Section from legacy Description header', () => {
		const csv = [
			'"Primary Location","Project","Item","Description","Unit","Length","Width","Location/Party","Batch","Physical Location","Bundle No.","Closing(Summ.) Nos.","Closing(Summ.) Qty. (MT)"',
			'"Plant A","PRJ-101","ITEM-1","Section desc","NOS","12.5","200","PARTY-1","B-01","Physical Loc A","BN-01","8","80.0"'
		].join('\n');

		const rows = parseStockRegisterCsv(csv);
		expect(rows[0].section).toBe('Section desc');
	});

	it('skips blank lines', () => {
		const csv = [
			headerLine,
			'',
			'"Plant B","PRJ-102","ITEM-2","PL-10","6.0","10","20","Physical Loc B","BN-02","NOS","PARTY-2","B-02","50.0"'
		].join('\n');

		expect(parseStockRegisterCsv(csv)).toHaveLength(1);
	});

	it('does not require free, locked, or locked against columns', () => {
		const csv = [headerLine, sampleRow].join('\n');

		expect(() => parseStockRegisterCsv(csv)).not.toThrow();
	});
});
