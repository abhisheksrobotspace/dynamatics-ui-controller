import { describe, expect, it } from 'vitest';
import {
	buildMachineLoadingRows,
	cuttingSummary,
	filterBarsByRmIds,
	formatBundles,
	formatMarkings,
	groupSteelRequisition,
	mapCuttingBar,
	operationLetters,
	parseBundles,
	pageIdsForJobCardDrawings,
	pickSectionPlans,
	toCuttingPlanAccordionItems,
	toJobCardDrawings,
	unitWeightKgPerM
} from './job-cards.derive.js';

describe('operationLetters', () => {
	it('joins letters after the first op and maps H to HG', () => {
		expect(operationLetters(['CPS', 'N'])).toBe('N');
		expect(operationLetters(['CPS', 'N', 'B'])).toBe('NB');
		expect(operationLetters(['CDS', 'H'])).toBe('HG');
		expect(operationLetters(['CPS'])).toBe('');
	});
});

describe('formatBundles', () => {
	it('renders a single group as pieces only', () => {
		expect(formatBundles(parseBundles([{ count: 1, pieces: 24 }]))).toBe('24');
	});

	it('joins multiple groups as count×pieces', () => {
		expect(
			formatBundles(
				parseBundles([
					{ count: 4, pieces: 6 },
					{ count: 1, pieces: 2 }
				])
			)
		).toBe('4×6 + 1×2');
	});
});

describe('groupSteelRequisition', () => {
	it('groups by stock/section length descending and sums qty/weight', () => {
		const rows = groupSteelRequisition('HT ANGLE 55X55X4', [
			{ lengthMm: 3564, totalPcs: 24, totalWtKg: 290.832 },
			{ lengthMm: 2100, totalPcs: 12, totalWtKg: 80 },
			{ lengthMm: 3564, totalPcs: 6, totalWtKg: 72.708 }
		]);
		expect(rows).toHaveLength(2);
		expect(rows[0]).toMatchObject({
			id: '3564',
			section: 'HT ANGLE 55X55X4',
			lengthMm: 3564,
			quantity: 30
		});
		expect(rows[0]!.weightKg).toBeCloseTo(363.54, 5);
		expect(rows[1]).toEqual({
			id: '2100',
			section: 'HT ANGLE 55X55X4',
			lengthMm: 2100,
			quantity: 12,
			weightKg: 80
		});
	});
});

describe('buildMachineLoadingRows', () => {
	it('collapses same-machine same-RM unit bars into one row spanning first start to last end', () => {
		const rows = buildMachineLoadingRows(
			[
				{
					task_id: 'u1',
					task_kind: 'unit',
					step_code: 'CPS',
					machine_id: 'NJM-02',
					rm_id: 'HT ANGLE 45x45x4-6000-1',
					qty: 1,
					start_time: '2026-08-25T18:16:00Z',
					end_time: '2026-08-25T18:28:00Z'
				},
				{
					task_id: 'u2',
					task_kind: 'unit',
					step_code: 'CPS',
					machine_id: 'NJM-02',
					rm_id: 'HT ANGLE 45x45x4-6000-1',
					qty: 1,
					start_time: '2026-08-25T18:28:00Z',
					end_time: '2026-08-25T18:40:00Z'
				}
			],
			new Map(),
			(iso) => iso
		);
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			materialId: 'HT ANGLE 45x45x4-6000-1',
			operation: 'CPS',
			qty: 2,
			plannedStart: '2026-08-25T18:16:00Z',
			plannedEnd: '2026-08-25T18:40:00Z'
		});
	});

	it('emits one row per RM/bundle with a machine and start, sorted by start', () => {
		const rows = buildMachineLoadingRows(
			[
				{
					task_id: 'b',
					task_kind: 'bundle',
					step_code: 'N',
					machine_id: 'NJM-114',
					mark_no: 'J57 DA 2556H',
					bundle_index: 0,
					qty: 20,
					start_time: '2026-08-23T17:01:00Z',
					end_time: '2026-08-23T18:41:00Z'
				},
				{
					task_id: 'a',
					task_kind: 'unit',
					step_code: 'CPS',
					machine_id: 'NJM-02',
					rm_id: 'HT ANGLE 75x75x4-10400-1',
					qty: 10,
					start_time: '2026-08-23T14:07:00Z',
					end_time: '2026-08-23T16:47:00Z'
				},
				{
					task_id: 'skip',
					task_kind: 'unit',
					step_code: 'CPS',
					rm_id: 'NO-MACHINE',
					qty: 1
				}
			],
			new Map([['NJM-02', 'NJM-02']]),
			(iso) => iso,
			new Map(),
			new Map([['J57 DA 2556H', 2573]])
		);
		expect(rows).toHaveLength(2);
		expect(rows[0]).toMatchObject({
			machineName: 'NJM-02',
			materialId: 'HT ANGLE 75x75x4-10400-1',
			lengthMm: 10400,
			operation: 'CPS',
			qty: 10
		});
		expect(rows[1]).toMatchObject({
			machineName: 'NJM-114',
			materialId: 'J57 DA 2556H · Bundle 1',
			lengthMm: 2573,
			operation: 'N',
			qty: 20
		});
	});
});

describe('cutting plan helpers', () => {
	it('keeps latest version whose section starts with the card profile', () => {
		const picked = pickSectionPlans(
			[
				{ section_plan_id: 'a', section: 'HT ANGLE 55X55X4 3001-6000', section_version: 1 },
				{ section_plan_id: 'b', section: 'HT ANGLE 55X55X4 3001-6000', section_version: 2 },
				{ section_plan_id: 'c', section: 'OTHER', section_version: 9 }
			],
			'HT ANGLE 55X55X4'
		);
		expect(picked.map((plan) => plan.section_plan_id)).toEqual(['b']);
	});

	it('filters bars by rm_id and falls back when none match', () => {
		const bars = [
			{ section_plan_id: 'p', rmid: 'RM-1' },
			{ section_plan_id: 'p', rmid: 'RM-2' }
		];
		expect(filterBarsByRmIds(bars, new Set(['RM-2'])).map((bar) => bar.rmid)).toEqual(['RM-2']);
		expect(filterBarsByRmIds(bars, new Set(['RM-9']))).toEqual(bars);
	});

	it('maps a bar and summary using unit weight from a mark line', () => {
		const unit = unitWeightKgPerM([{ wtPerPieceKg: 12.118, lengthMm: 3564 }]);
		expect(unit).toBeCloseTo(3.4001, 3);
		const row = mapCuttingBar(
			{
				section_plan_id: 'p',
				rmid: 'HT ANGLE 55X55X4 3001-6000-9650-1',
				rm_length_mm: 9650,
				quantity: 1,
				markings: [{ mark: '1610H', length: 4775, quantity: 2 }]
			},
			6,
			unit,
			'bar-1'
		);
		expect(row.quantity).toBe(6);
		expect(row.usedMm).toBe(9550);
		expect(row.wasteMm).toBe(100);
		expect(row.wastePct).toBe(1.04);
		expect(formatMarkings(undefined)).toBe('');
		expect(row.markings).toBe('1610H x2');
		expect(row.markingItems).toEqual([{ mark: '1610H', lengthMm: 4775, quantity: 2 }]);
		const items = toCuttingPlanAccordionItems([row]);
		expect(items[0]?.label).toBe('HT ANGLE 55X55X4 3001-6000-9650-1');
		expect(items[0]?.description).toBe('1 mark number');
		expect(items[0]?.stats).toEqual([
			{ label: 'RM Length', value: '9650 mm', badgeVariant: 'secondary' },
			{ label: 'Quantity', value: '6 bars', badgeVariant: 'default' }
		]);
		expect(items[0]?.rows[0]).toEqual({
			id: 'bar-1-m0',
			markNo: '1610H',
			lengthMm: 4775,
			pcsPerBar: 2
		});
		const summary = cuttingSummary([row, { ...row, id: 'bar-2' }]);
		expect(summary?.quantity).toBe(12);
		expect(summary?.wastePct).toBeCloseTo(
			(summary!.wasteKg / (summary!.wasteKg + summary!.weightKg)) * 100,
			2
		);
	});
});

describe('toJobCardDrawings', () => {
	const line = (id: string, markNo: string, bomItemId?: string | null) => ({
		id,
		markNo,
		bomItemId
	});

	it('matches by bom_item_id and uses the full page image', () => {
		expect(
			toJobCardDrawings(
				[line('l1', '1610H', 'item-1')],
				[
					{
						bom_item_id: 'item-1',
						bom_mark: '1610H',
						match_status: 'matched',
						page_id: 'page-1'
					}
				],
				new Map([['page-1', 'full-1']])
			)
		).toEqual([{ id: 'l1', markNo: '1610H', fileId: 'full-1' }]);
	});

	it('falls back to mark_no then hole-review full_page_file_id', () => {
		expect(
			toJobCardDrawings(
				[line('l1', '1610h')],
				[
					{
						bom_mark: '1610H',
						match_status: 'matched',
						metadata: { hole_images: { full_page_file_id: 'full-1' } }
					}
				]
			)
		).toEqual([{ id: 'l1', markNo: '1610h', fileId: 'full-1' }]);
	});

	it('matches job-card prefixed marks to OCR bom_mark last token', () => {
		expect(
			toJobCardDrawings(
				[line('l1', 'JA49 DA 1810H')],
				[
					{
						bom_mark: '1810H',
						match_status: 'matched',
						page_id: 'page-1'
					}
				],
				new Map([['page-1', 'full-1']])
			)
		).toEqual([{ id: 'l1', markNo: 'JA49 DA 1810H', fileId: 'full-1' }]);
	});

	it('matches when OCR stores the full prefixed bom_mark', () => {
		expect(
			toJobCardDrawings(
				[line('l1', 'JA49 DA 1810H')],
				[
					{
						bom_mark: 'JA49 DA 1810H',
						match_status: 'matched',
						page_id: 'page-1'
					}
				],
				new Map([['page-1', 'full-1']])
			)
		).toEqual([{ id: 'l1', markNo: 'JA49 DA 1810H', fileId: 'full-1' }]);
	});

	it('collects only page ids for this card marks', () => {
		expect(
			pageIdsForJobCardDrawings(
				[line('l1', 'JA49 DA 1810H'), line('l2', 'JA49 DA 1811H')],
				[
					{ bom_mark: '1810H', match_status: 'matched', page_id: 'p1' },
					{ bom_mark: '1811H', match_status: 'matched', page_id: 'p2' },
					{ bom_mark: '9999H', match_status: 'matched', page_id: 'p-other' },
					{ bom_mark: '1810H', match_status: 'not_in_pdf', page_id: 'p-skip' }
				]
			).sort()
		).toEqual(['p1', 'p2']);
	});

	it('skips not_in_pdf and marks with no full page', () => {
		expect(
			toJobCardDrawings(
				[line('l1', 'A', 'item-1'), line('l2', 'B', 'item-2')],
				[
					{ bom_item_id: 'item-1', match_status: 'not_in_pdf', page_id: 'page-1' },
					{ bom_item_id: 'item-2', match_status: 'matched' }
				],
				new Map([['page-1', 'full-1']])
			)
		).toEqual([]);
	});
});
