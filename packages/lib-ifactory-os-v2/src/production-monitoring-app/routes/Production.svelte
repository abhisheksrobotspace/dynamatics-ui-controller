<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import { ChartColumn, Factory, Wifi, WifiOff, Zap } from '@lucide/svelte';
	import {
		Alert,
		DataTable,
		FilterCardStrip,
		Skeleton,
		type BadgeCell,
		type DataTableColumn,
		type FilterCardItem
	} from '@ifactory/ui-v2';
	import { APP_DATE_FILTER_CONTEXT, type AppDateFilter } from '$lib/appShell/appSharedState.js';
	import { persistOSState } from '$lib/os/index.svelte.js';
	import RangeFilters from '../components/RangeFilters.svelte';
	import { CNC_GROUP_ID } from '../lib/constants.js';
	import {
		type DateRange,
		resolveInitialFilters,
		writeSharedDateRange
	} from '../lib/date-range.js';
	import { formatErrorMessage, isAbortError } from '../lib/errors.js';
	import { listMachineGroupOptions, listProductionTable, listShifts } from '../lib/machines.api.js';
	import { toBadgeVariant } from '../lib/resources.js';
	import type {
		MachineGroupOption,
		ProductionListPayload,
		ProductionListRow,
		Shift
	} from '../lib/types.js';

	const sharedDateFilter = getContext<AppDateFilter>(APP_DATE_FILTER_CONTEXT);
	const initial = resolveInitialFilters(sharedDateFilter);

	let dateRange = $state<DateRange | null>(initial.dateRange);
	let machineGroupId = $state(initial.machineGroupId);
	let selectedFilter = $state('all');
	let groupOptions = $state.raw<MachineGroupOption[]>([]);
	let shifts = $state.raw<Shift[]>([]);
	let payload = $state.raw<ProductionListPayload | null>(null);
	let mastersReady = $state(false);
	let loading = $state(true);
	let errorMessage = $state<string | null>(null);

	type ProductionRow = ProductionListRow & Record<string, unknown>;

	const filterItems = $derived.by<FilterCardItem[]>(() => [
		{ id: 'all', label: 'Total Machines', count: payload?.total ?? 0, icon: Factory },
		{ id: 'active', label: 'Active Machines', count: payload?.active ?? 0, icon: Wifi },
		{ id: 'inactive', label: 'Inactive Machines', count: payload?.inactive ?? 0, icon: WifiOff },
		{
			id: 'production',
			label: 'Total Production',
			count: `${payload?.totalProduction ?? 0} MT`,
			icon: ChartColumn,
			clickable: false
		},
		{
			id: 'energy',
			label: 'Total Energy Consumed',
			count: `${payload?.totalEnergy ?? 0} kWh`,
			icon: Zap,
			clickable: false
		}
	]);

	const rows = $derived.by<ProductionRow[]>(() => {
		const all = (payload?.rows ?? []) as ProductionRow[];
		if (selectedFilter === 'active') return all.filter((row) => row.isActive);
		if (selectedFilter === 'inactive') return all.filter((row) => !row.isActive);
		return all;
	});

	const columns: DataTableColumn<ProductionRow>[] = [
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
			key: 'machine_name',
			header: 'Machine Name',
			sortable: true,
			value: (row) => row.machine_name
		},
		{
			key: 'status',
			header: 'Status',
			type: 'badge',
			sortable: true,
			badge: (row): BadgeCell => ({
				variant: toBadgeVariant(row.status),
				label: row.status
			})
		},
		{
			key: 'oee',
			header: 'OEE (%)',
			sortable: true,
			value: (row) => row.oee
		},
		{
			key: 'uptime',
			header: 'Uptime (mins)',
			sortable: true,
			dataType: 'number',
			value: (row) => String(row.uptime)
		},
		{
			key: 'downtime',
			header: 'Downtime (mins)',
			sortable: true,
			dataType: 'number',
			value: (row) => String(row.downtime)
		},
		{
			key: 'totalProduction',
			header: 'Total Weight (MT)',
			sortable: true,
			dataType: 'number',
			value: (row) => row.totalProduction
		},
		{
			key: 'energyConsumed',
			header: 'Energy Consumed (kWh)',
			sortable: true,
			value: (row) => row.energyConsumed
		}
	];

	async function loadProduction(signal?: AbortSignal) {
		if (!dateRange) return;
		loading = true;
		errorMessage = null;
		selectedFilter = 'all';
		try {
			payload = await listProductionTable(
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
			payload = null;
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
		void loadProduction();
	}

	function handleDateRangeChange(value: DateRange) {
		dateRange = value;
		persistFilters(value, machineGroupId);
		void loadProduction();
	}

	function openMachine(row: ProductionRow) {
		window.location.hash = `#/PMS/Production/${row.id}`;
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
				await loadProduction(controller.signal);
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

<div class="flex h-full min-h-0 flex-col gap-4 overflow-hidden p-4">
	<div class="@container">
		<div class="flex flex-col gap-3 @4xl:flex-row @4xl:items-end @4xl:gap-4">
			<div class="@4xl:ml-auto @4xl:w-auto @4xl:shrink-0">
				<RangeFilters
					machineGroupItems={groupOptions}
					{machineGroupId}
					bind:dateRange
					{shifts}
					disabled={!mastersReady || loading}
					onMachineGroupChange={handleMachineGroupChange}
					onDateRangeChange={handleDateRangeChange}
				/>
			</div>
		</div>
	</div>

	{#if errorMessage}
		<Alert variant="error" title="Could not load production" description={errorMessage} />
	{/if}

	{#if loading}
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
			{#each [0, 1, 2, 3, 4] as index (index)}
				<div class="space-y-3 rounded-md border border-border bg-surface p-4">
					<Skeleton class={index >= 3 ? 'h-4 w-36' : 'h-4 w-32'} />
					<Skeleton class={index >= 3 ? 'h-8 w-28' : 'h-8 w-24'} />
				</div>
			{/each}
		</div>
	{:else if payload}
		<FilterCardStrip
			class="min-w-0 lg:grid-cols-5"
			items={filterItems}
			bind:value={selectedFilter}
		/>
	{/if}

	<DataTable
		{columns}
		{rows}
		{loading}
		rowKey={(row) => String(row.id)}
		onRowClick={openMachine}
		search={{ enabled: true, placeholder: 'Search machines' }}
		export={{ enabled: true, fileName: 'Production' }}
		emptyState={{
			icon: ChartColumn,
			title: 'No production data',
			description: 'Machine production for the selected filters will appear here'
		}}
		pagination={{ enabled: rows.length > 0 }}
		rowClass="cursor-pointer"
	/>
</div>
