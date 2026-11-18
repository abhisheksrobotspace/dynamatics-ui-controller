import { describe, expect, it } from 'vitest';
import {
	formatPlanDueDate,
	formatPlanMonth,
	formatPlanStatus,
	isManufacturingPlanBundleEditable,
	mapManufacturingPlanRow
} from './manufacturing-plans.js';

describe('manufacturing-plans mappers', () => {
	it('formats month and due date', () => {
		expect(formatPlanMonth('2026-07-01')).toBe('Jul 2026');
		expect(formatPlanDueDate('2026-07-31T00:00:00.000Z')).toBe('31 Jul 2026');
		expect(formatPlanDueDate(null)).toBe('-');
	});

	it('formats status labels', () => {
		expect(formatPlanStatus('draft')).toBe('Draft');
		expect(formatPlanStatus('scheduled')).toBe('Scheduled');
	});

	it('allows bundle edit for draft and scheduling_input', () => {
		expect(isManufacturingPlanBundleEditable('draft')).toBe(true);
		expect(isManufacturingPlanBundleEditable('scheduling_input')).toBe(true);
		expect(isManufacturingPlanBundleEditable('failed')).toBe(true);
		expect(isManufacturingPlanBundleEditable('scheduling')).toBe(false);
		expect(isManufacturingPlanBundleEditable('scheduled')).toBe(false);
	});

	it('maps api row with plan name and summary fields', () => {
		const row = mapManufacturingPlanRow({
			plan_id: 'MP-2026-07-A',
			name: 'July HA batch',
			month: '2026-07-01',
			due_date: null,
			priority: null,
			status: 'draft',
			summary: {
				work_orders: ['WO-1', 'WO-2'],
				structures: 3,
				batch_weight_mt: 12.5,
				plants: 'I',
				zinc_req_mt: 2.1
			}
		});
		expect(row.name).toBe('July HA batch');
		expect(row.planCode).toBe('MP-2026-07-A');
		expect(row.workOrders).toBe('WO-1, WO-2');
		expect(row.structures).toBe(3);
		expect(row.batchWt).toBe(12.5);
		expect(row.plant).toBe('I');
		expect(row.zincReq).toBe(2.1);
		expect(row.dueDate).toBe('-');
		expect(row.priority).toBe('-');
		expect(row.status).toBe('Draft');
	});
});
