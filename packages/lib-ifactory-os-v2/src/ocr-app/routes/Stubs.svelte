<script lang="ts">
	import { onMount } from 'svelte';
	import { DataTable, type DataTableColumn } from '@ifactory/ui-v2';
	import { Layers } from '@lucide/svelte';
	import { listOcrStructures, type OcrStructureOption } from '../lib/ocr-drawings.api.js';
	import { ocrBomsListHash } from '../lib/ocr-routes.js';
	import { errorDescription } from '../../lib/api/types.js';
	import { ocrPushErrorToast } from '../lib/toast.js';

	let { params }: { params: { projectId: string } } = $props();
	const projectId = $derived(params.projectId);

	let structures = $state<OcrStructureOption[]>([]);
	let isLoading = $state(true);

	function handleView(row: OcrStructureOption) {
		window.location.hash = ocrBomsListHash(projectId, {
			kind: 'stub',
			stubId: row.structureId
		});
	}

	const columns = $derived.by((): DataTableColumn<OcrStructureOption>[] => [
		{
			type: 'serial',
			key: 'sNo',
			header: 'S.No',
			value: (row) => String(structures.indexOf(row) + 1)
		},
		{
			type: 'text',
			key: 'name',
			header: 'Name',
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

	onMount(() => {
		const controller = new AbortController();
		void (async () => {
			isLoading = true;
			try {
				structures = await listOcrStructures(projectId, 'stub', controller.signal);
			} catch (err) {
				structures = [];
				ocrPushErrorToast({
					title: 'Could not load stubs',
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
		{columns}
		rows={structures}
		loading={isLoading}
		rowKey={(row) => row.structureId}
		onRowClick={handleView}
		search={{ enabled: true, placeholder: 'Search stubs...' }}
		export={{ enabled: false }}
		emptyState={{
			icon: Layers,
			title: 'No stubs',
			description: 'This project has no stubs yet.'
		}}
		pagination={{ pageSize: 15 }}
	/>
</div>
