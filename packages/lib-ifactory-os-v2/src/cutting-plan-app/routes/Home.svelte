<script lang="ts">
	import { onMount } from 'svelte';
	import { DataTable, type DataTableColumn } from '@ifactory/ui-v2';
	import { FolderKanban } from '@lucide/svelte';
	import { formatUtcAsIst } from '../../lib/datetime/format-ist.js';
	import { loadProjectsPageData } from '../../project-management-app/lib/projects/load-project.js';
	import type { Project } from '../../project-management-app/lib/store.svelte.js';
	import { cpProjectHomeHash } from '../lib/cp-routes.js';
	import { errorDescription } from '../../lib/api/types.js';
	import { cpPushErrorToast } from '../lib/toast.js';

	let projects = $state<Project[]>([]);
	let isLoading = $state(true);

	function handleView(project: Project) {
		window.location.hash = cpProjectHomeHash(project.id);
	}

	const columns: DataTableColumn<Project>[] = [
		{
			type: 'serial',
			key: 'sNo',
			header: 'S.No',
			sortable: true,
			filterable: true,
			dataType: 'number',
			value: (row) => String(row.sNo)
		},
		{
			type: 'text',
			key: 'workOrderNo',
			header: 'Work Order No',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => row.workOrderNo || '-'
		},
		{
			type: 'text',
			key: 'projectName',
			header: 'Name',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => row.projectName
		},
		{
			type: 'text',
			key: 'customerName',
			header: 'Customer',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => row.customerName
		},
		{
			type: 'text',
			key: 'contractorName',
			header: 'Contractor',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => row.contractorName || '-'
		},
		{
			type: 'text',
			key: 'createdAt',
			header: 'Created At',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => (row.createdAt ? formatUtcAsIst(row.createdAt) : '-')
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
	];

	onMount(() => {
		const controller = new AbortController();
		void (async () => {
			isLoading = true;
			try {
				const { projects: loaded } = await loadProjectsPageData(controller.signal);
				projects = loaded;
			} catch (err) {
				projects = [];
				cpPushErrorToast({
					title: 'Could not load projects',
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
		rows={projects}
		loading={isLoading}
		rowKey={(row) => row.id}
		onRowClick={handleView}
		search={{ enabled: true, placeholder: 'Search projects...' }}
		export={{ enabled: false }}
		emptyState={{
			icon: FolderKanban,
			title: 'No projects',
			description: 'No active projects are available for Cutting Plan.'
		}}
		pagination={{ pageSize: 15 }}
	/>
</div>
