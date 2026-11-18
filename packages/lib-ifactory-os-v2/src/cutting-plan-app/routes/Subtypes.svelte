<script lang="ts">
	import { onMount } from 'svelte';
	import { DataTable, type DataTableColumn } from '@ifactory/ui-v2';
	import { FileStack } from '@lucide/svelte';
	import {
		lineagesFromVersions,
		listOcrBomVersions,
		type OcrBomLineageOption
	} from '../../ocr-app/lib/ocr-drawings.api.js';
	import { bomStructureFromParams, cpLineageVersionsHash, structureId } from '../lib/cp-routes.js';
	import { formatUtcAsIst } from '../../lib/datetime/format-ist.js';
	import { bomPublishStatusBadge } from '../../project-management-app/lib/projects/bom-status-badges.js';
	import { errorDescription } from '../../lib/api/types.js';
	import { cpPushErrorToast } from '../lib/toast.js';

	let {
		params
	}: {
		params: { projectId: string; towerId?: string; stubId?: string };
	} = $props();

	const projectId = $derived(params.projectId);
	const structure = $derived(bomStructureFromParams(params));
	const structureKey = $derived(structureId(structure));

	let lineages = $state<OcrBomLineageOption[]>([]);
	let isLoading = $state(true);

	function handleView(row: OcrBomLineageOption) {
		window.location.hash = cpLineageVersionsHash(projectId, structure, row.bomLineageId);
	}

	const columns = $derived.by((): DataTableColumn<OcrBomLineageOption>[] => [
		{
			type: 'serial',
			key: 'sNo',
			header: 'S.No',
			sortable: true,
			filterable: true,
			dataType: 'number',
			value: (row) => String(lineages.indexOf(row) + 1)
		},
		{
			type: 'text',
			key: 'bomName',
			header: 'Subtype',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => row.bomName
		},
		{
			type: 'text',
			key: 'latestVersion',
			header: 'Latest Version',
			sortable: true,
			filterable: true,
			dataType: 'number',
			value: (row) => `V${row.latestVersion}`
		},
		{
			type: 'badge',
			key: 'stage',
			header: 'Status',
			sortable: true,
			filterable: true,
			dataType: 'string',
			badge: (row) => bomPublishStatusBadge(row)
		},
		{
			type: 'text',
			key: 'createdAt',
			header: 'Created At',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => (row.createdAt ? formatUtcAsIst(row.createdAt) : '—')
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
				const versions = await listOcrBomVersions(structureKey, controller.signal);
				lineages = lineagesFromVersions(versions);
			} catch (err) {
				lineages = [];
				cpPushErrorToast({
					title: 'Could not load subtypes',
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
		rows={lineages}
		loading={isLoading}
		rowKey={(row) => row.bomLineageId}
		onRowClick={handleView}
		search={{ enabled: true, placeholder: 'Search subtypes...' }}
		export={{ enabled: false }}
		emptyState={{
			icon: FileStack,
			title: 'No subtypes',
			description: 'This structure has no BOM subtypes yet.'
		}}
		pagination={{ pageSize: 15 }}
	/>
</div>
