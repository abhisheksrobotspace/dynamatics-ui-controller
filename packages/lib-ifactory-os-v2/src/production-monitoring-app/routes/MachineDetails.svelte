<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import {
		Activity,
		ArrowDownWideNarrow,
		ArrowUpWideNarrow,
		Boxes,
		Clock,
		CircleGauge,
		Download,
		Factory,
		Section,
		User,
		Zap
	} from '@lucide/svelte';
	import {
		Alert,
		Button,
		Chart,
		DataTable,
		EmptyState,
		KpiCard,
		Skeleton,
		StackedBarChart,
		Tabs,
		type BadgeCell,
		type DataTableColumn,
		type TabItem
	} from '@ifactory/ui-v2';
	import { APP_DATE_FILTER_CONTEXT, type AppDateFilter } from '$lib/appShell/appSharedState.js';
	import { persistOSState } from '$lib/os/index.svelte.js';
	import RangeFilters from '../components/RangeFilters.svelte';
	import { doughnutChartConfig, lineChartConfig } from '../lib/charts.js';
	import {
		type DateRange,
		resolveInitialFilters,
		writeSharedDateRange
	} from '../lib/date-range.js';
	import { downloadCsv } from '../lib/export-csv.js';
	import { formatErrorMessage, isAbortError } from '../lib/errors.js';
	import { getMachineDetails, listShifts } from '../lib/machines.api.js';
	import { machineJobDetailsHash, resolveMachineJobSourceRoute } from '../lib/job-routes.js';
	import type { MachineDetailsPayload, MachineJobRow, Shift } from '../lib/types.js';

	let { params = {} }: { params?: Record<string, string> } = $props();

	const sharedDateFilter = getContext<AppDateFilter>(APP_DATE_FILTER_CONTEXT);
	const initial = resolveInitialFilters(sharedDateFilter);
	const machineId = $derived(params.machineId ?? '');

	let dateRange = $state<DateRange | null>(initial.dateRange);
	let shifts = $state.raw<Shift[]>([]);
	let details = $state.raw<MachineDetailsPayload | null>(null);
	let mastersReady = $state(false);
	let loading = $state(true);
	let errorMessage = $state<string | null>(null);
	let currentTab = $state('overview');

	type JobRow = MachineJobRow & Record<string, unknown>;

	const tabItems: TabItem[] = [
		{ label: 'Overview Report', value: 'overview' },
		{ label: 'Performance Report', value: 'performance' },
		{ label: 'Production Report', value: 'production' },
		{ label: 'Downtime Report', value: 'downtime' }
	];

	const jobRows = $derived((details?.jobs ?? []) as JobRow[]);

	const jobColumns: DataTableColumn<JobRow>[] = [
		{
			type: 'serial',
			key: 'sNo',
			header: 'S.No',
			sortable: true,
			filterable: true,
			dataType: 'number',
			value: (row) => {
				const index = jobRows.indexOf(row);
				return String(index >= 0 ? index + 1 : '');
			}
		},
		{ key: 'machine_name', header: 'Machine Name', value: (row) => row.machine_name },
		{ key: 'mir', header: 'MIR', sortable: true, value: (row) => row.mir },
		{ key: 'sectionDM', header: 'Section Dimension', value: (row) => row.sectionDM },
		{
			key: 'allocationGroupNo',
			header: 'Allocation Group No.',
			value: (row) => row.allocationGroupNo
		},
		{ key: 'rmLength', header: 'RM Length', value: (row) => row.rmLength },
		{
			key: 'totalWeight',
			header: 'Production Qty (MT)',
			sortable: true,
			value: (row) => row.totalWeight
		},
		{ key: 'totalParts', header: 'Parts Produced', sortable: true, value: (row) => row.totalParts },
		{
			key: 'totalOperations',
			header: 'Operations Count',
			sortable: true,
			value: (row) => row.totalOperations
		},
		{
			key: 'jobStartDate',
			header: 'Job Start Date',
			dataType: 'date',
			value: (row) => row.jobStartDate
		},
		{ key: 'jobEndDate', header: 'Job End Date', dataType: 'date', value: (row) => row.jobEndDate },
		{
			key: 'jobStatus',
			header: 'Status',
			type: 'badge',
			sortable: true,
			badge: (row): BadgeCell => ({
				variant: row.jobStatus === 'Completed' ? 'online' : 'loading',
				label: row.jobStatus
			})
		}
	];

	const performanceConfig = $derived(
		lineChartConfig(
			details?.performance.labels ?? [],
			details?.performance.values ?? [],
			`Weight (${details?.performance.uom ?? 'MT'})`
		)
	);

	const downtimeConfig = $derived(
		doughnutChartConfig(details?.downtime.labels ?? [], details?.downtime.values ?? [])
	);

	const statusValueClass = $derived(
		details?.cardStatus === 'online'
			? 'text-status-online'
			: details?.cardStatus === 'offline'
				? 'text-muted-foreground'
				: details?.cardStatus === 'loading'
					? 'text-status-loading'
					: 'text-status-error'
	);

	const chartExportEnabled = $derived.by(() => {
		if (!details) return false;
		if (currentTab === 'performance') return details.performance.labels.length > 0;
		if (currentTab === 'production') return details.productionReport.labels.length > 0;
		if (currentTab === 'downtime') return details.downtime.labels.length > 0;
		return false;
	});

	function exportChartReport() {
		if (!details || !chartExportEnabled) return;

		const machineName = details.name;

		if (currentTab === 'performance') {
			const { labels, values, uom } = details.performance;
			downloadCsv(
				['Date', `Weight (${uom})`],
				labels.map((label, index) => [label, `${values[index]} ${uom}`]),
				`${machineName} - Performance Report`
			);
			return;
		}

		if (currentTab === 'production') {
			const { labels, uptime, downtime } = details.productionReport;
			downloadCsv(
				['Date', 'Uptime (mins)', 'Downtime (mins)'],
				labels.map((label, index) => [label, String(uptime[index]), String(downtime[index])]),
				`${machineName} - Production Report`
			);
			return;
		}

		if (currentTab === 'downtime') {
			const { labels, values } = details.downtime;
			downloadCsv(
				['Alert Name', 'Downtime (mins)'],
				labels.map((label, index) => [label, String(values[index])]),
				`${machineName} - Downtime Report`
			);
		}
	}

	async function loadDetails(id: string, range: DateRange, signal?: AbortSignal) {
		loading = true;
		errorMessage = null;
		try {
			details = await getMachineDetails(id, range.from, range.to, signal);
			if (!details && !signal?.aborted) {
				errorMessage = 'Machine not found.';
			}
		} catch (error) {
			if (isAbortError(error)) return;
			errorMessage = formatErrorMessage(error);
			details = null;
		} finally {
			if (!signal?.aborted) loading = false;
		}
	}

	function persistRange(range: DateRange) {
		writeSharedDateRange(sharedDateFilter, range);
		persistOSState();
	}

	function handleDateRangeChange(value: DateRange) {
		dateRange = value;
		persistRange(value);
	}

	function openJobDetails(row: JobRow) {
		const sourceRoute = resolveMachineJobSourceRoute(window.location.hash);
		window.location.hash = machineJobDetailsHash(sourceRoute, machineId, row.jid);
	}

	onMount(() => {
		const controller = new AbortController();
		if (initial.didInitializeRange && dateRange) persistRange(dateRange);
		void (async () => {
			try {
				shifts = await listShifts(controller.signal);
				mastersReady = true;
			} catch (error) {
				if (isAbortError(error)) return;
				errorMessage = formatErrorMessage(error);
				mastersReady = true;
			}
		})();
		return () => controller.abort();
	});

	$effect(() => {
		const id = machineId;
		const range = dateRange;
		if (!id || !range) return;
		const controller = new AbortController();
		void loadDetails(id, range, controller.signal);
		return () => controller.abort();
	});
</script>

<div class="flex h-full min-h-0 flex-col gap-4 overflow-hidden p-4">
	<div class="@container">
		<div class="flex flex-col gap-3 @4xl:flex-row @4xl:items-end @4xl:justify-between @4xl:gap-4">
			<Tabs items={tabItems} bind:value={currentTab} />
			<div class="@4xl:w-auto @4xl:shrink-0">
				<RangeFilters
					bind:dateRange
					{shifts}
					showMachineGroup={false}
					disabled={!mastersReady || loading}
					onDateRangeChange={handleDateRangeChange}
				/>
			</div>
		</div>
	</div>

	{#if errorMessage}
		<Alert variant="error" title="Could not load machine" description={errorMessage} />
	{/if}

	{#if loading}
		<div class="space-y-4" aria-busy="true" role="status">
			<span class="sr-only">Loading machine details</span>
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
				{#each [0, 1, 2, 3, 4, 5, 6, 7, 8] as index (index)}
					<Skeleton class="h-24 w-full" />
				{/each}
			</div>
			<Skeleton class="h-96 w-full" />
		</div>
	{:else if details}
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
			<KpiCard label="Status" value={details.status} icon={Factory} valueClass={statusValueClass} />
			<KpiCard label="Total Weight" value={details.qty} icon={Boxes} />
			<KpiCard label="Parts Produced" value={String(details.partsProduced)} icon={CircleGauge} />
			<KpiCard label="Operator" value={details.operatorName} icon={User} />
			<KpiCard label="Uptime" value={details.upTime} icon={ArrowUpWideNarrow} />
			<KpiCard label="Downtime" value={details.downTime} icon={ArrowDownWideNarrow} />
			<KpiCard label="OEE" value={details.oee} icon={Section} />
			<KpiCard label="Energy Consumed" value={details.energyConsumed} icon={Zap} />
			<KpiCard label="Total Operations" value={String(details.totalOperations)} icon={Activity} />
			<KpiCard label="Last Sync" value={details.lastSync} icon={Clock} />
		</div>

		{#if currentTab === 'overview'}
			<DataTable
				columns={jobColumns}
				rows={jobRows}
				rowKey={(row) => row.jid}
				onRowClick={openJobDetails}
				search={{ enabled: true, placeholder: 'Search jobs' }}
				export={{ enabled: true, fileName: `${details.name} - Overview Report` }}
				emptyState={{
					icon: Factory,
					title: 'No jobs in this range',
					description: 'Completed and in-progress jobs will appear here'
				}}
				pagination={{ enabled: jobRows.length > 0 }}
			/>
		{:else}
			<section class="min-h-96 rounded-md border border-border bg-background p-4">
				<div class="mb-4 flex justify-end">
					<Button
						variant="outline"
						size="sm"
						label="Export"
						icon={Download}
						disabled={!chartExportEnabled}
						onclick={exportChartReport}
					/>
				</div>

				{#if currentTab === 'performance'}
					{#if details.performance.labels.length === 0}
						<div class="flex h-80 items-center justify-center">
							<EmptyState
								title="No performance data"
								description="Weight samples for this machine in the selected range will appear here"
								icon={Activity}
							/>
						</div>
					{:else}
						<div class="h-80">
							<Chart config={performanceConfig} class="h-full" />
						</div>
					{/if}
				{:else if currentTab === 'production'}
					{#if details.productionReport.labels.length === 0}
						<div class="flex h-80 items-center justify-center">
							<EmptyState
								title="No production report"
								description="Uptime and downtime buckets for this range will appear here"
								icon={ArrowUpWideNarrow}
							/>
						</div>
					{:else}
						<div class="h-80">
							<StackedBarChart
								labels={details.productionReport.labels}
								series={[
									{
										label: 'Uptime (mins)',
										data: details.productionReport.uptime,
										color: '#22c55e'
									},
									{
										label: 'Downtime (mins)',
										data: details.productionReport.downtime,
										color: '#ef4444'
									}
								]}
								class="h-full"
							/>
						</div>
					{/if}
				{:else if currentTab === 'downtime'}
					{#if details.downtime.labels.length === 0}
						<div class="flex h-80 items-center justify-center">
							<EmptyState
								title="No downtime recorded"
								description="Downtime reasons for this machine in the selected range will appear here"
								icon={ArrowDownWideNarrow}
							/>
						</div>
					{:else}
						<div class="h-80">
							<Chart config={downtimeConfig} class="h-full" />
						</div>
					{/if}
				{/if}
			</section>
		{/if}
	{/if}
</div>
