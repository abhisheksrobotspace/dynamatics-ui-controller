<script lang="ts">
	import { DataTable, type DataTableColumn } from '@ifactory/ui-v2';
	import { Ticket } from '@lucide/svelte';
	import { onMount } from 'svelte';
	import { formatMonthLabel } from '../../central-planning-app/lib/planning-sheet.load';
	import { indentDetailUrl } from '../lib/indent-routes';
	import { getIndents, type IndentListRow } from '../lib/indents.api';
	import { listUiIndents } from '../lib/ui-indent.store';
	import { rmiPushToast } from '../lib/toast';
	import { formatApiErrorMessage } from '../../lib/api/types';
	import { app } from '../app.svelte';

	function formatMt(value: number): string {
		return value.toFixed(2);
	}

	function formatCreated(iso: string): string {
		const d = new Date(iso);
		if (Number.isNaN(d.getTime())) return '-';
		return d.toLocaleString('en-IN', {
			day: '2-digit',
			month: 'short',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function openIndent(row: IndentListRow) {
		window.location.hash = indentDetailUrl(row.id, app.appName);
	}

	function uiIndentsAsListRows(): IndentListRow[] {
		return listUiIndents().map((indent) => {
			let totalMt = 0;
			for (const line of indent.lines) {
				if (line.requiredWeightKg == null || line.requiredQty <= 0) continue;
				totalMt += (line.requiredWeightKg * line.toProcureQty) / line.requiredQty / 1000;
			}
			return {
				id: indent.indentId,
				indent_no: indent.indentNo,
				revision: 0,
				revision_label: 'UI',
				batch: 'UI only',
				mfg_plan_ref: `${indent.planLabel} · ${formatMonthLabel(indent.month)}`,
				sheet_month: indent.month,
				ht_mt: 0,
				ms_mt: 0,
				total_mt: totalMt,
				created_at: indent.createdAt,
				created_label: formatCreated(indent.createdAt),
				status: 'ui',
				project_id: indent.projectId,
				plant_id: ''
			};
		});
	}

	let rows = $state<IndentListRow[]>([]);
	let isLoading = $state(true);

	const columns = $derived.by((): DataTableColumn<IndentListRow>[] => [
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
			type: 'text',
			key: 'indent_no',
			header: 'Indent No',
			sortable: true,
			filterable: true,
			dataType: 'number',
			class: 'font-medium text-primary',
			value: (row) => `#${row.indent_no}`
		},
		{
			type: 'text',
			key: 'revision_label',
			header: 'Rev',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => row.revision_label
		},
		{
			type: 'text',
			key: 'batch',
			header: 'Batch',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => row.batch
		},
		{
			type: 'text',
			key: 'mfg_plan_ref',
			header: 'Plan',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => row.mfg_plan_ref
		},
		{
			type: 'text',
			key: 'ht_mt',
			header: 'HT (MT)',
			sortable: true,
			filterable: true,
			dataType: 'number',
			value: (row) => formatMt(row.ht_mt)
		},
		{
			type: 'text',
			key: 'ms_mt',
			header: 'MS (MT)',
			sortable: true,
			filterable: true,
			dataType: 'number',
			value: (row) => formatMt(row.ms_mt)
		},
		{
			type: 'text',
			key: 'total_mt',
			header: 'Total (MT)',
			sortable: true,
			filterable: true,
			dataType: 'number',
			class: 'font-semibold',
			value: (row) => formatMt(row.total_mt)
		},
		{
			type: 'text',
			key: 'created_label',
			header: 'Created',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => row.created_label
		}
	]);

	onMount(() => {
		const controller = new AbortController();
		void (async () => {
			isLoading = true;
			try {
				const apiRows = await getIndents(controller.signal);
				if (controller.signal.aborted) return;
				rows = [...uiIndentsAsListRows(), ...apiRows];
			} catch (error) {
				if (controller.signal.aborted) return;
				// Still show session UI indents when API is down.
				rows = uiIndentsAsListRows();
				if (rows.length === 0) {
					rmiPushToast({
						title: 'Failed to load indents',
						description: formatApiErrorMessage(error)
					});
				}
			} finally {
				if (!controller.signal.aborted) isLoading = false;
			}
		})();
		return () => controller.abort();
	});
</script>

<div class="flex h-full min-h-0 flex-col overflow-hidden p-3 md:p-4">
	<div class="min-h-0 flex-1">
		<DataTable
			{columns}
			{rows}
			loading={isLoading}
			rowKey={(row) => row.id}
			onRowClick={(row) => openIndent(row)}
			emptyState={{
				icon: Ticket,
				title: 'No indents yet',
				description: 'Open Plans, pick a plan, then Raise Indent for a project and month.'
			}}
			pagination={{ pageSize: 10 }}
		/>
	</div>
</div>
