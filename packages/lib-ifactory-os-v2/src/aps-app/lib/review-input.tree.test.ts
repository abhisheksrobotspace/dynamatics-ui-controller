import { describe, expect, it } from 'vitest';
import { buildReviewInputTreeNodes } from './review-input.api.js';

describe('buildReviewInputTreeNodes', () => {
	it('shows work orders without CP bars using BOM item fallback', () => {
		const nodes = buildReviewInputTreeNodes({
			bundleLinks: [
				{
					treeRootId: 'p1-ds1',
					project_id: 'p1',
					woLabel: 'WO-1 Alpha · Lot A',
					activeLines: [{ bom_id: 'bom-a' }]
				},
				{
					treeRootId: 'p2-ds2',
					project_id: 'p2',
					woLabel: 'WO-2 Beta · Lot B',
					activeLines: [{ bom_id: 'bom-b' }]
				}
			],
			itemsByBom: new Map([
				[
					'bom-a',
					[
						{
							bom_item_id: 'item-a1',
							bom_id: 'bom-a',
							mark_no: 'M1',
							section: 'ANGLE 75',
							length_mm: 1200,
							section_thickness_mm: 10,
							num_pieces: 2,
							remark: null
						}
					]
				],
				[
					'bom-b',
					[
						{
							bom_item_id: 'item-b1',
							bom_id: 'bom-b',
							mark_no: 'M2',
							section: 'PLATE 20',
							length_mm: 800,
							section_thickness_mm: 20,
							num_pieces: 1,
							remark: 'H'
						}
					]
				]
			]),
			barsByBomSection: new Map([
				[
					'bom-b::PLATE 20',
					[
						{
							section_plan_id: 'sp1',
							bar_index: 0,
							rmid: 'RM-1',
							rm_length_mm: 6000,
							quantity: 1,
							markings: [{ mark: 'M2', length: 800, quantity: 1 }]
						}
					]
				]
			]),
			holesByBomItemId: new Map(),
			holesByMark: new Map()
		});

		expect(nodes).toHaveLength(2);
		expect(nodes[0]?.label).toBe('WO-1 Alpha · Lot A');
		expect(nodes[0]?.children?.[0]?.label).toBe('ANGLE 75');
		expect(nodes[0]?.children?.[0]?.children?.[0]?.label).toBe('M1');
		expect(nodes[1]?.label).toBe('WO-2 Beta · Lot B');
	});
});
