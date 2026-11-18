<script lang="ts">
	import { onMount } from 'svelte';
	import {
		Button,
		ConfirmationDialog,
		DataTable,
		Dialog,
		Input,
		Label,
		type DataTableColumn
	} from '@ifactory/ui-v2';
	import { CalendarRange, Copy, EllipsisVertical, Plus, Trash2 } from '@lucide/svelte';
	import { formatApiErrorMessage } from '../../lib/api/types';
	import { rmiPushToast } from '../../rm-indent-app/lib/toast';
	import { resolveDefaultPlanningPlantId } from '../lib/planning-plant';
	import {
		clearPendingPlanName,
		clearPendingPlanPlantId,
		clearWorkingDraft,
		deletePlanningSheetPlan,
		duplicatePlanningSheetPlan,
		formatPlanCreatedAt,
		isMonthFrozen,
		listPlanningSheetPlans,
		refreshPlanningSheetPlans,
		setPendingPlanName,
		setPendingPlanPlantId
	} from '../lib/planning-sheet.store';
	import { formatMonthLabel } from '../lib/planning-sheet.load';
	import type { PlanningSheetPlan } from '../lib/planning-sheet.types';
	import { app } from '../app.svelte';

	let plans = $state<PlanningSheetPlan[]>([]);
	let isLoading = $state(true);
	let defaultPlantId = $state('');
	let isNewPlanDialogOpen = $state(false);
	let isDuplicateDialogOpen = $state(false);
	let isDeleteDialogOpen = $state(false);
	let planToDelete = $state<PlanningSheetPlan | null>(null);
	let planToDuplicate = $state<PlanningSheetPlan | null>(null);
	let planName = $state('');
	let planNameError = $state('');
	let isBusy = $state(false);

	const rowActionClass = 'text-primary border-primary hover:bg-primary/10';

	function frozenMonthsForPlan(plan: PlanningSheetPlan): string[] {
		return plan.sentToShopFloorMonths.filter((month) => isMonthFrozen(month, plan.plantId)).sort();
	}

	async function refresh() {
		if (!defaultPlantId) {
			plans = [];
			return;
		}
		isLoading = true;
		try {
			plans = await refreshPlanningSheetPlans(defaultPlantId);
		} catch (error) {
			rmiPushToast({
				title: 'Could not load plans',
				description: formatApiErrorMessage(error)
			});
			plans = listPlanningSheetPlans().filter((p) => p.plantId === defaultPlantId);
		} finally {
			isLoading = false;
		}
	}

	function openNewPlanDialog() {
		planName = '';
		planNameError = '';
		isNewPlanDialogOpen = true;
	}

	function closeNewPlanDialog() {
		isNewPlanDialogOpen = false;
		planName = '';
		planNameError = '';
	}

	function confirmNewPlan() {
		const trimmed = planName.trim();
		if (!trimmed) {
			planNameError = 'Plan name is required.';
			return;
		}
		if (!defaultPlantId) {
			planNameError = 'No plant available.';
			return;
		}
		clearWorkingDraft();
		setPendingPlanName(trimmed);
		setPendingPlanPlantId(defaultPlantId);
		closeNewPlanDialog();
		window.location.hash = `#/${app.appName}/Sheet/new`;
	}

	function openDuplicateDialog(row: PlanningSheetPlan) {
		planToDuplicate = row;
		planName = `${row.label} (copy)`;
		planNameError = '';
		isDuplicateDialogOpen = true;
	}

	function closeDuplicateDialog() {
		isDuplicateDialogOpen = false;
		planToDuplicate = null;
		planName = '';
		planNameError = '';
	}

	async function confirmDuplicate() {
		if (!planToDuplicate || isBusy) return;
		const trimmed = planName.trim();
		if (!trimmed) {
			planNameError = 'Plan name is required.';
			return;
		}
		isBusy = true;
		try {
			const created = await duplicatePlanningSheetPlan(planToDuplicate.id, trimmed);
			if (!created) {
				planNameError = 'Could not duplicate this plan.';
				return;
			}
			closeDuplicateDialog();
			await refresh();
			rmiPushToast({ title: 'Plan duplicated', description: created.label });
		} catch (error) {
			planNameError = formatApiErrorMessage(error);
		} finally {
			isBusy = false;
		}
	}

	function openDeleteDialog(row: PlanningSheetPlan) {
		const frozen = frozenMonthsForPlan(row);
		if (frozen.length > 0) {
			const labels = frozen.map((m) => formatMonthLabel(m)).join(', ');
			rmiPushToast({
				title: 'Cannot delete plan',
				description:
					frozen.length === 1
						? `Shop-floor plan for ${labels} is frozen. Unfreeze it first.`
						: `Shop-floor plans for ${labels} are frozen. Unfreeze them first.`
			});
			return;
		}
		planToDelete = row;
		isDeleteDialogOpen = true;
	}

	async function confirmDelete() {
		if (!planToDelete || isBusy) return;
		const label = planToDelete.label;
		const id = planToDelete.id;
		isBusy = true;
		try {
			await deletePlanningSheetPlan(id);
			isDeleteDialogOpen = false;
			planToDelete = null;
			await refresh();
			rmiPushToast({ title: 'Plan deleted', description: label });
		} catch (error) {
			rmiPushToast({
				title: 'Could not delete',
				description: formatApiErrorMessage(error)
			});
		} finally {
			isBusy = false;
		}
	}

	function openPlan(row: PlanningSheetPlan) {
		clearPendingPlanName();
		clearPendingPlanPlantId();
		window.location.hash = `#/${app.appName}/Sheet/${encodeURIComponent(row.id)}`;
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
			key: 'createdAt',
			header: 'Created',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => formatPlanCreatedAt(row.createdAt)
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
		},
		{
			type: 'actions',
			key: 'actions',
			header: 'Actions',
			headerClass: 'text-right',
			class: 'text-right',
			actions: () => [
				{
					label: 'Duplicate',
					icon: Copy,
					variant: 'outline',
					size: 'sm',
					class: rowActionClass,
					onClick: (plan) => openDuplicateDialog(plan)
				},
				{
					type: 'dropdown',
					icon: EllipsisVertical,
					align: 'end',
					ariaLabel: 'More actions',
					items: () => [
						[
							{
								label: 'Delete',
								icon: Trash2,
								onClick: (plan) => openDeleteDialog(plan)
							}
						]
					]
				}
			]
		}
	]);

	onMount(() => {
		const controller = new AbortController();
		void (async () => {
			try {
				defaultPlantId = await resolveDefaultPlanningPlantId(controller.signal);
				await refresh();
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
			toolbarButton={{
				enabled: Boolean(defaultPlantId) && (isLoading || plans.length > 0),
				label: 'New Plan',
				icon: Plus,
				onClick: openNewPlanDialog
			}}
			emptyState={{
				icon: CalendarRange,
				title: 'No plans yet',
				description: 'Create a plan from future delivery schedules, then Save.',
				actionLabel: 'New Plan',
				actionIcon: Plus,
				onAction: openNewPlanDialog
			}}
			pagination={{ pageSize: 10 }}
		/>
	</div>
</div>

<Dialog
	bind:open={isNewPlanDialogOpen}
	title="New Plan"
	hideFooter={true}
	onOpenChange={(open) => {
		if (!open) closeNewPlanDialog();
	}}
	onConfirm={confirmNewPlan}
>
	<div class="space-y-2">
		<Label for="cp-plan-name" text="Plan name" required />
		<Input
			id="cp-plan-name"
			autofocus
			bind:value={planName}
			placeholder="Enter plan name"
			error={Boolean(planNameError)}
			oninput={() => {
				if (planNameError) planNameError = '';
			}}
			onkeydown={(event) => {
				if (event.key === 'Enter') {
					event.preventDefault();
					confirmNewPlan();
				}
			}}
		/>
		{#if planNameError}
			<p class="text-sm text-destructive">{planNameError}</p>
		{/if}
	</div>

	<div class="mt-8 flex w-full items-center justify-end gap-3 border-t border-border pt-6">
		<Button variant="outline" label="Cancel" onclick={closeNewPlanDialog} />
		<Button
			variant="primary"
			label="Continue"
			disabled={!planName.trim()}
			onclick={confirmNewPlan}
		/>
	</div>
</Dialog>

<Dialog
	bind:open={isDuplicateDialogOpen}
	title="Duplicate Plan"
	hideFooter={true}
	onOpenChange={(open) => {
		if (!open) closeDuplicateDialog();
	}}
	onConfirm={() => void confirmDuplicate()}
>
	<div class="space-y-2">
		<Label for="cp-duplicate-plan-name" text="Plan name" required />
		<Input
			id="cp-duplicate-plan-name"
			autofocus
			bind:value={planName}
			placeholder="Enter plan name"
			error={Boolean(planNameError)}
			oninput={() => {
				if (planNameError) planNameError = '';
			}}
			onkeydown={(event) => {
				if (event.key === 'Enter') {
					event.preventDefault();
					void confirmDuplicate();
				}
			}}
		/>
		{#if planNameError}
			<p class="text-sm text-destructive">{planNameError}</p>
		{/if}
	</div>

	<div class="mt-8 flex w-full items-center justify-end gap-3 border-t border-border pt-6">
		<Button variant="outline" label="Cancel" onclick={closeDuplicateDialog} />
		<Button
			variant="primary"
			label={isBusy ? 'Duplicating…' : 'Duplicate'}
			disabled={!planName.trim() || !planToDuplicate || isBusy}
			onclick={() => void confirmDuplicate()}
		/>
	</div>
</Dialog>

<ConfirmationDialog
	bind:open={isDeleteDialogOpen}
	title="Delete plan"
	description={planToDelete
		? `Delete "${planToDelete.label}"? This cannot be undone.`
		: 'Delete this plan? This cannot be undone.'}
	confirmLabel="Delete"
	confirmVariant="danger"
	iconTone="danger"
	onConfirm={() => void confirmDelete()}
/>
