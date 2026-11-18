import type { TreeTableNode } from '@ifactory/ui-v2';
import { getManufacturingPlan } from './manufacturing-plans.mock.js';

export type ScheduleStructureRow = {
	workOrder: string;
	structure: string;
	sets: string;
	sections: string;
	marks: string;
	weight: string;
	plant: string;
	plannedDue: string;
	start: string;
	estCompletion: string;
	makespan: string;
};

export type ScheduleKpi = {
	label: string;
	value: string;
};

export type ScheduleReport = {
	planId: string;
	runLabel: string;
	ranAt: string;
	kpis: ScheduleKpi[];
	footer: string;
	nodes: TreeTableNode<ScheduleStructureRow>[];
};

const reports: Record<string, ScheduleReport> = {
	'mp-001': {
		planId: 'mp-001',
		runLabel: 'MP-2026-07-A',
		ranAt: '12 May 2026, 08:14 - Ran by scheduler',
		kpis: [
			{ label: 'Work Orders', value: '2' },
			{ label: 'Sets', value: '121' },
			{ label: 'Total Weight', value: '1,595.34 MT' },
			{ label: 'Total Tasks', value: '142' },
			{ label: 'Makespan', value: '3h 56m' },
			{ label: 'On-time', value: '1 / 2' },
			{ label: 'Plants', value: 'I + II' }
		],
		footer: '121 sets · 1,595.34 MT · 142 marks',
		nodes: [
			{
				id: 'proj-j1055',
				kind: 'group',
				label: 'J1055 - Reliance Industries · 400 kV D/C Kutch (Z2) → Lakadia',
				children: [
					{
						id: 'wo-j1055-da',
						label: 'J1055',
						defaultExpanded: true,
						data: {
							workOrder: 'J1055',
							structure: 'DA - Basic Tower',
							sets: '24',
							sections: '8',
							marks: '48',
							weight: '412.18',
							plant: 'Plant I',
							plannedDue: '12 Jul',
							start: '06:00',
							estCompletion: '09:12',
							makespan: '3h 12m'
						},
						details: [
							'HT ANGLE 200×200×22 - 2 RM bars - 1,010.24 kg',
							'HT ANGLE 80×80×5 - 4 bars - 292.8 kg',
							'MS ANGLE 75×75×5 - 20 RM bars - 653.50 kg',
							'MS ANGLE 50×50×5 - 12 bars - 186.2 kg',
							'MS CHANNEL 150×75×6 - 6 bars - 420.0 kg',
							'MS PLATE 150×12 - 12 plates - 328.40 kg',
							'MS FLAT 100×10 - 6 bars - 186.20 kg',
							'BOLT M20 SET - 48 kits - 96.00 kg'
						]
					},
					{
						id: 'wo-j1055-stub',
						label: 'J1055',
						data: {
							workOrder: 'J1055',
							structure: 'Stub & Cleats - DA',
							sets: '9',
							sections: '3',
							marks: '18',
							weight: '103.59',
							plant: 'Plant I',
							plannedDue: '12 Jul',
							start: '09:20',
							estCompletion: '10:05',
							makespan: '0h 45m'
						},
						details: [
							'STUB ANGLE 200×200×20 - 9 sets - 86.10 kg',
							'CLEAT PLATE 12mm - 18 pcs - 17.49 kg'
						]
					},
					{
						id: 'footer-j1055',
						kind: 'group-footer',
						label: '33 sets · 515.77 MT'
					}
				]
			},
			{
				id: 'proj-j1054',
				kind: 'group',
				label: 'J1054 - Adani Energy · 765 kV D/C Transmission Line Package',
				children: [
					{
						id: 'wo-j1054-db',
						label: 'J1054',
						data: {
							workOrder: 'J1054',
							structure: 'DB - Basic Tower',
							sets: '40',
							sections: '12',
							marks: '52',
							weight: '620.40',
							plant: 'Plant II',
							plannedDue: '14 Jul',
							start: '06:30',
							estCompletion: '08:50',
							makespan: '2h 20m'
						},
						details: [
							'HT ANGLE 150×150×18 - 8 RM bars - 1,240.00 kg',
							'MS ANGLE 100×100×8 - 16 RM bars - 480.00 kg'
						]
					},
					{
						id: 'wo-j1054-dd',
						label: 'J1054',
						data: {
							workOrder: 'J1054',
							structure: 'DD - Body Extension',
							sets: '48',
							sections: '10',
							marks: '24',
							weight: '459.17',
							plant: 'Plant II',
							plannedDue: '14 Jul',
							start: '09:00',
							estCompletion: '10:04',
							makespan: '1h 04m'
						}
					},
					{
						id: 'footer-j1054',
						kind: 'group-footer',
						label: '88 sets · 1,079.57 MT'
					}
				]
			}
		]
	}
};

export function getScheduleReport(planId: string): ScheduleReport | undefined {
	const base = reports['mp-001'];
	if (!base) return undefined;

	const existing = reports[planId];
	if (existing) return existing;

	const plan = getManufacturingPlan(planId);
	return {
		...base,
		planId,
		runLabel: plan?.name ?? planId,
		nodes: base.nodes
	};
}

export function scheduleReportHash(planId: string): string {
	return `#/APS/Home/${planId}/Schedule`;
}
