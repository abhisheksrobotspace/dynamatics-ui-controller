<script lang="ts">
	import { onMount } from 'svelte';
	import { Alert, Button, DataTable, type DataTableColumn } from '@ifactory/ui-v2';
	import { AlertCircle, ArrowLeft, Plus } from '@lucide/svelte';
	import { formatApiErrorMessage } from '../../lib/api/types.js';
	import { reviewInputHash } from '../lib/manufacturing-plans.js';
	import {
		formatScheduleRunOnTimePct,
		formatScheduleRunPlantUtilization,
		formatScheduleRunStatus,
		formatScheduleRunTimestamp,
		formatScheduleRunTonnage,
		listScheduleRuns,
		productionScheduleRunHash,
		type ApsScheduleRun
	} from '../lib/schedule-runs.js';
	import { countMachines } from '../lib/machines.api.js';
	import { jobCardsHash } from '../lib/job-cards.api.js';

	type RunTableRow = {
		id: string;
		sNo: number;
		versionLabel: string;
		createdAtLabel: string;
		ranBy: string;
		statusLabel: string;
		tonnageLabel: string;
		utilizationLabel: string;
		onTimeLabel: string;
	};

	let { params } = $props();
	const planId = $derived(String(params.planId ?? ''));

	let isLoading = $state(true);
	let errorMessage = $state<string | null>(null);
	let runs = $state<ApsScheduleRun[]>([]);
	let totalMachines = $state<number | null>(null);

	const tableRows = $derived.by((): RunTableRow[] =>
		runs.map((run, index) => ({
			id: run.runId,
			sNo: index + 1,
			versionLabel: `v${run.version}`,
			createdAtLabel: run.createdAt ? formatScheduleRunTimestamp(run.createdAt) : '-',
			ranBy: run.ranBy || '-',
			statusLabel:
				formatScheduleRunStatus(run.status) + (run.sourcesFrozen ? '' : ' · Provisional'),
			tonnageLabel: formatScheduleRunTonnage(run.totalWeightMt),
			utilizationLabel: formatScheduleRunPlantUtilization(run.machinesUsed, totalMachines),
			onTimeLabel: formatScheduleRunOnTimePct(run.onTimeCount, run.totalOrders)
		}))
	);

	onMount(() => {
		const controller = new AbortController();
		void (async () => {
			isLoading = true;
			errorMessage = null;
			try {
				runs = await listScheduleRuns(planId, controller.signal);
			} catch (error) {
				if (error instanceof DOMException && error.name === 'AbortError') return;
				errorMessage = formatApiErrorMessage(error);
				runs = [];
			} finally {
				if (!controller.signal.aborted) isLoading = false;
			}
		})();
		void (async () => {
			try {
				totalMachines = await countMachines(controller.signal);
			} catch {
				// Plant master unavailable - Plant Utilization column degrades to '-'
				// rather than blocking the runs list.
				totalMachines = null;
			}
		})();
		return () => controller.abort();
	});

	function openSchedule(runId: string) {
		window.location.hash = productionScheduleRunHash(planId, runId);
	}

	function openJobCards(runId: string) {
		window.location.hash = jobCardsHash(planId, runId);
	}

	function navigateToReview() {
		window.location.hash = reviewInputHash(planId);
	}

	const columns: DataTableColumn<RunTableRow>[] = [
		{
			type: 'serial',
			key: 'sNo',
			header: 'S.No',
			sortable: true,
			filterable: true,
			dataType: 'number',
			value: (row) => String(row.sNo)
		},
		{
			key: 'versionLabel',
			header: 'Version',
			sortable: true,
			filterable: false,
			dataType: 'string',
			value: (row) => row.versionLabel
		},
		{
			key: 'createdAtLabel',
			header: 'Run at',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => row.createdAtLabel
		},
		{
			key: 'ranBy',
			header: 'Run by',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => row.ranBy
		},
		{
			key: 'statusLabel',
			header: 'Status',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => row.statusLabel
		},
		{
			key: 'tonnageLabel',
			header: 'Tonnage (MT)',
			sortable: true,
			filterable: true,
			dataType: 'number',
			value: (row) => row.tonnageLabel
		},
		{
			key: 'utilizationLabel',
			header: 'Plant Utilization',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => row.utilizationLabel
		},
		{
			type: 'actions',
			key: 'actions',
			header: 'Actions',
			align: 'end',
			actions: (row) => [
				{
					type: 'button',
					label: 'View Jobs',
					variant: 'primary',
					size: 'sm',
					onClick: () => openJobCards(row.id)
				}
			]
		}
		// {
		// 	key: 'onTimeLabel',
		// 	header: 'On-time %',
		// 	sortable: true,
		// 	filterable: true,
		// 	dataType: 'string',
		// 	value: (row) => row.onTimeLabel
		// }
	];
</script>

<div class="flex h-full min-h-0 flex-col overflow-hidden p-4">
	{#if errorMessage}
		<div class="mb-4">
			<Alert variant="error" title="Could not load schedule runs" description={errorMessage} />
		</div>
	{/if}

	{#if !isLoading && tableRows.length === 0}
		<div class="flex flex-1 flex-col items-center justify-center py-16 text-center">
			<AlertCircle class="mb-3 h-8 w-8 text-muted-foreground" />
			<h3 class="text-lg font-medium text-foreground">No schedule runs yet</h3>
			<p class="mt-1 max-w-md text-muted-foreground">
				Run the APS scheduler from Review Input to create the first production schedule for this
				plan.
			</p>
			<Button
				variant="outline"
				class="mt-4 rounded-none"
				onclick={navigateToReview}
				label="Go to Review Input"
				icon={ArrowLeft}
			/>
		</div>
	{:else}
		<DataTable
			{columns}
			rows={tableRows}
			loading={isLoading}
			rowKey={(row) => row.id}
			onRowClick={(row) => openSchedule(row.id)}
			pagination={{ enabled: false }}
			search={{
				enabled: true,
				placeholder: 'Search runs...'
			}}
			toolbarButton={{
				enabled: true,
				label: 'New plan',
				icon: Plus,
				onClick: navigateToReview
			}}
			export={{ enabled: false }}
			tableClass="rounded-none"
		/>
	{/if}
</div>
