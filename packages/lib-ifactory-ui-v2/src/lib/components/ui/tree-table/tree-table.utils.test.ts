import { describe, expect, it } from 'vitest';
import type { TreeTableColumnDef, TreeTableNode } from './tree-table.constants';
import {
	buildColumnHeaderRows,
	collectDefaultExpandedIds,
	collectSelectableDescendantIds,
	collectSelectableLeafIds,
	collectTreeSelectableLeafIds,
	columnHeaderDepth,
	filterTreeNodes,
	flattenLeafColumns,
	flattenVisibleTreeRows,
	getTreeNodeCheckState,
	hasColumnGroups,
	isColumnGroup,
	isNodeExpandable,
	isNodeSelectable,
	showsSelectionCheckbox,
	toggleTreeSelection
} from './tree-table.utils';

type PartData = {
	qty?: string;
	process?: string;
};

const sample: TreeTableNode<PartData>[] = [
	{
		id: 'project',
		label: 'J1055 Pune Transmission',
		defaultExpanded: true,
		children: [
			{
				id: 'section',
				label: 'HT ANGLE 200×200×22',
				children: [
					{
						id: 'rm',
						label: 'RM-A22-001',
						children: [
							{
								id: 'length',
								label: '7.8 m',
								children: [
									{
										id: 'group',
										label: 'Group 1',
										children: [
											{
												id: 'part-1',
												label: 'J55 DA 71H',
												data: { qty: '2', process: 'Drill+Cope' }
											}
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

const scheduleSample: TreeTableNode<Record<string, string>>[] = [
	{
		id: 'proj-1',
		kind: 'group',
		label: 'J1055 - Reliance Industries',
		children: [
			{
				id: 'struct-1',
				label: 'DA - Basic Tower',
				defaultExpanded: true,
				data: { workOrder: 'J1055', sets: '24' },
				details: [
					'HT ANGLE 200×200×22 — 2 RM bars — 1,010.24 kg',
					'MS ANGLE 75×75×5 — 20 RM bars — 653.50 kg'
				]
			},
			{
				id: 'struct-2',
				label: 'Stub & Cleats - DA',
				data: { workOrder: 'J1055', sets: '9' }
			},
			{
				id: 'footer-1',
				kind: 'group-footer',
				label: '33 sets · 515.77 MT'
			}
		]
	}
];

describe('tree-table.utils', () => {
	it('collects defaultExpanded ids', () => {
		expect(collectDefaultExpandedIds(sample)).toEqual(['project']);
		expect(collectDefaultExpandedIds(sample, true)).toEqual([
			'project',
			'section',
			'rm',
			'length',
			'group'
		]);
	});

	it('collects ids by expand level under always-open groups', () => {
		expect(collectDefaultExpandedIds(scheduleSample, { expandLevels: 0 })).toEqual([]);
		expect(collectDefaultExpandedIds(scheduleSample, { expandLevels: 1 })).toEqual(['struct-1']);
	});

	it('always shows group children regardless of expanded ids', () => {
		const rows = flattenVisibleTreeRows(scheduleSample, new Set());
		expect(rows.map((row) => row.node.id)).toEqual(['proj-1', 'struct-1', 'struct-2', 'footer-1']);
	});

	it('flattens only expanded branches', () => {
		const rows = flattenVisibleTreeRows(sample, new Set(['project', 'section']));
		expect(rows.map((row) => row.node.id)).toEqual(['project', 'section', 'rm']);
		expect(rows[1]?.depth).toBe(1);
		expect(rows[2]?.hasChildren).toBe(true);
	});

	it('filters and keeps ancestor path', () => {
		const filtered = filterTreeNodes(sample, '71H');
		expect(filtered).toHaveLength(1);
		expect(filtered[0]?.label).toBe('J1055 Pune Transmission');
		const leaf =
			filtered[0]?.children?.[0]?.children?.[0]?.children?.[0]?.children?.[0]?.children?.[0];
		expect(leaf?.label).toBe('J55 DA 71H');
	});

	it('shows children of non-collapsible rows when the parent branch is open', () => {
		const nodes: TreeTableNode<PartData>[] = [
			{
				id: 'release',
				label: 'Release R2',
				defaultExpanded: true,
				children: [
					{
						id: 'tower',
						label: 'HA',
						collapsible: false,
						children: [{ id: 'bom', label: 'Basic Body', data: { qty: '1' } }]
					}
				]
			}
		];

		expect(isNodeExpandable(nodes[0]!.children![0]!)).toBe(false);
		const collapsed = flattenVisibleTreeRows(nodes, new Set());
		expect(collapsed.map((row) => row.node.id)).toEqual(['release']);

		const expanded = flattenVisibleTreeRows(nodes, new Set(['release']));
		expect(expanded.map((row) => row.node.id)).toEqual(['release', 'tower', 'bom']);
		expect(expanded[1]?.hasChildren).toBe(false);
	});

	it('treats detail-only rows as expandable, not group banners', () => {
		expect(isNodeExpandable(scheduleSample[0]!)).toBe(false);
		const node = scheduleSample[0]?.children?.[0];
		expect(node && isNodeExpandable(node)).toBe(true);
	});

	it('flattens group banners, detail panels, and group footers', () => {
		const rows = flattenVisibleTreeRows(scheduleSample, new Set(['struct-1']));
		expect(rows.map((row) => row.kind)).toEqual(['group', 'row', 'detail', 'row', 'group-footer']);
		expect(rows[2]?.node.details?.[0]).toBe('HT ANGLE 200×200×22 — 2 RM bars — 1,010.24 kg');
	});

	it('keeps group footer when filtering inside a group', () => {
		const filtered = filterTreeNodes(scheduleSample, 'Basic Tower');
		expect(filtered).toHaveLength(1);
		expect(filtered[0]?.kind).toBe('group');
		const footer = filtered[0]?.children?.find((child) => child.kind === 'group-footer');
		expect(footer?.label).toBe('33 sets · 515.77 MT');
	});

	it('assigns unique rowKey values when node ids repeat in the tree', () => {
		const duplicateIdNodes: TreeTableNode<PartData>[] = [
			{
				id: 'wo',
				label: 'Work order',
				children: [
					{ id: 'dup', label: 'First', data: { qty: '1' } },
					{ id: 'dup', label: 'Second', data: { qty: '2' } }
				]
			}
		];
		const rows = flattenVisibleTreeRows(duplicateIdNodes, new Set(['wo']));
		expect(rows.map((row) => row.rowKey)).toEqual(['r/0:wo', 'r/0:wo/0:dup', 'r/0:wo/1:dup']);
	});

	it('flattens grouped headers to leaf columns in order', () => {
		const columns: TreeTableColumnDef<PartData>[] = [
			{ key: 'name', header: 'Description', tree: true },
			{ key: 'unit', header: 'Unit' },
			{
				key: 'd1',
				header: '19/08/2026',
				columns: [
					{ key: 'qty-d1', header: 'Qty', value: (node) => node.data?.qty ?? '' },
					{ key: 'wt-d1', header: 'Weight' }
				]
			},
			{
				key: 'd2',
				header: '26/08/2026',
				columns: [{ key: 'qty-d2', header: 'Qty' }]
			}
		];

		expect(hasColumnGroups(columns)).toBe(true);
		expect(isColumnGroup(columns[2]!)).toBe(true);
		expect(flattenLeafColumns(columns).map((column) => column.key)).toEqual([
			'name',
			'unit',
			'qty-d1',
			'wt-d1',
			'qty-d2'
		]);
	});

	it('treats a flat column list as ungrouped', () => {
		const columns: TreeTableColumnDef<PartData>[] = [
			{ key: 'name', header: 'Description', tree: true },
			{ key: 'qty', header: 'Qty' }
		];
		expect(hasColumnGroups(columns)).toBe(false);
		expect(flattenLeafColumns(columns)).toEqual(columns);
	});

	it('flattens nested column groups in preorder', () => {
		const columns: TreeTableColumnDef<PartData>[] = [
			{ key: 'name', header: 'Description', tree: true },
			{
				key: 'fy',
				header: 'FY 2026-27',
				columns: [
					{
						key: 'q1',
						header: 'Q1',
						columns: [
							{ key: 'qty-q1', header: 'Qty' },
							{ key: 'wt-q1', header: 'Weight' }
						]
					},
					{ key: 'total', header: 'Total Qty' }
				]
			}
		];
		expect(flattenLeafColumns(columns).map((column) => column.key)).toEqual([
			'name',
			'qty-q1',
			'wt-q1',
			'total'
		]);
	});

	it('builds two header rows for a single-level group', () => {
		const columns: TreeTableColumnDef<PartData>[] = [
			{ key: 'name', header: 'Description', tree: true },
			{
				key: 'd1',
				header: '19/08/2026',
				columns: [
					{ key: 'qty-d1', header: 'Qty' },
					{ key: 'wt-d1', header: 'Weight' }
				]
			}
		];
		const rows = buildColumnHeaderRows(columns);
		expect(rows).toHaveLength(2);
		expect(
			rows[0]?.map((cell) => ({
				header: cell.header,
				colSpan: cell.colSpan,
				rowSpan: cell.rowSpan
			}))
		).toEqual([
			{ header: 'Description', colSpan: 1, rowSpan: 2 },
			{ header: '19/08/2026', colSpan: 2, rowSpan: 1 }
		]);
		expect(rows[1]?.map((cell) => cell.header)).toEqual(['Qty', 'Weight']);
		expect(rows[0]?.[0]?.isTree).toBe(true);
		expect(rows[1]?.every((cell) => cell.isTree !== true)).toBe(true);
	});

	it('marks serial leaf headers', () => {
		const columns: TreeTableColumnDef<PartData>[] = [
			{ type: 'serial', key: 'sNo', header: 'S.No', value: () => '1' },
			{ key: 'name', header: 'Description', tree: true }
		];
		const rows = buildColumnHeaderRows(columns);
		expect(rows[0]?.[0]).toMatchObject({ header: 'S.No', isSerial: true, isTree: false });
		expect(rows[0]?.[1]).toMatchObject({ header: 'Description', isSerial: false, isTree: true });
	});

	it('builds three header rows and rowspans mixed leaf siblings', () => {
		const columns: TreeTableColumnDef<PartData>[] = [
			{ key: 'name', header: 'Description', tree: true },
			{
				key: 'fy',
				header: 'FY 2026-27',
				columns: [
					{ key: 'released', header: 'Released' },
					{
						key: 'q1',
						header: 'Q1',
						columns: [
							{ key: 'qty-aug', header: 'Qty' },
							{ key: 'wt-aug', header: 'Weight' }
						]
					}
				]
			}
		];
		const rows = buildColumnHeaderRows(columns);
		expect(columnHeaderDepth(columns)).toBe(3);
		expect(rows.map((row) => row.map((cell) => cell.header))).toEqual([
			['Description', 'FY 2026-27'],
			['Released', 'Q1'],
			['Qty', 'Weight']
		]);
		expect(rows[1]?.[0]).toMatchObject({
			header: 'Released',
			rowSpan: 2,
			colSpan: 1,
			isGroup: false
		});
		expect(rows[0]?.[0]).toMatchObject({ header: 'Description', rowSpan: 3 });
	});

	it('propagates sticky to nested group header cells', () => {
		const columns: TreeTableColumnDef<PartData>[] = [
			{
				key: 'name-corner',
				header: 'Release Name',
				columns: [
					{
						key: 'total-tonnage-row',
						header: 'Total Tonnage (MT)',
						columns: [
							{
								key: 'name',
								header: 'Towers / BOMs',
								tree: true,
								sticky: true,
								class: 'min-w-[16rem]'
							}
						]
					}
				]
			},
			{ key: 'qty', header: 'Qty' }
		];
		const rows = buildColumnHeaderRows(columns);
		expect(rows[0]?.[0]).toMatchObject({
			header: 'Release Name',
			sticky: true,
			columnKey: 'name',
			columnClass: 'min-w-[16rem]'
		});
		expect(rows[1]?.[0]).toMatchObject({
			header: 'Total Tonnage (MT)',
			sticky: true,
			columnKey: 'name',
			columnClass: 'min-w-[16rem]'
		});
		expect(rows[2]?.[0]).toMatchObject({
			header: 'Towers / BOMs',
			sticky: true,
			columnKey: 'name',
			columnClass: 'min-w-[16rem]'
		});
		expect(rows[0]?.[1]?.sticky).toBe(false);
	});

	describe('selection helpers', () => {
		const selectionTree: TreeTableNode<PartData>[] = [
			{
				id: 'parent',
				label: 'Parent',
				children: [
					{ id: 'leaf-a', label: 'Leaf A', data: { qty: '1' } },
					{ id: 'leaf-b', label: 'Leaf B', data: { qty: '2' }, selectable: false },
					{
						id: 'child',
						label: 'Child',
						children: [{ id: 'leaf-c', label: 'Leaf C', data: { qty: '3' } }]
					}
				]
			},
			{
				id: 'group-1',
				kind: 'group',
				label: 'Group',
				children: [
					{ id: 'group-leaf', label: 'Group leaf' },
					{ id: 'footer-1', kind: 'group-footer', label: 'Footer' }
				]
			}
		];

		it('treats only selectable row nodes as selectable', () => {
			expect(isNodeSelectable(selectionTree[0]!)).toBe(true);
			expect(isNodeSelectable(selectionTree[0]!.children![1]!)).toBe(false);
			expect(isNodeSelectable(selectionTree[1]!)).toBe(false);
			expect(isNodeSelectable(selectionTree[1]!.children![1]!)).toBe(false);
		});

		it('shows cascade checkbox on branch nodes with selectable leaves', () => {
			expect(showsSelectionCheckbox(selectionTree[0]!.children![2]!)).toBe(true);
			expect(
				showsSelectionCheckbox({
					id: 'branch',
					label: 'Branch',
					selectable: false,
					children: [{ id: 'only-leaf', label: 'Leaf' }]
				})
			).toBe(true);
			expect(showsSelectionCheckbox(selectionTree[1]!)).toBe(false);
		});

		it('collects all selectable leaf ids in a forest', () => {
			expect(collectTreeSelectableLeafIds(selectionTree)).toEqual([
				'leaf-a',
				'leaf-c',
				'group-leaf'
			]);
		});

		it('collects selectable descendant ids including self', () => {
			expect(collectSelectableDescendantIds(selectionTree[0]!)).toEqual([
				'parent',
				'leaf-a',
				'child',
				'leaf-c'
			]);
			expect(collectSelectableDescendantIds(selectionTree[0]!.children![0]!)).toEqual(['leaf-a']);
			expect(collectSelectableDescendantIds(selectionTree[1]!)).toEqual(['group-leaf']);
		});

		it('collects selectable leaf ids for check-state', () => {
			expect(collectSelectableLeafIds(selectionTree[0]!)).toEqual(['leaf-a', 'leaf-c']);
			expect(collectSelectableLeafIds(selectionTree[0]!.children![0]!)).toEqual(['leaf-a']);
			expect(collectSelectableLeafIds(selectionTree[0]!.children![2]!)).toEqual(['leaf-c']);
		});

		it('toggles multiple selection with parent cascading', () => {
			expect(
				toggleTreeSelection({
					nodes: selectionTree,
					selectedIds: [],
					toggledId: 'parent',
					mode: 'multiple'
				})
			).toEqual(['parent', 'leaf-a', 'child', 'leaf-c']);

			expect(
				toggleTreeSelection({
					nodes: selectionTree,
					selectedIds: ['parent', 'leaf-a', 'child', 'leaf-c'],
					toggledId: 'parent',
					mode: 'multiple'
				})
			).toEqual([]);

			// Leaf-only selection still counts as fully selected for cascade deselect.
			expect(
				toggleTreeSelection({
					nodes: selectionTree,
					selectedIds: ['leaf-a', 'leaf-c'],
					toggledId: 'parent',
					mode: 'multiple'
				})
			).toEqual([]);

			expect(
				toggleTreeSelection({
					nodes: selectionTree,
					selectedIds: ['leaf-a'],
					toggledId: 'leaf-c',
					mode: 'multiple'
				})
			).toEqual(['leaf-a', 'leaf-c']);

			expect(
				toggleTreeSelection({
					nodes: selectionTree,
					selectedIds: ['leaf-a', 'leaf-c'],
					toggledId: 'leaf-a',
					mode: 'multiple'
				})
			).toEqual(['leaf-c']);
		});

		it('toggles single selection to only that id or empty', () => {
			expect(
				toggleTreeSelection({
					nodes: selectionTree,
					selectedIds: ['leaf-a'],
					toggledId: 'leaf-c',
					mode: 'single'
				})
			).toEqual(['leaf-c']);

			expect(
				toggleTreeSelection({
					nodes: selectionTree,
					selectedIds: ['leaf-c'],
					toggledId: 'leaf-c',
					mode: 'single'
				})
			).toEqual([]);
		});

		it('computes checked / indeterminate / unchecked from selected set', () => {
			const parent = selectionTree[0]!;
			expect(getTreeNodeCheckState(parent, new Set())).toBe('unchecked');
			expect(getTreeNodeCheckState(parent, new Set(['parent', 'leaf-a', 'child', 'leaf-c']))).toBe(
				'checked'
			);
			// Leaf-only select-all (no parent/intermediate ids) still shows checked.
			expect(getTreeNodeCheckState(parent, new Set(['leaf-a', 'leaf-c']))).toBe('checked');
			expect(getTreeNodeCheckState(parent, new Set(['leaf-a']))).toBe('indeterminate');
			expect(getTreeNodeCheckState(parent.children![0]!, new Set(['leaf-a']))).toBe('checked');
			expect(getTreeNodeCheckState(parent.children![0]!, new Set())).toBe('unchecked');
		});
	});
});
