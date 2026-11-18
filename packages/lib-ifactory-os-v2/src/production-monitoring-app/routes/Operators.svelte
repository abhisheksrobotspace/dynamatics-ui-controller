<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import { Users } from '@lucide/svelte';
	import { Alert, DataTable, type DataTableColumn } from '@ifactory/ui-v2';
	import { APP_DATE_FILTER_CONTEXT, type AppDateFilter } from '$lib/appShell/appSharedState.js';
	import { persistOSState } from '$lib/os/index.svelte.js';
	import RangeFilters from '../components/RangeFilters.svelte';
	import {
		type DateRange,
		resolveInitialFilters,
		writeSharedDateRange
	} from '../lib/date-range.js';
	import { formatErrorMessage, isAbortError } from '../lib/errors.js';
	import { listOperatorsTable, listShifts } from '../lib/machines.api.js';
	import type { OperatorListRow, Shift } from '../lib/types.js';

	const sharedDateFilter = getContext<AppDateFilter>(APP_DATE_FILTER_CONTEXT);
	const initial = resolveInitialFilters(sharedDateFilter);

	let dateRange = $state<DateRange | null>(initial.dateRange);
	let shifts = $state.raw<Shift[]>([]);
	let rows = $state.raw<OperatorListRow[]>([]);
	let mastersReady = $state(false);
	let loading = $state(true);
	let errorMessage = $state<string | null>(null);

	type OperatorRow = OperatorListRow & Record<string, unknown>;

	const tableRows = $derived(rows as OperatorRow[]);

	const columns: DataTableColumn<OperatorRow>[] = [
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
			key: 'operator_name',
			header: 'Name',
			sortable: true,
			value: (row) => row.operator_name
		},
		{ key: 'operator_id', header: 'ID', sortable: true, value: (row) => row.operator_id },
		{ key: 'duration', header: 'Duration', value: (row) => row.duration },
		{
			key: 'first_login',
			header: 'First Login',
			sortable: true,
			dataType: 'date',
			value: (row) => row.first_login
		},
		{
			key: 'latest_logout',
			header: 'Latest Logout',
			dataType: 'date',
			value: (row) => row.latest_logout
		},
		{ key: 'uptime', header: 'Uptime (mins)', sortable: true, value: (row) => row.uptime },
		{ key: 'downtime', header: 'Downtime (mins)', sortable: true, value: (row) => row.downtime },
		{
			key: 'total_production',
			header: 'Total Weight (MT)',
			sortable: true,
			value: (row) => row.total_production
		}
	];

	async function loadOperators(signal?: AbortSignal) {
		if (!dateRange) return;
		loading = true;
		errorMessage = null;
		try {
			rows = await listOperatorsTable({ from: dateRange.from, to: dateRange.to }, signal);
		} catch (error) {
			if (isAbortError(error)) return;
			errorMessage = formatErrorMessage(error);
			rows = [];
		} finally {
			if (!signal?.aborted) loading = false;
		}
	}

	function persistRange(nextRange: DateRange) {
		writeSharedDateRange(sharedDateFilter, nextRange);
		persistOSState();
	}

	function handleDateRangeChange(value: DateRange) {
		dateRange = value;
		persistRange(value);
		void loadOperators();
	}

	onMount(() => {
		const controller = new AbortController();
		if (initial.didInitializeRange && dateRange) persistRange(dateRange);
		void (async () => {
			try {
				shifts = await listShifts(controller.signal);
				mastersReady = true;
				await loadOperators(controller.signal);
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
					showMachineGroup={false}
					bind:dateRange
					{shifts}
					disabled={!mastersReady || loading}
					onDateRangeChange={handleDateRangeChange}
				/>
			</div>
		</div>
	</div>

	{#if errorMessage}
		<Alert variant="error" title="Could not load operators" description={errorMessage} />
	{/if}

	<DataTable
		{columns}
		rows={tableRows}
		{loading}
		rowKey={(row) => String(row.id)}
		search={{ enabled: true, placeholder: 'Search operators' }}
		export={{ enabled: true, fileName: 'Operators' }}
		emptyState={{
			icon: Users,
			title: 'No operators found',
			description: 'Operators with logins in the selected range will appear here'
		}}
		pagination={{ enabled: tableRows.length > 0 }}
	/>
</div>
