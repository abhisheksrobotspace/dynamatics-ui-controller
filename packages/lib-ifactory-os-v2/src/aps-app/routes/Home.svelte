<script lang="ts">
	import { onMount } from 'svelte';
	import { Alert, ConfirmationDialog, DataTable, type DataTableColumn } from '@ifactory/ui-v2';
	import { CalendarClock, FileText, History, MoreVertical, Plus, Trash2 } from '@lucide/svelte';
	import { formatApiErrorMessage } from '../../lib/api/types.js';
	import { apsPushErrorToast, apsPushSuccessToast } from '../lib/toast.js';
	import {
		deleteManufacturingPlan,
		listManufacturingPlans,
		type ApsManufacturingPlanRow
	} from '../lib/plans.api.js';
	import {
		mapManufacturingPlanRow,
		rememberManufacturingPlanLabels,
		reviewInputHash,
		viewPlanHash,
		type ManufacturingPlan
	} from '../lib/manufacturing-plans.js';
	import { formatMtNumber } from '../lib/create-plan.utils.js';
	import { scheduleRunsHash } from '../lib/schedule-runs.js';
	import CreateManufacturingPlanDialog from '../components/CreateManufacturingPlanDialog.svelte';

	let rows = $state<ManufacturingPlan[]>([]);
	let loading = $state(true);
	let saving = $state(false);
	let errorMessage = $state<string | null>(null);
	let isDeleteDialogOpen = $state(false);
	let activePlan = $state<ManufacturingPlan | null>(null);
	let isCreatePlanDialogOpen = $state(false);
	let selectedRowKeys = $state<string[]>([]);
	const selectedPlan = $derived(rows.find((row) => selectedRowKeys.includes(row.id)) ?? null);

	function openCreatePlan() {
		isCreatePlanDialogOpen = true;
	}

	function handlePlanCreated(plan: ApsManufacturingPlanRow) {
		const mapped = mapManufacturingPlanRow(plan);
		rememberManufacturingPlanLabels([mapped]);
		rows = [mapped, ...rows];
		isCreatePlanDialogOpen = false;
	}

	function viewPlan(plan: ManufacturingPlan) {
		window.location.hash = viewPlanHash(plan.id);
	}

	function sendToScheduler(plan: ManufacturingPlan) {
		window.location.hash = reviewInputHash(plan.id);
	}

	function sendSelectedToScheduler() {
		if (!selectedPlan) return;
		sendToScheduler(selectedPlan);
	}

	function openScheduleRuns(plan: ManufacturingPlan) {
		window.location.hash = scheduleRunsHash(plan.id);
	}

	function openDeleteDialog(plan: ManufacturingPlan) {
		activePlan = plan;
		errorMessage = null;
		isDeleteDialogOpen = true;
	}

	async function handleDeleteConfirm() {
		if (!activePlan || saving) return;
		saving = true;
		errorMessage = null;
		try {
			await deleteManufacturingPlan(activePlan.id);
			const deletedId = activePlan.id;
			rows = rows.filter((row) => row.id !== deletedId);
			selectedRowKeys = selectedRowKeys.filter((id) => id !== deletedId);
			isDeleteDialogOpen = false;
			activePlan = null;
			apsPushSuccessToast({ title: 'Manufacturing plan deleted' });
		} catch (error) {
			if (error instanceof DOMException && error.name === 'AbortError') return;
			apsPushErrorToast({
				title: 'Could not delete manufacturing plan',
				description: formatApiErrorMessage(error)
			});
			errorMessage = formatApiErrorMessage(error);
			isDeleteDialogOpen = false;
		} finally {
			saving = false;
		}
	}

	const columns: DataTableColumn<ManufacturingPlan>[] = [
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
			type: 'text',
			key: 'name',
			header: 'Plan',
			sticky: true,
			sortable: true,
			dataType: 'string',
			value: (row) => row.name
		},
		{
			type: 'text',
			key: 'planCode',
			header: 'Plan ID',
			sortable: true,
			dataType: 'string',
			value: (row) => row.planCode
		},
		{
			type: 'text',
			key: 'month',
			header: 'Month',
			sortable: true,
			dataType: 'string',
			value: (row) => row.month
		},
		{
			type: 'text',
			key: 'workOrders',
			header: 'Work Orders',
			sortable: true,
			dataType: 'string',
			value: (row) => row.workOrders
		},
		{
			type: 'text',
			key: 'structures',
			header: 'Structures',
			sortable: true,
			dataType: 'number',
			value: (row) => String(row.structures)
		},
		{
			type: 'text',
			key: 'batchWt',
			header: 'Batch Wt (MT)',
			sortable: true,
			dataType: 'number',
			value: (row) => formatMtNumber(row.batchWt)
		},
		{
			type: 'text',
			key: 'plant',
			header: 'Plant',
			sortable: true,
			dataType: 'string',
			value: (row) => row.plant
		},
		{
			type: 'text',
			key: 'zincReq',
			header: 'Zinc Req. (MT)',
			sortable: true,
			dataType: 'number',
			value: (row) => formatMtNumber(row.zincReq)
		},
		{
			type: 'text',
			key: 'dueDate',
			header: 'Due Date',
			sortable: true,
			dataType: 'string',
			value: (row) => row.dueDate
		},
		{
			type: 'actions',
			key: 'actions',
			header: 'Actions',
			headerClass: 'text-right',
			class: 'text-right',
			actions: () => [
				{
					type: 'dropdown',
					icon: MoreVertical,
					align: 'end',
					ariaLabel: 'More actions',
					items: () => [
						[
							{
								label: 'All Runs',
								icon: History,
								onClick: (selectedRow) => openScheduleRuns(selectedRow)
							},
							{
								label: 'Delete',
								icon: Trash2,
								onClick: (selectedRow) => openDeleteDialog(selectedRow)
							}
						]
					]
				}
			]
		}
	];

	onMount(() => {
		const controller = new AbortController();
		void (async () => {
			loading = true;
			errorMessage = null;
			try {
				const apiRows = await listManufacturingPlans(controller.signal);
				const mapped = apiRows.map(mapManufacturingPlanRow);
				rememberManufacturingPlanLabels(mapped);
				rows = mapped;
			} catch (error) {
				if (error instanceof DOMException && error.name === 'AbortError') return;
				errorMessage = formatApiErrorMessage(error);
				rows = [];
			} finally {
				if (!controller.signal.aborted) loading = false;
			}
		})();
		return () => controller.abort();
	});
</script>

<div class="flex h-full min-h-0 flex-col overflow-hidden p-4">
	{#if errorMessage}
		<div class="mb-4">
			<Alert variant="error" title="Could not complete request" description={errorMessage} />
		</div>
	{/if}

	<DataTable
		class="min-h-0 flex-1"
		{columns}
		{rows}
		{loading}
		rowKey={(row) => row.id}
		onRowClick={(row) => viewPlan(row)}
		selection={{ enabled: true, mode: 'single' }}
		bind:selectedRowKeys
		search={{ enabled: true, placeholder: 'Search plans' }}
		toolbarButton={[
			{
				enabled: rows.length > 0,
				disabled: !selectedPlan,
				label: 'Send to Scheduler',
				icon: CalendarClock,
				variant: 'outline',
				onClick: sendSelectedToScheduler
			},
			{
				enabled: loading || rows.length > 0,
				label: 'Create Manufacturing Plan',
				icon: Plus,
				onClick: openCreatePlan
			}
		]}
		emptyState={{
			icon: FileText,
			title: 'No manufacturing plans yet',
			description: 'Create your first plan to bundle confirmed delivery schedules for scheduling',
			actionLabel: 'Create Manufacturing Plan',
			actionIcon: Plus,
			onAction: openCreatePlan
		}}
		pagination={{ enabled: rows.length > 0 }}
	/>
</div>

<CreateManufacturingPlanDialog bind:open={isCreatePlanDialogOpen} onCreated={handlePlanCreated} />

<ConfirmationDialog
	bind:open={isDeleteDialogOpen}
	title="Delete Manufacturing Plan"
	description="Are you sure you want to delete plan '{activePlan?.name}'? Linked delivery schedules will be removed from this plan. This action cannot be undone."
	confirmLabel={saving ? 'Deleting...' : 'Delete'}
	confirmVariant="danger"
	iconTone="danger"
	onConfirm={handleDeleteConfirm}
/>
