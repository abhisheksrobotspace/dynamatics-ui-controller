<script lang="ts">
	import { onMount } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import type { ProjectProductionPlan } from '../lib/store.svelte';
	import {
		removeProductionPlanBreadcrumb,
		replaceProductionPlanBreadcrumbs,
		upsertProductionPlanBreadcrumb
	} from '../lib/projects/breadcrumb-registry.js';
	import {
		createProductionPlan,
		ddMmYyyyToIsoDate,
		deleteProductionPlan,
		listLinkedProductionPlanIds,
		listProductionPlans,
		updateProductionPlan
	} from '../lib/projects/production-plans.api.js';
	import { formatApiErrorMessage } from '../../lib/api/types.js';
	import { pmPushErrorToast, pmPushSuccessToast, pmPushToast } from '../lib/toast';
	import {
		Alert,
		Button,
		DataTable,
		type DataTableColumn,
		Dialog,
		ConfirmationDialog,
		DateInput,
		Input,
		Label,
		isValidDdMmYyyy
	} from '@ifactory/ui-v2';
	import { Plus, Trash2, Package, MoreVertical, Pencil } from '@lucide/svelte';

	let { params } = $props();
	const projectId = $derived(params.projectId);
	let isLoading = $state(true);
	let isSaving = $state(false);
	let formError = $state('');
	let productionPlans = $state<ProjectProductionPlan[]>([]);
	let linkedProductionPlanIds = new SvelteSet<string>();

	async function loadPlans(signal?: AbortSignal) {
		const [rows, linkedIds] = await Promise.all([
			listProductionPlans(projectId, signal),
			listLinkedProductionPlanIds(projectId, signal)
		]);
		productionPlans = rows;
		linkedProductionPlanIds.clear();
		for (const id of linkedIds) linkedProductionPlanIds.add(id);
		replaceProductionPlanBreadcrumbs(
			projectId,
			rows.map((plan) => ({
				id: plan.id,
				projectId: plan.projectId,
				name: plan.name
			}))
		);
	}

	onMount(() => {
		const controller = new AbortController();
		void (async () => {
			isLoading = true;
			try {
				await loadPlans(controller.signal);
			} catch (error) {
				if (!controller.signal.aborted) {
					pmPushToast({
						title: 'Failed to load production plans',
						description: formatApiErrorMessage(error)
					});
				}
			} finally {
				if (!controller.signal.aborted) isLoading = false;
			}
		})();
		return () => controller.abort();
	});

	let isCreateDialogOpen = $state(false);
	let isEditDialogOpen = $state(false);
	let isDeleteDialogOpen = $state(false);
	let activePlan = $state<ProjectProductionPlan | null>(null);
	let planName = $state('');
	let planDate = $state('');

	function formatDisplayDate(date: string): string {
		if (/^\d{2}\/\d{2}\/\d{4}$/.test(date)) return date;
		if (/^\d{4}-\d{2}-\d{2}/.test(date)) {
			const [year, month, day] = date.slice(0, 10).split('-');
			if (year && month && day) return `${day}/${month}/${year}`;
		}
		return date;
	}

	function openCreateDialog() {
		planName = '';
		planDate = '';
		formError = '';
		isCreateDialogOpen = true;
	}

	async function handleCreateConfirm() {
		const name = planName.trim();
		const planDateIso = ddMmYyyyToIsoDate(planDate);
		if (!name || !planDateIso || !isValidDdMmYyyy(planDate)) {
			formError = 'Enter a production plan name and a valid plan date.';
			return;
		}

		isSaving = true;
		formError = '';
		try {
			const created = await createProductionPlan(
				{
					projectId,
					name,
					planDateIso
				},
				productionPlans.length + 1
			);
			productionPlans = [...productionPlans, created];
			upsertProductionPlanBreadcrumb(created);
			isCreateDialogOpen = false;
			pmPushSuccessToast({ title: 'Production plan created' });
			navigateToPlan(created);
		} catch (error) {
			formError = formatApiErrorMessage(error);
		} finally {
			isSaving = false;
		}
	}

	function openEditDialog(plan: ProjectProductionPlan) {
		activePlan = plan;
		planName = plan.name;
		planDate = formatDisplayDate(plan.date);
		formError = '';
		isEditDialogOpen = true;
	}

	async function handleEditConfirm() {
		if (!activePlan) return;

		const name = planName.trim();
		const planDateIso = ddMmYyyyToIsoDate(planDate);
		if (!name || !planDateIso || !isValidDdMmYyyy(planDate)) {
			formError = 'Enter a production plan name and a valid plan date.';
			return;
		}

		isSaving = true;
		formError = '';
		try {
			const updated = await updateProductionPlan({
				planId: activePlan.id,
				name,
				planDateIso,
				sNo: activePlan.sNo
			});
			productionPlans = productionPlans.map((plan) =>
				plan.id === updated.id ? { ...plan, ...updated } : plan
			);
			upsertProductionPlanBreadcrumb(updated);
			isEditDialogOpen = false;
			activePlan = null;
			pmPushSuccessToast({ title: 'Production plan updated' });
		} catch (error) {
			formError = formatApiErrorMessage(error);
		} finally {
			isSaving = false;
		}
	}

	function openDeleteDialog(plan: ProjectProductionPlan) {
		if (linkedProductionPlanIds.has(plan.id)) {
			pmPushToast({
				title: 'Cannot delete',
				description: 'Remove this production plan from its manufacturing plan first.'
			});
			return;
		}
		activePlan = plan;
		isDeleteDialogOpen = true;
	}

	function navigateToPlan(plan: ProjectProductionPlan) {
		window.location.hash = `#/ProjectManagement/Home/${projectId}/ProductionPlans/${plan.id}`;
	}

	async function handleDeleteConfirm() {
		if (!activePlan) return;
		isSaving = true;
		try {
			await deleteProductionPlan(activePlan.id);
			removeProductionPlanBreadcrumb(activePlan.id);
			const remaining = productionPlans.filter((plan) => plan.id !== activePlan!.id);
			productionPlans = remaining.map((plan, index) => ({ ...plan, sNo: index + 1 }));
			isDeleteDialogOpen = false;
			activePlan = null;
			pmPushSuccessToast({ title: 'Production plan deleted' });
		} catch (error) {
			pmPushErrorToast({
				title: 'Failed to delete production plan',
				description: formatApiErrorMessage(error)
			});
		} finally {
			isSaving = false;
		}
	}

	const columns: DataTableColumn<ProjectProductionPlan>[] = [
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
			type: 'text',
			key: 'name',
			header: 'Name',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => row.name
		},
		{
			type: 'text',
			key: 'date',
			header: 'Plan Date',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => formatDisplayDate(row.date)
		},
		{
			type: 'actions',
			key: 'actions',
			header: 'Actions',
			headerClass: 'text-right',
			class: 'text-right',
			actions: () => {
				const items: Array<{
					label: string;
					icon: typeof Pencil;
					onClick: (selectedRow: ProjectProductionPlan) => void;
				}> = [
					{
						label: 'Edit',
						icon: Pencil,
						onClick: (selectedRow) => openEditDialog(selectedRow)
					},
					{
						label: 'Delete',
						icon: Trash2,
						onClick: (selectedRow) => openDeleteDialog(selectedRow)
					}
				];
				return [
					{
						type: 'dropdown' as const,
						icon: MoreVertical,
						align: 'end' as const,
						ariaLabel: 'More actions',
						items: () => [items]
					}
				];
			}
		}
	];

	const planDialogClass =
		'flex w-full max-h-[min(90dvh,85vh)] flex-col overflow-hidden sm:max-w-lg';
	const planDialogBodyScrollClass = 'min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 md:px-6';
	const planDialogFooterClass =
		'flex shrink-0 flex-col-reverse gap-3 border-t border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-end md:px-6';
</script>

<div class="flex h-full min-h-0 flex-col overflow-hidden p-4">
	<DataTable
		{columns}
		rows={productionPlans}
		loading={isLoading}
		rowKey={(row) => row.id}
		onRowClick={(row) => navigateToPlan(row)}
		search={{
			enabled: true,
			placeholder: 'Search production plans...'
		}}
		toolbarButton={{
			enabled: isLoading || productionPlans.length > 0,
			label: 'Add Production Plan',
			icon: Plus,
			onClick: openCreateDialog
		}}
		emptyState={{
			icon: Package,
			title: 'No production plans',
			description: 'Get started by creating a new production plan.',
			actionLabel: 'Add Production Plan',
			actionIcon: Plus,
			onAction: openCreateDialog
		}}
		pagination={{ pageSize: 10 }}
	/>
</div>

<Dialog
	bind:open={isCreateDialogOpen}
	title="Add Production Plan"
	hideFooter={true}
	onConfirm={handleCreateConfirm}
	class={planDialogClass}
	headerClass="shrink-0"
	bodyClass="flex min-h-0 flex-1 flex-col overflow-hidden px-0 py-0"
>
	<div class={planDialogBodyScrollClass}>
		{#if formError}
			<Alert variant="error" title="Could not create production plan" description={formError} />
		{/if}
		<div class="space-y-2">
			<Label for="production-plan-name" text="Name" required />
			<Input
				id="production-plan-name"
				autofocus
				bind:value={planName}
				placeholder="e.g. Q3 production batch"
				disabled={isSaving}
			/>
		</div>
		<div class="space-y-2">
			<Label for="production-plan-date" text="Plan Date" required />
			<DateInput id="production-plan-date" bind:value={planDate} />
		</div>
	</div>
	<div class={planDialogFooterClass}>
		<Button
			class="w-full sm:w-auto"
			variant="outline"
			label="Cancel"
			disabled={isSaving}
			onclick={() => (isCreateDialogOpen = false)}
		/>
		<Button
			class="min-w-44 w-full sm:w-auto"
			variant="primary"
			label={isSaving ? 'Adding...' : 'Add Production Plan'}
			disabled={isSaving}
			onclick={handleCreateConfirm}
		/>
	</div>
</Dialog>

<Dialog
	bind:open={isEditDialogOpen}
	title="Edit Production Plan"
	hideFooter={true}
	onConfirm={handleEditConfirm}
	class={planDialogClass}
	headerClass="shrink-0"
	bodyClass="flex min-h-0 flex-1 flex-col overflow-hidden px-0 py-0"
>
	<div class={planDialogBodyScrollClass}>
		{#if formError}
			<Alert variant="error" title="Could not update production plan" description={formError} />
		{/if}
		<div class="space-y-2">
			<Label for="edit-production-plan-name" text="Name" required />
			<Input
				id="edit-production-plan-name"
				autofocus
				bind:value={planName}
				placeholder="e.g. Q3 production batch"
				disabled={isSaving}
			/>
		</div>
		<div class="space-y-2">
			<Label for="edit-production-plan-date" text="Plan Date" required />
			<DateInput id="edit-production-plan-date" bind:value={planDate} />
		</div>
	</div>
	<div class={planDialogFooterClass}>
		<Button
			class="w-full sm:w-auto"
			variant="outline"
			label="Cancel"
			disabled={isSaving}
			onclick={() => (isEditDialogOpen = false)}
		/>
		<Button
			class="min-w-32 w-full sm:w-auto"
			variant="primary"
			label={isSaving ? 'Saving...' : 'Save Changes'}
			disabled={isSaving}
			onclick={handleEditConfirm}
		/>
	</div>
</Dialog>

<ConfirmationDialog
	bind:open={isDeleteDialogOpen}
	title="Delete Production Plan"
	description="Are you sure you want to delete production plan '{activePlan?.name}'? This action cannot be undone."
	confirmLabel={isSaving ? 'Deleting...' : 'Delete'}
	confirmVariant="danger"
	iconTone="danger"
	onConfirm={handleDeleteConfirm}
/>
