<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import { Cog, Factory, Wifi, WifiOff } from '@lucide/svelte';
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
	import { listMachineGroupOptions, listMachinesTable, listShifts } from '../lib/machines.api.js';
	import { toBadgeVariant } from '../lib/resources.js';
	import type {
		MachineGroupOption,
		MachineListRow,
		MachinesListPayload,
		Shift
	} from '../lib/types.js';

	const sharedDateFilter = getContext<AppDateFilter>(APP_DATE_FILTER_CONTEXT);
	const initial = resolveInitialFilters(sharedDateFilter);

	let dateRange = $state<DateRange | null>(initial.dateRange);
	let machineGroupId = $state(initial.machineGroupId);
	let selectedFilter = $state('all');
	let groupOptions = $state.raw<MachineGroupOption[]>([]);
	let shifts = $state.raw<Shift[]>([]);
	let payload = $state.raw<MachinesListPayload | null>(null);
	let mastersReady = $state(false);
	let loading = $state(true);
	let errorMessage = $state<string | null>(null);

	type MachineRow = MachineListRow & Record<string, unknown>;

	const filterItems = $derived.by<FilterCardItem[]>(() => [
		{ id: 'all', label: 'Total Machines', count: payload?.total ?? 0, icon: Factory },
		{ id: 'active', label: 'Active Machines', count: payload?.active ?? 0, icon: Wifi },
		{ id: 'inactive', label: 'Inactive Machines', count: payload?.inactive ?? 0, icon: WifiOff }
	]);

	const rows = $derived.by<MachineRow[]>(() => {
		const all = (payload?.rows ?? []) as MachineRow[];
		if (selectedFilter === 'active') return all.filter((row) => row.isActive);
		if (selectedFilter === 'inactive') return all.filter((row) => !row.isActive);
		return all;
	});

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
			key: 'machine_name',
			header: 'Machine Name',
			sortable: true,
			value: (row) => row.machine_name
		},
		{
			key: 'machine_status',
			header: 'Status',
			type: 'badge',
			sortable: true,
			badge: (row): BadgeCell => ({
				variant: toBadgeVariant(row.machine_status),
				label: row.machine_status
			})
		},
		{
			key: 'operator_name',
			header: 'Operator',
			sortable: true,
			value: (row) => row.operator_name
		},
		{
			key: 'interlockState',
			header: 'Interlock Status',
			sortable: true,
			value: (row) => row.interlockState
		},
		{
			key: 'last_sync',
			header: 'Last Sync',
			sortable: true,
			dataType: 'date',
			value: (row) => row.last_sync
		},
		{
			key: 'macId',
			header: 'MAC Address',
			sortable: true,
			value: (row) => row.macId
		}
	];

	async function loadMachines(signal?: AbortSignal) {
		if (!dateRange) return;
		loading = true;
		errorMessage = null;
		selectedFilter = 'all';
		try {
			payload = await listMachinesTable(
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
		void loadMachines();
	}

	function handleDateRangeChange(value: DateRange) {
		dateRange = value;
		persistFilters(value, machineGroupId);
		void loadMachines();
	}

	function openMachine(row: MachineRow) {
		window.location.hash = `#/PMS/Machines/${row.id}`;
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
				await loadMachines(controller.signal);
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
		<Alert variant="error" title="Could not load machines" description={errorMessage} />
	{/if}

	{#if loading}
		<div class="grid grid-cols-1 gap-0 border border-border bg-white sm:grid-cols-3 lg:grid-cols-3">
			{#each [0, 1, 2] as index (index)}
				<div class="space-y-3 border-border p-4 sm:not-last:border-r">
					<Skeleton class="h-4 w-24" />
					<Skeleton class="h-8 w-16" />
				</div>
			{/each}
		</div>
	{:else if payload}
		<FilterCardStrip items={filterItems} bind:value={selectedFilter} />
	{/if}

	<DataTable
		{columns}
		{rows}
		{loading}
		rowKey={(row) => String(row.id)}
		onRowClick={openMachine}
		search={{ enabled: true, placeholder: 'Search machines' }}
		export={{ enabled: true, fileName: 'Machines' }}
		emptyState={{
			icon: Cog,
			title: 'No machines found',
			description: 'Machines matching the current filters will appear here'
		}}
		pagination={{ enabled: rows.length > 0 }}
		rowClass="cursor-pointer"
	/>
</div>
