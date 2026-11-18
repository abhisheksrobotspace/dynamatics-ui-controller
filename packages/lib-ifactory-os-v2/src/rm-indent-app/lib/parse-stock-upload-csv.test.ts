import { describe, expect, it } from 'vitest';
import {
	STOCK_UPLOAD_TEMPLATE_HEADERS,
	buildStockUploadProjectMap,
	collectStockUploadProjectCodes,
	parseStockUploadCsvFile,
	previewStockUploadCsv,
	projectRefKey,
	suggestStockUploadProjectMapping
} from './parse-stock-upload-csv';

const plants = [
	{ plant_id: 'nashik-1', name: 'Nashik Plant-I' },
	{ plant_id: 'nashik-2', name: 'Nashik-2' }
];

function csvFile(body: string, header = STOCK_UPLOAD_TEMPLATE_HEADERS.join(',')): File {
	return new File([`${header}\n${body}\n`], 'stock.csv', { type: 'text/csv' });
}

/** One ERP-shaped data row (27 columns). */
function erpRow(overrides: Partial<Record<string, string>> = {}): string {
	const values = {
		plant: 'Nashik Plant-I',
		locationCode: 'NSK1',
		project: 'J-1004/1005',
		projectDescription: 'J-1005-Khavda-Bhuj',
		item: 'IC-1',
		description: 'L 75X75X5 MS - IS 2062 E 250 A',
		unit: 'KGS',
		length: '7.8',
		width: '0',
		party: 'N1RM',
		name: 'Steel Stores-Ind Nashik Plant-I',
		batch: 'B-1',
		physical: 'Yard A-1',
		bundle: 'BND-1',
		openingNos: '',
		openingMt: '',
		openingValue: '',
		receiptNos: '',
		receiptMt: '',
		receiptValue: '',
		issueNos: '',
		issueMt: '',
		issueValue: '',
		nos: '10',
		mt: '0.5',
		closingValue: '',
		closingRate: '',
		...overrides
	};
	return [
		values.plant,
		values.locationCode,
		values.project,
		values.projectDescription,
		values.item,
		values.description,
		values.unit,
		values.length,
		values.width,
		values.party,
		values.name,
		values.batch,
		values.physical,
		values.bundle,
		values.openingNos,
		values.openingMt,
		values.openingValue,
		values.receiptNos,
		values.receiptMt,
		values.receiptValue,
		values.issueNos,
		values.issueMt,
		values.issueValue,
		values.nos,
		values.mt,
		values.closingValue,
		values.closingRate
	].join(',');
}

describe('parseStockUploadCsvFile (ERP template §3.4)', () => {
	it('maps Description→name, Location/Party→location_ref, Physical Location, weight_mt; qty_uom PCS', async () => {
		const rows = await parseStockUploadCsvFile(csvFile(erpRow()), {
			plants,
			uploadPlantId: 'nashik-1'
		});
		expect(rows).toHaveLength(1);
		expect(rows[0].validation_status).toBe('warning');
		expect(rows[0].validation_code).toBe('inv.row_item_autocreated');
		expect(rows[0].item_code).toBe('IC-1');
		expect(rows[0].name).toBe('L 75X75X5 MS - IS 2062 E 250 A');
		expect(rows[0].project_ref).toBe('J-1004/1005');
		expect(rows[0].plant_ref).toBe('Nashik Plant-I');
		expect(rows[0].qty).toBe(10);
		expect(rows[0].qty_uom).toBe('PCS');
		expect(rows[0].length_mm).toBe(7800);
		expect(rows[0].location_ref).toBe('N1RM');
		expect(rows[0].physical_location).toBe('Yard A-1');
		expect(rows[0].lot_code).toBe('B-1');
		expect(rows[0].bundle_no).toBe('BND-1');
		expect(rows[0].weight_mt).toBe(0.5);
	});

	it('rejects Primary Location that is not the upload plant', async () => {
		const rows = await parseStockUploadCsvFile(csvFile(erpRow()), {
			plants,
			uploadPlantId: 'nashik-2'
		});
		expect(rows[0].validation_status).toBe('error');
		expect(rows[0].validation_code).toBe('inv.row_unknown_plant');
	});

	it('stamps plant override and accepts when override matches upload plant', async () => {
		const rows = await parseStockUploadCsvFile(csvFile(erpRow()), {
			plants,
			uploadPlantId: 'nashik-1',
			plantRefOverride: 'nashik-1'
		});
		expect(rows[0].plant_ref).toBe('nashik-1');
		expect(rows[0].validation_code).not.toBe('inv.row_unknown_plant');
	});

	it('rejects invalid qty', async () => {
		const rows = await parseStockUploadCsvFile(csvFile(erpRow({ nos: 'abc' })), {
			plants,
			uploadPlantId: 'nashik-1'
		});
		expect(rows[0].validation_code).toBe('inv.row_invalid_qty');
	});

	it('rejects row with no Item code (no alias fallback)', async () => {
		const rows = await parseStockUploadCsvFile(
			csvFile(erpRow({ item: '', description: 'ANGLE' })),
			{
				plants,
				uploadPlantId: 'nashik-1'
			}
		);
		expect(rows[0].validation_code).toBe('inv.row_unknown_item');
	});

	it('marks known item ok and unmapped project when projectMap provided', async () => {
		const rows = await parseStockUploadCsvFile(csvFile(erpRow()), {
			plants,
			uploadPlantId: 'nashik-1',
			items: [
				{ item_id: 'i1', item_code: 'IC-1', stock_archetype: 'linear', tracking_mode: 'lot' }
			],
			projectMap: { 'J-9999': 'proj-x' }
		});
		expect(rows[0].validation_status).toBe('error');
		expect(rows[0].validation_code).toBe('inv.row_unknown_project');
	});

	it('maps legacy Section into name when Description is absent', async () => {
		const body = [
			'Plant,Item Code,Section,Grade,Qty,UOM',
			'Nashik Plant-I,IC-10001,HT ANGLE 100X100X6,HT,10,PCS'
		].join('\n');
		const file = new File([body], 'bams.csv', { type: 'text/csv' });
		const rows = await parseStockUploadCsvFile(file, {
			plants,
			uploadPlantId: 'nashik-1',
			items: [
				{ item_id: 'i1', item_code: 'IC-10001', stock_archetype: 'discrete', tracking_mode: 'none' }
			]
		});
		expect(rows[0].validation_status).toBe('ok');
		expect(rows[0].name).toBe('HT ANGLE 100X100X6');
		expect(rows[0].material_grade).toBe('HT');
		expect(rows[0].qty_uom).toBe('PCS');
	});
});

describe('collectStockUploadProjectCodes / project_map helpers', () => {
	it('collects unique Project # values with stock vs total counts', async () => {
		const body = [
			erpRow({ project: 'J-1004/1005', nos: '1', batch: 'A', bundle: '1' }),
			erpRow({ project: 'J-1050/1051', nos: '0', batch: 'B', bundle: '2' }),
			erpRow({ project: 'J-1004/1005', nos: '3', batch: 'C', bundle: '3' })
		].join('\n');
		const rows = await parseStockUploadCsvFile(csvFile(body), {
			plants,
			uploadPlantId: 'nashik-1'
		});
		expect(collectStockUploadProjectCodes(rows)).toEqual([
			{ project_ref: 'J-1004/1005', row_count: 2, stock_row_count: 2 },
			{ project_ref: 'J-1050/1051', row_count: 1, stock_row_count: 0 }
		]);
	});

	it('buildStockUploadProjectMap drops empty entries', () => {
		expect(
			buildStockUploadProjectMap({
				'J-A': 'proj-a',
				'J-B': '',
				'  ': 'proj-c'
			})
		).toEqual({ 'J-A': 'proj-a' });
	});

	it('suggestStockUploadProjectMapping matches work_order_no via projectRefKey', () => {
		expect(projectRefKey('J-1027/1028')).toBe(projectRefKey('j 1027 / 1028'));
		expect(
			suggestStockUploadProjectMapping(
				['J-1027/1028', 'J-9999'],
				[
					{ project_id: 'p1', work_order_no: 'J1027/1028' },
					{ project_id: 'p2', work_order_no: 'J-1056' }
				]
			)
		).toEqual({ 'J-1027/1028': 'p1', 'J-9999': '' });
	});
});

describe('previewStockUploadCsv', () => {
	it('maps all 27 ERP columns from the CSV header order', async () => {
		const rows = await previewStockUploadCsv(csvFile(erpRow()));
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			primary_location: 'Nashik Plant-I',
			location_code: 'NSK1',
			project: 'J-1004/1005',
			project_description: 'J-1005-Khavda-Bhuj',
			item: 'IC-1',
			description: 'L 75X75X5 MS - IS 2062 E 250 A',
			unit: 'KGS',
			length: '7.8',
			width: '0',
			location_party: 'N1RM',
			name: 'Steel Stores-Ind Nashik Plant-I',
			batch: 'B-1',
			physical_location: 'Yard A-1',
			bundle_no: 'BND-1',
			closing_nos: '10',
			closing_mt: '0.5'
		});
	});

	it('maps legacy BAMS Section into Description when present', async () => {
		const body = [
			'Plant,Item Code,Section,Grade,Qty,UOM',
			'Nashik-1,IC-10001,HT ANGLE 100X100X6,HT,10,PCS'
		].join('\n');
		const file = new File([body], 'bams.csv', { type: 'text/csv' });
		const rows = await previewStockUploadCsv(file, { maxRows: 5 });
		expect(rows[0]).toMatchObject({
			primary_location: 'Nashik-1',
			item: 'IC-10001',
			description: 'HT ANGLE 100X100X6',
			unit: 'PCS',
			closing_nos: '10'
		});
	});
});

describe('STOCK_UPLOAD_TEMPLATE_HEADERS', () => {
	it('matches the ERP Data Template header row (27 columns)', () => {
		expect(STOCK_UPLOAD_TEMPLATE_HEADERS).toHaveLength(27);
		expect([...STOCK_UPLOAD_TEMPLATE_HEADERS]).toEqual([
			'Primary Location',
			'Location Code',
			'Project #',
			'Project Description',
			'Item',
			'Description',
			'Unit',
			'Length',
			'Width',
			'Location/Party',
			'Name',
			'Batch',
			'Physical Location',
			'Bundle No.',
			'Opening Nos.',
			'Opening Qty.(MT)',
			'Opening Value',
			'Receipt Nos.',
			'Receipt Qty.(MT)',
			'Receipt Value',
			'Issue Nos.',
			'Issue Qty.(MT)',
			'Issue Value',
			'Closing(Summ.) Nos.',
			'Closing(Summ.) Qty. (MT)',
			'Closing(Summ.) Value.',
			'Closing(Summ.) Rate. (MT)'
		]);
		expect(STOCK_UPLOAD_TEMPLATE_HEADERS).not.toContain('Section');
	});
});
