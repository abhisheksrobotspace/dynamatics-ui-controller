<script lang="ts">
	import { KpiCard, StackedBarChart, Table, type TableColumn } from '@ifactory/ui-v2';
	import { AlertTriangle, ClipboardList, Lock, Package, Ticket, Unlock } from '@lucide/svelte';

	type ShortfallRow = {
		id: string;
		section: string;
		barsShort: number;
		mt: string;
		drivenBy: string;
	};

	type LockRow = {
		id: string;
		plan: string;
		project: string;
		barsLocked: string;
		barsComplete: boolean;
		shortfall: string;
		when: string;
	};

	type UploadRow = {
		id: string;
		project: string;
		plant: string;
		lines: string;
		replaced: string;
		isFullReplace: boolean;
		by: string;
		when: string;
	};

	const kpiItems = [
		{ label: 'Total Stock', value: '486.20 MT', icon: Package },
		{ label: 'Free', value: '312.40 MT', icon: Unlock },
		{ label: 'Locked', value: '173.80 MT', icon: Lock },
		{
			label: 'Shortfall awaiting indent',
			value: '12.4 MT',
			icon: AlertTriangle
		},
		{ label: 'Open plans to assign', value: '3', icon: ClipboardList },
		{ label: 'Indents raised (July)', value: '2', icon: Ticket }
	] as const;

	const plantLabels = ['Nashik 1', 'Nashik 2'];
	const plantSeries = [
		{ label: 'Free', data: [218.4, 94.0], color: '#22c55e' },
		{ label: 'Locked', data: [124.2, 49.6], color: '#ff6c2e' }
	];

	const shortfallRows: ShortfallRow[] = [
		{
			id: '1',
			section: 'HT ANGLE 45×45×4',
			barsShort: 3,
			mt: '0.51',
			drivenBy: 'CP-J57-0009'
		},
		{
			id: '2',
			section: 'HT ANGLE 200×200×22',
			barsShort: 12,
			mt: '6.55',
			drivenBy: 'CP-J55-0011'
		},
		{
			id: '3',
			section: 'MS ANGLE 55×55×4',
			barsShort: 4,
			mt: '0.16',
			drivenBy: 'CP-J55-0012'
		}
	];

	const lockRows: LockRow[] = [
		{
			id: '1',
			plan: 'CP-J57-0009',
			project: 'J57',
			barsLocked: '6 of 10',
			barsComplete: false,
			shortfall: '3 bars',
			when: '06/07 14:20'
		},
		{
			id: '2',
			plan: 'CP-J55-0007',
			project: 'J55',
			barsLocked: '21 of 21',
			barsComplete: true,
			shortfall: '-',
			when: '05/07 11:02'
		}
	];

	const uploadRows: UploadRow[] = [
		{
			id: '1',
			project: 'J57',
			plant: 'Nashik 1',
			lines: '48 lines',
			replaced: 'full replace',
			isFullReplace: true,
			by: 'Karteek',
			when: '06/07'
		}
	];

	const tableTitleClass = 'flex items-center px-6 py-4';

	const shortfallColumns: TableColumn<ShortfallRow>[] = [
		{ key: 'section', header: 'Section', value: (row) => row.section },
		{
			key: 'barsShort',
			header: 'Bars Short',
			type: 'actions',
			align: 'start',
			actions: (row) => [
				{
					type: 'label',
					label: String(row.barsShort),
					class: 'font-semibold text-status-error'
				}
			]
		},
		{
			key: 'mt',
			header: 'MT',
			value: (row) => row.mt
		},
		{
			key: 'drivenBy',
			header: 'Driven By',
			type: 'actions',
			align: 'start',
			actions: (row) => [
				{
					type: 'label',
					label: row.drivenBy,
					class: 'text-primary'
				}
			]
		}
	];

	const lockColumns: TableColumn<LockRow>[] = [
		{
			key: 'plan',
			header: 'Plan',
			type: 'actions',
			align: 'start',
			actions: (row) => [
				{
					type: 'label',
					label: row.plan,
					class: 'text-primary'
				}
			]
		},
		{ key: 'project', header: 'Project', value: (row) => row.project },
		{
			key: 'barsLocked',
			header: 'Bars Locked',
			type: 'actions',
			align: 'start',
			actions: (row) => [
				{
					type: 'label',
					label: row.barsLocked,
					class: row.barsComplete ? 'font-semibold text-status-online' : undefined
				}
			]
		},
		{
			key: 'shortfall',
			header: 'Shortfall',
			type: 'actions',
			align: 'start',
			actions: (row) => [
				{
					type: 'label',
					label: row.shortfall,
					class: row.shortfall === '-' ? 'text-muted-foreground' : 'font-medium text-status-error'
				}
			]
		},
		{
			key: 'when',
			header: 'When',
			value: (row) => row.when,
			class: 'text-muted-foreground'
		}
	];

	const uploadColumns: TableColumn<UploadRow>[] = [
		{ key: 'project', header: 'Project', value: (row) => row.project },
		{ key: 'plant', header: 'Plant', value: (row) => row.plant },
		{ key: 'lines', header: 'Lines', value: (row) => row.lines },
		{
			key: 'replaced',
			header: 'Replaced',
			type: 'actions',
			align: 'start',
			actions: (row) => [
				{
					type: 'label',
					label: row.replaced,
					class: row.isFullReplace ? 'font-medium text-status-online' : undefined
				}
			]
		},
		{ key: 'by', header: 'By', value: (row) => row.by },
		{
			key: 'when',
			header: 'When',
			value: (row) => row.when,
			class: 'text-muted-foreground'
		}
	];
</script>

<div class="flex h-full min-h-0 flex-col overflow-hidden p-3 md:p-4">
	<div class="flex min-h-0 flex-1 flex-col gap-4">
		<div class="grid shrink-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
			{#each kpiItems as item (item.label)}
				<KpiCard label={item.label} value={item.value} icon={item.icon} />
			{/each}
		</div>

		<div class="grid min-h-0 flex-1 grid-cols-1 gap-4 xl:grid-cols-2 xl:grid-rows-2">
			<section
				class="flex h-full min-h-0 min-w-0 flex-col overflow-hidden border border-border bg-surface"
			>
				<div class={tableTitleClass}>
					<h2 class="font-heading text-base font-semibold text-foreground">Stock by plant</h2>
				</div>
				<div class="flex min-h-0 flex-1 flex-col px-6 pb-4">
					<StackedBarChart
						labels={plantLabels}
						series={plantSeries}
						orientation="horizontal"
						showLegend={true}
						showGrid={false}
						showAxes={true}
						barThickness={24}
						class="min-h-0 w-full flex-1"
					/>
				</div>
			</section>

			<section
				class="flex h-full min-h-0 min-w-0 flex-col overflow-hidden border border-border bg-surface"
			>
				<div class={tableTitleClass}>
					<h2 class="font-heading text-base font-semibold text-foreground">
						Top shortfall sections
					</h2>
				</div>
				<div class="min-h-0 flex-1">
					<Table
						layout="content"
						columns={shortfallColumns}
						rows={shortfallRows}
						rowKey={(row) => row.id}
					/>
				</div>
			</section>

			<section
				class="flex h-full min-h-0 min-w-0 flex-col overflow-hidden border border-border bg-surface"
			>
				<div class={tableTitleClass}>
					<h2 class="font-heading text-base font-semibold text-foreground">Recent locks</h2>
				</div>
				<div class="min-h-0 flex-1">
					<Table layout="content" columns={lockColumns} rows={lockRows} rowKey={(row) => row.id} />
				</div>
			</section>

			<section
				class="flex h-full min-h-0 min-w-0 flex-col overflow-hidden border border-border bg-surface"
			>
				<div class={tableTitleClass}>
					<h2 class="font-heading text-base font-semibold text-foreground">Recent stock uploads</h2>
				</div>
				<div class="min-h-0 flex-1">
					<Table
						layout="content"
						columns={uploadColumns}
						rows={uploadRows}
						rowKey={(row) => row.id}
					/>
				</div>
			</section>
		</div>
	</div>
</div>
