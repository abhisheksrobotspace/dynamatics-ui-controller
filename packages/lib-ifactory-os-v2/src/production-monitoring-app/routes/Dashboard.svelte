<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import {
		BarChart3,
		ChartLine,
		ClipboardCheck,
		Factory,
		FileDown,
		Filter,
		LayoutList,
		Scale
	} from '@lucide/svelte';
	import {
		Alert,
		Badge,
		BarChart,
		Button,
		Chart,
		DataTable,
		DropdownMenu,
		EmptyState,
		KpiCard,
		MachineCard,
		Skeleton,
		Tabs,
		kpiCardStripClass,
		type DataTableColumn
	} from '@ifactory/ui-v2';
	import { APP_DATE_FILTER_CONTEXT, type AppDateFilter } from '$lib/appShell/appSharedState.js';
	import { persistOSState } from '$lib/os/index.svelte.js';
	import RangeFilters from '../components/RangeFilters.svelte';
	import { CNC_GROUP_ID } from '../lib/constants.js';
	import { lineChartConfig } from '../lib/charts.js';
	import {
		type DateRange,
		resolveInitialFilters,
		writeSharedDateRange
	} from '../lib/date-range.js';
	import { formatErrorMessage, isAbortError } from '../lib/errors.js';
	import { getDashboard, listMachineGroupOptions, listShifts } from '../lib/machines.api.js';
	import type {
		DashboardMachineCard,
		DashboardPayload,
		MachineGroupOption,
		Shift
	} from '../lib/types.js';

	const sharedDateFilter = getContext<AppDateFilter>(APP_DATE_FILTER_CONTEXT);
	const initial = resolveInitialFilters(sharedDateFilter);

	let dateRange = $state<DateRange | null>(initial.dateRange);
	let machineGroupId = $state(initial.machineGroupId);
	let groupOptions = $state.raw<MachineGroupOption[]>([]);
	let shifts = $state.raw<Shift[]>([]);
	let mastersReady = $state(false);
	let dashboard = $state.raw<DashboardPayload | null>(null);
	let loading = $state(true);
	let errorMessage = $state<string | null>(null);
	let viewMode = $state('grid');
	let chartMode = $state('bar');
	let sortBy = $state<'weight' | 'oee' | 'jobs' | 'name' | 'breakdowns'>('weight');
	let statusFilter = $state<'all' | 'online' | 'error' | 'loading' | 'offline'>('all');

	type ProductionRow = {
		id: number;
		name: string;
		breakdowns: string;
		jobsCompleted: string;
		oee: string;
		production: string;
	};

	const viewTabs = $derived([
		{ label: 'Grid', value: 'grid', current: viewMode === 'grid' },
		{ label: 'List', value: 'list', current: viewMode === 'list' }
	]);

	const chartTabs = $derived([
		{ label: 'Bar', value: 'bar', icon: BarChart3, current: chartMode === 'bar' },
		{ label: 'Line', value: 'line', icon: ChartLine, current: chartMode === 'line' }
	]);

	const sortLabel = $derived(
		(
			{
				weight: 'Sort by weight',
				oee: 'Sort by OEE',
				jobs: 'Sort by jobs',
				name: 'Sort by name',
				breakdowns: 'Sort by breakdowns'
			} as const
		)[sortBy]
	);

	const sortedMachines = $derived.by(() => {
		if (!dashboard) return [] as DashboardMachineCard[];
		const rows = [...dashboard.machines];
		const filtered =
			statusFilter === 'all' ? rows : rows.filter((machine) => machine.cardStatus === statusFilter);
		filtered.sort((a, b) => {
			switch (sortBy) {
				case 'oee':
					return (b.oeeNumeric ?? -1) - (a.oeeNumeric ?? -1);
				case 'jobs':
					return b.jobsCompleted - a.jobsCompleted;
				case 'breakdowns':
					return b.breakdowns - a.breakdowns;
				case 'name':
					return a.name.localeCompare(b.name);
				case 'weight':
				default:
					return Number.parseFloat(b.production) - Number.parseFloat(a.production);
			}
		});
		return filtered;
	});

	const productionRows = $derived.by<ProductionRow[]>(() =>
		sortedMachines.map((machine) => ({
			id: machine.id,
			name: machine.name,
			breakdowns: String(machine.breakdowns),
			jobsCompleted: String(machine.jobsCompleted),
			oee: machine.oee === 'No Data' ? 'No Data' : `${machine.oee}%`,
			production: `${machine.production} ${machine.uom}`
		}))
	);

	const productionColumns: DataTableColumn<ProductionRow>[] = [
		{
			type: 'serial',
			key: 'sNo',
			header: 'S.No',
			sortable: true,
			filterable: true,
			dataType: 'number',
			value: (row) => {
				const index = productionRows.indexOf(row);
				return String(index >= 0 ? index + 1 : '');
			}
		},
		{ key: 'name', header: 'Machine', sortable: true, value: (row) => row.name },
		{
			key: 'breakdowns',
			header: 'Breakdowns',
			sortable: true,
			dataType: 'number',
			value: (row) => row.breakdowns
		},
		{
			key: 'jobsCompleted',
			header: 'Jobs Completed',
			sortable: true,
			dataType: 'number',
			value: (row) => row.jobsCompleted
		},
		{ key: 'oee', header: 'OEE', sortable: true, value: (row) => row.oee },
		{ key: 'production', header: 'Weight', sortable: true, value: (row) => row.production }
	];

	const lineConfig = $derived(
		dashboard
			? lineChartConfig(
					dashboard.productionChart.labels,
					dashboard.productionChart.values,
					'Weight (MT)'
				)
			: null
	);

	async function loadDashboard(signal?: AbortSignal) {
		if (!dateRange) return;
		loading = true;
		errorMessage = null;
		try {
			dashboard = await getDashboard(
				{
					from: dateRange.from,
					to: dateRange.to,
					machineGroupId: Number(machineGroupId) || CNC_GROUP_ID
				},
				signal
			);
		} catch (error) {
			if (isAbortError(error)) return;
			errorMessage = formatErrorMessage(error);
			dashboard = null;
		} finally {
			if (!signal?.aborted) loading = false;
		}
	}

	function persistFilters(nextRange: DateRange, nextGroupId: string) {
		writeSharedDateRange(sharedDateFilter, nextRange);
		sharedDateFilter.selectedMachineGroupId = Number(nextGroupId) || CNC_GROUP_ID;
		persistOSState();
	}

	function handleMachineGroupChange(value: string) {
		machineGroupId = value;
		if (!dateRange) return;
		persistFilters(dateRange, value);
		void loadDashboard();
	}

	function handleDateRangeChange(value: DateRange) {
		dateRange = value;
		persistFilters(value, machineGroupId);
		void loadDashboard();
	}

	function openMachine(id: number) {
		window.location.hash = `#/PMS/Dashboard/${id}`;
	}

	function exportCsv() {
		if (!dashboard) return;
		const header = ['Machine', 'Breakdowns', 'Jobs Completed', 'OEE', 'Weight'];
		const lines = [
			header.join(','),
			...dashboard.machines.map((machine) =>
				[
					machine.name,
					machine.breakdowns,
					machine.jobsCompleted,
					machine.oee === 'No Data' ? 'No Data' : `${machine.oee}%`,
					`${machine.production} ${machine.uom}`
				].join(',')
			)
		];
		const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
		const url = URL.createObjectURL(blob);
		const anchor = document.createElement('a');
		anchor.href = url;
		anchor.download = 'Dashboard.csv';
		anchor.click();
		URL.revokeObjectURL(url);
	}

	onMount(() => {
		const controller = new AbortController();
		if (initial.didInitializeRange && dateRange) {
			persistFilters(dateRange, machineGroupId);
		}
		void (async () => {
			try {
				[groupOptions, shifts] = await Promise.all([
					listMachineGroupOptions(controller.signal),
					listShifts(controller.signal)
				]);
				mastersReady = true;
				await loadDashboard(controller.signal);
			} catch (error) {
				if (isAbortError(error)) return;
				errorMessage = formatErrorMessage(error);
				mastersReady = true;
				loading = false;
			}
		})();
		return () => controller.abort();
	});
</script>

<div class="flex h-full min-h-0 flex-col overflow-hidden">
	<div class="@container border-b border-border p-4">
		<div class="flex flex-col gap-3 @4xl:flex-row @4xl:items-end @4xl:gap-4">
			<!-- <h1 class="min-w-0 text-2xl font-semibold">Dashboard</h1> -->
			<div
				class="flex min-w-0 flex-col gap-2 @4xl:ml-auto @4xl:w-auto @4xl:shrink-0 sm:flex-row sm:items-end"
			>
				<RangeFilters
					machineGroupItems={groupOptions}
					{machineGroupId}
					bind:dateRange
					{shifts}
					disabled={!mastersReady || loading}
					onMachineGroupChange={handleMachineGroupChange}
					onDateRangeChange={handleDateRangeChange}
				/>
				<Button
					variant="primary"
					size="md"
					label="Export"
					icon={FileDown}
					iconPosition="right"
					onclick={exportCsv}
					disabled={!dashboard || loading}
					class="shrink-0"
				/>
			</div>
		</div>
	</div>

	{#if errorMessage}
		<div class="flex h-full min-h-0 flex-col overflow-hidden p-4">
			<Alert variant="error" title="Could not load dashboard" description={errorMessage} />
		</div>
	{/if}

	{#if loading || !dashboard}
		<div class="space-y-4 p-4" aria-busy="true" role="status">
			<span class="sr-only">Loading dashboard</span>
			<Skeleton class="h-28 w-full" />
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
				{#each [0, 1, 2, 3] as index (index)}
					<Skeleton class="h-48 w-full" />
				{/each}
			</div>
		</div>
	{:else}
		<div class={kpiCardStripClass(4, 'rounded-none border-x-0 border-t-0')}>
			<KpiCard
				label="Total weight"
				value={dashboard.totalWeight.value}
				trend={dashboard.totalWeight.trend}
				icon={Scale}
				index={0}
				columns={4}
			/>
			<KpiCard
				label="Breakdowns"
				value={dashboard.breakdowns.value}
				trend={dashboard.breakdowns.trend}
				icon={LayoutList}
				index={1}
				columns={4}
			/>
			<KpiCard
				label="OEE"
				value={dashboard.oee.value}
				trend={dashboard.oee.trend}
				icon={ChartLine}
				index={2}
				columns={4}
			/>
			<KpiCard
				label="Jobs completed"
				value={dashboard.jobsCompleted.value}
				trend={dashboard.jobsCompleted.trend}
				icon={ClipboardCheck}
				index={3}
				columns={4}
			/>
		</div>

		<div class="flex flex-col gap-4 p-4">
			<div class="flex flex-wrap items-center justify-between gap-3">
				<Tabs
					items={viewTabs}
					bind:value={viewMode}
					variant="underline"
					mobileSelect={false}
					ariaLabel="Machine view"
					class="min-w-0"
				/>
				<div class="flex items-center">
					<DropdownMenu
						triggerLabel={sortLabel}
						showChevron={true}
						selectedValue={sortBy}
						align="end"
						groups={[
							[
								{
									label: 'Weight',
									value: 'weight',
									selected: sortBy === 'weight',
									onclick: () => (sortBy = 'weight')
								},
								{
									label: 'OEE',
									value: 'oee',
									selected: sortBy === 'oee',
									onclick: () => (sortBy = 'oee')
								},
								{
									label: 'Jobs',
									value: 'jobs',
									selected: sortBy === 'jobs',
									onclick: () => (sortBy = 'jobs')
								},
								{
									label: 'Breakdowns',
									value: 'breakdowns',
									selected: sortBy === 'breakdowns',
									onclick: () => (sortBy = 'breakdowns')
								},
								{
									label: 'Name',
									value: 'name',
									selected: sortBy === 'name',
									onclick: () => (sortBy = 'name')
								}
							]
						]}
						triggerClass="h-10 px-3 text-sm text-foreground"
					/>
					<DropdownMenu
						triggerLabel="Filter"
						triggerIcon={Filter}
						showChevron={false}
						align="end"
						groups={[
							[
								{
									label: 'All statuses',
									value: 'all',
									selected: statusFilter === 'all',
									onclick: () => (statusFilter = 'all')
								},
								{
									label: 'Online',
									value: 'online',
									selected: statusFilter === 'online',
									onclick: () => (statusFilter = 'online')
								},
								{
									label: 'Error',
									value: 'error',
									selected: statusFilter === 'error',
									onclick: () => (statusFilter = 'error')
								},
								{
									label: 'Loading',
									value: 'loading',
									selected: statusFilter === 'loading',
									onclick: () => (statusFilter = 'loading')
								},
								{
									label: 'Offline',
									value: 'offline',
									selected: statusFilter === 'offline',
									onclick: () => (statusFilter = 'offline')
								}
							]
						]}
						triggerClass="h-10 gap-2 bg-foreground px-4 text-sm font-bold text-white hover:bg-foreground/90"
					/>
				</div>
			</div>

			{#if sortedMachines.length === 0}
				<EmptyState
					title="No machines in this group"
					description="Machines for the selected group and date range will appear here"
					icon={Factory}
				/>
			{:else if viewMode === 'grid'}
				<div
					class="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
				>
					{#each sortedMachines as machine (machine.id)}
						<a href="#/PMS/Dashboard/{machine.id}" class="block h-full min-w-0">
							<MachineCard
								class="h-full"
								id={machine.name}
								status={machine.cardStatus}
								badge={{ label: machine.status, variant: machine.cardStatus }}
								gridMetrics={[
									{
										label: 'OEE',
										value: machine.oee === 'No Data' ? 'No Data' : `${machine.oee}%`
									},
									{
										label: 'Jobs',
										value: String(machine.jobsCompleted),
										suffix: 'completed'
									}
								]}
								rowMetric={{
									label: 'Weight',
									value: `${machine.production} ${machine.uom}`
								}}
								showFooter={true}
								footer={{ segments: machine.statusBar }}
							/>
						</a>
					{/each}
				</div>
			{:else}
				<DataTable
					columns={productionColumns}
					rows={productionRows}
					rowKey={(row) => String(row.id)}
					onRowClick={(row) => openMachine(row.id)}
					search={{ enabled: true, placeholder: 'Search machines' }}
					emptyState={{
						icon: Factory,
						title: 'No production data',
						description: 'Machine production for the selected range will appear here'
					}}
					pagination={{ enabled: productionRows.length > 0 }}
					rowClass="cursor-pointer"
				/>
			{/if}

			<div class="flex flex-col gap-6 xl:flex-row xl:items-stretch">
				<div class="flex min-w-0 flex-1 flex-col gap-4">
					<div class="flex items-center justify-between gap-3">
						<h2 class="text-base font-semibold">Production across machines</h2>
						<Tabs
							items={chartTabs}
							bind:value={chartMode}
							variant="segmented"
							size="sm"
							mobileSelect={false}
							ariaLabel="Chart type"
						/>
					</div>
					{#if dashboard.productionChart.labels.length > 0}
						{#if chartMode === 'bar'}
							<BarChart
								labels={dashboard.productionChart.labels}
								series={[{ label: 'Weight (MT)', data: dashboard.productionChart.values }]}
								showLegend={false}
								// barThickness={16}
								class="h-80"
							/>
						{:else if lineConfig}
							<Chart config={lineConfig} class="h-80" />
						{/if}
					{:else}
						<EmptyState
							title="No production chart data"
							description="Weight across machines will appear when production is recorded"
							icon={Factory}
						/>
					{/if}
				</div>

				<section
					class="flex w-full shrink-0 flex-col overflow-hidden border border-border bg-white xl:w-80"
				>
					<header class="border-b border-border px-4 py-4">
						<h2 class="text-base font-semibold">Production by machines</h2>
					</header>
					<div class="flex max-h-80 flex-col overflow-auto">
						{#if sortedMachines.length === 0}
							<div class="flex h-full min-h-0 flex-col overflow-hidden p-4">
								<p class="text-sm text-muted-foreground">No machines to list</p>
							</div>
						{:else}
							{#each sortedMachines as machine, index (machine.id)}
								<a
									href="#/PMS/Dashboard/{machine.id}"
									class={[
										'block space-y-3 p-4 hover:bg-foreground/5',
										index > 0 && 'border-t border-border'
									]}
								>
									<div class="flex items-start justify-between gap-3">
										<p class="text-sm font-medium">{machine.name}</p>
										<Badge variant="secondary" label={`${machine.production} ${machine.uom}`} />
									</div>
									<div class="flex items-center gap-4">
										<div class="min-w-0 flex-1">
											<p class="text-xs font-medium tracking-tight">
												{machine.jobsCompleted}, OEE:
												{machine.oee === 'No Data' ? ' No Data' : ` ${machine.oee}%`}
											</p>
											<p class="text-xs text-muted-foreground">Completed</p>
										</div>
										<div class="h-9 w-px shrink-0 bg-border" aria-hidden="true"></div>
										<div class="min-w-0 flex-1">
											<p class="text-xs font-medium tracking-tight">
												{machine.breakdowns}, Jobs
											</p>
											<p class="text-xs text-muted-foreground">Breakdowns</p>
										</div>
									</div>
								</a>
							{/each}
						{/if}
					</div>
				</section>
			</div>
		</div>
	{/if}
</div>
