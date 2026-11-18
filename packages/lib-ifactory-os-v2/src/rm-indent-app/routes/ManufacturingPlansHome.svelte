<script lang="ts">
	import { onMount } from 'svelte';
	import { Component } from '@lucide/svelte';
	import { DataTable, type DataTableColumn } from '@ifactory/ui-v2';
	import { rmiPushToast } from '../lib/toast';
	import { formatApiErrorMessage } from '../../lib/api/types';
	import { listRmiManufacturingPlans, type ApsManufacturingPlanRow } from '../lib/rmi-home.api';
	import { resolvePlanningAppData } from '../lib/planning-capabilities';

	type PlanRow = ApsManufacturingPlanRow & {
		plan_title: string;
		due_date_label: string;
	};

	let { data }: { data?: unknown } = $props();
	const planning = $derived(resolvePlanningAppData(data));

	let isLoading = $state(true);
	let planRows = $state<PlanRow[]>([]);

	function formatPlanTitle(plan: ApsManufacturingPlanRow): string {
		const name = plan.name?.trim();
		const month = plan.month?.slice(0, 7);
		if (name && month) return `${name} (${month})`;
		if (name) return name;
		if (month) return month;
		return plan.plan_id;
	}

	function formatDate(iso: string | null | undefined): string {
		if (!iso) return '-';
		const d = new Date(iso);
		if (isNaN(d.getTime())) return '-';
		return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
	}

	const columns: DataTableColumn<PlanRow>[] = [
		{
			type: 'serial',
			key: 'sNo',
			header: 'S.No',
			sortable: true,
			filterable: true,
			dataType: 'number',
			value: (row) => {
				const index = planRows.indexOf(row);
				return String(index >= 0 ? index + 1 : '');
			}
		},
		{
			type: 'text',
			key: 'plan_title',
			header: 'Plan',
			sortable: true,
			filterable: true,
			dataType: 'string',
			class: 'font-medium',
			value: (row) => row.plan_title
		},
		{
			type: 'text',
			key: 'month',
			header: 'Month',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => row.month?.slice(0, 7) ?? '-'
		},
		{
			type: 'text',
			key: 'due_date_label',
			header: 'Due Date',
			sortable: true,
			dataType: 'string',
			value: (row) => row.due_date_label
		}
	];

	function selectPlan(plan: PlanRow) {
		window.location.hash = `#/${planning.appName}/ManufacturingPlan/${encodeURIComponent(plan.plan_id)}`;
	}

	onMount(() => {
		const controller = new AbortController();
		void (async () => {
			isLoading = true;
			try {
				const rows = await listRmiManufacturingPlans(controller.signal);
				planRows = rows.map((plan) => ({
					...plan,
					plan_title: formatPlanTitle(plan),
					due_date_label: formatDate(plan.due_date)
				}));
			} catch (error) {
				if (controller.signal.aborted) return;
				rmiPushToast({
					title: 'Failed to load manufacturing plans',
					description: formatApiErrorMessage(error)
				});
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
			rows={planRows}
			loading={isLoading}
			rowKey={(row) => row.plan_id}
			onRowClick={(row) => selectPlan(row)}
			emptyState={{
				icon: Component,
				title: 'No manufacturing plans',
				description: 'Freeze a shop-floor month and use Send to APS to schedule.'
			}}
			pagination={{ pageSize: 15 }}
			rowClass={() => 'cursor-pointer'}
		/>
	</div>
</div>
