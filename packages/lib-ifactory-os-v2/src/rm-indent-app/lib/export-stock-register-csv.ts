import {
	STOCK_REGISTER_CSV_FILE_COLUMNS,
	STOCK_REGISTER_CSV_FILE_HEADERS,
	type StockRegisterRow
} from './stock-register.types';

function csvCell(value: string | number | null | undefined): string {
	const text = value == null ? '' : String(value);
	return `"${text.replace(/"/g, '""')}"`;
}

export function buildStockRegisterCsv(rows: StockRegisterRow[]): string {
	const lines = [STOCK_REGISTER_CSV_FILE_HEADERS.map((header) => csvCell(header)).join(',')];

	for (const row of rows) {
		lines.push(STOCK_REGISTER_CSV_FILE_COLUMNS.map((column) => csvCell(row[column])).join(','));
	}

	return lines.join('\n');
}

function downloadCsv(csv: string, filename: string) {
	const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = filename;
	document.body.append(link);
	try {
		link.click();
	} finally {
		link.remove();
		window.setTimeout(() => URL.revokeObjectURL(url), 0);
	}
}

export function exportStockRegisterCsv(rows: StockRegisterRow[], filename = 'stock-register.csv') {
	downloadCsv(buildStockRegisterCsv(rows), filename);
}

export function downloadStockRegisterTemplate(filename = 'stock-register-template.csv') {
	const csv = `${STOCK_REGISTER_CSV_FILE_HEADERS.map((header) => csvCell(header)).join(',')}\n`;
	downloadCsv(csv, filename);
}
