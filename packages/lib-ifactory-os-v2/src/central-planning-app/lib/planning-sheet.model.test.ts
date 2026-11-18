import { describe, expect, it } from 'vitest';
import type { TreeTableNode } from '@ifactory/ui-v2';
import {
	isBomAllocationDelayed,
	planningNodeDelayLabel,
	planningNodeDelayStatus
} from './planning-sheet.model.js';
import type { PlanningSheetDraft, PlanningSheetRowData } from './planning-sheet.types.js';

function bomNode(id: string, deliveryMonth: string): TreeTableNode<PlanningSheetRowData> {
	return {
		id,
		label: 'BOM',
		data: {
			kind: 'bom',
			projectId: 'p1',
			scheduleId: 's1',
			structureId: 't1',
			bomId: id,
			deliveryScheduleLineId: `line-${id}`,
			deliveryMonth,
			qtySets: 10,
			qtyMt: 1,
			weightMtPerSet: 0.1
		}
	};
}

function towerNode(
	children: TreeTableNode<PlanningSheetRowData>[]
): TreeTableNode<PlanningSheetRowData> {
	return {
		id: 'tower:s1:t1',
		label: 'Tower',
		data: {
			kind: 'tower',
			projectId: 'p1',
			scheduleId: 's1',
			structureId: 't1',
			qtySets: 10,
			qtyMt: 1
		},
		children
	};
}

function scheduleNode(
	children: TreeTableNode<PlanningSheetRowData>[]
): TreeTableNode<PlanningSheetRowData> {
	return {
		id: 'schedule:s1',
		label: '05-09-2026',
		data: {
			kind: 'schedule',
			projectId: 'p1',
			scheduleId: 's1',
			deliveryDate: '2026-09-05',
			qtySets: 10,
			qtyMt: 1
		},
		children
	};
}

describe('planning-sheet delayed status', () => {
	it('flags BOM when qty is planned after delivery month', () => {
		const bom = bomNode('bom:s1:b1', '2026-09');
		const draft: PlanningSheetDraft = {
			months: ['2026-09', '2026-10'],
			monthQtyByBomId: { 'bom:s1:b1': { '2026-10': 5 } },
			included: {}
		};
		expect(isBomAllocationDelayed(draft, bom)).toBe(true);
		expect(planningNodeDelayStatus(draft, bom)).toBe('delayed');
		expect(planningNodeDelayLabel(draft, bom)).toBe('(Delayed)');
	});

	it('does not flag BOM when qty stays in delivery month', () => {
		const bom = bomNode('bom:s1:b1', '2026-09');
		const draft: PlanningSheetDraft = {
			months: ['2026-09', '2026-10'],
			monthQtyByBomId: { 'bom:s1:b1': { '2026-09': 5 } },
			included: {}
		};
		expect(isBomAllocationDelayed(draft, bom)).toBe(false);
		expect(planningNodeDelayStatus(draft, bom)).toBeNull();
	});

	it('marks tower/DS Delayed when every BOM is delayed', () => {
		const bom = bomNode('bom:s1:b1', '2026-09');
		const tower = towerNode([bom]);
		const schedule = scheduleNode([tower]);
		const draft: PlanningSheetDraft = {
			months: ['2026-09', '2026-10'],
			monthQtyByBomId: { 'bom:s1:b1': { '2026-10': 2 } },
			included: {}
		};
		expect(planningNodeDelayStatus(draft, tower)).toBe('delayed');
		expect(planningNodeDelayStatus(draft, schedule)).toBe('delayed');
	});

	it('marks tower/DS Partially Delayed when only some BOMs are delayed', () => {
		const delayed = bomNode('bom:s1:b1', '2026-09');
		const onTime = bomNode('bom:s1:b2', '2026-09');
		const tower = towerNode([delayed, onTime]);
		const schedule = scheduleNode([tower]);
		const draft: PlanningSheetDraft = {
			months: ['2026-09', '2026-10'],
			monthQtyByBomId: {
				'bom:s1:b1': { '2026-10': 2 },
				'bom:s1:b2': { '2026-09': 4 }
			},
			included: {}
		};
		expect(planningNodeDelayStatus(draft, tower)).toBe('partially-delayed');
		expect(planningNodeDelayLabel(draft, tower)).toBe('(Partial)');
		expect(planningNodeDelayStatus(draft, schedule)).toBe('partially-delayed');
		expect(planningNodeDelayLabel(draft, delayed)).toBe('(Delayed)');
		expect(planningNodeDelayLabel(draft, onTime)).toBe('');
	});
});
