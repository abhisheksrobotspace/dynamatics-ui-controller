import { describe, expect, it } from 'vitest';
import {
	buildJobCardOrderTree,
	flattenUnitTaskMarks,
	formatGanttBarLabel,
	formatJobCardLeafLabel,
	formatScheduleTaskLabel,
	ganttHighlightIdsForTreeSelection,
	markTreeNodeId,
	rmTreeNodeId,
	taskGanttHighlightIds,
	taskOrderId,
	UNASSIGNED_ORDER_ID
} from './production-schedule.derive.js';

describe('formatScheduleTaskLabel', () => {
	it('labels unit tasks with a 1-based bar index', () => {
		expect(
			formatScheduleTaskLabel({
				task_id: 't1',
				task_kind: 'unit',
				product: '55x55x4',
				unit_index: 0
			})
		).toBe('55x55x4 · bar 1');
	});

	it('labels bundle tasks with a 1-based bundle index', () => {
		expect(
			formatScheduleTaskLabel({
				task_id: 't1',
				task_kind: 'bundle',
				mark_no: '1426H',
				bundle_index: 2
			})
		).toBe('1426H · Bundle 3');
	});
});

describe('buildJobCardOrderTree', () => {
	it('nests WO → tower → BOM → section and appends Unassigned', () => {
		const tree = buildJobCardOrderTree(
			[
				{
					job_card_id: 'c1',
					work_order_id: 'WO-1',
					tower_label: 'T1',
					bom_name: 'BOM A',
					section: '55x55x4',
					card_no: 1441,
					status: 'draft'
				}
			],
			true
		);
		expect(tree[0]?.children?.map((c) => c.label)).toEqual(['WO-1', 'Unassigned']);
		expect(tree[0]?.children?.[0]?.children?.[0]?.children?.[0]?.children?.[0]).toEqual({
			id: 'c1',
			label: '55x55x4'
		});
	});

	it('nests RMID → marking under a section from unit tasks', () => {
		const tree = buildJobCardOrderTree(
			[
				{
					job_card_id: 'c1',
					work_order_id: 'WO-1',
					tower_label: 'T1',
					bom_name: 'BOM A',
					section: '55x55x4',
					card_no: 1,
					status: 'draft'
				}
			],
			false,
			[
				{
					task_id: 'u1',
					job_card_id: 'c1',
					task_kind: 'unit',
					rm_id: 'RM-1',
					unit_index: 0,
					metadata: { marks: [{ mark_no: 'A' }, { mark_no: 'B' }] }
				}
			]
		);
		const section = tree[0]?.children?.[0]?.children?.[0]?.children?.[0]?.children?.[0];
		expect(section?.id).toBe('c1');
		expect(section?.children).toEqual([
			{
				id: rmTreeNodeId('c1', 'RM-1'),
				label: 'RM-1',
				children: [
					{ id: markTreeNodeId('c1', 'RM-1', 'A'), label: 'A' },
					{ id: markTreeNodeId('c1', 'RM-1', 'B'), label: 'B' }
				]
			}
		]);
	});

	it('skips cancelled cards', () => {
		const tree = buildJobCardOrderTree(
			[
				{
					job_card_id: 'c1',
					work_order_id: 'WO-1',
					tower_label: 'T1',
					bom_name: 'BOM A',
					section: 'S',
					card_no: 1,
					status: 'cancelled'
				}
			],
			false
		);
		expect(tree[0]?.children).toEqual([]);
	});
});

describe('taskOrderId', () => {
	it('uses job_card_id and maps NULL to Unassigned', () => {
		expect(taskOrderId('c1')).toBe('c1');
		expect(taskOrderId(null)).toBe(UNASSIGNED_ORDER_ID);
	});
});

describe('flattenUnitTaskMarks', () => {
	it('flattens metadata.marks in start_time then seq order', () => {
		const marks = flattenUnitTaskMarks(
			[
				{
					task_id: 'later',
					job_card_id: 'c1',
					task_kind: 'unit',
					start_time: '2026-08-23T13:00:00Z',
					machine_id: 'NJM-02',
					rm_id: 'RM-2',
					unit_index: 1,
					metadata: { marks: [{ mark_no: 'B', qty: 2 }] }
				},
				{
					task_id: 'first',
					job_card_id: 'c1',
					task_kind: 'unit',
					start_time: '2026-08-23T12:00:00Z',
					machine_id: 'NJM-01',
					rm_id: 'RM-1',
					unit_index: 0,
					metadata: {
						marks: [
							{ mark_no: 'A', qty: 4 },
							{ mark_no: 'A2', qty: 1 }
						]
					}
				},
				{
					task_id: 'other',
					job_card_id: 'c2',
					task_kind: 'unit',
					metadata: { marks: [{ mark_no: 'X' }] }
				}
			],
			'c1'
		);
		expect(marks.map((m) => m.mark_no)).toEqual(['A', 'A2', 'B']);
		expect(marks[0]).toMatchObject({ bar: 1, machine_id: 'NJM-01', rm_id: 'RM-1', qty: 4 });
	});

	it('returns [] when metadata.marks is missing or {}', () => {
		expect(
			flattenUnitTaskMarks(
				[{ task_id: 't1', job_card_id: 'c1', task_kind: 'unit', metadata: { marks: {} } }],
				'c1'
			)
		).toEqual([]);
	});

	it('can scope to one unit task', () => {
		expect(
			flattenUnitTaskMarks(
				[
					{
						task_id: 't1',
						job_card_id: 'c1',
						task_kind: 'unit',
						unit_index: 0,
						metadata: { marks: [{ mark_no: 'A' }] }
					},
					{
						task_id: 't2',
						job_card_id: 'c1',
						task_kind: 'unit',
						unit_index: 1,
						metadata: { marks: [{ mark_no: 'B' }] }
					}
				],
				'c1',
				't2'
			).map((m) => m.mark_no)
		).toEqual(['B']);
	});
});

describe('formatGanttBarLabel', () => {
	it('joins section • tower • BOM • tonnage', () => {
		expect(
			formatGanttBarLabel({
				section: 'HT ANGLE 45x45x4',
				tower_label: 'NBA',
				bom_name: '5MBE',
				total_weight_mt: 2.4
			})
		).toBe('HT ANGLE 45x45x4 • NBA • 5MBE • 2.40 MT');
	});

	it('uses dashes when card fields are missing', () => {
		expect(formatGanttBarLabel(null, 'HT ANGLE 45x45x4')).toBe('HT ANGLE 45x45x4 • - • - • -');
	});
});

describe('ganttHighlightIdsForTreeSelection', () => {
	const tree = buildJobCardOrderTree(
		[
			{
				job_card_id: 'c1',
				work_order_id: 'WO-1',
				tower_label: 'T1',
				bom_name: 'BOM A',
				section: 'S',
				card_no: 1,
				status: 'draft'
			}
		],
		false,
		[
			{
				task_id: 'u1',
				job_card_id: 'c1',
				task_kind: 'unit',
				rm_id: 'RM-1',
				metadata: { marks: [{ mark_no: 'A' }] }
			}
		]
	);

	it('returns null for All orders', () => {
		expect(ganttHighlightIdsForTreeSelection(tree, 'all')).toBeNull();
	});

	it('highlights the section id when a section or ancestor is selected', () => {
		expect(ganttHighlightIdsForTreeSelection(tree, 'c1')).toEqual(['c1']);
		expect(ganttHighlightIdsForTreeSelection(tree, 'wo-WO-1')).toEqual(['c1']);
	});

	it('highlights the RMID or marking node id when those leaves are selected', () => {
		expect(ganttHighlightIdsForTreeSelection(tree, rmTreeNodeId('c1', 'RM-1'))).toEqual([
			rmTreeNodeId('c1', 'RM-1')
		]);
		expect(ganttHighlightIdsForTreeSelection(tree, markTreeNodeId('c1', 'RM-1', 'A'))).toEqual([
			markTreeNodeId('c1', 'RM-1', 'A')
		]);
	});
});

describe('taskGanttHighlightIds', () => {
	const unit = {
		task_id: 'u1',
		job_card_id: 'c1',
		task_kind: 'unit' as const,
		rm_id: 'RM-1',
		metadata: { marks: [{ mark_no: 'A' }] }
	};
	const bundle = {
		task_id: 'b1',
		job_card_id: 'c1',
		task_kind: 'bundle' as const,
		mark_no: 'A'
	};

	it('tags unit bars with section, RMID, and marking ids', () => {
		expect(taskGanttHighlightIds(unit, [unit, bundle])).toEqual([
			'c1',
			rmTreeNodeId('c1', 'RM-1'),
			markTreeNodeId('c1', 'RM-1', 'A')
		]);
	});

	it('tags bundle bars with section and matching marking ids', () => {
		expect(taskGanttHighlightIds(bundle, [unit, bundle])).toEqual([
			'c1',
			markTreeNodeId('c1', 'RM-1', 'A')
		]);
	});
});

describe('formatJobCardLeafLabel', () => {
	it('is M-<card_no> · section', () => {
		expect(formatJobCardLeafLabel({ job_card_id: 'c1', card_no: 9, section: 'ISA' })).toBe(
			'M-9 · ISA'
		);
		expect(formatJobCardLeafLabel({ job_card_id: 'c1', card_no: 9 })).toBe('M-9');
	});
});
