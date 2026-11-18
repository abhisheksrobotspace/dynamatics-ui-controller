<script lang="ts">
	import { onMount } from 'svelte';
	import { Alert, DataTable, type DataTableColumn } from '@ifactory/ui-v2';
	import { Cpu } from '@lucide/svelte';
	import { formatApiErrorMessage } from '../../lib/api/types.js';
	import { listMachines, type MachineRow } from '../lib/machines.api.js';

	let rows = $state<MachineRow[]>([]);
	let loading = $state(true);
	let errorMessage = $state<string | null>(null);

	const columns: DataTableColumn<MachineRow>[] = [
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
			key: 'machine_id',
			header: 'Machine ID',
			sortable: true,
			dataType: 'string',
			value: (row) => row.machine_id
		},
		{
			type: 'text',
			key: 'name',
			header: 'Name',
			sortable: true,
			dataType: 'string',
			value: (row) => row.name
		},
		{
			type: 'text',
			key: 'group_id',
			header: 'Group',
			sortable: true,
			dataType: 'string',
			value: (row) => row.group_id
		},
		{
			type: 'text',
			key: 'location_id',
			header: 'Location',
			sortable: true,
			dataType: 'string',
			value: (row) => row.location_id?.trim() || '-'
		},
		{
			type: 'text',
			key: 'setup_time_s',
			header: 'Setup (s)',
			sortable: true,
			dataType: 'number',
			value: (row) => String(row.setup_time_s ?? 0)
		},
		{
			type: 'text',
			key: 'is_active',
			header: 'Active',
			sortable: true,
			dataType: 'string',
			value: (row) => (row.is_active === false ? 'No' : 'Yes')
		}
	];

	onMount(() => {
		const controller = new AbortController();
		void (async () => {
			loading = true;
			errorMessage = null;
			try {
				rows = await listMachines(controller.signal);
			} catch (error) {
				if (error instanceof DOMException && error.name === 'AbortError') return;
				errorMessage = formatApiErrorMessage(error);
				rows = [];
			} finally {
				if (!controller.signal.aborted) loading = false;
			}
		})();
		return () => controller.abort();
	});
</script>

<div class="flex h-full min-h-0 flex-col overflow-hidden p-4">
	{#if errorMessage}
		<div class="mb-4">
			<Alert variant="error" title="Could not load machines" description={errorMessage} />
		</div>
	{/if}

	<DataTable
		{columns}
		{rows}
		{loading}
		rowKey={(row) => row.machine_id}
		search={{ enabled: true, placeholder: 'Search machines' }}
		emptyState={{
			icon: Cpu,
			title: 'No machines yet',
			description: 'Machines from the plant master will appear here once configured'
		}}
		pagination={{ enabled: rows.length > 0 }}
	/>
</div>
