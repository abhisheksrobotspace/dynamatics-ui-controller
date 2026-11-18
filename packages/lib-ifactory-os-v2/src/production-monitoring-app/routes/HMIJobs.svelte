<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import { Briefcase } from '@lucide/svelte';
	import { Alert, Combobox, DataTable, type DataTableColumn } from '@ifactory/ui-v2';
	import { APP_DATE_FILTER_CONTEXT, type AppDateFilter } from '$lib/appShell/appSharedState.js';
	import { persistOSState } from '$lib/os/index.svelte.js';
	import { CNC_GROUP_ID } from '../lib/constants.js';
	import { formatErrorMessage, isAbortError } from '../lib/errors.js';
	import {
		listHmiJobs,
		listMachineGroupOptions,
		listMachineSelectOptions
	} from '../lib/machines.api.js';
	import type { HmiJobRow, MachineGroupOption } from '../lib/types.js';

	const ALL_MACHINES = 'all';
	const sharedDateFilter = getContext<AppDateFilter>(APP_DATE_FILTER_CONTEXT);

	let machineGroupId = $state(String(sharedDateFilter?.selectedMachineGroupId ?? CNC_GROUP_ID));
	let machineId = $state(ALL_MACHINES);
	let groupOptions = $state.raw<MachineGroupOption[]>([]);
	let machineOptions = $state.raw<MachineGroupOption[]>([]);
	let rows = $state.raw<HmiJobRow[]>([]);
	let loading = $state(true);
	let errorMessage = $state<string | null>(null);

	type LiveRow = HmiJobRow & Record<string, unknown>;

	const tableRows = $derived(rows as LiveRow[]);

	const columns: DataTableColumn<LiveRow>[] = [
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
		{ key: 'po', header: 'PO', sortable: true, value: (row) => row.po },
		{ key: 'mir', header: 'MIR', sortable: true, value: (row) => row.mir },
		{ key: 'marking', header: 'Marking', sortable: true, value: (row) => row.marking },
		{ key: 'sectionDM', header: 'Section Dimension', value: (row) => row.sectionDM },
		{ key: 'rmLength', header: 'RM Length', value: (row) => row.rmLength },
		{
			key: 'allocationGroupNo',
			header: 'Allocation Group No.',
			value: (row) => row.allocationGroupNo
		},
		{
			key: 'createdAt',
			header: 'Time Stamp',
			sortable: true,
			dataType: 'date',
			value: (row) => row.createdAt
		}
	];

	async function refreshMachineOptions(groupId: string, signal?: AbortSignal) {
		machineOptions = await listMachineSelectOptions(Number(groupId) || CNC_GROUP_ID, signal);
	}

	async function loadJobs(signal?: AbortSignal) {
		loading = true;
		errorMessage = null;
		try {
			rows = await listHmiJobs(Number(machineGroupId) || CNC_GROUP_ID, machineId, signal);
		} catch (error) {
			if (isAbortError(error)) return;
			errorMessage = formatErrorMessage(error);
			rows = [];
		} finally {
			if (!signal?.aborted) loading = false;
		}
	}

	function persistGroup(nextGroupId: string) {
		sharedDateFilter.selectedMachineGroupId = Number(nextGroupId) || CNC_GROUP_ID;
		persistOSState();
	}

	function handleMachineGroupChange(value: string | string[]) {
		const next = Array.isArray(value) ? (value[0] ?? String(CNC_GROUP_ID)) : value;
		machineGroupId = next;
		machineId = ALL_MACHINES;
		persistGroup(next);
		void (async () => {
			await refreshMachineOptions(next);
			await loadJobs();
		})();
	}

	function handleMachineChange(value: string | string[]) {
		machineId = Array.isArray(value) ? (value[0] ?? ALL_MACHINES) : value;
		void loadJobs();
	}

	onMount(() => {
		const controller = new AbortController();
		void (async () => {
			try {
				groupOptions = await listMachineGroupOptions(controller.signal);
				await refreshMachineOptions(machineGroupId, controller.signal);
				await loadJobs(controller.signal);
			} catch (error) {
				if (isAbortError(error)) return;
				errorMessage = formatErrorMessage(error);
				loading = false;
			}
		})();
		return () => controller.abort();
	});
</script>

<div class="flex h-full min-h-0 flex-col gap-4 overflow-hidden p-4">
	<div class="@container">
		<div class="flex flex-col gap-3 @4xl:flex-row @4xl:items-end @4xl:gap-4">
			<!-- <h1 class="min-w-0 text-2xl font-semibold">HMI Jobs</h1> -->
			<div
				class="flex min-w-0 flex-col gap-2 @4xl:ml-auto @4xl:w-auto @4xl:shrink-0 sm:flex-row sm:items-end sm:justify-end"
			>
				<div class="w-full sm:w-50 sm:shrink-0">
					<Combobox
						items={groupOptions}
						value={machineGroupId}
						onValueChange={handleMachineGroupChange}
						placeholder="All Machines"
						disabled={loading}
					/>
				</div>
				<div class="w-full sm:w-60 sm:shrink-0">
					<Combobox
						items={machineOptions}
						value={machineId}
						onValueChange={handleMachineChange}
						placeholder="Select Machine"
						disabled={loading}
					/>
				</div>
			</div>
		</div>
	</div>

	{#if errorMessage}
		<Alert variant="error" title="Could not load HMI jobs" description={errorMessage} />
	{/if}

	<DataTable
		{columns}
		rows={tableRows}
		{loading}
		rowKey={(row) => row.id}
		search={{ enabled: true, placeholder: 'Search live jobs' }}
		export={{ enabled: true, fileName: 'Live_Jobs' }}
		emptyState={{
			icon: Briefcase,
			title: 'No live jobs',
			description: 'HMI job state for the selected machines will appear here'
		}}
		pagination={{ enabled: tableRows.length > 0 }}
	/>
</div>
