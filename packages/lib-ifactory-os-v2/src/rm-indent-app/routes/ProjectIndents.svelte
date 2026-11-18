<script lang="ts">
	import { DataTable, type DataTableColumn } from '@ifactory/ui-v2';
	import { Ticket } from '@lucide/svelte';
	import { onMount } from 'svelte';
	import { projectIndentDetailUrl } from '../lib/indent-routes';
	import { getIndents, type IndentListRow } from '../lib/indents.api';
	import { resolvePlanningAppData } from '../lib/planning-capabilities';
	import { rmiPushToast } from '../lib/toast';
	import { formatApiErrorMessage } from '../../lib/api/types';

	let { params = {}, data }: { params?: Record<string, string>; data?: unknown } = $props();

	const planId = $derived(params.planId ? decodeURIComponent(params.planId) : '');
	const projectId = $derived(params.projectId ? decodeURIComponent(params.projectId) : '');
	const planning = $derived(resolvePlanningAppData(data));

	let rows = $state<IndentListRow[]>([]);
	let isLoading = $state(true);

	function formatMt(value: number): string {
		return value.toFixed(2);
	}

	function openIndent(row: IndentListRow) {
		if (!planId || !projectId) return;
		window.location.hash = projectIndentDetailUrl(planning.appName, planId, projectId, row.id);
	}

	const columns = $derived.by((): DataTableColumn<IndentListRow>[] => [
		{
			type: 'serial',
			key: 'sNo',
			header: 'S.No',
			sortable: true,
			filterable: true,
			dataType: 'number',
			value: (row) => {
				const index = rows.indexOf(row);
				return String(index >= 0 ? index + 1 : '');
			}
		},
		{
			type: 'text',
			key: 'indent_no',
			header: 'Indent No',
			sortable: true,
			filterable: true,
			dataType: 'number',
			class: 'font-medium text-primary',
			value: (row) => `#${row.indent_no}`
		},
		{
			type: 'text',
			key: 'revision_label',
			header: 'Rev',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => row.revision_label
		},
		{
			type: 'text',
			key: 'batch',
			header: 'Batch',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => row.batch
		},
		{
			type: 'text',
			key: 'mfg_plan_ref',
			header: 'Manufacturing Plan',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => row.mfg_plan_ref
		},
		{
			type: 'text',
			key: 'status',
			header: 'Status',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => row.status
		},
		{
			type: 'text',
			key: 'ht_mt',
			header: 'HT (MT)',
			sortable: true,
			filterable: true,
			dataType: 'number',
			value: (row) => formatMt(row.ht_mt)
		},
		{
			type: 'text',
			key: 'ms_mt',
			header: 'MS (MT)',
			sortable: true,
			filterable: true,
			dataType: 'number',
			value: (row) => formatMt(row.ms_mt)
		},
		{
			type: 'text',
			key: 'total_mt',
			header: 'Total (MT)',
			sortable: true,
			filterable: true,
			dataType: 'number',
			class: 'font-semibold',
			value: (row) => formatMt(row.total_mt)
		},
		{
			type: 'text',
			key: 'created_label',
			header: 'Created',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => row.created_label
		}
	]);

	onMount(() => {
		if (!projectId) {
			isLoading = false;
			return;
		}
		const controller = new AbortController();
		void (async () => {
			isLoading = true;
			try {
				rows = await getIndents(controller.signal, { projectId });
			} catch (error) {
				if (controller.signal.aborted) return;
				rmiPushToast({
					title: 'Failed to load indents',
					description: formatApiErrorMessage(error)
				});
				rows = [];
			} finally {
				if (!controller.signal.aborted) isLoading = false;
			}
		})();
		return () => controller.abort();
	});
</script>

<div class="flex h-full min-h-0 flex-col overflow-hidden p-3 md:p-4">
	<div class="min-h-0 flex-1">
		<DataTable
			{columns}
			{rows}
			loading={isLoading}
			rowKey={(row) => row.id}
			onRowClick={(row) => openIndent(row)}
			emptyState={{
				icon: Ticket,
				title: 'No indents for this project',
				description: 'Raise an indent for this project to see it here.'
			}}
			pagination={{ pageSize: 10 }}
		/>
	</div>
</div>
