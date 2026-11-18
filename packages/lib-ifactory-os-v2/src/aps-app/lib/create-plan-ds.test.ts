import { describe, expect, it } from 'vitest';
import {
	countSelectedBomLeaves,
	formatDeliveryScheduleLabel,
	formatIsoDateDdMmYyyy,
	isOverProductionTarget,
	monthRangeFromPlanMonth,
	rollupSelectedWeightByProject,
	sumSelectedWeightMt,
	weightMtFromRollupKg
} from './create-plan-ds.utils.js';
import { computeMaxLoadingMt, readPlantCapacityMt, readPlantMaxLoading } from './plant-capacity.js';
import type { MfgDsProjectGroup } from './create-plan-ds.types.js';

describe('monthRangeFromPlanMonth', () => {
	it('derives start and end for a 31-day month', () => {
		expect(monthRangeFromPlanMonth('2026-07-01')).toEqual({
			startDate: '2026-07-01',
			endDate: '2026-07-31'
		});
	});

	it('handles February non-leap', () => {
		expect(monthRangeFromPlanMonth('2026-02')).toEqual({
			startDate: '2026-02-01',
			endDate: '2026-02-28'
		});
	});

	it('returns null for invalid month', () => {
		expect(monthRangeFromPlanMonth('not-a-month')).toBeNull();
	});
});

describe('weight helpers', () => {
	it('computes MT from rollup kg with set scale', () => {
		expect(weightMtFromRollupKg(2000, 2, 2)).toBe(2);
		expect(weightMtFromRollupKg(2000, 2, 1)).toBe(1);
		expect(weightMtFromRollupKg(null, 2, 2)).toBeNull();
	});

	it('formats iso date', () => {
		expect(formatIsoDateDdMmYyyy('2026-07-15')).toBe('15-07-2026');
	});

	it('formats delivery schedule label as name - date', () => {
		expect(formatDeliveryScheduleLabel('Lot A', '15-07-2026')).toBe('Lot A - 15-07-2026');
		expect(formatDeliveryScheduleLabel('', '15-07-2026')).toBe('15-07-2026');
		expect(formatDeliveryScheduleLabel('Lot A', '')).toBe('Lot A');
	});
});

describe('plant capacity + max loading', () => {
	it('reads monthly_capacity_mt and max_loading_pct from plant columns', () => {
		expect(readPlantCapacityMt({ monthly_capacity_mt: 800 })).toBe(800);
		expect(readPlantCapacityMt({ monthly_capacity_mt: '2000' })).toBe(2000);
		expect(readPlantCapacityMt({})).toBeNull();
		expect(readPlantMaxLoading({ max_loading_pct: 150 })).toBe(150);
		expect(readPlantMaxLoading({ max_loading_pct: '125' })).toBe(125);
		expect(readPlantMaxLoading({})).toBeNull();
	});

	it('computes max loading MT', () => {
		expect(computeMaxLoadingMt(800, 125)).toBe(1000);
		expect(computeMaxLoadingMt(800, 150)).toBe(1200);
		expect(computeMaxLoadingMt(null, 125)).toBeNull();
		expect(computeMaxLoadingMt(800, null)).toBeNull();
	});

	it('detects over max loading', () => {
		expect(isOverProductionTarget(1001, 800, 125)).toBe(true);
		expect(isOverProductionTarget(1000, 800, 125)).toBe(false);
		expect(isOverProductionTarget(1001, 800, null)).toBe(false);
	});
});

describe('selection rollup', () => {
	const projects: MfgDsProjectGroup[] = [
		{
			id: 'project-p1',
			projectId: 'p1',
			title: 'Alpha',
			weightMt: 5,
			schedules: [
				{
					id: 'schedule-s1',
					scheduleId: 's1',
					projectId: 'p1',
					deliveryDate: '2026-07-10',
					label: 'Lot A - 10-07-2026',
					name: 'Lot A',
					weightMt: 5,
					structures: [
						{
							id: 'structure-s1-t1',
							structureId: 't1',
							name: 'Tower A',
							type: 'tower',
							weightMt: 5,
							boms: [
								{
									id: 'bom-s1-b1',
									scheduleId: 's1',
									projectId: 'p1',
									structureId: 't1',
									bomId: 'b1',
									scheduleLineId: 'line-1',
									bomName: 'BOM1',
									unit: 'Set',
									qty: 2,
									weightMt: 3
								},
								{
									id: 'bom-s1-b2',
									scheduleId: 's1',
									projectId: 'p1',
									structureId: 't1',
									bomId: 'b2',
									scheduleLineId: 'line-2',
									bomName: 'BOM2',
									unit: 'Set',
									qty: 1,
									weightMt: 2
								}
							]
						}
					]
				}
			]
		}
	];

	it('rolls up selected weight by project', () => {
		const selected = new Set(['bom-s1-b1']);
		expect(rollupSelectedWeightByProject(projects, selected)).toEqual([
			{ projectId: 'p1', title: 'Alpha', weightMt: 3 }
		]);
		expect(sumSelectedWeightMt(projects, selected)).toBe(3);
	});

	it('counts only BOM leaf selection, not parent row ids', () => {
		expect(countSelectedBomLeaves(projects, new Set(['bom-s1-b1']))).toBe(1);
		expect(countSelectedBomLeaves(projects, new Set(['project-p1', 'schedule-s1']))).toBe(0);
		expect(countSelectedBomLeaves(projects, new Set())).toBe(0);
	});
});
