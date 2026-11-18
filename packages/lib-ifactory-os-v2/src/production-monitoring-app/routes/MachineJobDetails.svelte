<script lang="ts">
	import {
		ArrowDownWideNarrow,
		ArrowUpWideNarrow,
		Boxes,
		CircleGauge,
		Clock,
		Factory,
		Section
	} from '@lucide/svelte';
	import {
		Alert,
		DataTable,
		EmptyState,
		KpiCard,
		Skeleton,
		type DataTableColumn
	} from '@ifactory/ui-v2';
	import { formatErrorMessage, isAbortError } from '../lib/errors.js';
	import { getMachineJobDetails } from '../lib/machines.api.js';
	import type { JobMarkingRow, MachineJobDetailsPayload } from '../lib/types.js';

	let { params = {} }: { params?: Record<string, string> } = $props();

	const machineId = $derived(params.machineId ?? '');
	const jobId = $derived(params.jobId ?? '');
	const decodedJobId = $derived(jobId ? decodeURIComponent(jobId) : '');

	let loading = $state(true);
	let errorMessage = $state<string | null>(null);
	let details = $state.raw<MachineJobDetailsPayload | null>(null);

	type MarkingRow = JobMarkingRow & Record<string, unknown>;

	const markingRows = $derived((details?.markings ?? []) as MarkingRow[]);

	const markingColumns: DataTableColumn<MarkingRow>[] = [
		{
			type: 'serial',
			key: 'sNo',
			header: 'S.No',
			sortable: true,
			filterable: true,
			dataType: 'number',
			value: (row) => {
				const index = markingRows.indexOf(row);
				return String(index >= 0 ? index + 1 : '');
			}
		},
		{ key: 'marking', header: 'Marking', sortable: true, value: (row) => row.marking },
		{ key: 'poNo', header: 'Order No.', sortable: true, value: (row) => row.poNo },
		{ key: 'pcsPerBar', header: 'Pcs per bar', value: (row) => row.pcsPerBar },
		{
			key: 'operations',
			header: 'Operations',
			sortable: true,
			dataType: 'number',
			value: (row) => String(row.operations)
		},
		{ key: 'pcs', header: 'Pcs', value: (row) => row.pcs },
		{ key: 'progress', header: 'Progress', value: (row) => row.progress },
		{ key: 'markingLength', header: 'Marking Length', value: (row) => row.markingLength },
		{ key: 'partWeight', header: 'Part Weight (kg)', value: (row) => row.partWeight }
	];

	const exportFileName = $derived(
		details ? `${details.machineName} - ${details.jid}` : decodedJobId || 'Job Details'
	);

	async function loadJobDetails(id: string, jid: string, signal?: AbortSignal) {
		loading = true;
		errorMessage = null;
		try {
			details = await getMachineJobDetails(id, jid, signal);
			if (!details && !signal?.aborted) {
				errorMessage = 'Job not found.';
			}
		} catch (error) {
			if (isAbortError(error)) return;
			errorMessage = formatErrorMessage(error);
			details = null;
		} finally {
			if (!signal?.aborted) loading = false;
		}
	}

	$effect(() => {
		const id = machineId;
		const jid = decodedJobId;
		if (!id || !jid) return;
		const controller = new AbortController();
		void loadJobDetails(id, jid, controller.signal);
		return () => controller.abort();
	});
</script>

<div class="flex h-full min-h-0 flex-col gap-4 overflow-hidden p-4">
	{#if errorMessage}
		<Alert variant="error" title="Could not load job" description={errorMessage} />
	{/if}

	{#if loading}
		<div class="space-y-4" aria-busy="true" role="status">
			<span class="sr-only">Loading job details</span>
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
				{#each [0, 1, 2, 3, 4, 5, 6, 7] as index (index)}
					<Skeleton class="h-24 w-full" />
				{/each}
			</div>
			<Skeleton class="h-96 w-full" />
		</div>
	{:else if details}
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
			<KpiCard label="MIR" value={details.mir} icon={Boxes} />
			<KpiCard label="RM Length" value={details.rmLength} icon={Section} />
			<KpiCard label="Uptime" value={`${details.uptimeMins} mins`} icon={ArrowUpWideNarrow} />
			<KpiCard label="Downtime" value={`${details.downtimeMins} mins`} icon={ArrowDownWideNarrow} />
		</div>

		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
			<KpiCard label="Job Started" value={details.jobStarted} icon={Clock} />
			<KpiCard label="Job Ended" value={details.jobEnded} icon={Clock} />
			<KpiCard label="Total Weight" value={details.totalWeight} icon={CircleGauge} />
			<KpiCard label="Allocation Group" value={details.allocationGroup} icon={Factory} />
		</div>

		{#if markingRows.length === 0}
			<EmptyState
				title="No markings for this job"
				description="Marking rows will appear here once production data is available"
				icon={Factory}
			/>
		{:else}
			<DataTable
				columns={markingColumns}
				rows={markingRows}
				rowKey={(row) => row.id}
				search={{ enabled: true, placeholder: 'Search markings' }}
				export={{ enabled: true, fileName: exportFileName }}
				pagination={{ enabled: markingRows.length > 0 }}
			/>
		{/if}
	{/if}
</div>
