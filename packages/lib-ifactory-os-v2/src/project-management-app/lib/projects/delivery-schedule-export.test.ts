import { describe, expect, it } from 'vitest';
import {
	buildDeliveryScheduleCsv,
	deliveryScheduleExportFilename,
	formatBatchWt,
	formatExportMonth,
	formatExportUpdatedOn,
	formatStructureSetsLabel,
	formatStructuresDetailsCell,
	sanitizeDeliveryScheduleExportFilename
} from './delivery-schedule-export.js';

describe('buildDeliveryScheduleCsv', () => {
	it('writes the steel-status header and one row per BOM', () => {
		const csv = buildDeliveryScheduleCsv([
			{
				month: 'Aug-26',
				workOrder: 'J 1048',
				structureLabel: 'DA - 25 Sets',
				batchWt: '680.80',
				boms: [
					{ name: 'Basic Tower', qty: 25, weightMt: '560.31' },
					{ name: '0.0 MBE', qty: 20, weightMt: '98.96' },
					{ name: '+3.0 MBE', qty: 1, weightMt: '6.84' },
					{ name: '-3.0 MBE', qty: 4, weightMt: '14.69' }
				]
			}
		]);

		expect(csv.split('\r\n')).toEqual([
			'"Month","Work Order","Structures","Mass / Proto","Structures Details","Batch wt","Steel Indent No","Steel Indent WT in MT","Available Stock","Received Qty. in MT","Bal. Qty. in MT","Rel. Bal.","Fab. Bal.","Gal. Bal.","Ins. Bal","Desp Bal.","Plant","Remark","Zinc Req."',
			'"Aug-26","J 1048","DA - 25 Sets","","Basic Tower: 25 sets (560.31 MT)","680.80","","","","","","","","","","","","",""',
			'"","","","","0.0 MBE: 20 sets (98.96 MT)","","","","","","","","","","","","","",""',
			'"","","","","+3.0 MBE: 1 set (6.84 MT)","","","","","","","","","","","","","",""',
			'"","","","","-3.0 MBE: 4 sets (14.69 MT)","","","","","","","","","","","","","",""'
		]);
	});

	it('escapes quotes in BOM names', () => {
		const csv = buildDeliveryScheduleCsv([
			{
				month: 'Aug-26',
				workOrder: '',
				structureLabel: 'DA - 1 Set',
				batchWt: '-',
				boms: [{ name: 'Body "A"', qty: 1, weightMt: '-' }]
			}
		]);
		expect(csv).toContain('"Body ""A"": 1 set (- MT)"');
	});
});

describe('formatExportMonth', () => {
	it('formats DD/MM/YYYY as MMM-yy', () => {
		expect(formatExportMonth('16/08/2026')).toBe('Aug-26');
	});
});

describe('formatStructureSetsLabel', () => {
	it('uses Set when qty is 1', () => {
		expect(formatStructureSetsLabel('DA', 1)).toBe('DA - 1 Set');
		expect(formatStructureSetsLabel('DA', 25)).toBe('DA - 25 Sets');
	});
});

describe('formatStructuresDetailsCell', () => {
	it('keeps minus BOM names readable', () => {
		expect(formatStructuresDetailsCell('-3.0 MBE', 4, '14.69')).toBe('-3.0 MBE: 4 sets (14.69 MT)');
	});
});

describe('formatBatchWt', () => {
	it('sums MT cells', () => {
		expect(formatBatchWt(['560.31', '98.96', '6.84', '14.69'])).toBe('680.80');
	});
});

describe('formatExportUpdatedOn', () => {
	it('formats as dd.mm.yy', () => {
		expect(formatExportUpdatedOn(new Date(2026, 7, 16))).toBe('16.08.26');
	});
});

describe('sanitizeDeliveryScheduleExportFilename', () => {
	it('keeps spaces and strips path-unsafe characters', () => {
		expect(sanitizeDeliveryScheduleExportFilename('DA / T1')).toBe('DA - T1');
	});
});

describe('deliveryScheduleExportFilename', () => {
	it('matches a readable shop-floor name', () => {
		expect(deliveryScheduleExportFilename('DA-T1', '16.08.26')).toBe(
			'Delivery Schedule - DA-T1 - Updated 16.08.26.csv'
		);
	});
});
