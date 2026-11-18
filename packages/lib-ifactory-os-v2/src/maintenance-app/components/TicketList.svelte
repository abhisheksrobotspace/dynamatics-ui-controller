<script lang="ts">
	import { onMount } from 'svelte';
	import { Ticket, Wrench, Plus } from '@lucide/svelte';
	import {
		Alert,
		Combobox,
		DataTable,
		DateRangePicker,
		FilterCard,
		Skeleton,
		Tabs,
		type BadgeCell,
		type DataTableColumn,
		type TabItem
	} from '@ifactory/ui-v2';
	import {
		calculateDuration,
		formatDateTime,
		getCaseEndAt,
		getTicketSource,
		getWorkEndAt,
		isTicketVisibleToday,
		mapTicketStatus,
		TICKET_STATUS,
		type TicketStatusLabel
	} from '../lib/constants.js';
	import { listTickets, type TicketListKind } from '../lib/tickets.api.js';
	import { alertNameById, listAlerts } from '../lib/alerts.api.js';
	import {
		formatUserName,
		listAssets,
		listMachineGroups,
		listShifts,
		listUsers
	} from '../lib/masters.api.js';
	import { formatErrorMessage, isAbortError } from '../lib/errors.js';
	import { lastSevenDaysRange, type DateRange } from '../lib/date-range.js';
	import type {
		AlertMaster,
		AssetRef,
		MachineGroup,
		MaintenanceTicket,
		Shift,
		UserRef
	} from '../lib/types.js';
	import AddTicketDialog from './AddTicketDialog.svelte';

	type Props = {
		kind: TicketListKind;
	};

	let { kind }: Props = $props();

	const ALL_MACHINE_GROUPS = '0';

	type ListTab = 'open' | 'closed' | 'closed_unattended';
	type StatusCardFilter = 'All' | 'Open' | 'In Progress';

	// Breakdown gets the open/closed/closed-unattended tab split; "other"
	// tickets are a single flat list (v1 behaviour).
	const hasTabs = $derived(kind === 'breakdown');

	let activeTab = $state<ListTab>('open');
	let statusFilter = $state<StatusCardFilter>('All');
	let machineGroupId = $state<string>(ALL_MACHINE_GROUPS);
	let dateRange = $state<DateRange | null>(lastSevenDaysRange());

	let assets = $state.raw<AssetRef[]>([]);
	let users = $state.raw<UserRef[]>([]);
	let machineGroups = $state.raw<MachineGroup[]>([]);
	let shifts = $state.raw<Shift[]>([]);
	let alerts = $state.raw<AlertMaster[]>([]);
	let tickets = $state.raw<MaintenanceTicket[]>([]);

	let mastersReady = $state(false);
	let tableLoading = $state(true);
	let errorMessage = $state<string | null>(null);
	let isAddTicketOpen = $state(false);

	const isClosedTab = $derived(hasTabs && activeTab !== 'open');
	const showDatePicker = $derived(kind === 'other' || isClosedTab);

	const tabItems = $derived<TabItem[]>([
		{ label: 'Open', value: 'open' },
		{ label: 'Closed', value: 'closed' },
		{ label: 'Closed - Unattended', value: 'closed_unattended' }
	]);

	const machineGroupItems = $derived([
		{ value: ALL_MACHINE_GROUPS, label: 'All Machines' },
		...machineGroups.map((group) => ({ value: String(group.id), label: group.name }))
	]);

	const shiftConfigs = $derived(
		shifts.map((shift) => ({
			name: shift.name,
			start: shift.start_time.slice(0, 5),
			end: shift.end_time.slice(0, 5)
		}))
	);

	type TicketRow = {
		id: number;
		s_no: number;
		ticketId: string;
		assetId: string;
		source: string;
		issue: string;
		status: TicketStatusLabel | '-';
		created: string;
		closed: string;
		caseDuration: string;
		started: string;
		workDuration: string;
		assignedTo: string;
		attendedBy: string;
		priority: string;
	};

	const allRows = $derived.by<TicketRow[]>(() => {
		const alertNames = alertNameById(alerts);
		const assetById = new Map(assets.map((asset) => [asset.id, asset]));
		const userById = new Map(users.map((user) => [user.id, user]));

		return tickets
			.filter((ticket) => isTicketVisibleToday(ticket))
			.filter((ticket) => {
				if (!hasTabs) return true;
				if (activeTab === 'closed') return ticket.started_at != null;
				if (activeTab === 'closed_unattended') return ticket.started_at == null;
				return true;
			})
			.map((ticket, index) => {
				const alertName = ticket.alert_id != null ? (alertNames.get(ticket.alert_id) ?? '-') : '-';
				const subAlertName =
					ticket.sub_alert_id != null ? alertNames.get(ticket.sub_alert_id) : undefined;
				return {
					id: ticket.id,
					s_no: index + 1,
					ticketId: String(ticket.id),
					assetId: ticket.mid != null ? (assetById.get(ticket.mid)?.display_id ?? '-') : '-',
					source: getTicketSource(ticket.event_id),
					issue: subAlertName ? `${alertName} - ${subAlertName}` : alertName,
					status: mapTicketStatus(ticket.status),
					created: formatDateTime(ticket.created_at),
					closed: formatDateTime(ticket.closed_at),
					caseDuration: calculateDuration(ticket.created_at, getCaseEndAt(ticket)),
					started: formatDateTime(ticket.started_at),
					workDuration: calculateDuration(ticket.started_at, getWorkEndAt(ticket)),
					assignedTo:
						ticket.assigned_to != null ? formatUserName(userById.get(ticket.assigned_to)) : '-',
					attendedBy: ticket.metadata.attendedBy || '-',
					priority: ticket.priority ?? '-'
				};
			});
	});

	const rows = $derived.by<TicketRow[]>(() => {
		if (!hasTabs || activeTab !== 'open' || statusFilter === 'All') return allRows;
		return allRows.filter((row) => row.status === statusFilter);
	});

	const openCount = $derived(allRows.filter((row) => row.status === 'Open').length);
	const inProgressCount = $derived(allRows.filter((row) => row.status === 'In Progress').length);

	const columns: DataTableColumn<TicketRow>[] = [
		{
			type: 'serial',
			key: 's_no',
			header: 'S.No',
			dataType: 'number',
			value: (row) => String(row.s_no)
		},
		{ key: 'ticketId', header: 'Ticket ID', sortable: true, value: (row) => row.ticketId },
		{ key: 'assetId', header: 'Asset ID', sortable: true, value: (row) => row.assetId },
		{ key: 'source', header: 'Source', sortable: true, value: (row) => row.source },
		{ key: 'issue', header: 'Issue', sortable: true, value: (row) => row.issue },
		{
			key: 'status',
			header: 'Status',
			type: 'badge',
			sortable: true,
			badge: (row): BadgeCell => ({
				variant:
					row.status === 'Open' ? 'error' : row.status === 'In Progress' ? 'loading' : 'online',
				label: row.status
			})
		},
		{
			key: 'created',
			header: 'Created',
			sortable: true,
			dataType: 'date',
			value: (row) => row.created
		},
		{
			key: 'closed',
			header: 'Closed',
			sortable: true,
			dataType: 'date',
			value: (row) => row.closed
		},
		{ key: 'caseDuration', header: 'Case Duration', value: (row) => row.caseDuration },
		{
			key: 'started',
			header: 'Started',
			sortable: true,
			dataType: 'date',
			value: (row) => row.started
		},
		{ key: 'workDuration', header: 'Work Duration', value: (row) => row.workDuration },
		{ key: 'assignedTo', header: 'Assigned To', sortable: true, value: (row) => row.assignedTo },
		{ key: 'attendedBy', header: 'Attended By', value: (row) => row.attendedBy },
		{ key: 'priority', header: 'Priority', sortable: true, value: (row) => row.priority }
	];

	function selectedMachineIds(): number[] | undefined {
		if (machineGroupId === ALL_MACHINE_GROUPS) return undefined;
		return assets
			.filter((asset) => String(asset.machine_group_id) === machineGroupId)
			.map((asset) => asset.id);
	}

	async function loadTickets(signal?: AbortSignal) {
		tableLoading = true;
		errorMessage = null;
		try {
			const statuses = !hasTabs
				? undefined
				: activeTab === 'open'
					? ([
							TICKET_STATUS.OPEN,
							TICKET_STATUS.IN_PROGRESS,
							TICKET_STATUS.IN_PROGRESS_ALT
						] as const)
					: ([TICKET_STATUS.CLOSED] as const);
			const useDateFilter = showDatePicker && dateRange != null;
			tickets = await listTickets(
				{
					kind,
					statuses: statuses ? [...statuses] : undefined,
					from: useDateFilter ? dateRange!.from : undefined,
					till: useDateFilter ? dateRange!.to : undefined,
					machineIds: selectedMachineIds()
				},
				signal
			);
		} catch (error) {
			if (isAbortError(error)) return;
			errorMessage = formatErrorMessage(error);
			tickets = [];
		} finally {
			if (!signal?.aborted) tableLoading = false;
		}
	}

	function handleTabChange(value: string) {
		activeTab = value as ListTab;
		statusFilter = 'All';
		void loadTickets();
	}

	function handleMachineGroupChange(value: string | string[]) {
		machineGroupId = String(value);
		void loadTickets();
	}

	function handleDateRangeChange() {
		void loadTickets();
	}

	function openDetails(row: TicketRow) {
		window.location.hash = `#/Maintenance/Tickets/Details/${row.id}`;
	}

	function handleAddTicket() {
		isAddTicketOpen = true;
	}

	function handleTicketSaved() {
		void loadTickets();
	}

	onMount(() => {
		const controller = new AbortController();
		void (async () => {
			try {
				[assets, users, machineGroups, shifts, alerts] = await Promise.all([
					listAssets(controller.signal),
					listUsers(controller.signal),
					listMachineGroups(controller.signal),
					listShifts(controller.signal),
					listAlerts(controller.signal)
				]);
				mastersReady = true;
				await loadTickets(controller.signal);
			} catch (error) {
				if (isAbortError(error)) return;
				errorMessage = formatErrorMessage(error);
				mastersReady = true;
				tableLoading = false;
			}
		})();
		return () => controller.abort();
	});
</script>

<div class="flex h-full min-h-0 flex-col gap-4 overflow-hidden p-4">
	<div class="@container">
		<div class="flex flex-col gap-3 @4xl:flex-row @4xl:items-end @4xl:gap-4">
			{#if hasTabs}
				<div class="min-w-0 shrink-0">
					<Tabs items={tabItems} value={activeTab} onValueChange={handleTabChange} />
				</div>
			{/if}
			<div
				class="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end sm:justify-end @4xl:ml-auto @4xl:w-auto @4xl:shrink-0"
			>
				<div class="w-full min-w-0 sm:w-50 sm:shrink-0">
					<Combobox
						items={machineGroupItems}
						value={machineGroupId}
						onValueChange={handleMachineGroupChange}
						placeholder="All Machines"
						disabled={!mastersReady || tableLoading}
					/>
				</div>
				{#if showDatePicker}
					<div class="w-full min-w-0 sm:w-auto sm:shrink-0">
						<DateRangePicker
							bind:value={dateRange}
							onValueChange={handleDateRangeChange}
							showTime={false}
							showShiftSelector={shiftConfigs.length > 0}
							shifts={shiftConfigs}
							disabled={!mastersReady || tableLoading}
							class="w-full"
							triggerClass="w-full min-w-0 sm:w-auto"
						/>
					</div>
				{/if}
			</div>
		</div>
	</div>

	{#if errorMessage}
		<Alert variant="error" title="Could not load tickets" description={errorMessage} />
	{/if}

	{#if hasTabs && activeTab === 'open' && !tableLoading}
		<div class="grid grid-cols-1 border border-border bg-white sm:grid-cols-3 lg:grid-cols-3">
			<FilterCard
				label="Total"
				value={openCount + inProgressCount}
				icon={Ticket}
				index={0}
				selected={statusFilter === 'All'}
				onclick={() => (statusFilter = 'All')}
			/>
			<FilterCard
				label="Unattended"
				value={openCount}
				icon={Ticket}
				index={1}
				selected={statusFilter === 'Open'}
				onclick={() => (statusFilter = 'Open')}
			/>
			<FilterCard
				label="In Progress"
				value={inProgressCount}
				icon={Wrench}
				index={2}
				selected={statusFilter === 'In Progress'}
				onclick={() => (statusFilter = 'In Progress')}
			/>
		</div>
	{:else if hasTabs && activeTab === 'open' && tableLoading}
		<div class="grid grid-cols-1 gap-0 border border-border bg-white sm:grid-cols-3 lg:grid-cols-3">
			{#each [0, 1, 2] as index (index)}
				<div class="space-y-3 border-border p-4 sm:not-last:border-r">
					<Skeleton class="h-4 w-24" />
					<Skeleton class="h-8 w-16" />
				</div>
			{/each}
		</div>
	{/if}

	<DataTable
		{columns}
		{rows}
		loading={tableLoading}
		rowKey={(row) => String(row.id)}
		onRowClick={openDetails}
		search={{ enabled: true, placeholder: 'Search tickets' }}
		emptyState={{
			icon: Ticket,
			title: 'No tickets found',
			description: 'Tickets matching the current filters will appear here'
		}}
		toolbarButton={[
			{
				enabled: true,
				label: 'Add Ticket',
				icon: Plus,
				disabled: !mastersReady,
				onClick: handleAddTicket
			}
		]}
		pagination={{ enabled: rows.length > 0 }}
		rowClass="cursor-pointer"
	/>
</div>

<AddTicketDialog bind:open={isAddTicketOpen} onSaved={handleTicketSaved} />
