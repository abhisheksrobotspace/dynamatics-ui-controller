import { describe, expect, it } from 'vitest';
import { normalizeBomSectionName } from './bom-csv-parser';
import {
	aggregateStockLengthRows,
	buildPlanBarDetailExportRows,
	buildPlanSummaryAccordionItems,
	buildPlanSummaryExportRows,
	formatBarMarkingsForExport,
	formatExportQtyLabel,
	formatExportWastePercent,
	formatExportWeightKg,
	formatSectionStockLengthsSummary,
	sanitizeCuttingPlanExportFilename,
	sectionUtilizationPercent,
	sectionWastePercent,
	splitSectionExportIdentity,
	stockLengthWeightKg
} from './planner-results';
import type { PlanBarRow, PlanResponse } from './types';

describe('stockLengthWeightKg', () => {
	it('computes (lengthMm/1000) × qty × unitWeightKgPerM', () => {
		expect(stockLengthWeightKg(8225, 2, 3.4)).toBeCloseTo(55.93, 2);
	});

	it('returns null when unit weight is missing or non-positive', () => {
		expect(stockLengthWeightKg(8225, 2, null)).toBeNull();
		expect(stockLengthWeightKg(8225, 2, 0)).toBeNull();
		expect(stockLengthWeightKg(8225, 2, undefined)).toBeNull();
	});

	it('returns null when length or quantity is non-positive', () => {
		expect(stockLengthWeightKg(0, 2, 3.4)).toBeNull();
		expect(stockLengthWeightKg(8225, 0, 3.4)).toBeNull();
	});
});

describe('aggregateStockLengthRows', () => {
	it('aggregates qty by length and stamps weightKg from unit weight', () => {
		const plan: PlanBarRow[] = [
			{ rmid: 'a', rm_length: 8225, quantity: 1, markings: [] },
			{ rmid: 'b', rm_length: 8225, quantity: 1, markings: [] },
			{ rmid: 'c', rm_length: 6000, quantity: 3, markings: [] }
		];

		const rows = aggregateStockLengthRows(plan, 3.4);
		expect(rows).toHaveLength(2);
		expect(rows[0]).toMatchObject({ lengthMm: 8225, quantity: 2 });
		expect(rows[0].weightKg).toBeCloseTo(55.93, 2);
		expect(rows[1]).toMatchObject({ lengthMm: 6000, quantity: 3 });
		expect(rows[1].weightKg).toBeCloseTo(61.2, 2);
	});

	it('leaves weightKg null when unit weight is absent', () => {
		const plan: PlanBarRow[] = [{ rmid: 'a', rm_length: 8225, quantity: 2, markings: [] }];
		expect(aggregateStockLengthRows(plan)[0].weightKg).toBeNull();
	});
});

describe('formatSectionStockLengthsSummary', () => {
	it('joins unique lengths descending with a shared mm unit', () => {
		const plan: PlanBarRow[] = [
			{ rmid: 'a', rm_length: 7475, quantity: 1, markings: [] },
			{ rmid: 'b', rm_length: 7600, quantity: 2, markings: [] },
			{ rmid: 'c', rm_length: 7475, quantity: 1, markings: [] }
		];
		expect(formatSectionStockLengthsSummary(plan)).toBe('7600 / 7475 mm');
	});

	it('returns a single length when only one unique stock is used', () => {
		const plan: PlanBarRow[] = [{ rmid: 'a', rm_length: 6000, quantity: 3, markings: [] }];
		expect(formatSectionStockLengthsSummary(plan)).toBe('6000 mm');
	});
});

describe('sectionUtilizationPercent', () => {
	it('returns used/stock as a percent', () => {
		expect(sectionUtilizationPercent({ total_stock_length: 1000, waste: 10 })).toBeCloseTo(99, 5);
		expect(sectionUtilizationPercent({ total_stock_length: 1000, waste: 430 })).toBeCloseTo(57, 5);
	});

	it('returns null when stock length is missing', () => {
		expect(sectionUtilizationPercent({ waste: 10 })).toBeNull();
		expect(sectionUtilizationPercent({ total_stock_length: 0, waste: 0 })).toBeNull();
	});
});

describe('sectionWastePercent', () => {
	it('returns waste/stock as a percent', () => {
		expect(sectionWastePercent({ total_stock_length: 10000, waste: 131 })).toBeCloseTo(1.31, 5);
		expect(sectionWastePercent({ total_stock_length: 1000, waste: 430 })).toBeCloseTo(43, 5);
	});
});

describe('buildPlanSummaryAccordionItems', () => {
	it('adds stock lengths and utilisation progress on the trigger', () => {
		const data: PlanResponse = {
			bom_id: 'bom-1',
			output: {
				'MS ANGLE 120x120x9': {
					plan: [
						{ rmid: 'a', rm_length: 7600, quantity: 2, markings: [] },
						{ rmid: 'b', rm_length: 7475, quantity: 4, markings: [] }
					],
					result: {
						num_bars: 6,
						total_stock_length: 10000,
						waste: 131,
						total_stock_weight_kg: 752,
						total_waste_weight_kg: 9.9
					}
				}
			}
		};

		const [item] = buildPlanSummaryAccordionItems(data);
		expect(item.stats).toEqual([
			{ label: 'Stock lengths', value: '7600 / 7475 mm' },
			{ label: 'Bars', value: '6' },
			{ label: 'Weight', value: '0.75 MT' },
			{
				label: 'Waste',
				value: '1.31%',
				sublabel: '9.9 kg',
				badgeVariant: 'online'
			}
		]);
		expect(item.progress).toEqual({
			label: 'Utilisation',
			value: 99,
			valueLabel: '99% used',
			fillTone: 'online',
			remainderTone: 'error'
		});
	});

	it('marks waste badges error when waste % is above 10', () => {
		const data: PlanResponse = {
			bom_id: 'bom-1',
			output: {
				'MS PLATE 16': {
					plan: [{ rmid: 'a', rm_length: 6000, quantity: 1, markings: [] }],
					result: {
						num_bars: 1,
						total_stock_length: 1000,
						waste: 430,
						total_stock_weight_kg: 77.9,
						total_waste_weight_kg: 33.8
					}
				}
			}
		};

		const [item] = buildPlanSummaryAccordionItems(data);
		const wasteStat = item.stats?.find((stat) => stat.label === 'Waste');
		expect(wasteStat?.badgeVariant).toBe('error');
		expect(wasteStat?.value).toBe('43.00%');
	});
});

describe('splitSectionExportIdentity', () => {
	const bases = ['MS ANGLE 100x100x6', 'HT ANGLE 90X90X5'];

	it('uses the base name for Sec Group when the section is ungrouped', () => {
		expect(splitSectionExportIdentity('MS ANGLE 100x100x6', bases)).toEqual({
			sec: 'MS ANGLE 100x100x6',
			secGroup: 'MS ANGLE 100x100x6'
		});
	});

	it('splits grouped section names into base Sec and full Sec Group', () => {
		expect(splitSectionExportIdentity('MS ANGLE 100X100X6 3001-6000', bases)).toEqual({
			sec: 'MS ANGLE 100x100x6',
			secGroup: 'MS ANGLE 100X100X6 3001-6000'
		});
	});

	it('falls back to the section name for both columns when no base matches', () => {
		expect(splitSectionExportIdentity('UNKNOWN SECTION', bases)).toEqual({
			sec: 'UNKNOWN SECTION',
			secGroup: 'UNKNOWN SECTION'
		});
	});
});

describe('buildPlanSummaryExportRows', () => {
	it('emits one row per stock length with waste from markings', () => {
		const data: PlanResponse = {
			bom_id: 'bom-1',
			result: {},
			output: {
				'MS ANGLE 100X100X6 3001-6000': {
					plan: [
						{
							rmid: 'a',
							rm_length: 10100,
							quantity: 1,
							markings: [
								{ mark: '470', length: 5000, quantity: 1 },
								{ mark: '472', length: 4719, quantity: 1 }
							]
						},
						{
							rmid: 'b',
							rm_length: 8925,
							quantity: 2,
							markings: [{ mark: '18', length: 8000, quantity: 1 }]
						}
					],
					result: { num_bars: 3 }
				},
				'HT ANGLE 90X90X5': {
					plan: [{ rmid: 'd', rm_length: 12000, quantity: 2, markings: [] }],
					result: { num_bars: 2 }
				}
			}
		};

		const rows = buildPlanSummaryExportRows(
			data,
			{
				[normalizeBomSectionName('MS ANGLE 100x100x6')]: 9.26,
				[normalizeBomSectionName('HT ANGLE 90X90X5')]: 3.4
			},
			['MS ANGLE 100x100x6', 'HT ANGLE 90X90X5']
		);

		expect(rows).toHaveLength(3);
		expect(rows[0]).toMatchObject({
			sec: 'MS ANGLE 100x100x6',
			secGroup: 'MS ANGLE 100X100X6 3001-6000',
			lengthMm: 10100,
			qty: 1
		});
		// waste mm = 10100 - 9719 = 381
		expect(rows[0].wasteMm).toBe(381);
		expect(rows[0].wasteKg).toBeCloseTo((381 / 1000) * 1 * 9.26, 5);
		expect(rows[0].weightKg).toBeCloseTo((10100 / 1000) * 1 * 9.26, 5);

		expect(rows[1]).toMatchObject({
			lengthMm: 8925,
			qty: 2
		});
		// waste mm per bar = 925; × qty 2
		expect(rows[1].wasteMm).toBe(925 * 2);
		expect(rows[1].wasteKg).toBeCloseTo((925 / 1000) * 2 * 9.26, 5);

		expect(rows[2]).toMatchObject({
			sec: 'HT ANGLE 90X90X5',
			secGroup: 'HT ANGLE 90X90X5',
			lengthMm: 12000,
			qty: 2,
			wasteMm: null,
			wasteKg: null
		});
		expect(rows[2].weightKg).toBeCloseTo((12000 / 1000) * 2 * 3.4, 5);
	});

	it('merges identical stock lengths into one Qty (matches Summary UI)', () => {
		const data: PlanResponse = {
			bom_id: 'bom-1',
			result: {},
			output: {
				'MS ANGLE 90X90X5 3001-6000': {
					plan: [
						{
							rmid: 'a',
							rm_length: 9100,
							quantity: 1,
							markings: [{ mark: 'M1', length: 9000, quantity: 1 }]
						},
						{
							rmid: 'b',
							rm_length: 9100,
							quantity: 1,
							markings: [{ mark: 'M2', length: 9000, quantity: 1 }]
						}
					],
					result: { num_bars: 2 }
				}
			}
		};

		const unitWeight = 6.97;
		const rows = buildPlanSummaryExportRows(
			data,
			{ [normalizeBomSectionName('MS ANGLE 90x90x5')]: unitWeight },
			['MS ANGLE 90x90x5']
		);

		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			sec: 'MS ANGLE 90x90x5',
			secGroup: 'MS ANGLE 90X90X5 3001-6000',
			lengthMm: 9100,
			qty: 2,
			wasteMm: 200
		});
		// waste mm per bar = 100; × qty 1 each → summed
		expect(rows[0].wasteKg).toBeCloseTo((100 / 1000) * 2 * unitWeight, 5);
		expect(rows[0].weightKg).toBeCloseTo((9100 / 1000) * 2 * unitWeight, 5);
	});
});

describe('formatExportWastePercent', () => {
	it('formats waste as percent of stock length', () => {
		expect(formatExportWastePercent(100, 9100)).toBe('1.10');
		expect(formatExportWastePercent(200, 18200)).toBe('1.10');
	});

	it('returns empty string when stock or waste is missing', () => {
		expect(formatExportWastePercent(null, 9100)).toBe('');
		expect(formatExportWastePercent(100, 0)).toBe('');
	});
});

describe('formatExportWeightKg', () => {
	it('formats numeric kg without a unit suffix', () => {
		expect(formatExportWeightKg(63.4)).toBe('63.4');
		expect(formatExportWeightKg(0.9)).toBe('0.9');
	});

	it('keeps values in kg even above the display MT threshold', () => {
		expect(formatExportWeightKg(1269.5)).toBe('1269.5');
	});

	it('returns empty string for missing weights', () => {
		expect(formatExportWeightKg(null)).toBe('');
		expect(formatExportWeightKg(undefined)).toBe('');
	});
});

describe('formatExportQtyLabel / formatBarMarkingsForExport', () => {
	it('formats value x qty', () => {
		expect(formatExportQtyLabel(11400, 6)).toBe('11400 x6');
		expect(formatExportQtyLabel('470', 1)).toBe('470 x1');
	});

	it('joins markings as comma-separated mark (length) x qty', () => {
		expect(
			formatBarMarkingsForExport([
				{ mark: '470', length: 5000, quantity: 1 },
				{ mark: '472', length: 4719, quantity: 1 },
				{ mark: '18', length: 1512, quantity: 1 }
			])
		).toBe('470 (5000 mm) x1, 472 (4719 mm) x1, 18 (1512 mm) x1');
	});
});

describe('buildPlanBarDetailExportRows', () => {
	it('emits one row per bar with comma-separated markings', () => {
		const data: PlanResponse = {
			bom_id: 'bom-1',
			result: {},
			output: {
				'MS ANGLE 100X100X6 0-500': {
					plan: [
						{
							rmid: 'bar-1',
							rm_length: 6000,
							quantity: 1,
							markings: [
								{ mark: 'S1', length: 400, quantity: 4 },
								{ mark: 'S2', length: 350, quantity: 2 }
							]
						}
					],
					result: { num_bars: 1 }
				}
			}
		};

		const rows = buildPlanBarDetailExportRows(
			data,
			{ [normalizeBomSectionName('MS ANGLE 100x100x6')]: 9.26 },
			['MS ANGLE 100x100x6']
		);

		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			sec: 'MS ANGLE 100x100x6',
			secGroup: 'MS ANGLE 100X100X6 0-500',
			rmId: 'bar-1',
			lengthMm: 6000,
			qty: 1,
			markings: 'S1 (400 mm) x4, S2 (350 mm) x2',
			usedMm: 400 * 4 + 350 * 2,
			wasteMm: 6000 - (400 * 4 + 350 * 2)
		});
		expect(rows[0].weightKg).toBeCloseTo(6 * 9.26, 5);
		expect(rows[0].wasteKg).toBeCloseTo(((6000 - 2300) / 1000) * 9.26, 5);
	});
});

describe('sanitizeCuttingPlanExportFilename', () => {
	it('replaces spaces and illegal filename characters', () => {
		expect(sanitizeCuttingPlanExportFilename('Basic body - 2')).toBe('Basic-body-2');
		expect(sanitizeCuttingPlanExportFilename('a/b:c')).toBe('a-b-c');
	});
});
