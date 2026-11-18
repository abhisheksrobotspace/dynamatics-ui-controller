import type { ManufacturingPlan } from './manufacturing-plans.js';

/** Mock plans for Review / Gantt / Schedule routes until those pages are wired. */
export const manufacturingPlans: ManufacturingPlan[] = [
	{
		id: 'mp-001',
		name: 'July Plant A batch',
		planCode: 'MP-2026-07-A',
		month: 'Jul 2026',
		workOrders: 'WO-1042, WO-1048',
		structures: 12,
		batchWt: 186.4,
		plant: 'Plant A',
		zincReq: 35.2,
		dueDate: '31 Jul 2026',
		priority: '1',
		status: 'Draft'
	},
	{
		id: 'mp-002',
		name: 'July Plant B batch',
		planCode: 'MP-2026-07-B',
		month: 'Jul 2026',
		workOrders: 'WO-1051',
		structures: 6,
		batchWt: 92.1,
		plant: 'Plant B',
		zincReq: 15.2,
		dueDate: '28 Jul 2026',
		priority: '2',
		status: 'Scheduled'
	},
	{
		id: 'mp-003',
		name: 'August multi-WO',
		planCode: 'MP-2026-08-A',
		month: 'Aug 2026',
		workOrders: 'WO-1102, WO-1105, WO-1110',
		structures: 18,
		batchWt: 241.7,
		plant: 'Plant A',
		zincReq: 48.6,
		dueDate: '15 Aug 2026',
		priority: '1',
		status: 'In Progress'
	},
	{
		id: 'mp-004',
		name: 'June closeout',
		planCode: 'MP-2026-06-C',
		month: 'Jun 2026',
		workOrders: 'WO-0988',
		structures: 4,
		batchWt: 54.3,
		plant: 'Plant C',
		zincReq: 8.4,
		dueDate: '30 Jun 2026',
		priority: '3',
		status: 'Completed'
	},
	{
		id: 'mp-005',
		name: 'August Plant B',
		planCode: 'MP-2026-08-B',
		month: 'Aug 2026',
		workOrders: 'WO-1120, WO-1124',
		structures: 9,
		batchWt: 128.9,
		plant: 'Plant B',
		zincReq: 22.1,
		dueDate: '22 Aug 2026',
		priority: '2',
		status: 'Draft'
	}
];

export function getManufacturingPlan(planId: string): ManufacturingPlan | undefined {
	return manufacturingPlans.find((plan) => plan.id === planId);
}

export { reviewInputHash } from './manufacturing-plans.js';
