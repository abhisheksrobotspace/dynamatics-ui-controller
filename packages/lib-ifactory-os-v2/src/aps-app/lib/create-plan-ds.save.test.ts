import { describe, expect, it } from 'vitest';
import type { MfgDsProjectGroup } from './create-plan-ds.types.js';
import {
	buildPlanDeliveryScheduleInputs,
	computeDsPlanSummary,
	filterProjectsToSavedSchedules,
	selectedLeafIdsFromSavedLinks,
	workOrdersForSelection
} from './create-plan-ds.save.js';

const projects: MfgDsProjectGroup[] = [
	{
		id: 'project-p1',
		projectId: 'p1',
		title: 'Alpha',
		workOrderCode: 'J1050',
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

describe('buildPlanDeliveryScheduleInputs', () => {
	it('groups selected leaves into one junction row per schedule', () => {
		const rows = buildPlanDeliveryScheduleInputs(projects, new Set(['bom-s1-b1']), 'NASHIK-1');
		expect(rows).toEqual([
			{
				projectId: 'p1',
				deliveryScheduleId: 's1',
				plantId: 'NASHIK-1',
				selectedLines: { 'line-1': 2 }
			}
		]);
	});

	it('returns empty when no BOM leaves are selected', () => {
		expect(buildPlanDeliveryScheduleInputs(projects, new Set(), 'NASHIK-1')).toEqual([]);
		expect(buildPlanDeliveryScheduleInputs(projects, new Set(['project-p1']), 'NASHIK-1')).toEqual(
			[]
		);
	});
});

describe('selectedLeafIdsFromSavedLinks', () => {
	it('maps saved selected_lines back to tree leaf ids', () => {
		expect(
			selectedLeafIdsFromSavedLinks(projects, [
				{ delivery_schedule_id: 's1', selected_lines: { 'line-2': 1 } }
			])
		).toEqual(['bom-s1-b2']);
	});
});

describe('filterProjectsToSavedSchedules', () => {
	it('drops schedules that were not saved on the plan', () => {
		const extra: MfgDsProjectGroup[] = [
			{
				...projects[0]!,
				schedules: [
					projects[0]!.schedules[0]!,
					{
						...projects[0]!.schedules[0]!,
						id: 'schedule-s2',
						scheduleId: 's2',
						label: 'Lot B - 20-07-2026',
						name: 'Lot B',
						weightMt: 9
					}
				],
				weightMt: 14
			}
		];
		const filtered = filterProjectsToSavedSchedules(extra, [{ delivery_schedule_id: 's1' }]);
		expect(filtered).toHaveLength(1);
		expect(filtered[0]?.schedules.map((s) => s.scheduleId)).toEqual(['s1']);
		expect(filtered[0]?.weightMt).toBe(5);
	});

	it('drops projects with no saved schedules', () => {
		expect(filterProjectsToSavedSchedules(projects, [{ delivery_schedule_id: 'missing' }])).toEqual(
			[]
		);
	});
});

describe('computeDsPlanSummary', () => {
	it('rolls up selected schedules and structures', () => {
		const summary = computeDsPlanSummary(projects, new Set(['bom-s1-b1', 'bom-s1-b2']), ['J1050']);
		expect(summary).toMatchObject({
			production_plans: 1,
			projects: 1,
			work_orders: ['J1050'],
			structures: 1,
			sets: 3,
			batch_weight_mt: 5,
			plants: 'Plant 1',
			zinc_req_mt: 0
		});
	});
});

describe('workOrdersForSelection', () => {
	it('returns work orders only for projects with selected lines', () => {
		expect(workOrdersForSelection(projects, new Set(['bom-s1-b1']))).toEqual(['J1050']);
		expect(workOrdersForSelection(projects, new Set())).toEqual([]);
	});
});
