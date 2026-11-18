<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import { Search } from '@lucide/svelte';
	import { Alert, DataTable, type BadgeCell, type DataTableColumn } from '@ifactory/ui-v2';
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
	import { listMachineGroupOptions, listSearchByMir, listShifts } from '../lib/machines.api.js';
	import { toJobOrTicketBadgeVariant } from '../lib/resources.js';
	import type { MachineGroupOption, SearchByMirRow, Shift } from '../lib/types.js';

	const sharedDateFilter = getContext<AppDateFilter>(APP_DATE_FILTER_CONTEXT);
	const initial = resolveInitialFilters(sharedDateFilter);

	let dateRange = $state<DateRange | null>(initial.dateRange);
	let machineGroupId = $state(initial.machineGroupId);
	let groupOptions = $state.raw<MachineGroupOption[]>([]);
	let shifts = $state.raw<Shift[]>([]);
	let rows = $state.raw<SearchByMirRow[]>([]);
	let mastersReady = $state(false);
	let loading = $state(true);
	let errorMessage = $state<string | null>(null);

	type MirRow = SearchByMirRow & Record<string, unknown>;

	const tableRows = $derived(rows as MirRow[]);

	const columns: DataTableColumn<MirRow>[] = [
		{
			type: 'serial',
			key: 'sNo',
			header: 'S.No',
			sortable: true,
			filterable: true,
			dataType: 'number',
			value: (row) => {
				const index = tableRows.indexOf(row);
				return String(index >= 0 ? index + 1 : '');
			}
		},
		{
			key: 'machine_name',
			header: 'Machine Name',
			sortable: true,
			value: (row) => row.machine_name
		},
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
			sortable: true,
			dataType: 'date',
			value: (row) => row.jobStartDate
		},
		{
			key: 'jobEndDate',
			header: 'Job End Date',
			dataType: 'date',
			value: (row) => row.jobEndDate
		},
		{
			key: 'jobStatus',
			header: 'Status',
			type: 'badge',
			sortable: true,
			badge: (row): BadgeCell => ({
				variant: toJobOrTicketBadgeVariant(row.jobStatus),
				label: row.jobStatus
			})
		}
	];

	async function loadRows(signal?: AbortSignal) {
		if (!dateRange) return;
		loading = true;
		errorMessage = null;
		try {
			rows = await listSearchByMir(
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
			rows = [];
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
		void loadRows();
	}

	function handleDateRangeChange(value: DateRange) {
		dateRange = value;
		persistFilters(value, machineGroupId);
		void loadRows();
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
				await loadRows(controller.signal);
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
			<div
				class="flex min-w-0 flex-col gap-2 @4xl:ml-auto @4xl:w-auto @4xl:shrink-0 sm:flex-row sm:flex-wrap sm:items-end sm:justify-end"
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
			</div>
		</div>
	</div>

	{#if errorMessage}
		<Alert variant="error" title="Could not load MIR jobs" description={errorMessage} />
	{/if}

	<DataTable
		{columns}
		rows={tableRows}
		{loading}
		rowKey={(row) => row.id}
		search={{ enabled: true, placeholder: 'Search by MIR' }}
		export={{ enabled: true, fileName: 'Search_By_MIR' }}
		emptyState={{
			icon: Search,
			title: 'No MIR jobs found',
			description: 'In-progress and completed jobs for the selected filters will appear here'
		}}
		pagination={{ enabled: tableRows.length > 0 }}
	/>
</div>
