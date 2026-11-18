import type {
	ScheduleJobDetail,
	ScheduleResource,
	ScheduleTask,
	ScheduleTreeNode,
	UtilizationSeries
} from '@ifactory/ui-v2';
import { markSlug } from '@ifactory/ui-v2';
import { getReviewInputDetail } from './review-input.mock.js';
import {
	productionScheduleHash,
	type ProductionScheduleData
} from './production-schedule.types.js';

export type { ProductionScheduleData };
export { productionScheduleHash };

/** Simulation anchor for mock Gantt timestamps (03/07/2026 14:06 local). */
export const PRODUCTION_SCHEDULE_SIM_START_MS = new Date('2026-07-03T14:06:00').getTime();

const TIMELINE_SPAN_MIN = 300;

const defaultTasks: ScheduleTask[] = [
	// B-1
	{
		id: 't-b-1',
		resourceId: 'B-1',
		label: 'J1047 DA 12A / step_0_B',
		orderId: 'j1047',
		markLabel: 'J1047 DA 12A',
		stepId: 'step_0_B',
		startMin: 20,
		durationMin: 22,
		color: '#64748B'
	},
	{
		id: 't-b-2',
		resourceId: 'B-1',
		label: 'J1058 DB 21H / step_0_B',
		orderId: 'j1058',
		markLabel: 'J1058 DB 21H',
		stepId: 'step_0_B',
		startMin: 55,
		durationMin: 16,
		changeoverMin: 3,
		color: '#94A3B8'
	},

	// CPD-1
	{
		id: 't-cpd-1',
		resourceId: 'CPD-1',
		label: 'J55 HA 95H / step_0_CPD',
		orderId: 'j1055',
		markLabel: 'J55 HA 95H',
		stepId: 'step_0_CPD',
		startMin: 6,
		durationMin: 18,
		color: '#3B82F6'
	},
	{
		id: 't-cpd-2',
		resourceId: 'CPD-1',
		label: 'J55 DA 87H / step_0_CPD',
		orderId: 'j1055',
		markLabel: 'J55 DA 87H',
		stepId: 'step_0_CPD',
		startMin: 28,
		durationMin: 14,
		changeoverMin: 2,
		color: '#8B5CF6'
	},
	{
		id: 't-cpd-3',
		resourceId: 'CPD-1',
		label: 'J1047 DA 14H / step_0_CPD',
		orderId: 'j1047',
		markLabel: 'J1047 DA 14H',
		stepId: 'step_0_CPD',
		startMin: 48,
		durationMin: 20,
		changeoverMin: 3,
		color: '#6366F1'
	},
	{
		id: 't-cpd-4',
		resourceId: 'CPD-1',
		label: 'J1057 BB 32H / step_0_CPD',
		orderId: 'j1057',
		markLabel: 'J1057 BB 32H',
		stepId: 'step_0_CPD',
		startMin: 78,
		durationMin: 24,
		color: '#A855F7'
	},

	// CPS-1
	{
		id: 't-cps-1',
		resourceId: 'CPS-1',
		label: 'J55 DA 87H / step_0_CPS',
		orderId: 'j1055',
		markLabel: 'J55 DA 87H',
		stepId: 'step_0_CPS',
		startMin: 32,
		durationMin: 12,
		color: '#14B8A6'
	},
	{
		id: 't-cps-1b',
		resourceId: 'CPS-1',
		label: 'J55 DA 92H / step_1_CPS',
		orderId: 'j1055',
		markLabel: 'J55 DA 92H',
		stepId: 'step_1_CPS',
		startMin: 52,
		durationMin: 28,
		changeoverMin: 2,
		color: '#0D9488'
	},
	{
		id: 't-cps-1c',
		resourceId: 'CPS-1',
		label: 'J55 DA 93H / step_1_CPS',
		orderId: 'j1055',
		markLabel: 'J55 DA 93H',
		stepId: 'step_1_CPS',
		startMin: 88,
		durationMin: 18,
		color: '#22C55E'
	},

	// CPS-2
	{
		id: 't-cps-2a',
		resourceId: 'CPS-2',
		label: 'J55 DA 88H / step_0_CPS',
		orderId: 'j1055',
		markLabel: 'J55 DA 88H',
		stepId: 'step_0_CPS',
		startMin: 18,
		durationMin: 14,
		color: '#22C55E'
	},
	{
		id: 't-cps-2b',
		resourceId: 'CPS-2',
		label: 'J55 DA 89H / step_0_CPS',
		orderId: 'j1055',
		markLabel: 'J55 DA 89H',
		stepId: 'step_0_CPS',
		startMin: 40,
		durationMin: 16,
		changeoverMin: 2,
		color: '#16A34A'
	},
	{
		id: 't-cps-2c',
		resourceId: 'CPS-2',
		label: 'J55 HA 94B / step_1_CPS',
		orderId: 'j1055',
		markLabel: 'J55 HA 94B',
		stepId: 'step_1_CPS',
		startMin: 65,
		durationMin: 36,
		color: '#4ADE80'
	},
	{
		id: 't-cps-2d',
		resourceId: 'CPS-2',
		label: 'J1047 DA 15C / step_0_CPS',
		orderId: 'j1047',
		markLabel: 'J1047 DA 15C',
		stepId: 'step_0_CPS',
		startMin: 110,
		durationMin: 22,
		changeoverMin: 3,
		color: '#86EFAC'
	},

	// H-1
	{
		id: 't-h-1',
		resourceId: 'H-1',
		label: 'J55 DA 87H / step_0_H',
		orderId: 'j1055',
		markLabel: 'J55 DA 87H',
		stepId: 'step_0_H',
		startMin: 50,
		durationMin: 12,
		color: '#EAB308'
	},
	{
		id: 't-h-2',
		resourceId: 'H-1',
		label: 'J55 HA 94B / step_2_H',
		orderId: 'j1055',
		markLabel: 'J55 HA 94B',
		stepId: 'step_2_H',
		startMin: 78,
		durationMin: 40,
		changeoverMin: 2,
		color: '#CA8A04'
	},
	{
		id: 't-h-3',
		resourceId: 'H-1',
		label: 'J1057 BB 31H / step_0_H',
		orderId: 'j1057',
		markLabel: 'J1057 BB 31H',
		stepId: 'step_0_H',
		startMin: 130,
		durationMin: 18,
		color: '#FACC15'
	},

	// N-3
	{
		id: 't-n-1',
		resourceId: 'N-3',
		label: 'J1047 DA 13A / step_0_N',
		orderId: 'j1047',
		markLabel: 'J1047 DA 13A',
		stepId: 'step_0_N',
		startMin: 10,
		durationMin: 14,
		color: '#8B5CF6'
	},
	{
		id: 't-n-2',
		resourceId: 'N-3',
		label: 'J55 DA 90H / step_0_N',
		orderId: 'j1055',
		markLabel: 'J55 DA 90H',
		stepId: 'step_0_N',
		startMin: 30,
		durationMin: 20,
		changeoverMin: 4,
		color: '#14B8A6'
	},
	{
		id: 't-n-3',
		resourceId: 'N-3',
		label: 'J55 DA 88H / step_1_N',
		orderId: 'j1055',
		markLabel: 'J55 DA 88H',
		stepId: 'step_1_N',
		startMin: 62,
		durationMin: 16,
		changeoverMin: 2,
		color: '#06B6D4'
	},
	{
		id: 't-n-4',
		resourceId: 'N-3',
		label: 'J1058 DB 22H / step_1_N',
		orderId: 'j1058',
		markLabel: 'J1058 DB 22H',
		stepId: 'step_1_N',
		startMin: 90,
		durationMin: 28,
		color: '#2DD4BF'
	}
];

const defaultOrderTree: ScheduleTreeNode[] = [
	{
		id: 'all',
		label: 'All Orders',
		children: [
			{
				id: 'proj-j1050',
				label: 'J1050/1051 — Pune III Transmission Ltd',
				children: [
					{
						id: 'tower-ha',
						label: 'HA type',
						children: [
							{
								id: 'bom-basic-body',
								label: 'Basic Body (with Basic Level Plan)',
								children: [
									{
										id: 'sec-basic-body::HT ANGLE 90X90X5',
										label: 'HT ANGLE 90X90X5',
										children: [
											{ id: 'j55-da-87h', label: 'J55 DA 87H' },
											{ id: 'j55-da-88h', label: 'J55 DA 88H' },
											{ id: 'j55-da-89h', label: 'J55 DA 89H' },
											{ id: 'j55-da-92h', label: 'J55 DA 92H' }
										]
									},
									{
										id: 'sec-basic-body::HT ANGLE 75X75X6',
										label: 'HT ANGLE 75X75X6',
										children: [
											{ id: 'j55-da-90h', label: 'J55 DA 90H' },
											{ id: 'j55-da-93h', label: 'J55 DA 93H' },
											{ id: 'j55-ha-94b', label: 'J55 HA 94B' },
											{ id: 'j55-ha-95h', label: 'J55 HA 95H' }
										]
									}
								]
							},
							{
								id: 'bom-ext-3',
								label: '+3m Body Extension',
								children: [
									{
										id: 'sec-ext-3::HT ANGLE 90X90X5',
										label: 'HT ANGLE 90X90X5',
										children: [
											{ id: 'j55-ha-101', label: 'J55 HA 101' },
											{ id: 'j55-ha-102', label: 'J55 HA 102' }
										]
									}
								]
							},
							{
								id: 'bom-ext-6',
								label: '+6m Body Extension',
								children: [
									{
										id: 'sec-ext-6::HT ANGLE 75X75X6',
										label: 'HT ANGLE 75X75X6',
										children: [{ id: 'j55-ha-103', label: 'J55 HA 103' }]
									}
								]
							}
						]
					},
					{
						id: 'tower-3b5',
						label: '3B5 type',
						children: [
							{
								id: 'bom-3b5-basic',
								label: 'Basic Body',
								children: [
									{
										id: 'sec-3b5-basic::HT ANGLE 100X100X8',
										label: 'HT ANGLE 100X100X8',
										children: [
											{ id: 'j1057-bb-31h', label: 'J1057 BB 31H' },
											{ id: 'j1057-bb-32h', label: 'J1057 BB 32H' }
										]
									}
								]
							}
						]
					}
				]
			},
			{
				id: 'proj-j1047',
				label: 'J1047 — Nashik Evacuation Corridor',
				children: [
					{
						id: 'tower-da',
						label: 'DA - Basic Tower',
						children: [
							{
								id: 'bom-da-common',
								label: 'Common Plan at −3m lvl',
								children: [
									{
										id: 'sec-da-common::HT ANGLE 90X90X5',
										label: 'HT ANGLE 90X90X5',
										children: [
											{ id: 'j1047-da-12a', label: 'J1047 DA 12A' },
											{ id: 'j1047-da-13a', label: 'J1047 DA 13A' },
											{ id: 'j1047-da-14h', label: 'J1047 DA 14H' },
											{ id: 'j1047-da-15c', label: 'J1047 DA 15C' }
										]
									}
								]
							}
						]
					}
				]
			},
			{
				id: 'proj-j1058',
				label: 'J1058 — Boisar Spur Line',
				children: [
					{
						id: 'tower-db',
						label: 'DB - Basic Tower',
						children: [
							{
								id: 'bom-db-body',
								label: '−3m Body Extension',
								children: [
									{
										id: 'sec-db-body::HT ANGLE 75X75X6',
										label: 'HT ANGLE 75X75X6',
										children: [
											{ id: 'j1058-db-21h', label: 'J1058 DB 21H' },
											{ id: 'j1058-db-22h', label: 'J1058 DB 22H' }
										]
									}
								]
							}
						]
					}
				]
			}
		]
	}
];

const defaultUtilization: UtilizationSeries[] = [
	{
		id: 'b',
		label: 'Bending (B)',
		color: '#64748B',
		points: [0, 0.35, 0.55, 0.4, 0.15]
	},
	{
		id: 'cpd',
		label: 'Cutting Punching Drilling (CPD)',
		color: '#D946EF',
		points: [0.35, 0.95, 0.7, 0.55, 0.2]
	},
	{
		id: 'cps',
		label: 'Cutting Punching Stamping (CPS)',
		color: '#F59E0B',
		points: [0.55, 0.85, 0.9, 0.88, 0.75]
	},
	{
		id: 'h',
		label: 'Heel Grinding (H)',
		color: '#EAB308',
		points: [0.1, 0.35, 0.7, 0.85, 0.4]
	},
	{
		id: 'n',
		label: 'Notching (N)',
		color: '#14B8A6',
		points: [0.4, 0.75, 0.85, 0.7, 0.5]
	}
];

function detail(
	title: string,
	color: string,
	_step: string,
	machine: string,
	product: string,
	start: string,
	end: string,
	duration: string,
	changeover?: string
): ScheduleJobDetail {
	return {
		title,
		color,
		sections: [
			{
				title: 'Assignment',
				fields: [{ label: 'Machine', value: machine }]
			},
			{
				title: 'Production',
				fields: [
					{ label: 'Product', value: product },
					{ label: 'Qty', value: 2 },
					{ label: 'Holes', value: 6 },
					{ label: 'RM ID', value: 'RM-A22-001' }
				]
			},
			{
				title: 'Timing',
				fields: [
					{ label: 'Start', value: start },
					{ label: 'End', value: end },
					{ label: 'Duration', value: duration },
					...(changeover ? [{ label: 'Changeover before', value: changeover }] : [])
				]
			}
		]
	};
}

const defaultJobDetails: Record<string, ScheduleJobDetail> = {
	'j55-da-87h': detail(
		'J55 DA 87H',
		'#14B8A6',
		'step_0_CPS',
		'CPS-1',
		'HT ANGLE 90×90×5',
		'03/07/2026 14:32',
		'14:43',
		'11m 55s',
		'2m'
	),
	'j55-da-88h': detail(
		'J55 DA 88H',
		'#22C55E',
		'step_0_CPS',
		'CPS-2',
		'HT ANGLE 80×80×5',
		'03/07/2026 14:24',
		'14:38',
		'14m',
		undefined
	),
	'j1047-da-14h': detail(
		'J1047 DA 14H',
		'#6366F1',
		'step_0_CPD',
		'CPD-1',
		'HT ANGLE 100×100×8',
		'03/07/2026 14:54',
		'15:14',
		'20m',
		'3m'
	),
	'j1057-bb-32h': detail(
		'J1057 BB 32H',
		'#A855F7',
		'step_0_CPD',
		'CPD-1',
		'CHANNEL 150×75×6',
		'03/07/2026 15:24',
		'15:48',
		'24m'
	),
	'j1058-db-21h': detail(
		'J1058 DB 21H',
		'#94A3B8',
		'step_0_B',
		'B-1',
		'ANGLE 50×50×4',
		'03/07/2026 15:01',
		'15:17',
		'16m',
		'3m'
	)
};

const defaultResources: ScheduleResource[] = [
	{ id: 'B-1', label: 'B-1', groupId: 'B' },
	{ id: 'CPD-1', label: 'CPD-1', groupId: 'CPD' },
	{ id: 'CPS-1', label: 'CPS-1', groupId: 'CPS' },
	{ id: 'CPS-2', label: 'CPS-2', groupId: 'CPS' },
	{ id: 'H-1', label: 'H-1', groupId: 'H' },
	{ id: 'N-3', label: 'N-3', groupId: 'N' }
];

const schedules: Record<string, ProductionScheduleData> = {
	'mp-001': {
		planId: 'mp-001',
		runId: 'mock-run-mp-001',
		releaseLabel: 'RELEASE G21/04/G20',
		publishedAt: null,
		publishedBy: null,
		sourcesFrozen: true,
		startLabel: '03/07/2026 14:06',
		makespanLabel: '4H 12M',
		taskCount: defaultTasks.length,
		scheduleStartIso: new Date(PRODUCTION_SCHEDULE_SIM_START_MS).toISOString(),
		timelineStart: 'Jul 3',
		timelineHours: ['14:00', '15:00', '16:00', '17:00', '18:00', '19:00'],
		currentTimeMin: 80,
		timelineSpanMin: TIMELINE_SPAN_MIN,
		orderTree: defaultOrderTree,
		resources: defaultResources,
		tasks: defaultTasks,
		dependencyEdges: [
			{ from: 'step_0_CPS', to: 'step_1_N' },
			{ from: 'step_1_CPS', to: 'step_2_H' }
		],
		defaultSelectedMarkId: 'j55-da-87h',
		jobDetailsByMarkId: defaultJobDetails,
		jobDetailsByTaskId: Object.fromEntries(
			defaultTasks.flatMap((task) => {
				const detail = defaultJobDetails[markSlug(task.markLabel ?? '')];
				return detail ? [[task.id, detail] as const] : [];
			})
		),
		utilization: defaultUtilization,
		confirmChange: {
			beforeMachine: 'CPS-2',
			afterMachine: 'CPS-2',
			beforeStart: '03/07 14:47',
			beforeEnd: '03/07 14:53',
			afterStart: '03/07 15:02',
			afterEnd: '03/07 15:08',
			changeover: '+2m (switch)',
			impacts: [
				{
					type: 'shift',
					text: 'step_1_N — J55 DA 88H shifts +15m on N-3'
				},
				{
					type: 'task-shift',
					text: '3 tasks on CPS-2 shift +11m'
				},
				{
					type: 'success',
					text: 'Order J1047 est. completion 18:33 → 18:41 — still within due date 15/08/2026'
				},
				{
					type: 'failure',
					text: 'Order J1055 est. completion 17:10 → 17:22 — would MISS due date 10/07/2026'
				}
			]
		},
		incompatibleResources: ['B-1', 'CPD-1', 'N-3']
	}
};

export function getProductionSchedule(planId: string): ProductionScheduleData | undefined {
	const base = schedules['mp-001'];
	if (!base) return undefined;

	const existing = schedules[planId];
	if (existing) return existing;

	if (!schedules[planId]) {
		const review = getReviewInputDetail(planId);
		schedules[planId] = {
			...base,
			planId,
			releaseLabel: review?.summary.releaseLabel ?? base.releaseLabel
		};
	}

	return schedules[planId];
}
