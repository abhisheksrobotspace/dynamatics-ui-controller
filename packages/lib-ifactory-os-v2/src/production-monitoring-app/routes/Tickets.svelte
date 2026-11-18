<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import { AlertCircle, CircleCheck, CircleDashed, Ticket } from '@lucide/svelte';
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
	import { listMachineGroupOptions, listShifts, listTicketsTable } from '../lib/machines.api.js';
	import {
		isTicketClosed,
		isTicketInProgress,
		isTicketOpen,
		ticketStatusLabel,
		toTicketBadgeVariant
	} from '../lib/resources.js';
	import type {
		MachineGroupOption,
		Shift,
		TicketListRow,
		TicketsListPayload
	} from '../lib/types.js';

	const sharedDateFilter = getContext<AppDateFilter>(APP_DATE_FILTER_CONTEXT);
	const initial = resolveInitialFilters(sharedDateFilter);

	let dateRange = $state<DateRange | null>(initial.dateRange);
	let machineGroupId = $state(initial.machineGroupId);
	let selectedFilter = $state('all');
	let groupOptions = $state.raw<MachineGroupOption[]>([]);
	let shifts = $state.raw<Shift[]>([]);
	let payload = $state.raw<TicketsListPayload | null>(null);
	let mastersReady = $state(false);
	let loading = $state(true);
	let errorMessage = $state<string | null>(null);

	type TicketRow = TicketListRow & Record<string, unknown>;

	const filterItems = $derived.by<FilterCardItem[]>(() => [
		{ id: 'all', label: 'Total Tickets', count: payload?.total ?? 0, icon: Ticket },
		{ id: 'open', label: 'Tickets Open', count: payload?.open ?? 0, icon: AlertCircle },
		{
			id: 'in_progress',
			label: 'Tickets In Progress',
			count: payload?.inProgress ?? 0,
			icon: CircleDashed
		},
		{ id: 'closed', label: 'Tickets Closed', count: payload?.closed ?? 0, icon: CircleCheck }
	]);

	const rows = $derived.by<TicketRow[]>(() => {
		const all = (payload?.rows ?? []) as TicketRow[];
		if (selectedFilter === 'open') return all.filter((row) => isTicketOpen(row.ticket_status));
		if (selectedFilter === 'in_progress') {
			return all.filter((row) => isTicketInProgress(row.ticket_status));
		}
		if (selectedFilter === 'closed') return all.filter((row) => isTicketClosed(row.ticket_status));
		return all;
	});

	const columns: DataTableColumn<TicketRow>[] = [
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
		{ key: 'ticket_id', header: 'Ticket ID', sortable: true, value: (row) => row.ticket_id },
		{
			key: 'machine_name',
			header: 'Machine Name',
			sortable: true,
			value: (row) => row.machine_name
		},
		{
			key: 'alert_name',
			header: 'Alert Name',
			type: 'badge',
			badge: (row): BadgeCell => ({
				variant: row.alert_name === '-' ? 'offline' : 'error',
				label: row.alert_name
			})
		},
		{
			key: 'ticket_status',
			header: 'Status',
			type: 'badge',
			sortable: true,
			badge: (row): BadgeCell => ({
				variant: toTicketBadgeVariant(row.ticket_status),
				label: ticketStatusLabel(row.ticket_status)
			})
		},
		{
			key: 'created_at',
			header: 'Created Date',
			sortable: true,
			dataType: 'date',
			value: (row) => row.created_at
		},
		{ key: 'closed_at', header: 'Closed Date', dataType: 'date', value: (row) => row.closed_at },
		{ key: 'duration', header: 'Ticket Duration', value: (row) => row.duration },
		{ key: 'job_id', header: 'Job ID', value: (row) => row.job_id },
		{ key: 'operator', header: 'Operator', value: (row) => row.operator }
	];

	async function loadTickets(signal?: AbortSignal) {
		if (!dateRange) return;
		loading = true;
		errorMessage = null;
		try {
			payload = await listTicketsTable(
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
		selectedFilter = 'all';
		if (!dateRange) return;
		persistFilters(dateRange, value);
		void loadTickets();
	}

	function handleDateRangeChange(value: DateRange) {
		dateRange = value;
		selectedFilter = 'all';
		persistFilters(value, machineGroupId);
		void loadTickets();
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
				await loadTickets(controller.signal);
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
		<Alert variant="error" title="Could not load tickets" description={errorMessage} />
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
		<FilterCardStrip class="lg:grid-cols-4" items={filterItems} bind:value={selectedFilter} />
	{/if}

	<DataTable
		{columns}
		{rows}
		{loading}
		rowKey={(row) => String(row.id)}
		search={{ enabled: true, placeholder: 'Search tickets' }}
		export={{ enabled: true, fileName: 'Tickets' }}
		emptyState={{
			icon: Ticket,
			title: 'No tickets found',
			description: 'Tickets matching the current filters will appear here'
		}}
		pagination={{ enabled: rows.length > 0 }}
	/>
</div>
