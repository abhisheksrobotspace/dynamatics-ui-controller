<script lang="ts">
	import { onMount } from 'svelte';
	import { DataTable, type DataTableColumn } from '@ifactory/ui-v2';
	import { GitBranch } from '@lucide/svelte';
	import {
		listOcrBomVersions,
		versionsForLineage,
		type OcrBomVersionOption
	} from '../lib/ocr-drawings.api.js';
	import { formatUtcAsIst } from '../../lib/datetime/format-ist.js';
	import { bomPublishStatusBadge } from '../../project-management-app/lib/projects/bom-status-badges.js';
	import { bomStructureFromParams, ocrBomDetailHash, structureId } from '../lib/ocr-routes.js';
	import { errorDescription } from '../../lib/api/types.js';
	import { ocrPushErrorToast } from '../lib/toast.js';

	let {
		params
	}: {
		params: { projectId: string; towerId?: string; stubId?: string; lineageId: string };
	} = $props();

	const projectId = $derived(params.projectId);
	const lineageId = $derived(decodeURIComponent(params.lineageId));
	const structure = $derived(bomStructureFromParams(params));
	const structureKey = $derived(structureId(structure));

	let versions = $state<OcrBomVersionOption[]>([]);
	let isLoading = $state(true);

	function handleView(row: OcrBomVersionOption) {
		window.location.hash = ocrBomDetailHash(projectId, structure, row.bomId);
	}

	const columns = $derived.by((): DataTableColumn<OcrBomVersionOption>[] => [
		{
			type: 'serial',
			key: 'sNo',
			header: 'S.No',
			value: (row) => String(versions.indexOf(row) + 1)
		},
		{
			type: 'text',
			key: 'version',
			header: 'Version',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => `V${row.version}`
		},
		{
			type: 'badge',
			key: 'stage',
			header: 'Status',
			sortable: true,
			filterable: true,
			dataType: 'string',
			badge: (row) => bomPublishStatusBadge({ stage: row.stage === 'mass' ? 'mass' : 'proto' })
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
				const all = await listOcrBomVersions(structureKey, controller.signal);
				versions = versionsForLineage(all, lineageId);
			} catch (err) {
				versions = [];
				ocrPushErrorToast({
					title: 'Could not load versions',
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
		rows={versions}
		loading={isLoading}
		rowKey={(row) => row.bomId}
		onRowClick={handleView}
		search={{ enabled: true, placeholder: 'Search versions...' }}
		export={{ enabled: false }}
		emptyState={{
			icon: GitBranch,
			title: 'No versions',
			description: 'This subtype has no BOM versions yet.'
		}}
		pagination={{ pageSize: 15 }}
	/>
</div>
