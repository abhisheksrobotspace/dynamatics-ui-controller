import { describe, expect, it } from 'vitest';
import {
	indexToLetterSuffix,
	letterSuffixToIndex,
	dateFromPlanMonth,
	nextPlanId,
	planIdMonthPrefix,
	planMonthDate,
	planMonthOptions,
	currentLocalPlanMonth
} from './create-plan.id.js';
import { mapReleaseToPlanRelease, releaseBatchWeightMt } from './create-plan.mapper.js';
import {
	computePlanSummary,
	planIdByReleaseId,
	planSummaryToPayload
} from './create-plan.utils.js';
import { DEFAULT_APS_PLANT_LABEL } from './aps-plant.constants.js';
import type { PlanProject } from './create-plan.types.js';

describe('create-plan.id', () => {
	it('builds month prefix and month date in UTC', () => {
		const now = new Date(Date.UTC(2026, 6, 15));
		expect(planIdMonthPrefix(now)).toBe('MP-2026-07-');
		expect(planMonthDate(now)).toBe('2026-07-01');
	});

	it('allocates letter suffixes including AA after Z', () => {
		expect(indexToLetterSuffix(0)).toBe('A');
		expect(indexToLetterSuffix(25)).toBe('Z');
		expect(indexToLetterSuffix(26)).toBe('AA');
		expect(letterSuffixToIndex('A')).toBe(0);
		expect(letterSuffixToIndex('Z')).toBe(25);
		expect(letterSuffixToIndex('AA')).toBe(26);
	});

	it('picks next free plan id for the month', () => {
		const now = new Date(Date.UTC(2026, 6, 15));
		expect(nextPlanId([], now)).toBe('MP-2026-07-A');
		expect(nextPlanId(['MP-2026-07-A', 'MP-2026-07-B'], now)).toBe('MP-2026-07-C');
		expect(nextPlanId(['MP-2026-06-Z', 'MP-2026-07-A'], now)).toBe('MP-2026-07-B');
	});

	it('lists all months of a year as YYYY-MM-01 options', () => {
		const options = planMonthOptions(2026);
		expect(options).toHaveLength(12);
		expect(options[0]).toEqual({ value: '2026-01-01', label: 'January 2026' });
		expect(options[11]).toEqual({ value: '2026-12-01', label: 'December 2026' });
	});

	it('parses a plan month into a UTC first-of-month date', () => {
		expect(dateFromPlanMonth('2026-07-01')?.toISOString()).toBe('2026-07-01T00:00:00.000Z');
		expect(dateFromPlanMonth('2026-13-01')).toBeNull();
		expect(dateFromPlanMonth('07/2026')).toBeNull();
	});

	it('uses the local calendar month for the default selection', () => {
		expect(currentLocalPlanMonth(new Date(2026, 6, 15))).toBe('2026-07-01');
	});
});

describe('already-in-plan overlay', () => {
	it('maps production_plan_id to first plan_id', () => {
		const map = planIdByReleaseId([
			{ production_plan_id: 'pp1', plan_id: 'MP-2026-07-A' },
			{ production_plan_id: 'pp1', plan_id: 'MP-2026-07-B' },
			{ production_plan_id: 'pp2', plan_id: 'MP-2026-08-A' }
		]);
		expect(map.get('pp1')).toBe('MP-2026-07-A');
		expect(map.get('pp2')).toBe('MP-2026-08-A');
	});

	it('marks production plan unavailable when already in a plan', () => {
		const release = mapReleaseToPlanRelease({
			release: {
				production_plan_id: 'pp1',
				project_id: 'p1',
				plan_name: 'PP-12',
				plan_date: '2026-03-24'
			},
			lines: [
				{
					production_plan_line_id: 'l1',
					bom_id: 'b1',
					quantity: 10,
					unit: 'Set',
					description: 'Basic Body'
				}
			],
			boms: [{ bom_id: 'b1', structure_id: 't1', bom_name: 'Basic Body', sort_order: 0 }],
			structures: [{ structure_id: 't1', name: 'HA type', type: 'tower', sort_order: 0 }],
			workOrderCode: 'J1050',
			planIdIfTaken: 'MP-2026-04'
		});
		expect(release.selectable).toBe(false);
		expect(release.disabledReason).toBe('Already in MP-2026-04');
		expect(release.status).toBe('unavailable');
	});
});

describe('computePlanSummary', () => {
	const projects: PlanProject[] = [
		{
			id: 'p1',
			title: 'P1',
			subtitle: '',
			workOrderCode: 'WO-1',
			releases: [
				{
					id: 'r1',
					projectId: 'p1',
					label: 'R-1',
					status: 'confirmed',
					selectable: true,
					workOrderCode: 'WO-1',
					sets: 5,
					batchWeightMt: 12.5,
					plants: '-',
					zincReqMt: 1.5,
					selectedLines: { l1: 5 },
					structureCount: 2,
					towerParts: [],
					stubs: []
				},
				{
					id: 'r2',
					projectId: 'p1',
					label: 'R-2',
					status: 'confirmed',
					selectable: true,
					workOrderCode: 'WO-1',
					sets: 3,
					batchWeightMt: 4,
					plants: '-',
					zincReqMt: 0.5,
					selectedLines: { l2: 3 },
					structureCount: 1,
					towerParts: [],
					stubs: []
				}
			]
		},
		{
			id: 'p2',
			title: 'P2',
			subtitle: '',
			workOrderCode: 'WO-2',
			releases: [
				{
					id: 'r3',
					projectId: 'p2',
					label: 'R-3',
					status: 'confirmed',
					selectable: true,
					workOrderCode: 'WO-2',
					sets: 4,
					batchWeightMt: 7.5,
					plants: '-',
					zincReqMt: 2,
					selectedLines: { l3: 4 },
					structureCount: 1,
					towerParts: [],
					stubs: []
				}
			]
		}
	];

	it('aggregates sets, work orders, zinc, batch weight, and structures for selected releases', () => {
		const summary = computePlanSummary(projects, new Set(['r1', 'r3']));
		expect(summary.releases).toBe(2);
		expect(summary.projects).toBe(2);
		expect(summary.workOrders).toBe('WO-1, WO-2');
		expect(summary.sets).toBe(9);
		expect(summary.structures).toBe(3);
		expect(summary.batchWeightMt).toBe(20);
		expect(summary.plants).toBe(DEFAULT_APS_PLANT_LABEL);
		expect(summary.zincReqMt).toBe(3.5);
	});

	it('maps summary to persist payload including zinc and batch weight', () => {
		const summary = computePlanSummary(projects, new Set(['r1']));
		const payload = planSummaryToPayload(summary);
		expect(payload.production_plans).toBe(1);
		expect(payload.work_orders).toEqual(['WO-1']);
		expect(payload.sets).toBe(5);
		expect(payload.zinc_req_mt).toBe(1.5);
		expect(payload.batch_weight_mt).toBe(12.5);
	});
});

describe('releaseBatchWeightMt', () => {
	it('sums BOM set kg × line qty into MT', () => {
		const bomKg = new Map([
			['b1', 1000],
			['b2', 500]
		]);
		expect(
			releaseBatchWeightMt(
				[
					{ production_plan_line_id: 'l1', bom_id: 'b1', quantity: 2, unit: 'Set' },
					{ production_plan_line_id: 'l2', bom_id: 'b2', quantity: 4, unit: 'Set' }
				],
				bomKg
			)
		).toBe(4);
	});
});
