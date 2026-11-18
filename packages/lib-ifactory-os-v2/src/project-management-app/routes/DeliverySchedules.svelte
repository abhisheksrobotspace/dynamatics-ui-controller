<script lang="ts">
	import { onMount } from 'svelte';
	import type { ProjectDeliverySchedule } from '../lib/store.svelte.js';
	import {
		removeDeliveryScheduleBreadcrumb,
		replaceDeliveryScheduleBreadcrumbs,
		upsertDeliveryScheduleBreadcrumb
	} from '../lib/projects/breadcrumb-registry.js';
	import {
		createDeliverySchedule,
		ddMmYyyyToIsoDate,
		deleteDeliverySchedule,
		isDeliveryScheduleEditable,
		listDeliverySchedules,
		updateDeliverySchedule
	} from '../lib/projects/delivery-schedules.api.js';
	import { formatApiErrorMessage } from '../../lib/api/types.js';
	import { pmPushErrorToast, pmPushSuccessToast, pmPushToast } from '../lib/toast.js';
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
		Textarea,
		isValidDdMmYyyy
	} from '@ifactory/ui-v2';
	import { Plus, Trash2, Package, MoreVertical, Pencil } from '@lucide/svelte';

	let { params } = $props();
	const projectId = $derived(params.projectId);
	let isLoading = $state(true);
	let isSaving = $state(false);
	let formError = $state('');
	let schedules = $state<ProjectDeliverySchedule[]>([]);

	async function loadSchedules(signal?: AbortSignal) {
		const rows = await listDeliverySchedules(projectId, signal);
		schedules = rows;
		replaceDeliveryScheduleBreadcrumbs(
			projectId,
			rows.map((schedule) => ({
				id: schedule.id,
				projectId: schedule.projectId,
				name: schedule.name,
				date: schedule.date
			}))
		);
	}

	onMount(() => {
		const controller = new AbortController();
		void (async () => {
			isLoading = true;
			try {
				await loadSchedules(controller.signal);
			} catch (error) {
				if (!controller.signal.aborted) {
					pmPushToast({
						title: 'Failed to load delivery schedules',
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
	let activeSchedule = $state<ProjectDeliverySchedule | null>(null);
	let scheduleName = $state('');
	let scheduleDate = $state('');
	let scheduleDescription = $state('');

	function formatDisplayDate(date: string): string {
		if (/^\d{2}\/\d{2}\/\d{4}$/.test(date)) return date;
		if (/^\d{4}-\d{2}-\d{2}/.test(date)) {
			const [year, month, day] = date.slice(0, 10).split('-');
			if (year && month && day) return `${day}/${month}/${year}`;
		}
		return date;
	}

	function openCreateDialog() {
		scheduleName = '';
		scheduleDate = '';
		scheduleDescription = '';
		formError = '';
		isCreateDialogOpen = true;
	}

	async function handleCreateConfirm() {
		const name = scheduleName.trim();
		const deliveryDateIso = ddMmYyyyToIsoDate(scheduleDate);
		if (!name || !deliveryDateIso || !isValidDdMmYyyy(scheduleDate)) {
			formError = 'Enter a delivery schedule name and a valid plan date.';
			return;
		}

		isSaving = true;
		formError = '';
		try {
			const created = await createDeliverySchedule(
				{
					projectId,
					name,
					deliveryDateIso,
					description: scheduleDescription.trim() || undefined
				},
				schedules.length + 1
			);
			schedules = [...schedules, created];
			upsertDeliveryScheduleBreadcrumb(created);
			isCreateDialogOpen = false;
			pmPushSuccessToast({ title: 'Delivery schedule created' });
			navigateToSchedule(created);
		} catch (error) {
			formError = formatApiErrorMessage(error);
		} finally {
			isSaving = false;
		}
	}

	function openEditDialog(schedule: ProjectDeliverySchedule) {
		if (!isDeliveryScheduleEditable(schedule)) {
			pmPushToast({
				title: 'Delivery schedule is frozen',
				description: 'Frozen delivery schedules cannot be edited.'
			});
			return;
		}
		activeSchedule = schedule;
		scheduleName = schedule.name;
		scheduleDate = formatDisplayDate(schedule.date);
		scheduleDescription = schedule.description ?? '';
		formError = '';
		isEditDialogOpen = true;
	}

	async function handleEditConfirm() {
		if (!activeSchedule) return;

		const name = scheduleName.trim();
		const deliveryDateIso = ddMmYyyyToIsoDate(scheduleDate);
		if (!name || !deliveryDateIso || !isValidDdMmYyyy(scheduleDate)) {
			formError = 'Enter a delivery schedule name and a valid plan date.';
			return;
		}

		isSaving = true;
		formError = '';
		try {
			const updated = await updateDeliverySchedule({
				scheduleId: activeSchedule.id,
				name,
				deliveryDateIso,
				description: scheduleDescription.trim() || null,
				sNo: activeSchedule.sNo
			});
			schedules = schedules.map((schedule) =>
				schedule.id === updated.id ? { ...schedule, ...updated } : schedule
			);
			upsertDeliveryScheduleBreadcrumb(updated);
			isEditDialogOpen = false;
			activeSchedule = null;
			pmPushSuccessToast({ title: 'Delivery schedule updated' });
		} catch (error) {
			formError = formatApiErrorMessage(error);
		} finally {
			isSaving = false;
		}
	}

	function openDeleteDialog(schedule: ProjectDeliverySchedule) {
		if (!isDeliveryScheduleEditable(schedule)) {
			pmPushToast({
				title: 'Delivery schedule is frozen',
				description: 'Frozen delivery schedules cannot be deleted.'
			});
			return;
		}
		activeSchedule = schedule;
		isDeleteDialogOpen = true;
	}

	function navigateToSchedule(schedule: ProjectDeliverySchedule) {
		window.location.hash = `#/ProjectManagement/Home/${projectId}/DeliverySchedule/DeliverySchedules/${schedule.id}`;
	}

	async function handleDeleteConfirm() {
		if (!activeSchedule) return;
		isSaving = true;
		try {
			await deleteDeliverySchedule(activeSchedule.id);
			removeDeliveryScheduleBreadcrumb(activeSchedule.id);
			const remaining = schedules.filter((row) => row.id !== activeSchedule!.id);
			schedules = remaining.map((row, index) => ({ ...row, sNo: index + 1 }));
			isDeleteDialogOpen = false;
			activeSchedule = null;
			pmPushSuccessToast({ title: 'Delivery schedule deleted' });
		} catch (error) {
			pmPushErrorToast({
				title: 'Failed to delete delivery schedule',
				description: formatApiErrorMessage(error)
			});
		} finally {
			isSaving = false;
		}
	}

	const columns: DataTableColumn<ProjectDeliverySchedule>[] = [
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
			type: 'text',
			key: 'description',
			header: 'Description',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => row.description ?? ''
		},
		{
			type: 'actions',
			key: 'actions',
			header: 'Actions',
			headerClass: 'text-right',
			class: 'text-right',
			actions: (row) => {
				if (!isDeliveryScheduleEditable(row)) return [];

				const items: Array<{
					label: string;
					icon: typeof Pencil;
					onClick: (selectedRow: ProjectDeliverySchedule) => void;
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

	const scheduleDialogClass =
		'flex w-full max-h-[min(90dvh,85vh)] flex-col overflow-hidden sm:max-w-lg';
	const scheduleDialogBodyScrollClass =
		'min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 md:px-6';
	const scheduleDialogFooterClass =
		'flex shrink-0 flex-col-reverse gap-3 border-t border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-end md:px-6';
</script>

<div class="flex h-full min-h-0 flex-col overflow-hidden p-4">
	<DataTable
		{columns}
		rows={schedules}
		loading={isLoading}
		rowKey={(row) => row.id}
		onRowClick={(row) => navigateToSchedule(row)}
		search={{
			enabled: true,
			placeholder: 'Search delivery schedules...'
		}}
		toolbarButton={{
			enabled: isLoading || schedules.length > 0,
			label: 'Add Delivery Schedule',
			icon: Plus,
			onClick: openCreateDialog
		}}
		emptyState={{
			icon: Package,
			title: 'No delivery schedules',
			description: 'Get started by adding a named delivery schedule.',
			actionLabel: 'Add Delivery Schedule',
			actionIcon: Plus,
			onAction: openCreateDialog
		}}
		pagination={{ pageSize: 10 }}
	/>
</div>

<Dialog
	bind:open={isCreateDialogOpen}
	title="Add Delivery Schedule"
	hideFooter={true}
	onConfirm={handleCreateConfirm}
	class={scheduleDialogClass}
	headerClass="shrink-0"
	bodyClass="flex min-h-0 flex-1 flex-col overflow-hidden px-0 py-0"
>
	<div class={scheduleDialogBodyScrollClass}>
		{#if formError}
			<Alert variant="error" title="Could not create delivery schedule" description={formError} />
		{/if}
		<div class="space-y-2">
			<Label for="delivery-schedule-name" text="Name" required />
			<Input
				id="delivery-schedule-name"
				autofocus
				bind:value={scheduleName}
				placeholder="e.g. Lot 1 - Site A"
				maxlength={100}
				disabled={isSaving}
			/>
		</div>
		<div class="space-y-2">
			<Label for="delivery-schedule-date" text="Plan Date" required />
			<DateInput id="delivery-schedule-date" bind:value={scheduleDate} disabled={isSaving} />
		</div>
		<div class="space-y-2">
			<Label for="delivery-schedule-description" text="Description" />
			<Textarea
				id="delivery-schedule-description"
				bind:value={scheduleDescription}
				placeholder="Optional description for this delivery"
				rows={3}
				disabled={isSaving}
				class="resize-none"
			/>
		</div>
	</div>
	<div class={scheduleDialogFooterClass}>
		<Button
			class="w-full sm:w-auto"
			variant="outline"
			label="Cancel"
			disabled={isSaving}
			onclick={() => (isCreateDialogOpen = false)}
		/>
		<Button
			class="min-w-48 w-full sm:w-auto"
			variant="primary"
			label={isSaving ? 'Adding...' : 'Add Delivery Schedule'}
			disabled={isSaving}
			onclick={handleCreateConfirm}
		/>
	</div>
</Dialog>

<Dialog
	bind:open={isEditDialogOpen}
	title="Edit Delivery Schedule"
	hideFooter={true}
	onConfirm={handleEditConfirm}
	class={scheduleDialogClass}
	headerClass="shrink-0"
	bodyClass="flex min-h-0 flex-1 flex-col overflow-hidden px-0 py-0"
>
	<div class={scheduleDialogBodyScrollClass}>
		{#if formError}
			<Alert variant="error" title="Could not update delivery schedule" description={formError} />
		{/if}
		<div class="space-y-2">
			<Label for="edit-schedule-name" text="Name" required />
			<Input
				id="edit-schedule-name"
				autofocus
				bind:value={scheduleName}
				placeholder="e.g. Lot 1 - Site A"
				maxlength={100}
				disabled={isSaving}
			/>
		</div>
		<div class="space-y-2">
			<Label for="edit-schedule-date" text="Plan Date" required />
			<DateInput id="edit-schedule-date" bind:value={scheduleDate} disabled={isSaving} />
		</div>
		<div class="space-y-2">
			<Label for="edit-schedule-description" text="Description" />
			<Textarea
				id="edit-schedule-description"
				bind:value={scheduleDescription}
				placeholder="Optional description for this delivery"
				rows={3}
				disabled={isSaving}
				class="resize-none"
			/>
		</div>
	</div>
	<div class={scheduleDialogFooterClass}>
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
	title="Delete Delivery Schedule"
	description="Are you sure you want to delete delivery schedule '{activeSchedule?.name ??
		(activeSchedule
			? formatDisplayDate(activeSchedule.date)
			: 'this schedule')}'? This action cannot be undone."
	confirmLabel={isSaving ? 'Deleting...' : 'Delete'}
	confirmVariant="danger"
	iconTone="danger"
	onConfirm={handleDeleteConfirm}
/>
