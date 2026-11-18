<script lang="ts">
	import { onMount } from 'svelte';
	import { DataTable, type DataTableColumn } from '@ifactory/ui-v2';
	import { CalendarRange } from '@lucide/svelte';
	import { formatApiErrorMessage } from '../../lib/api/types';
	import { resolveDefaultPlanningPlantId } from '../../central-planning-app/lib/planning-plant';
	import {
		formatPlanCreatedAt,
		listPlanningSheetPlans,
		refreshPlanningSheetPlans
	} from '../../central-planning-app/lib/planning-sheet.store';
	import type { PlanningSheetPlan } from '../../central-planning-app/lib/planning-sheet.types';
	import { rmiPushToast } from '../lib/toast';
	import { app } from '../app.svelte';

	let plans = $state<PlanningSheetPlan[]>([]);
	let isLoading = $state(true);

	async function refresh(plantId: string) {
		isLoading = true;
		try {
			plans = await refreshPlanningSheetPlans(plantId);
		} catch (error) {
			rmiPushToast({
				title: 'Could not load plans',
				description: formatApiErrorMessage(error)
			});
			plans = listPlanningSheetPlans().filter((p) => p.plantId === plantId);
		} finally {
			isLoading = false;
		}
	}

	function openPlan(row: PlanningSheetPlan) {
		window.location.hash = `#/${app.appName}/Plans/${encodeURIComponent(row.id)}`;
	}

	const columns = $derived.by((): DataTableColumn<PlanningSheetPlan>[] => [
		{
			type: 'serial',
			key: 'sNo',
			header: 'S.No',
			sortable: true,
			filterable: true,
			dataType: 'number',
			value: (row) => {
				const index = plans.indexOf(row);
				return String(index >= 0 ? index + 1 : '');
			}
		},
		{
			type: 'text',
			key: 'label',
			header: 'Plan',
			sortable: true,
			filterable: true,
			dataType: 'string',
			class: 'font-medium text-primary',
			value: (row) => row.label
		},
		{
			type: 'text',
			key: 'createdBy',
			header: 'Created by',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => row.createdBy || '-'
		},
		{
			type: 'text',
			key: 'updatedBy',
			header: 'Updated by',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => row.updatedBy || '-'
		},
		{
			type: 'text',
			key: 'updatedAt',
			header: 'Updated',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => formatPlanCreatedAt(row.updatedAt)
		}
	]);

	onMount(() => {
		const controller = new AbortController();
		void (async () => {
			try {
				const plantId = await resolveDefaultPlanningPlantId(controller.signal);
				await refresh(plantId);
			} catch (error) {
				rmiPushToast({
					title: 'Could not load plans',
					description: formatApiErrorMessage(error)
				});
				isLoading = false;
			}
		})();
		return () => controller.abort();
	});
</script>

<div class="flex h-full min-h-0 flex-col overflow-hidden p-3 md:p-4">
	<div class="min-h-0 flex-1">
		<DataTable
			{columns}
			rows={plans}
			loading={isLoading}
			rowKey={(row) => row.id}
			onRowClick={(row) => openPlan(row)}
			emptyState={{
				icon: CalendarRange,
				title: 'No central plans',
				description: 'Create plans in Central Planning, then open them here to raise indents.'
			}}
			pagination={{ pageSize: 10 }}
		/>
	</div>
</div>
