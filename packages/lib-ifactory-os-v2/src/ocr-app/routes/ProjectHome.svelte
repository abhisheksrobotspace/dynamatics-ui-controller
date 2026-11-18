<script lang="ts">
	import { DataTable, type DataTableColumn } from '@ifactory/ui-v2';
	import { Layers } from '@lucide/svelte';
	import { ocrStubsHash, ocrTowersHash } from '../lib/ocr-routes.js';

	let { params }: { params: { projectId: string } } = $props();
	const projectId = $derived(params.projectId);

	type StructureTypeRow = {
		id: 'tower' | 'stub';
		name: string;
		href: string;
	};

	const rows = $derived.by((): StructureTypeRow[] => [
		{ id: 'tower', name: 'Tower Types', href: ocrTowersHash(projectId) },
		{ id: 'stub', name: 'Stubs', href: ocrStubsHash(projectId) }
	]);

	function handleView(row: StructureTypeRow) {
		window.location.hash = row.href;
	}

	const columns = $derived.by((): DataTableColumn<StructureTypeRow>[] => [
		{
			type: 'serial',
			key: 'sNo',
			header: 'S.No',
			value: (row) => String(rows.indexOf(row) + 1)
		},
		{
			type: 'text',
			key: 'name',
			header: 'Structure',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => row.name
		},
		{
			type: 'actions',
			key: 'actions',
			header: 'Actions',
			headerClass: 'text-right',
			class: 'text-right',
			actions: (row) => [
				{
					type: 'button',
					label: 'View',
					variant: 'primary',
					size: 'sm',
					onClick: () => handleView(row)
				}
			]
		}
	]);
</script>

<div class="flex h-full min-h-0 flex-col overflow-hidden p-3 md:p-4">
	<DataTable
		{columns}
		{rows}
		rowKey={(row) => row.id}
		onRowClick={handleView}
		search={{ enabled: true, placeholder: 'Search structures...' }}
		export={{ enabled: false }}
		emptyState={{
			icon: Layers,
			title: 'No structures',
			description: 'Choose Tower Types or Stubs to continue.'
		}}
		pagination={{ pageSize: 15 }}
	/>
</div>
