<script lang="ts">
	import DemoBackNav from '../_components/demo-back-nav.svelte';
	import { MoreVertical, Pencil, Trash2 } from '@lucide/svelte';
	import { Label, Table, Toggle } from '$lib';
	import type { StatusBarSegment } from '$lib/components/ui/status-bar/status-bar.constants';
	import type { RowTone, TableColumn } from '$lib/components/ui/table/table.constants';

	type MachineRow = {
		key: string;
		id: string;
		oee: string;
		jobsCompleted: number;
		status: RowTone;
		weightLabel: string;
		segments: StatusBarSegment[];
	};

	const statusLabels: Record<RowTone, string> = {
		online: 'Online',
		offline: 'Offline',
		loading: 'Loading',
		error: 'Error'
	};

	const activePattern: StatusBarSegment[] = [
		'primary',
		'error',
		'online',
		'loading',
		'primary',
		'error',
		'online',
		'loading',
		'primary',
		'error',
		'online',
		'online',
		'loading',
		'primary',
		'loading',
		'error',
		'primary'
	];

	const partialPattern: StatusBarSegment[] = [
		'primary',
		'error',
		'online',
		'loading',
		'primary',
		'error',
		'online',
		'offline',
		'offline',
		'offline',
		'offline',
		'offline',
		'offline',
		'offline',
		'offline',
		'offline',
		'offline',
		'offline',
		'offline',
		'offline',
		'offline',
		'offline',
		'offline',
		'offline'
	];

	const sparsePattern: StatusBarSegment[] = [
		'primary',
		'error',
		'online',
		'offline',
		'offline',
		'offline',
		'offline',
		'offline',
		'offline',
		'offline',
		'offline',
		'offline',
		'offline',
		'offline',
		'offline',
		'offline',
		'offline',
		'offline',
		'offline',
		'offline',
		'offline',
		'offline',
		'offline',
		'offline'
	];

	function padSegments(segments: StatusBarSegment[]): StatusBarSegment[] {
		const padded = [...segments];
		while (padded.length < 24) {
			padded.push('offline');
		}
		return padded.slice(0, 24);
	}

	const rowConfigs: { status: RowTone; weightLabel: string; segments: StatusBarSegment[] }[] = [
		{ status: 'online', weightLabel: '0 MT', segments: activePattern },
		{ status: 'offline', weightLabel: 'CP06', segments: partialPattern },
		{ status: 'loading', weightLabel: 'CP06', segments: sparsePattern },
		{ status: 'error', weightLabel: 'CP06', segments: activePattern },
		{ status: 'online', weightLabel: '0 MT', segments: activePattern },
		{ status: 'offline', weightLabel: 'CP06', segments: partialPattern },
		{ status: 'loading', weightLabel: 'CP06', segments: sparsePattern },
		{ status: 'error', weightLabel: 'CP06', segments: activePattern },
		{ status: 'loading', weightLabel: 'CP06', segments: sparsePattern },
		{ status: 'error', weightLabel: 'CP06', segments: activePattern }
	];

	const rows: MachineRow[] = rowConfigs.map((config, index) => ({
		key: `cp06-${index}`,
		id: 'CP06',
		oee: '0.00%',
		jobsCompleted: 0,
		status: config.status,
		weightLabel: config.weightLabel,
		segments: padSegments(config.segments)
	}));

	const columns: TableColumn<MachineRow>[] = [
		{ type: 'serial', key: 'sNo', header: 'S.No', value: (row) => row.key.replace('cp06-', '') },
		{ key: 'id', header: 'Machine', value: (row) => row.id },
		{ key: 'oee', header: 'OEE', value: (row) => row.oee },
		{
			key: 'jobsCompleted',
			header: 'Jobs Completed',
			value: (row) => String(row.jobsCompleted)
		},
		{
			key: 'status',
			header: 'Status',
			type: 'badge',
			badge: (row) => ({ variant: row.status, label: statusLabels[row.status] })
		},
		{
			key: 'weight',
			header: 'Weight',
			type: 'metric-bar',
			label: (row) => row.weightLabel,
			segments: (row) => row.segments,
			headerClass: 'min-w-[20rem]'
		},
		{
			key: 'actions',
			header: 'Actions',
			type: 'actions',
			headerClass: 'text-right',
			class: 'text-right',
			actions: (row) => [
				{
					label: 'View',
					variant: 'outline',
					size: 'sm',
					onClick: (machine) => {
						lastAction = `View ${machine.id}`;
					}
				},
				{
					type: 'dropdown',
					icon: MoreVertical,
					ariaLabel: `More actions for ${row.id}`,
					align: 'end',
					items: () => [
						[
							{
								label: 'Edit',
								icon: Pencil,
								onClick: (entry) => {
									lastAction = `Edit ${entry.id}`;
								}
							},
							{
								label: 'Duplicate',
								onClick: (entry) => {
									lastAction = `Duplicate ${entry.id}`;
								}
							}
						],
						[
							{
								label: 'Delete',
								icon: Trash2,
								onClick: (entry) => {
									lastAction = `Delete ${entry.id}`;
								}
							}
						]
					]
				}
			]
		}
	];

	let selectedRow = $state<MachineRow | null>(null);
	let lastAction = $state<string | null>(null);
	let loading = $state(true);
</script>

<DemoBackNav />

<div class="mx-auto max-w-7xl space-y-10 p-8">
	<section class="space-y-4">
		<h2 class="text-xl font-semibold">Machine monitoring table</h2>
		<p class="text-sm text-muted-foreground">
			Example using the base Table API with status-tinted rows, badges, compact status bars, row
			actions, and dropdown menus.
		</p>

		{#if selectedRow}
			<p class="text-sm text-muted-foreground">
				Selected row: {selectedRow.id} ({selectedRow.status})
			</p>
		{/if}

		{#if lastAction}
			<p class="text-sm text-muted-foreground">Last action: {lastAction}</p>
		{/if}

		<Table
			{columns}
			{rows}
			rowKey={(row) => row.key}
			variant="structured"
			getRowTone={(row) => row.status}
			onRowClick={(row) => {
				selectedRow = row;
			}}
		/>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">Loading skeleton</h2>
		<p class="text-sm text-muted-foreground">
			Set <code class="text-xs">loading</code> to keep the real column headers while placeholder cells
			follow each column type (serial circle, text bars, badge pills, metric bars, actions ellipsis).
		</p>
		<div class="flex items-center gap-3">
			<Toggle id="table-loading" bind:checked={loading} aria-label="Table loading" />
			<Label for="table-loading" text="Show loading skeleton" />
		</div>
		<Table {columns} {rows} {loading} rowKey={(row) => row.key} variant="structured" />
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">Striped rows</h2>
		<p class="text-sm text-muted-foreground">
			Pass <code class="text-xs">rowVariant="striped"</code> for zebra-striped rows. Semantic
			<code class="text-xs">getRowTone</code> still overrides the stripe for individual rows. Sticky columns
			inherit the stripe colour so they don't paint over it.
		</p>
		<Table
			{columns}
			{rows}
			rowKey={(row) => row.key}
			variant="structured"
			rowVariant="striped"
			getRowTone={(row) => row.status}
		/>
	</section>
</div>
