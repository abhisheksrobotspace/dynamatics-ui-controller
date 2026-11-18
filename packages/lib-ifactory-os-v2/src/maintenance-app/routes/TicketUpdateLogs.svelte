<script lang="ts">
	import { onMount } from 'svelte';
	import { History } from '@lucide/svelte';
	import { Alert, DataTable, DateRangePicker, type DataTableColumn } from '@ifactory/ui-v2';
	import { listReasonChanges } from '../lib/tickets.api.js';
	import { alertNameById, listAlerts } from '../lib/alerts.api.js';
	import { formatUserName, listAssets, listUsers } from '../lib/masters.api.js';
	import { formatErrorMessage, isAbortError } from '../lib/errors.js';
	import { lastSevenDaysRange, type DateRange } from '../lib/date-range.js';
	import type { AlertMaster, AssetRef, TicketReasonChange, UserRef } from '../lib/types.js';

	let assets = $state.raw<AssetRef[]>([]);
	let users = $state.raw<UserRef[]>([]);
	let alerts = $state.raw<AlertMaster[]>([]);
	let changes = $state.raw<TicketReasonChange[]>([]);

	let loading = $state(true);
	let errorMessage = $state<string | null>(null);
	let dateRange = $state<DateRange | null>(lastSevenDaysRange());

	type LogRow = {
		id: number;
		dateTime: string;
		ticketId: string;
		changedBy: string;
		asset: string;
		oldIssue: string;
		newIssue: string;
		note: string;
	};

	function formatIssue(
		alertNames: Map<number, string>,
		alertId: number | null,
		subAlertId: number | null
	): string {
		const parts: string[] = [];
		if (alertId != null && alertNames.has(alertId)) parts.push(alertNames.get(alertId)!);
		if (subAlertId != null && alertNames.has(subAlertId)) {
			const sub = alertNames.get(subAlertId)!;
			if (!parts.includes(sub)) parts.push(sub);
		}
		return parts.length > 0 ? parts.join(' / ') : '-';
	}

	const rows = $derived.by<LogRow[]>(() => {
		const alertNames = alertNameById(alerts);
		const assetById = new Map(assets.map((asset) => [asset.id, asset]));
		const userById = new Map(users.map((user) => [user.id, user]));

		return changes.map((change) => ({
			id: change.id,
			dateTime: change.changed_at ? new Date(change.changed_at).toLocaleString('en-IN') : '-',
			ticketId: String(change.ticket_id),
			changedBy: change.changed_by != null ? formatUserName(userById.get(change.changed_by)) : '-',
			asset: change.mid != null ? (assetById.get(change.mid)?.display_id ?? '-') : '-',
			oldIssue: formatIssue(alertNames, change.old_alert_id, change.old_sub_alert_id),
			newIssue: formatIssue(alertNames, change.new_alert_id, change.new_sub_alert_id),
			note: change.note || '-'
		}));
	});

	const columns: DataTableColumn<LogRow>[] = [
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
			key: 'dateTime',
			header: 'Date & Time',
			sortable: true,
			dataType: 'date',
			value: (row) => row.dateTime
		},
		{ key: 'ticketId', header: 'Ticket ID', sortable: true, value: (row) => row.ticketId },
		{ key: 'changedBy', header: 'Changed By', sortable: true, value: (row) => row.changedBy },
		{ key: 'asset', header: 'Asset', sortable: true, value: (row) => row.asset },
		{ key: 'oldIssue', header: 'Old Issue', value: (row) => row.oldIssue },
		{ key: 'newIssue', header: 'New Issue', value: (row) => row.newIssue },
		{ key: 'note', header: 'Note', value: (row) => row.note, title: (row) => row.note }
	];

	async function loadChanges(signal?: AbortSignal) {
		if (!dateRange) return;
		loading = true;
		errorMessage = null;
		try {
			changes = await listReasonChanges(dateRange.from, dateRange.to, signal);
		} catch (error) {
			if (isAbortError(error)) return;
			errorMessage = formatErrorMessage(error);
			changes = [];
		} finally {
			if (!signal?.aborted) loading = false;
		}
	}

	function handleDateRangeChange() {
		void loadChanges();
	}

	onMount(() => {
		const controller = new AbortController();
		void (async () => {
			try {
				[assets, users, alerts] = await Promise.all([
					listAssets(controller.signal),
					listUsers(controller.signal),
					listAlerts(controller.signal)
				]);
				await loadChanges(controller.signal);
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
	<div class="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-end">
		<!-- <h1 class="font-heading text-2xl font-bold text-foreground">Logs</h1> -->
		<DateRangePicker
			bind:value={dateRange}
			onValueChange={handleDateRangeChange}
			showTime={false}
			disabled={loading}
		/>
	</div>

	{#if errorMessage}
		<Alert variant="error" title="Could not load logs" description={errorMessage} />
	{/if}

	<DataTable
		{columns}
		{rows}
		{loading}
		rowKey={(row) => String(row.id)}
		search={{ enabled: true, placeholder: 'Search logs' }}
		emptyState={{
			icon: History,
			title: 'No reason changes',
			description: 'Ticket reason corrections in the selected period will appear here'
		}}
		pagination={{ enabled: rows.length > 0 }}
	/>
</div>
