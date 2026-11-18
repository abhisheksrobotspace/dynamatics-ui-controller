<script lang="ts">
	import { onMount } from 'svelte';
	import {
		Alert,
		Combobox,
		Skeleton,
		TreeTable,
		type ComboboxItem,
		type TreeTableColumn
	} from '@ifactory/ui-v2';
	import { formatApiErrorMessage } from '../../lib/api/types.js';
	import {
		loadMachinesReport,
		type MachineReportRow,
		type MachinesReport
	} from '../lib/reports.api.js';

	let { params } = $props();

	const planId = $derived(String(params.planId ?? ''));
	let report = $state<MachinesReport | null>(null);
	let selectedRunId = $state('');
	let loading = $state(true);
	let errorMessage = $state<string | null>(null);
	let controller: AbortController | null = null;

	const runItems = $derived(
		(report?.runItems ?? []).map((item): ComboboxItem => ({ value: item.value, label: item.label }))
	);

	const columns: TreeTableColumn<MachineReportRow>[] = [
		{
			key: 'machine',
			header: 'Machine',
			value: (node) => node.data?.machine ?? node.label,
			class: 'min-w-[6rem] font-semibold'
		},
		{
			key: 'group',
			header: 'Group',
			value: (node) => node.data?.group ?? '',
			class: 'min-w-[14rem]'
		},
		{
			key: 'jobs',
			header: 'Jobs',
			value: (node) => node.data?.jobs ?? ''
		},
		{
			key: 'parts',
			header: 'Parts',
			value: (node) => node.data?.parts ?? ''
		},
		{
			key: 'weight',
			header: 'Weight (MT)',
			value: (node) => node.data?.weight ?? ''
		},
		{
			key: 'busy',
			header: 'Busy',
			value: (node) => node.data?.busy ?? ''
		},
		{
			key: 'changeover',
			header: 'Changeover',
			value: (node) => node.data?.changeover ?? ''
		},
		{
			key: 'idle',
			header: 'Idle',
			value: (node) => node.data?.idle ?? ''
		},
		{
			key: 'totalSpan',
			header: 'Total Span',
			value: (node) => node.data?.totalSpan ?? ''
		},
		{
			key: 'utilization',
			header: 'Utilization',
			value: (node) => node.data?.utilization ?? '',
			class: 'font-semibold'
		}
	];

	async function load(runId?: string) {
		controller?.abort();
		controller = new AbortController();
		loading = true;
		errorMessage = null;
		try {
			const next = await loadMachinesReport(planId, runId, controller.signal);
			report = next;
			selectedRunId = next?.runId ?? '';
		} catch (error) {
			if (error instanceof DOMException && error.name === 'AbortError') return;
			errorMessage = formatApiErrorMessage(error);
			report = null;
		} finally {
			if (!controller.signal.aborted) loading = false;
		}
	}

	function handleRunChange(value: string | string[]) {
		const next = typeof value === 'string' ? value : value[0];
		if (!next || next === selectedRunId) return;
		void load(next);
	}

	onMount(() => {
		void load();
		return () => controller?.abort();
	});
</script>

<div class="flex h-full min-h-0 flex-col gap-4 overflow-hidden p-4">
	{#if errorMessage}
		<Alert variant="error" title="Could not load machines report" description={errorMessage} />
	{/if}

	{#if loading}
		<Skeleton class="h-16 w-full" />
		<Skeleton class="h-28 w-full" />
		<Skeleton class="h-80 w-full" />
	{:else if !report}
		<div class="border border-border bg-surface p-6">
			<p class="text-sm font-medium text-foreground">Machines report not found</p>
			<p class="mt-1 text-sm text-muted-foreground">
				Run a production schedule for this manufacturing plan first.
			</p>
		</div>
	{:else}
		<div
			class="flex flex-col gap-3 border border-border bg-surface px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
		>
			<div class="w-full min-w-48 sm:w-72">
				<Combobox
					items={runItems}
					bind:value={selectedRunId}
					placeholder="Select run"
					onValueChange={handleRunChange}
					triggerClass="rounded-none"
				/>
			</div>
			<p class="text-sm text-muted-foreground">{report.ranAt}</p>
		</div>

		<div
			class="grid grid-cols-2 gap-4 border border-border bg-surface px-4 py-4 sm:grid-cols-3 lg:grid-cols-6"
		>
			{#each report.kpis as kpi (kpi.label)}
				<div class="min-w-0">
					<p class="text-xs font-medium tracking-wide text-muted-foreground uppercase">
						{kpi.label}
					</p>
					<p class="mt-1 text-xl font-bold text-foreground">{kpi.value}</p>
				</div>
			{/each}
		</div>

		<div class="min-h-0 flex-1">
			<TreeTable nodes={report.nodes} {columns} groupHeaderClass="hidden" />
		</div>
	{/if}
</div>
