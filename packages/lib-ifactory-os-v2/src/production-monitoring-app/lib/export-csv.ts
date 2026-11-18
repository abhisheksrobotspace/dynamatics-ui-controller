export function downloadCsv(headers: string[], rows: string[][], fileName: string): void {
	const lines = rows.map((row) =>
		row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
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
