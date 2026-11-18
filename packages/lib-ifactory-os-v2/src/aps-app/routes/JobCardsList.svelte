<script lang="ts">
	import { onMount } from 'svelte';
	import { Alert, Button, DataTable, type DataTableColumn } from '@ifactory/ui-v2';
	import { formatApiErrorMessage } from '../../lib/api/types.js';
	import {
		formatJobCardStatus,
		jobCardDetailHash,
		listJobCards,
		resolveJobCardsRunId
	} from '../lib/job-cards.api.js';
	import type { JobCardSummary } from '../lib/job-cards.types.js';
	import { formatDisplayWeight, formatExportWeightKg } from '../lib/job-cards.weight.js';
	import { productionScheduleHash } from '../lib/production-schedule.types.js';

	let { params } = $props();

	const planId = $derived(String(params.planId ?? ''));
	const preferredRunId = $derived(String(params.runId ?? '').trim() || null);

	let loading = $state(true);
	let errorMessage = $state<string | null>(null);
	let runId = $state<string | null>(null);
	let rows = $state<JobCardSummary[]>([]);

	const columns: DataTableColumn<JobCardSummary>[] = [
		{
			type: 'serial',
			key: 'sNo',
			header: 'S.No',
			sticky: true,
			sortable: true,
			filterable: true,
			dataType: 'number',
			value: (row) => {
				const index = rows.indexOf(row);
				return String(index >= 0 ? index + 1 : '');
			}
		},
		{
			key: 'jcSrNo',
			header: 'JC / SR No.',
			sticky: true,
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => row.jcSrNo
		},
		{
			key: 'workOrder',
			header: 'Work Order',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => row.workOrder
		},
		{
			key: 'towerType',
			header: 'Tower Type',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => row.towerType
		},
		{
			key: 'subtype',
			header: 'Subtype',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => row.subtype
		},
		{
			key: 'section',
			header: 'Section',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => row.section,
			class: 'min-w-[14rem]'
		},
		{
			key: 'sets',
			header: 'No of Sets',
			sortable: true,
			filterable: true,
			dataType: 'number',
			value: (row) => String(row.sets)
		},
		{
			key: 'markCount',
			header: 'Marks',
			sortable: true,
			filterable: true,
			dataType: 'number',
			value: (row) => String(row.markCount)
		},
		{
			key: 'totalWeightKg',
			header: 'Total Wt',
			sortable: true,
			filterable: true,
			dataType: 'number',
			value: (row) => formatDisplayWeight(row.totalWeightKg)
		},
		{
			key: 'date',
			header: 'Date',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => row.date
		},
		{
			key: 'status',
			header: 'Status',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => formatJobCardStatus(row.status)
		}
	];

	onMount(() => {
		const id = planId;
		const preferred = preferredRunId;
		if (!id) {
			loading = false;
			rows = [];
			runId = null;
			return;
		}
		const controller = new AbortController();
		loading = true;
		errorMessage = null;
		void (async () => {
			try {
				const resolved = await resolveJobCardsRunId(id, preferred, controller.signal);
				if (controller.signal.aborted) return;
				runId = resolved;
				if (!resolved) {
					rows = [];
					return;
				}
				rows = await listJobCards(resolved, controller.signal);
			} catch (error) {
				if (error instanceof DOMException && error.name === 'AbortError') return;
				errorMessage = formatApiErrorMessage(error);
				rows = [];
				runId = null;
			} finally {
				if (!controller.signal.aborted) loading = false;
			}
		})();
		return () => controller.abort();
	});

	function openJobCard(row: JobCardSummary) {
		window.location.hash = jobCardDetailHash(planId, row.jobId);
	}

	function goRerunSchedule() {
		window.location.hash = productionScheduleHash(planId);
	}

	function exportCsv() {
		const headers = [
			'JC / SR No.',
			'Work Order',
			'Tower Type',
			'Subtype',
			'Section',
			'No of Sets',
			'Marks',
			'Total Wt (kg)',
			'Date',
			'Status'
		];
		const lines = rows.map((row) =>
			[
				row.jcSrNo,
				row.workOrder,
				row.towerType,
				row.subtype,
				row.section,
				row.sets,
				row.markCount,
				formatExportWeightKg(row.totalWeightKg),
				row.date,
				formatJobCardStatus(row.status)
			]
				.map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
				.join(',')
		);
		const csv = [headers.join(','), ...lines].join('\n');
		const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = `job-cards-${planId || 'plan'}.csv`;
		link.click();
		URL.revokeObjectURL(url);
	}
</script>

<div class="flex h-full min-h-0 flex-col gap-4 overflow-hidden p-4">
	{#if errorMessage}
		<Alert variant="error" title="Could not load job cards" description={errorMessage} />
	{/if}

	{#if !loading && !runId}
		<div class="border border-border bg-surface p-6">
			<p class="text-sm font-medium text-foreground">No completed schedule run</p>
			<p class="mt-1 text-sm text-muted-foreground">
				Run the APS scheduler to generate a schedule and job cards for this plan.
			</p>
		</div>
	{:else if !loading && runId && rows.length === 0}
		<div class="border border-border bg-surface p-6">
			<p class="text-sm font-medium text-foreground">No job cards</p>
			<p class="mt-1 text-sm text-muted-foreground">
				Historical runs may not have cards. Rerun Schedule to generate job cards for a new run.
			</p>
			<div class="mt-4">
				<Button
					variant="outline"
					size="sm"
					label="Open Production Schedule"
					class="rounded-none"
					onclick={goRerunSchedule}
				/>
			</div>
		</div>
	{:else}
		<DataTable
			class="min-h-0 flex-1"
			{columns}
			{rows}
			{loading}
			rowKey={(row) => row.jobId}
			search={{ enabled: true, placeholder: 'Search job cards…' }}
			pagination={{ pageSize: 10 }}
			export={{
				enabled: true,
				fileName: `job-cards-${planId || 'plan'}`,
				onClick: exportCsv
			}}
			onRowClick={openJobCard}
		/>
	{/if}
</div>
