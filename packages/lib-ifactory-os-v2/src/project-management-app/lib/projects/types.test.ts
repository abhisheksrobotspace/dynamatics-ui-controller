import { describe, expect, it } from 'vitest';
import {
	metadataWithProjectFields,
	metadataWithShortName,
	projectSetupFromMetadata,
	shortNameFromMetadata
} from './types.js';

describe('project metadata helpers', () => {
	it('reads short_name from metadata', () => {
		expect(shortNameFromMetadata({ short_name: ' DA-T1 ' })).toBe('DA-T1');
		expect(shortNameFromMetadata({})).toBe('');
	});

	it('reads project setup fields from metadata', () => {
		expect(
			projectSetupFromMetadata({
				work_order_no: ' J1055 ',
				project_details: '400 KV D/C',
				line_details: 'KUTCH(Z2) TO LAKADIA',
				loa_no: '935/240956419'
			})
		).toEqual({
			workOrderNo: 'J1055',
			projectDetails: '400 KV D/C',
			lineDetails: 'KUTCH(Z2) TO LAKADIA',
			loaNo: '935/240956419'
		});
	});

	it('writes project fields into metadata and keeps empty strings for PATCH merge', () => {
		expect(
			metadataWithProjectFields(
				{ foo: 1, work_order_no: 'old', loa_no: 'keep-me' },
				{
					shortName: 'DA-T1',
					workOrderNo: 'J1055',
					projectDetails: '400 KV D/C',
					lineDetails: '',
					loaNo: '  '
				}
			)
		).toEqual({
			foo: 1,
			short_name: 'DA-T1',
			work_order_no: 'J1055',
			project_details: '400 KV D/C',
			line_details: '',
			loa_no: ''
		});
	});

	it('writes short_name into metadata and clears it when empty', () => {
		expect(metadataWithShortName({ foo: 1 }, 'DA-T1')).toEqual({
			foo: 1,
			short_name: 'DA-T1',
			work_order_no: '',
			project_details: '',
			line_details: '',
			loa_no: ''
		});
		expect(metadataWithShortName({ foo: 1, short_name: 'old' }, '  ')).toEqual({
			foo: 1,
			short_name: '',
			work_order_no: '',
			project_details: '',
			line_details: '',
			loa_no: ''
		});
	});

	it('preserves existing setup fields when only short_name changes', () => {
		expect(
			metadataWithShortName(
				{
					work_order_no: 'J1055',
					project_details: '400 KV D/C'
				},
				'DA-T1'
			)
		).toEqual({
			short_name: 'DA-T1',
			work_order_no: 'J1055',
			project_details: '400 KV D/C',
			line_details: '',
			loa_no: ''
		});
	});
});
