<script lang="ts">
	import { onMount } from 'svelte';
	import {
		Alert,
		Button,
		ConfirmationDialog,
		DataTable,
		Dialog,
		Input,
		Label,
		type DataTableColumn
	} from '@ifactory/ui-v2';
	import { EllipsisVertical, Factory, Pencil, Plus, Trash2 } from '@lucide/svelte';
	import { createPlant, deletePlant, listPlants, updatePlant } from '../lib/plants.api.js';
	import { isAbortError } from '../lib/errors.js';
	import { formatApiErrorMessage } from '../../lib/api/types.js';
	import { pushErrorToast, pushSuccessToast } from '../lib/toast.js';
	import type { Plant } from '../lib/types.js';

	const dialogClass = 'flex w-full max-h-[min(90dvh,85vh)] flex-col overflow-hidden sm:max-w-lg';
	const dialogBodyClass = 'min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 md:px-6';
	const dialogFooterClass =
		'flex shrink-0 flex-col-reverse gap-3 border-t border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-end md:px-6';

	let rows = $state.raw<Plant[]>([]);
	let loading = $state(true);
	let errorMessage = $state<string | null>(null);
	let formError = $state('');
	let isSaving = $state(false);
	let isDeleting = $state(false);

	let isAddOpen = $state(false);
	let isEditOpen = $state(false);
	let isDeleteOpen = $state(false);
	let activePlant = $state<Plant | null>(null);

	let plantId = $state('');
	let name = $state('');
	let capacityMt = $state('');
	let maxLoading = $state('');

	const columns: DataTableColumn<Plant>[] = [
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
			key: 'plant_id',
			header: 'Plant ID',
			sortable: true,
			dataType: 'string',
			value: (row) => row.plant_id
		},
		{
			type: 'text',
			key: 'name',
			header: 'Name',
			sortable: true,
			dataType: 'string',
			value: (row) => row.name
		},
		{
			type: 'text',
			key: 'monthly_capacity_mt',
			header: 'Capacity (MT)',
			sortable: true,
			dataType: 'number',
			value: (row) => {
				const value = row.monthly_capacity_mt;
				if (value == null || value === '') return '-';
				const parsed = Number(value);
				return Number.isFinite(parsed) && parsed >= 0 ? String(parsed) : '-';
			}
		},
		{
			type: 'text',
			key: 'max_loading_pct',
			header: 'Max loading (%)',
			sortable: true,
			dataType: 'number',
			value: (row) => {
				const value = row.max_loading_pct;
				if (value == null || value === '') return '-';
				const parsed = Number(value);
				return Number.isFinite(parsed) && parsed > 0 ? String(parsed) : '-';
			}
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
					icon: EllipsisVertical,
					align: 'end',
					ariaLabel: 'More actions',
					items: () => [
						[
							{
								label: 'Edit',
								icon: Pencil,
								onClick: (row) => openEdit(row)
							},
							{
								label: 'Delete',
								icon: Trash2,
								onClick: (row) => openDelete(row)
							}
						]
					]
				}
			]
		}
	];

	function parseCapacity(value: string): number | null {
		const trimmed = value.trim();
		if (!trimmed) return null;
		const parsed = Number(trimmed);
		if (!Number.isFinite(parsed) || parsed < 0) {
			throw new Error('Capacity (MT) must be a non-negative number.');
		}
		return parsed;
	}

	function parseMaxLoading(value: string): number {
		const trimmed = value.trim();
		if (!trimmed) {
			throw new Error('Max loading is required.');
		}
		const parsed = Number(trimmed);
		if (!Number.isFinite(parsed) || parsed <= 0) {
			throw new Error('Max loading must be a positive number.');
		}
		return parsed;
	}

	function resetForm() {
		plantId = '';
		name = '';
		capacityMt = '';
		maxLoading = '';
		formError = '';
	}

	function openAdd() {
		resetForm();
		isAddOpen = true;
	}

	function formatRowNumeric(value: string | number | null | undefined, allowZero: boolean): string {
		if (value == null || value === '') return '';
		const parsed = Number(value);
		if (!Number.isFinite(parsed)) return '';
		if (allowZero ? parsed >= 0 : parsed > 0) return String(parsed);
		return '';
	}

	function openEdit(row: Plant) {
		activePlant = row;
		plantId = row.plant_id;
		name = row.name;
		capacityMt = formatRowNumeric(row.monthly_capacity_mt, true);
		maxLoading = formatRowNumeric(row.max_loading_pct, false);
		formError = '';
		isEditOpen = true;
	}

	function openDelete(row: Plant) {
		activePlant = row;
		isDeleteOpen = true;
	}

	async function handleAddConfirm() {
		if (!plantId.trim() || !name.trim()) {
			formError = 'Please fill in all required fields.';
			return;
		}
		isSaving = true;
		formError = '';
		try {
			const created = await createPlant({
				plant_id: plantId.trim(),
				name: name.trim(),
				capacityMt: parseCapacity(capacityMt),
				maxLoading: parseMaxLoading(maxLoading)
			});
			rows = [...rows, created].sort((a, b) => a.plant_id.localeCompare(b.plant_id));
			isAddOpen = false;
			resetForm();
			pushSuccessToast({ title: 'Plant created.' });
		} catch (error) {
			formError = formatApiErrorMessage(error);
		} finally {
			isSaving = false;
		}
	}

	async function handleEditConfirm() {
		if (!activePlant) return;
		if (!name.trim()) {
			formError = 'Please fill in all required fields.';
			return;
		}
		isSaving = true;
		formError = '';
		try {
			const updated = await updatePlant(activePlant.plant_id, {
				name: name.trim(),
				capacityMt: parseCapacity(capacityMt),
				maxLoading: parseMaxLoading(maxLoading)
			});
			rows = rows.map((row) => (row.plant_id === updated.plant_id ? updated : row));
			isEditOpen = false;
			activePlant = null;
			resetForm();
			pushSuccessToast({ title: 'Plant updated.' });
		} catch (error) {
			formError = formatApiErrorMessage(error);
		} finally {
			isSaving = false;
		}
	}

	async function handleDeleteConfirm() {
		if (!activePlant || isDeleting) return;
		isDeleting = true;
		try {
			await deletePlant(activePlant.plant_id);
			rows = rows.filter((row) => row.plant_id !== activePlant?.plant_id);
			pushSuccessToast({ title: 'Plant deleted.' });
			isDeleteOpen = false;
			activePlant = null;
		} catch (error) {
			if (isAbortError(error)) return;
			pushErrorToast({
				title: 'Could not delete plant',
				description: formatApiErrorMessage(error)
			});
		} finally {
			isDeleting = false;
		}
	}

	onMount(() => {
		const controller = new AbortController();
		void (async () => {
			loading = true;
			errorMessage = null;
			try {
				rows = await listPlants(controller.signal);
			} catch (error) {
				if (isAbortError(error)) return;
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
			<Alert variant="error" title="Could not load plants" description={errorMessage} />
		</div>
	{/if}

	<DataTable
		{columns}
		{rows}
		{loading}
		rowKey={(row) => row.plant_id}
		search={{ enabled: true, placeholder: 'Search plants' }}
		toolbarButton={[
			{
				enabled: true,
				label: 'Add Plant',
				icon: Plus,
				onClick: openAdd
			}
		]}
		emptyState={{
			icon: Factory,
			title: 'No plants yet',
			description: 'Add a plant to start defining locations and transfer times',
			actionLabel: 'Add Plant',
			actionIcon: Plus,
			onAction: openAdd
		}}
		pagination={{ enabled: rows.length > 0 }}
	/>
</div>

<Dialog
	bind:open={isAddOpen}
	title="Add Plant"
	hideFooter={true}
	onConfirm={handleAddConfirm}
	class={dialogClass}
	headerClass="shrink-0"
	bodyClass="flex min-h-0 flex-1 flex-col overflow-hidden px-0 py-0"
>
	<div class={dialogBodyClass}>
		{#if formError}
			<Alert variant="error" title="Could not create plant" description={formError} />
		{/if}
		<div class="space-y-2">
			<Label for="add-plant-id" text="Plant ID" required />
			<Input id="add-plant-id" autofocus bind:value={plantId} placeholder="e.g. PLT-PUNE" />
		</div>
		<div class="space-y-2">
			<Label for="add-plant-name" text="Name" required />
			<Input id="add-plant-name" bind:value={name} placeholder="Plant name" />
		</div>
		<div class="space-y-2">
			<Label for="add-plant-capacity" text="Capacity (MT)" />
			<Input
				id="add-plant-capacity"
				bind:value={capacityMt}
				placeholder="e.g. 1200"
				inputmode="decimal"
			/>
		</div>
		<div class="space-y-2">
			<Label for="add-plant-max-loading" text="Max loading (%)" required />
			<Input
				id="add-plant-max-loading"
				bind:value={maxLoading}
				placeholder="e.g. 125"
				inputmode="decimal"
			/>
		</div>
	</div>
	<div class={dialogFooterClass}>
		<Button variant="outline" label="Cancel" onclick={() => (isAddOpen = false)} />
		<Button
			variant="primary"
			label={isSaving ? 'Saving...' : 'Save'}
			disabled={isSaving}
			onclick={handleAddConfirm}
			class="min-w-24"
		/>
	</div>
</Dialog>

<Dialog
	bind:open={isEditOpen}
	title="Edit Plant"
	hideFooter={true}
	onConfirm={handleEditConfirm}
	class={dialogClass}
	headerClass="shrink-0"
	bodyClass="flex min-h-0 flex-1 flex-col overflow-hidden px-0 py-0"
>
	<div class={dialogBodyClass}>
		{#if formError}
			<Alert variant="error" title="Could not update plant" description={formError} />
		{/if}
		<div class="space-y-2">
			<Label for="edit-plant-id" text="Plant ID" />
			<Input id="edit-plant-id" value={plantId} disabled />
		</div>
		<div class="space-y-2">
			<Label for="edit-plant-name" text="Name" required />
			<Input id="edit-plant-name" autofocus bind:value={name} placeholder="Plant name" />
		</div>
		<div class="space-y-2">
			<Label for="edit-plant-capacity" text="Capacity (MT)" />
			<Input
				id="edit-plant-capacity"
				bind:value={capacityMt}
				placeholder="e.g. 1200"
				inputmode="decimal"
			/>
		</div>
		<div class="space-y-2">
			<Label for="edit-plant-max-loading" text="Max loading (%)" required />
			<Input
				id="edit-plant-max-loading"
				bind:value={maxLoading}
				placeholder="e.g. 125"
				inputmode="decimal"
			/>
		</div>
	</div>
	<div class={dialogFooterClass}>
		<Button variant="outline" label="Cancel" onclick={() => (isEditOpen = false)} />
		<Button
			variant="primary"
			label={isSaving ? 'Saving...' : 'Save'}
			disabled={isSaving}
			onclick={handleEditConfirm}
			class="min-w-24"
		/>
	</div>
</Dialog>

<ConfirmationDialog
	bind:open={isDeleteOpen}
	title="Delete Plant"
	description="Are you sure you want to delete plant '{activePlant?.name}'? Locations linked to this plant may be affected."
	confirmLabel={isDeleting ? 'Deleting...' : 'Delete'}
	confirmVariant="danger"
	iconTone="danger"
	onConfirm={handleDeleteConfirm}
/>
