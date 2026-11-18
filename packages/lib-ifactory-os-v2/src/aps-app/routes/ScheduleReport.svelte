<script lang="ts">
	import { onMount } from 'svelte';
	import {
		Alert,
		Button,
		Combobox,
		Skeleton,
		TreeTable,
		type ComboboxItem,
		type TreeTableColumn
	} from '@ifactory/ui-v2';
	import { Download, FileText } from '@lucide/svelte';
	import { formatApiErrorMessage } from '../../lib/api/types.js';
	import {
		loadScheduleReport,
		type ScheduleReport,
		type ScheduleStructureRow
	} from '../lib/reports.api.js';

	let { params } = $props();

	const planId = $derived(String(params.planId ?? ''));
	let report = $state<ScheduleReport | null>(null);
	let selectedRunId = $state('');
	let loading = $state(true);
	let errorMessage = $state<string | null>(null);
	let controller: AbortController | null = null;

	const runItems = $derived(
		(report?.runItems ?? []).map((item): ComboboxItem => ({ value: item.value, label: item.label }))
	);

	const columns: TreeTableColumn<ScheduleStructureRow>[] = [
		{
			key: 'workOrder',
			header: 'Work Order',
			tree: true,
			value: (node) => node.data?.workOrder ?? node.label,
			class: 'min-w-[8rem]'
		},
		{
			key: 'structure',
			header: 'Structure',
			value: (node) => node.data?.structure ?? '',
			class: 'min-w-[14rem]'
		},
		{
			key: 'sets',
			header: 'Sets',
			value: (node) => node.data?.sets ?? ''
		},
		{
			key: 'sections',
			header: 'Sections',
			value: (node) => node.data?.sections ?? ''
		},
		{
			key: 'marks',
			header: 'Marks',
			value: (node) => node.data?.marks ?? ''
		},
		{
			key: 'weight',
			header: 'Weight (MT)',
			value: (node) => node.data?.weight ?? ''
		},
		{
			key: 'plant',
			header: 'Plant',
			value: (node) => node.data?.plant ?? ''
		},
		{
			key: 'plannedDue',
			header: 'Planned Due',
			value: (node) => node.data?.plannedDue ?? ''
		},
		{
			key: 'start',
			header: 'Start',
			value: (node) => node.data?.start ?? ''
		},
		{
			key: 'estCompletion',
			header: 'Est. Completion',
			value: (node) => node.data?.estCompletion ?? ''
		},
		{
			key: 'makespan',
			header: 'Makespan',
			value: (node) => node.data?.makespan ?? ''
		}
	];

	async function load(runId?: string) {
		controller?.abort();
		controller = new AbortController();
		loading = true;
		errorMessage = null;
		try {
			const next = await loadScheduleReport(planId, runId, controller.signal);
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

	function exportCsv() {
		// Export will be wired when the report API exists.
	}

	function exportPdf() {
		// Export will be wired when the report API exists.
	}

	onMount(() => {
		void load();
		return () => controller?.abort();
	});
</script>

<div class="flex h-full min-h-0 flex-col gap-4 overflow-hidden p-4">
	{#if errorMessage}
		<Alert variant="error" title="Could not load schedule report" description={errorMessage} />
	{/if}

	{#if loading}
		<Skeleton class="h-16 w-full" />
		<Skeleton class="h-28 w-full" />
		<Skeleton class="h-80 w-full" />
	{:else if !report}
		<div class="border border-border bg-surface p-6">
			<p class="text-sm font-medium text-foreground">Schedule report not found</p>
			<p class="mt-1 text-sm text-muted-foreground">
				Run a schedule from Review Input to generate a report for this plan.
			</p>
		</div>
	{:else}
		<div
			class="flex flex-col gap-3 border border-border bg-surface px-4 py-3 lg:flex-row lg:items-center lg:justify-between"
		>
			<div class="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
				<div class="w-full min-w-48 sm:w-56">
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

			<div class="flex shrink-0 flex-wrap items-center gap-2">
				<Button
					variant="outline"
					size="sm"
					label="Export CSV"
					icon={Download}
					class="rounded-none"
					onclick={exportCsv}
				/>
				<Button
					variant="outline"
					size="sm"
					label="Export PDF"
					icon={FileText}
					class="rounded-none"
					onclick={exportPdf}
				/>
			</div>
		</div>

		<div
			class="grid grid-cols-2 gap-4 border border-border bg-surface px-4 py-4 sm:grid-cols-3 lg:grid-cols-7"
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
			<TreeTable nodes={report.nodes} {columns} footer={report.footer} />
		</div>
	{/if}
</div>
