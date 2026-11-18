<script lang="ts">
	import { onMount } from 'svelte';
	import { Alert, Button, DataTable, type DataTableColumn } from '@ifactory/ui-v2';
	import { Plus } from '@lucide/svelte';
	import { formatApiErrorMessage } from '../../lib/api/types.js';
	import { resolveDefaultPlanningPlantId } from '../../central-planning-app/lib/planning-plant';
	import { currentLocalPlanMonth } from '../../aps-app/lib/create-plan.id.js';
	import { monthRangeFromPlanMonth } from '../../aps-app/lib/create-plan-ds.utils.js';
	import {
		createScheduleRequest,
		scheduleRequestLabel
	} from '../../aps-app/lib/schedule-requests.api.js';
	import {
		rememberManufacturingPlanLabel,
		reviewInputHash
	} from '../../aps-app/lib/manufacturing-plans.js';
	import { apsRunsPlanHash, listApsRunsPlans, type ApsRunsPlanRow } from '../lib/aps-runs.api.js';
	import { rmiPushToast } from '../../rm-indent-app/lib/toast';

	let loading = $state(true);
	let creating = $state(false);
	let errorMessage = $state<string | null>(null);
	let rows = $state<ApsRunsPlanRow[]>([]);

	const columns: DataTableColumn<ApsRunsPlanRow>[] = [
		{
			key: 'name',
			header: 'Request',
			class: 'min-w-[12rem] font-medium',
			value: (row) => row.name
		},
		{
			key: 'monthLabel',
			header: 'Horizon',
			value: (row) => row.monthLabel
		},
		{
			key: 'status',
			header: 'Status',
			value: (row) => {
				if (row.sourcesFrozen === false) return 'Provisional';
				return row.status;
			}
		},
		{
			key: 'runCount',
			header: 'Runs',
			headerClass: 'text-right',
			class: 'text-right',
			value: (row) => String(row.runCount)
		},
		{
			key: 'latestVersion',
			header: 'Latest',
			value: (row) =>
				row.latestVersion != null
					? `v${row.latestVersion}${row.latestStatus ? ` · ${row.latestStatus}` : ''}`
					: '—'
		}
	];

	function openPlan(row: ApsRunsPlanRow) {
		window.location.hash = row.runCount > 0 ? apsRunsPlanHash(row.id) : reviewInputHash(row.id);
	}

	async function createRequest() {
		if (creating) return;
		creating = true;
		try {
			const plantId = await resolveDefaultPlanningPlantId();
			const range = monthRangeFromPlanMonth(currentLocalPlanMonth());
			if (!plantId || !range) throw new Error('Could not resolve plant or month for a new request');
			const created = await createScheduleRequest({
				plantId,
				horizonStart: range.startDate,
				horizonEnd: range.endDate,
				cadence: 'monthly'
			});
			rememberManufacturingPlanLabel(created.request_id, scheduleRequestLabel(created));
			window.location.hash = reviewInputHash(created.request_id);
		} catch (error) {
			rmiPushToast({
				title: 'Could not create request',
				description: formatApiErrorMessage(error)
			});
		} finally {
			creating = false;
		}
	}

	onMount(() => {
		const controller = new AbortController();
		void (async () => {
			loading = true;
			errorMessage = null;
			try {
				rows = await listApsRunsPlans(controller.signal);
			} catch (error) {
				if (error instanceof DOMException && error.name === 'AbortError') return;
				errorMessage = formatApiErrorMessage(error);
				rows = [];
			} finally {
				loading = false;
			}
		})();
		return () => controller.abort();
	});
</script>

<div class="flex h-full min-h-0 flex-col gap-3 p-4">
	<div class="flex items-center justify-end">
		<Button
			variant="primary"
			size="sm"
			label={creating ? 'Creating…' : 'New request'}
			icon={Plus}
			disabled={creating}
			onclick={createRequest}
		/>
	</div>

	{#if errorMessage}
		<Alert variant="error" title="Could not load APS runs">{errorMessage}</Alert>
	{/if}

	<DataTable
		{columns}
		{rows}
		{loading}
		rowKey={(row) => row.id}
		emptyMessage="No schedule requests yet. Use Send to APS from a shop-floor month, or create a request here."
		onRowClick={openPlan}
	/>
</div>
