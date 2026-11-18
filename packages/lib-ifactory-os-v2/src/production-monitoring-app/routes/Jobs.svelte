<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import { Briefcase, CircleCheck, CircleDashed, ListTodo } from '@lucide/svelte';
	import {
		Alert,
		DataTable,
		FilterCardStrip,
		Skeleton,
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
	import { listJobsTable, listMachineGroupOptions, listShifts } from '../lib/machines.api.js';
	import type {
		AssignedJobRow,
		JobsListPayload,
		JobsListRow,
		JobsTab,
		MachineGroupOption,
		Shift
	} from '../lib/types.js';

	const ALL_MACHINES = 'all';
	const sharedDateFilter = getContext<AppDateFilter>(APP_DATE_FILTER_CONTEXT);
	const initial = resolveInitialFilters(sharedDateFilter);

	let dateRange = $state<DateRange | null>(initial.dateRange);
	let machineGroupId = $state(initial.machineGroupId);
	let currentTab = $state<JobsTab>('completed');
	let groupOptions = $state.raw<MachineGroupOption[]>([]);
	let shifts = $state.raw<Shift[]>([]);
	let payload = $state.raw<JobsListPayload | null>(null);
	let mastersReady = $state(false);
	let loading = $state(true);
	let errorMessage = $state<string | null>(null);

	type AssignedRow = AssignedJobRow & Record<string, unknown>;
	type JobRow = JobsListRow & Record<string, unknown>;

	const filterItems = $derived.by<FilterCardItem[]>(() => [
		{ id: 'total', label: 'Total', count: payload?.total ?? 0, icon: Briefcase, clickable: false },
		{ id: 'completed', label: 'Completed', count: payload?.completed ?? 0, icon: CircleCheck },
		{ id: 'inProgress', label: 'In Progress', count: payload?.inProgress ?? 0, icon: CircleDashed },
		{ id: 'assigned', label: 'Assigned', count: payload?.assigned ?? 0, icon: ListTodo }
	]);

	const exportFileName = $derived(
		currentTab === 'assigned'
			? 'Assigned_Jobs'
			: currentTab === 'inProgress'
				? 'In_Progress_Jobs'
				: 'Completed_Jobs'
	);

	const assignedRows = $derived((payload?.assignedRows ?? []) as AssignedRow[]);
	const inProgressRows = $derived((payload?.inProgressRows ?? []) as JobRow[]);
	const completedRows = $derived((payload?.completedRows ?? []) as JobRow[]);

	const assignedColumns: DataTableColumn<AssignedRow>[] = [
		{
			type: 'serial',
			key: 'sNo',
			header: 'S.No',
			sortable: true,
			filterable: true,
			dataType: 'number',
			value: (row) => {
				const index = assignedRows.indexOf(row);
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
			key: 'plannedStartDate',
			header: 'Planned Start Date',
			sortable: true,
			dataType: 'date',
			value: (row) => row.plannedStartDate
		}
	];

	const inProgressColumns: DataTableColumn<JobRow>[] = [
		{
			type: 'serial',
			key: 'sNo',
			header: 'S.No',
			sortable: true,
			filterable: true,
			dataType: 'number',
			value: (row) => {
				const index = inProgressRows.indexOf(row);
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
		}
	];

	const completedColumns: DataTableColumn<JobRow>[] = [
		{
			type: 'serial',
			key: 'sNo',
			header: 'S.No',
			sortable: true,
			filterable: true,
			dataType: 'number',
			value: (row) => {
				const index = completedRows.indexOf(row);
				return String(index >= 0 ? index + 1 : '');
			}
		},
		...inProgressColumns.slice(1),
		{
			key: 'jobEndDate',
			header: 'Job End Date',
			sortable: true,
			dataType: 'date',
			value: (row) => row.jobEndDate
		}
	];

	async function loadJobs(signal?: AbortSignal) {
		if (!dateRange) return;
		loading = true;
		errorMessage = null;
		try {
			payload = await listJobsTable(
				{
					from: dateRange.from,
					to: dateRange.to,
					machineGroupId: Number(machineGroupId) || CNC_GROUP_ID,
					machineId: ALL_MACHINES
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
		void loadJobs();
	}

	function handleDateRangeChange(value: DateRange) {
		dateRange = value;
		persistFilters(value, machineGroupId);
		void loadJobs();
	}

	function handleTabChange(id: string) {
		if (id === 'completed' || id === 'inProgress' || id === 'assigned') {
			currentTab = id;
		}
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
				await loadJobs(controller.signal);
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
			<!-- <h1 class="min-w-0 text-2xl font-semibold">Jobs</h1> -->
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
		<Alert variant="error" title="Could not load jobs" description={errorMessage} />
	{/if}

	{#if loading}
		<div class="grid grid-cols-1 gap-0 border border-border bg-white sm:grid-cols-4 lg:grid-cols-4">
			{#each [0, 1, 2, 3] as index (index)}
				<div class="space-y-3 border-border p-4 sm:not-last:border-r">
					<Skeleton class="h-4 w-24" />
					<Skeleton class="h-8 w-16" />
				</div>
			{/each}
		</div>
	{:else if payload}
		<FilterCardStrip
			class="lg:grid-cols-4"
			items={filterItems}
			value={currentTab}
			onValueChange={handleTabChange}
		/>
	{/if}

	{#if currentTab === 'assigned'}
		<DataTable
			columns={assignedColumns}
			rows={assignedRows}
			{loading}
			rowKey={(row) => row.id}
			search={{ enabled: true, placeholder: 'Search jobs' }}
			export={{ enabled: true, fileName: exportFileName }}
			emptyState={{
				icon: ListTodo,
				title: 'No assigned jobs',
				description: 'Planned jobs for the selected filters will appear here'
			}}
			pagination={{ enabled: assignedRows.length > 0 }}
		/>
	{:else if currentTab === 'inProgress'}
		<DataTable
			columns={inProgressColumns}
			rows={inProgressRows}
			{loading}
			rowKey={(row) => row.id}
			search={{ enabled: true, placeholder: 'Search jobs' }}
			export={{ enabled: true, fileName: exportFileName }}
			emptyState={{
				icon: CircleDashed,
				title: 'No in-progress jobs',
				description: 'Jobs currently running in this range will appear here'
			}}
			pagination={{ enabled: inProgressRows.length > 0 }}
		/>
	{:else}
		<DataTable
			columns={completedColumns}
			rows={completedRows}
			{loading}
			rowKey={(row) => row.id}
			search={{ enabled: true, placeholder: 'Search jobs' }}
			export={{ enabled: true, fileName: exportFileName }}
			emptyState={{
				icon: CircleCheck,
				title: 'No completed jobs',
				description: 'Completed jobs for the selected filters will appear here'
			}}
			pagination={{ enabled: completedRows.length > 0 }}
		/>
	{/if}
</div>
