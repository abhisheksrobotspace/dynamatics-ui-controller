<script lang="ts">
	import { onMount } from 'svelte';
	import { Bell, MoreVertical, Pencil, Plus } from '@lucide/svelte';
	import { Alert, DataTable, type DataTableColumn } from '@ifactory/ui-v2';
	import { listAlerts } from '../lib/alerts.api.js';
	import { formatErrorMessage, isAbortError } from '../lib/errors.js';
	import type { AlertMaster } from '../lib/types.js';
	import AddAlertDialog from '../components/AddAlertDialog.svelte';

	let alerts = $state.raw<AlertMaster[]>([]);
	let dataReady = $state(false);
	let errorMessage = $state<string | null>(null);
	let isAlertDialogOpen = $state(false);
	let alertDialogId = $state<number | null>(null);

	type AlertRow = {
		id: number;
		s_no: number;
		name: string;
		description: string;
	};

	// Only top-level alerts are managed here (sub-categories/reasons are
	// taxonomy children maintained with the backend team).
	const rows = $derived<AlertRow[]>(
		alerts
			.filter((alert) => !alert.parent_id)
			.map((alert, index) => ({
				id: alert.id,
				s_no: index + 1,
				name: alert.name || '-',
				description: alert.description || '-'
			}))
	);

	// Only top-level alerts are managed here (sub-categories/reasons are
	// taxonomy children maintained with the backend team).
	const columns: DataTableColumn<AlertRow>[] = [
		{
			type: 'serial',
			key: 's_no',
			header: 'S.No',
			dataType: 'number',
			value: (row) => String(row.s_no)
		},
		{ key: 'name', header: 'Name', sortable: true, value: (row) => row.name },
		{ key: 'description', header: 'Description', value: (row) => row.description },
		{
			type: 'actions',
			key: 'actions',
			header: '',
			headerClass: 'text-right',
			class: 'text-right',
			actions: () => [
				{
					type: 'dropdown',
					icon: MoreVertical,
					align: 'end',
					ariaLabel: 'More actions',
					items: () => [
						[
							{
								label: 'Edit',
								icon: Pencil,
								onClick: (selectedRow) => {
									alertDialogId = selectedRow.id;
									isAlertDialogOpen = true;
								}
							}
						]
					]
				}
			]
		}
	];

	async function loadPageData(signal?: AbortSignal) {
		alerts = await listAlerts(signal);
	}

	function handleAdd() {
		alertDialogId = null;
		isAlertDialogOpen = true;
	}

	function handleAlertSaved() {
		void loadPageData();
	}

	onMount(() => {
		const controller = new AbortController();
		loadPageData(controller.signal)
			.then(() => (dataReady = true))
			.catch((error) => {
				if (isAbortError(error)) return;
				errorMessage = formatErrorMessage(error);
				dataReady = true;
			});
		return () => controller.abort();
	});
</script>

<div class="flex h-full min-h-0 flex-col gap-4 overflow-hidden p-4">
	<!-- <h1 class="font-heading text-2xl font-bold text-foreground">Alerts</h1> -->

	{#if errorMessage}
		<Alert variant="error" title="Could not load alerts" description={errorMessage} />
	{/if}

	<DataTable
		{columns}
		{rows}
		loading={!dataReady}
		rowKey={(row) => String(row.id)}
		search={{ enabled: true, placeholder: 'Search alerts' }}
		emptyState={{
			icon: Bell,
			title: 'No alerts found',
			description: 'Top-level alert categories will appear here'
		}}
		toolbarButton={[
			{
				enabled: true,
				label: 'Add Alert',
				icon: Plus,
				onClick: handleAdd
			}
		]}
		pagination={{ enabled: rows.length > 0 }}
	/>
</div>

<AddAlertDialog bind:open={isAlertDialogOpen} alertId={alertDialogId} onSaved={handleAlertSaved} />
