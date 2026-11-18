<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import { Search } from '@lucide/svelte';
	import { Alert, DataTable, type DataTableColumn } from '@ifactory/ui-v2';
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
	import { listMachineGroupOptions, listSearchByMarking, listShifts } from '../lib/machines.api.js';
	import type { MachineGroupOption, SearchByMarkingRow, Shift } from '../lib/types.js';

	const sharedDateFilter = getContext<AppDateFilter>(APP_DATE_FILTER_CONTEXT);
	const initial = resolveInitialFilters(sharedDateFilter);

	let dateRange = $state<DateRange | null>(initial.dateRange);
	let machineGroupId = $state(initial.machineGroupId);
	let groupOptions = $state.raw<MachineGroupOption[]>([]);
	let shifts = $state.raw<Shift[]>([]);
	let rows = $state.raw<SearchByMarkingRow[]>([]);
	let mastersReady = $state(false);
	let loading = $state(true);
	let errorMessage = $state<string | null>(null);

	type MarkingRow = SearchByMarkingRow & Record<string, unknown>;

	const tableRows = $derived(rows as MarkingRow[]);

	const columns: DataTableColumn<MarkingRow>[] = [
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
		{ key: 'marking', header: 'Marking', sortable: true, value: (row) => row.marking },
		{ key: 'poNo', header: 'Order No.', sortable: true, value: (row) => row.poNo },
		{ key: 'mir', header: 'MIR', sortable: true, value: (row) => row.mir },
		{
			key: 'sectionDimension',
			header: 'Section Dimension',
			value: (row) => row.sectionDimension
		},
		{
			key: 'allocationGroup',
			header: 'Allocation Group',
			value: (row) => row.allocationGroup
		},
		{ key: 'mid', header: 'Machine', sortable: true, value: (row) => row.mid },
		{ key: 'operator', header: 'Operator', value: (row) => row.operator },
		{ key: 'pcsPerBar', header: 'Pcs per bar', value: (row) => row.pcsPerBar },
		{ key: 'pcs', header: 'Pcs', value: (row) => row.pcs },
		{ key: 'progress', header: 'Progress', value: (row) => row.progress },
		{ key: 'partWeight', header: 'Part Weight (kg)', value: (row) => row.partWeight },
		{ key: 'totalWeight', header: 'Total Weight (kg)', value: (row) => row.totalWeight },
		{ key: 'markingLength', header: 'Marking Length', value: (row) => row.markingLength }
	];

	async function loadRows(signal?: AbortSignal) {
		if (!dateRange) return;
		loading = true;
		errorMessage = null;
		try {
			rows = await listSearchByMarking(
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
		<Alert variant="error" title="Could not load markings" description={errorMessage} />
	{/if}

	<DataTable
		{columns}
		rows={tableRows}
		{loading}
		rowKey={(row) => row.id}
		search={{ enabled: true, placeholder: 'Search by marking' }}
		export={{ enabled: true, fileName: 'Markings' }}
		emptyState={{
			icon: Search,
			title: 'No markings found',
			description: 'Markings for the selected filters will appear here'
		}}
		pagination={{ enabled: tableRows.length > 0 }}
	/>
</div>
