<script lang="ts">
	import { onMount } from 'svelte';
	import { DataTable, type DataTableColumn } from '@ifactory/ui-v2';
	import {
		listBomItems,
		type ProjBomItemRow
	} from '../../project-management-app/lib/projects/boms.api.js';
	import { errorDescription } from '../../lib/api/types.js';
	import { ocrPushErrorToast } from '../lib/toast.js';

	let { params }: { params: { bomId: string } } = $props();
	const bomId = $derived(params.bomId);

	let rows = $state<ProjBomItemRow[]>([]);
	let isLoading = $state(true);

	function formatCell(value: unknown): string {
		if (value === null || value === undefined || value === '') return '';
		return String(value);
	}

	const columns: DataTableColumn<ProjBomItemRow>[] = [
		{
			type: 'serial',
			key: 'row_number',
			header: 'S.No',
			sticky: true,
			sortable: true,
			filterable: true,
			dataType: 'number',
			value: (row) => formatCell(row.row_number)
		},
		{
			key: 'mark_no',
			header: 'Mark No',
			sticky: true,
			sortable: true,
			filterable: true,
			dataType: 'string',
			headerClass: 'w-[11rem] max-w-[11rem]',
			class: 'w-[11rem] max-w-[11rem] overflow-hidden [&>span]:w-[11rem]',
			value: (row) => row.mark_no,
			title: (row) => row.mark_no
		},
		{
			key: 'material_grade',
			header: 'HT/MS',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => formatCell(row.material_grade)
		},
		{
			key: 'section',
			header: 'Section',
			sortable: true,
			filterable: true,
			dataType: 'string',
			headerClass: 'w-[14rem] max-w-[14rem]',
			class: 'w-[14rem] max-w-[14rem] overflow-hidden [&>span]:w-[14rem]',
			value: (row) => formatCell(row.section),
			title: (row) => formatCell(row.section) || undefined
		},
		{
			key: 'width_mm',
			header: 'Width',
			sortable: true,
			filterable: true,
			dataType: 'number',
			value: (row) => formatCell(row.width_mm)
		},
		{
			key: 'length_mm',
			header: 'Length',
			sortable: true,
			filterable: true,
			dataType: 'number',
			value: (row) => formatCell(row.length_mm)
		},
		{
			key: 'unit_weight',
			header: 'Unit Wt kg/Mtr',
			sortable: true,
			filterable: true,
			dataType: 'number',
			value: (row) => formatCell(row.unit_weight)
		},
		{
			key: 'weight_per_piece',
			header: 'Wt/Pc Black (Kgs)',
			sortable: true,
			filterable: true,
			dataType: 'number',
			value: (row) => formatCell(row.weight_per_piece)
		},
		{
			key: 'num_pieces',
			header: 'No of Pcs',
			sortable: true,
			filterable: true,
			dataType: 'number',
			value: (row) => formatCell(row.num_pieces)
		},
		{
			key: 'total_weight',
			header: 'Weight in Kgs(black)',
			sortable: true,
			filterable: true,
			dataType: 'number',
			value: (row) => formatCell(row.total_weight)
		},
		{
			key: 'remark',
			header: 'Remark',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => formatCell(row.remark)
		}
	];

	onMount(() => {
		const controller = new AbortController();
		void (async () => {
			isLoading = true;
			try {
				rows = await listBomItems(bomId, controller.signal);
				if (rows.length === 0) {
					ocrPushErrorToast({
						title: 'No BOM items',
						description: 'No extracted BOM rows found for this version.'
					});
				}
			} catch (err) {
				rows = [];
				ocrPushErrorToast({
					title: 'Could not load BOM items',
					description: errorDescription(err)
				});
			} finally {
				isLoading = false;
			}
		})();
		return () => controller.abort();
	});
</script>

<div class="flex h-full min-h-0 flex-col overflow-hidden p-3 md:p-4">
	<DataTable
		class="min-h-0 flex-1"
		{columns}
		{rows}
		loading={isLoading}
		rowKey={(row) => row.bom_item_id}
		search={{ enabled: true, placeholder: 'Search BOM rows...' }}
		export={{ enabled: false }}
		pagination={{ pageSize: 10 }}
		emptyState={{
			title: 'No BOM items',
			description: 'No extracted BOM rows found for this version.'
		}}
	/>
</div>
