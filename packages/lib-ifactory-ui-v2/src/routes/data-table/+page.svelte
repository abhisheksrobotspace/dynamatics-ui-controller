<script lang="ts">
	import DemoBackNav from '../_components/demo-back-nav.svelte';
	import { EllipsisVertical, Pencil, Plus, Trash2 } from '@lucide/svelte';
	import { DataTable, Label, Toggle, type DataTableColumn } from '$lib';

	type MachineStatus = 'Production' | 'No Operator' | 'Inspection' | 'Breakdown';

	type MachineListRow = {
		key: string;
		name: string;
		status: MachineStatus;
		operator: string;
		interlockStatus: string;
		lastSync: string;
		macAddress: string;
	};

	const rows: MachineListRow[] = [
		{
			key: 'cp08',
			name: 'CP08',
			status: 'No Operator',
			operator: 'N/A',
			interlockStatus: 'On',
			lastSync: '7/3/2026, 11:56:21 AM',
			macAddress: '2c-cf-67-18-b8-dd'
		},
		{
			key: 'cp11',
			name: 'CP11',
			status: 'Production',
			operator: 'Jitendra Sharma',
			interlockStatus: 'Off',
			lastSync: '7/3/2026, 11:56:21 AM',
			macAddress: '2c-cf-67-18-b8-dd'
		},
		{
			key: 'p82',
			name: 'P82',
			status: 'Inspection',
			operator: 'Jitendra Sharma',
			interlockStatus: '-',
			lastSync: '7/3/2026, 11:56:21 AM',
			macAddress: '2c-cf-67-18-b8-dd'
		},
		{
			key: 'cp12',
			name: 'CP12',
			status: 'Breakdown',
			operator: 'Jitendra Sharma',
			interlockStatus: 'On',
			lastSync: '7/3/2026, 11:56:21 AM',
			macAddress: '2c-cf-67-18-b8-dd'
		},
		{
			key: 'cp13',
			name: 'CP13',
			status: 'Production',
			operator: 'Jitendra Sharma',
			interlockStatus: 'Off',
			lastSync: '7/3/2026, 11:56:21 AM',
			macAddress: '2c-cf-67-18-b8-dd'
		},
		{
			key: 'cp14',
			name: 'CP14',
			status: 'No Operator',
			operator: 'N/A',
			interlockStatus: 'On',
			lastSync: '-',
			macAddress: '2c-cf-67-18-b8-dd'
		},
		{
			key: 'cp15',
			name: 'CP15',
			status: 'Inspection',
			operator: 'Jitendra Sharma',
			interlockStatus: '-',
			lastSync: '7/3/2026, 11:56:21 AM',
			macAddress: '2c-cf-67-18-b8-dd'
		},
		{
			key: 'cp16',
			name: 'CP16',
			status: 'Breakdown',
			operator: 'Jitendra Sharma',
			interlockStatus: 'On',
			lastSync: '7/3/2026, 11:56:21 AM',
			macAddress: '2c-cf-67-18-b8-dd'
		},
		{
			key: 'cp17',
			name: 'CP17',
			status: 'Production',
			operator: 'Jitendra Sharma',
			interlockStatus: 'Off',
			lastSync: '7/3/2026, 11:56:21 AM',
			macAddress: '2c-cf-67-18-b8-dd'
		},
		{
			key: 'cp18',
			name: 'CP18',
			status: 'No Operator',
			operator: 'N/A',
			interlockStatus: 'On',
			lastSync: '7/3/2026, 11:56:21 AM',
			macAddress: '2c-cf-67-18-b8-dd'
		},
		{
			key: 'cp19',
			name: 'CP19',
			status: 'Production',
			operator: 'Jitendra Sharma',
			interlockStatus: 'Off',
			lastSync: '7/3/2026, 11:56:22 AM',
			macAddress: '2c-cf-67-18-b8-de'
		},
		{
			key: 'cp20',
			name: 'CP20',
			status: 'Breakdown',
			operator: 'Jitendra Sharma',
			interlockStatus: 'On',
			lastSync: '7/3/2026, 11:56:22 AM',
			macAddress: '2c-cf-67-18-b8-df'
		}
	];

	function statusBadge(status: MachineStatus) {
		if (status === 'Production') {
			return { variant: 'online' as const, label: status, dot: false };
		}

		return { variant: 'error' as const, label: status, dot: false };
	}

	const columns: DataTableColumn<MachineListRow>[] = [
		{
			key: 'name',
			header: 'Machine Name',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => row.name
		},
		{
			key: 'status',
			header: 'Status',
			type: 'badge',
			sortable: true,
			filterable: true,
			dataType: 'string',
			badge: (row) => statusBadge(row.status)
		},
		{
			key: 'operator',
			header: 'Operator',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => row.operator
		},
		{
			key: 'interlockStatus',
			header: 'Interlock Status',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => row.interlockStatus
		},
		{
			key: 'lastSync',
			header: 'Last Sync',
			sortable: true,
			filterable: true,
			dataType: 'date',
			value: (row) => row.lastSync
		},
		{
			key: 'macAddress',
			header: 'MAC Address',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => row.macAddress
		},
		{
			key: 'actions',
			header: 'Actions',
			type: 'actions',
			headerClass: 'text-right',
			class: 'text-right',
			actions: (row) => [
				{
					icon: Pencil,
					variant: 'ghost',
					size: 'icon',
					ariaLabel: `Edit ${row.name}`,
					onClick: (machine) => {
						lastAction = `Edit ${machine.name}`;
					}
				},
				{
					type: 'dropdown',
					icon: EllipsisVertical,
					ariaLabel: `More actions for ${row.name}`,
					align: 'end',
					items: () => [
						{
							label: 'View details',
							onClick: (entry) => {
								lastAction = `View ${entry.name}`;
							}
						},
						{
							label: 'Delete',
							icon: Trash2,
							disabled: (entry) => entry.status === 'Production',
							onClick: (entry) => {
								lastAction = `Delete ${entry.name}`;
							}
						}
					]
				}
			]
		}
	];

	let selectedRow = $state<MachineListRow | null>(null);
	let selectedRowKeys = $state<string[]>([]);
	let singleSelectedRowKeys = $state<string[]>([]);
	let lastAction = $state<string | null>(null);
	let loading = $state(true);

	const selectedMachines = $derived(
		rows.filter((row) => selectedRowKeys.includes(row.key)).map((row) => row.name)
	);
	const singleSelectedMachine = $derived(
		rows.find((row) => singleSelectedRowKeys.includes(row.key))?.name ?? null
	);
</script>

<DemoBackNav />

<div class="mx-auto max-w-7xl space-y-10 p-8">
	<section class="space-y-4">
		<h2 class="text-xl font-semibold">DataTable</h2>
		<p class="text-sm text-muted-foreground">
			Card table with search, export, sortable columns, per-column filters (values + conditions),
			pagination, row click, action buttons, dropdown menus, and multiple toolbar buttons via
			<code class="text-xs">toolbarButton</code> array.
		</p>

		{#if selectedRow}
			<p class="text-sm text-muted-foreground">Selected row: {selectedRow.name}</p>
		{/if}

		{#if lastAction}
			<p class="text-sm text-muted-foreground">Last action: {lastAction}</p>
		{/if}

		<DataTable
			{columns}
			{rows}
			rowKey={(row) => row.key}
			onRowClick={(row) => {
				selectedRow = row;
			}}
			export={{ enabled: true, fileName: 'machines' }}
			filtering={{ conditions: true }}
			toolbarButton={[
				{
					enabled: true,
					label: 'Add machine',
					icon: Plus,
					onClick: () => {
						lastAction = 'Add machine';
					}
				},
				{
					enabled: true,
					label: 'Bulk assign',
					variant: 'outline',
					onClick: () => {
						lastAction = 'Bulk assign';
					}
				}
			]}
			pagination={{ pageSize: 10 }}
		/>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">Loading skeleton</h2>
		<p class="text-sm text-muted-foreground">
			Set <code class="text-xs">loading</code> to keep the real headers, toolbar, and pagination while
			placeholder cells match each column type (serial, text, badge, actions).
		</p>
		<div class="flex items-center gap-3">
			<Toggle id="data-table-loading" bind:checked={loading} aria-label="Table loading" />
			<Label for="data-table-loading" text="Show loading skeleton" />
		</div>
		<DataTable
			{columns}
			{rows}
			{loading}
			rowKey={(row) => row.key}
			export={{ enabled: true, fileName: 'machines' }}
			filtering={{ conditions: true }}
			toolbarButton={{
				enabled: true,
				label: 'Add machine',
				icon: Plus
			}}
			pagination={{ pageSize: 10 }}
		/>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">With checkbox selection</h2>
		<p class="text-sm text-muted-foreground">
			Enable <code class="text-xs">selection</code> and bind
			<code class="text-xs">selectedRowKeys</code> for a checkbox column with select-all. Selected:
			{selectedRowKeys.length}
			{#if selectedMachines.length}
				({selectedMachines.join(', ')})
			{/if}
		</p>

		<DataTable
			{columns}
			{rows}
			rowKey={(row) => row.key}
			selection={{ enabled: true }}
			bind:selectedRowKeys
			export={{ enabled: false }}
			filtering={{ conditions: true }}
			toolbarButton={{ enabled: false, label: 'Add machine' }}
			pagination={{ pageSize: 10 }}
		/>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">With single checkbox selection</h2>
		<p class="text-sm text-muted-foreground">
			Set <code class="text-xs">selection.mode = 'single'</code> to allow at most one selected row
			(select-all is hidden). Selected:
			{singleSelectedMachine ?? 'none'}
		</p>

		<DataTable
			{columns}
			{rows}
			rowKey={(row) => row.key}
			selection={{ enabled: true, mode: 'single' }}
			bind:selectedRowKeys={singleSelectedRowKeys}
			export={{ enabled: false }}
			filtering={{ conditions: true }}
			toolbarButton={{ enabled: false, label: 'Add machine' }}
			pagination={{ pageSize: 10 }}
		/>
	</section>
</div>
