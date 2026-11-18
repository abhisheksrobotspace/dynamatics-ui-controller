import { describe, expect, it } from 'vitest';
import {
	buildAssignAndLockTree,
	selectedSectionLengthGroups,
	type SectionLengthGroup
} from './assign-and-lock.tree';
import type { PlanLockSummaryRow } from './inv.types';

function summary(overrides: Partial<PlanLockSummaryRow> = {}): PlanLockSummaryRow {
	return {
		row_key: 'lock-1',
		central_plan_id: 'cp-1',
		month: '2026-09-01',
		project_id: 'proj-1',
		project_name: 'P1',
		delivery_schedule_id: 'ds-1',
		delivery_schedule_name: 'Lot 1 - 01/01/2026',
		delivery_schedule_line_id: 'line-1',
		structure_id: 'tower-1',
		tower_label: 'Tower A',
		bom_id: 'bom-1',
		bom_name: 'BOM-17',
		item_id: 'item-1',
		item_code: 'HT75',
		section: 'HT ANGLE 75X75X5',
		length_mm: 6000,
		variant_key: 'L=6000',
		required_qty_base: 6,
		remaining_qty_base: 6,
		indented_qty_base: 0,
		procure_qty_base: 6,
		free_qty_base: 4,
		locked_qty_base: 1,
		unit_weight_kg_m: 5.5,
		required_weight_kg: 198,
		procure_weight_kg: 198,
		free_weight_kg: 132,
		locked_weight_kg: 33,
		unresolved: false,
		runs_unpinned: 0,
		committed: false,
		plan_count: 1,
		...overrides
	};
}

describe('buildAssignAndLockTree', () => {
	it('builds DS → tower → BOM → section·length hierarchy', () => {
		const { nodes, groups } = buildAssignAndLockTree({
			rows: [summary()],
			structureKinds: new Map([['tower-1', 'tower']])
		});

		expect(nodes).toHaveLength(1);
		expect(nodes[0]?.label).toBe('Lot 1 - 01/01/2026');
		expect(nodes[0]?.data?.kind).toBe('schedule');
		expect(nodes[0]?.data?.requiredQty).toBe(6);

		const tower = nodes[0]?.children?.[0];
		expect(tower?.label).toBe('Tower A');
		expect(tower?.data?.kind).toBe('tower');

		const bom = tower?.children?.[0];
		expect(bom?.label).toBe('BOM-17');
		expect(bom?.data?.kind).toBe('bom');

		const leaf = bom?.children?.[0];
		expect(leaf?.label).toBe('HT ANGLE 75X75X5');
		expect(leaf?.id).toBe('lock-1');
		expect(leaf?.data?.group?.lengthLabel).toBe('6,000');
		expect(leaf?.data?.kind).toBe('section-length');
		expect(leaf?.data?.requiredQty).toBe(6);
		expect(leaf?.data?.availableQty).toBe(4);
		expect(leaf?.data?.lockedQty).toBe(1);
		expect(leaf?.data?.group?.deliveryScheduleLineId).toBe('line-1');
		expect(leaf?.data?.replan).toEqual({
			bomId: 'bom-1',
			structureId: 'tower-1',
			structureKind: 'tower'
		});

		expect(groups).toHaveLength(1);
		expect(groups[0]?.groupKey).toBe('lock-1');
	});

	it('does not roll free stock up to parent rows', () => {
		const { nodes } = buildAssignAndLockTree({
			rows: [
				summary({ row_key: 'a', free_qty_base: 8 }),
				summary({
					row_key: 'b',
					section: 'HT ANGLE 100',
					length_mm: 9000,
					free_qty_base: 8,
					required_qty_base: 2,
					required_weight_kg: 50
				})
			]
		});
		const bom = nodes[0]?.children?.[0]?.children?.[0];
		expect(bom?.data?.availableQty).toBeUndefined();
		expect(bom?.data?.requiredQty).toBe(8);
	});

	it('dedupes selected section-length groups by groupKey', () => {
		const group: SectionLengthGroup = {
			groupKey: 'g1',
			itemId: 'item-1',
			section: 'HT ANGLE 75X75X5',
			lengthMm: 6000,
			lengthLabel: '6,000',
			requiredQty: 6,
			availableQty: 4,
			lockedQty: 1,
			requiredWeightKg: 198,
			freeWeightKg: 132,
			lockedWeightKg: 33,
			remainingQty: 5,
			procureQty: 5,
			procureWeightKg: 165,
			unresolved: false,
			runsUnpinned: 0,
			deliveryScheduleLineId: 'line-1',
			committed: false,
			planCount: 1
		};
		const nodes = [
			{
				id: 'leaf-a',
				label: 'leaf a',
				data: { kind: 'section-length' as const, requiredQty: 3, requiredWeightKg: 99, group },
				selectable: true
			},
			{
				id: 'leaf-b',
				label: 'leaf b',
				data: { kind: 'section-length' as const, requiredQty: 3, requiredWeightKg: 99, group },
				selectable: true
			}
		];

		const selected = selectedSectionLengthGroups(nodes, ['leaf-a', 'leaf-b']);
		expect(selected).toHaveLength(1);
		expect(selected[0]?.groupKey).toBe('g1');
	});

	it('keeps unresolved section-length leaves selectable for indent', () => {
		const { nodes } = buildAssignAndLockTree({
			rows: [
				summary({
					row_key: 'unresolved:UNKNOWN SECTION|6000',
					item_id: null,
					item_code: '',
					section: 'UNKNOWN SECTION',
					unresolved: true,
					free_qty_base: 0,
					locked_qty_base: 0
				})
			]
		});

		const leaf = nodes[0]?.children?.[0]?.children?.[0]?.children?.[0];
		expect(leaf?.data?.group?.unresolved).toBe(true);
		expect(leaf?.data?.group?.itemId).toBe('');
		expect(leaf?.selectable).not.toBe(false);
	});
});
