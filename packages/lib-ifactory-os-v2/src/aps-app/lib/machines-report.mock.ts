import type { TreeTableNode } from '@ifactory/ui-v2';

export type MachineReportRow = {
	machine: string;
	group: string;
	jobs: string;
	parts: string;
	weight: string;
	busy: string;
	changeover: string;
	idle: string;
	totalSpan: string;
	utilization: string;
};

export type MachineReportKpi = {
	label: string;
	value: string;
};

export type MachinesReport = {
	kpis: MachineReportKpi[];
	nodes: TreeTableNode<MachineReportRow>[];
};

const EMPTY = '-';

export const machinesReport: MachinesReport = {
	kpis: [
		{ label: 'Avg Utilization', value: '55.8%' },
		{ label: 'Total Busy', value: '9h 53m' },
		{ label: 'Total Changeover', value: '48m' },
		{ label: 'Total Idle', value: '7h 11m' },
		{ label: 'Machines Used', value: '4 of 6' }
	],
	nodes: [
		{
			id: 'group-cpd',
			kind: 'group',
			label: 'Cutting Punching Drilling',
			children: [
				{
					id: 'cpd-1',
					label: 'CPD-1',
					data: {
						machine: 'CPD-1',
						group: 'Cutting Punching Drilling',
						jobs: '9',
						parts: '18',
						weight: '2.02',
						busy: '1h 0m 4s',
						changeover: '6m',
						idle: '3h 20m',
						totalSpan: '4h 26m 10s',
						utilization: '22.57%'
					}
				},
				{
					id: 'footer-cpd',
					kind: 'group-footer',
					label: 'CPD Total: 9 jobs • 18 parts • 1h 0m busy • 6m changeover • 22.5% avg utilization'
				}
			]
		},
		{
			id: 'group-cps',
			kind: 'group',
			label: 'Cutting Punching Stamping',
			children: [
				{
					id: 'cps-1',
					label: 'CPS-1',
					data: {
						machine: 'CPS-1',
						group: 'Cutting Punching Stamping',
						jobs: '24',
						parts: '51',
						weight: '0.94',
						busy: '2h 38m',
						changeover: '14m',
						idle: '1h 27m',
						totalSpan: '4h 19m',
						utilization: '61.00%'
					}
				},
				{
					id: 'cps-2',
					label: 'CPS-2',
					data: {
						machine: 'CPS-2',
						group: 'Cutting Punching Stamping',
						jobs: '19',
						parts: '42',
						weight: '0.72',
						busy: '2h 3m',
						changeover: '11m',
						idle: '2h 6m',
						totalSpan: '4h 20m',
						utilization: '47.31%'
					}
				},
				{
					id: 'footer-cps',
					kind: 'group-footer',
					label:
						'CPS Total: 43 jobs • 93 parts • 4h 41m busy • 25m changeover • 54.2% avg utilization'
				}
			]
		},
		{
			id: 'group-n',
			kind: 'group',
			label: 'Notching',
			children: [
				{
					id: 'n-3',
					label: 'N-3',
					data: {
						machine: 'N-3',
						group: 'Notching',
						jobs: '31',
						parts: '64',
						weight: '1.18',
						busy: '4h 11m',
						changeover: '17m',
						idle: '58m',
						totalSpan: '5h 26m',
						utilization: '76.99%'
					}
				},
				{
					id: 'footer-n',
					kind: 'group-footer',
					label:
						'N Total: 31 jobs • 64 parts • 4h 11m busy • 17m changeover • 77.0% avg utilization'
				}
			]
		},
		{
			id: 'group-b',
			kind: 'group',
			label: 'Bending',
			children: [
				{
					id: 'b-1',
					label: 'B-1',
					data: {
						machine: 'B-1',
						group: 'Bending',
						jobs: EMPTY,
						parts: EMPTY,
						weight: EMPTY,
						busy: EMPTY,
						changeover: EMPTY,
						idle: EMPTY,
						totalSpan: EMPTY,
						utilization: EMPTY
					}
				},
				{
					id: 'footer-b',
					kind: 'group-footer',
					label: 'B Total: 0 jobs • 0 parts • 0m busy • 0m changeover • - avg utilization'
				}
			]
		}
	]
};

export function getMachinesReport(): MachinesReport {
	return machinesReport;
}

export function machinesReportHash(): string {
	return '#/APS/Reports/Machines';
}
