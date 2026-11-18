import { ocrFetch } from '../../../project-management-app/lib/ocr.api.js';
import type { BomCsvRow } from './bom-csv-parser';

export async function extractCsvRows(file: File): Promise<BomCsvRow[]> {
	const formData = new FormData();
	formData.append('file', file);
	return ocrFetch<BomCsvRow[]>('/csv_extractor', { method: 'POST', body: formData });
}
