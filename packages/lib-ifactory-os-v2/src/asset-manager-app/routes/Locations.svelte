<script lang="ts">
	import { onMount } from 'svelte';
	import {
		Alert,
		Button,
		Combobox,
		ConfirmationDialog,
		DataTable,
		Dialog,
		Input,
		Label,
		type ComboboxItem,
		type DataTableColumn
	} from '@ifactory/ui-v2';
	import { EllipsisVertical, MapPin, Pencil, Plus, Trash2 } from '@lucide/svelte';
	import {
		createLocation,
		deleteLocation,
		listLocations,
		updateLocation
	} from '../lib/locations.api.js';
	import { listPlants } from '../lib/plants.api.js';
	import { isAbortError } from '../lib/errors.js';
	import { formatApiErrorMessage } from '../../lib/api/types.js';
	import { pushErrorToast, pushSuccessToast } from '../lib/toast.js';
	import type { Location } from '../lib/types.js';

	const dialogClass = 'flex w-full max-h-[min(90dvh,85vh)] flex-col overflow-hidden sm:max-w-lg';
	const dialogBodyClass = 'min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 md:px-6';
	const dialogFooterClass =
		'flex shrink-0 flex-col-reverse gap-3 border-t border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-end md:px-6';

	type LocationRow = Location & {
		plantName: string;
		typeLabel: string;
	};

	let rows = $state.raw<LocationRow[]>([]);
	let plantItems = $state.raw<ComboboxItem[]>([]);
	let plantNameById = $state.raw(new Map<string, string>());
	let loading = $state(true);
	let errorMessage = $state<string | null>(null);
	let formError = $state('');
	let isSaving = $state(false);
	let isDeleting = $state(false);

	let isAddOpen = $state(false);
	let isEditOpen = $state(false);
	let isDeleteOpen = $state(false);
	let activeLocation = $state<LocationRow | null>(null);

	let locationId = $state('');
	let plantId = $state('');
	let name = $state('');
	let locationType = $state('');

	const columns: DataTableColumn<LocationRow>[] = [
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
			key: 'location_id',
			header: 'Location ID',
			sortable: true,
			dataType: 'string',
			value: (row) => row.location_id
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
			key: 'plantName',
			header: 'Plant',
			sortable: true,
			dataType: 'string',
			value: (row) => row.plantName
		},
		{
			type: 'text',
			key: 'typeLabel',
			header: 'Type',
			sortable: true,
			dataType: 'string',
			value: (row) => row.typeLabel
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

	function toRow(location: Location): LocationRow {
		return {
			...location,
			plantName: plantNameById.get(location.plant_id) ?? location.plant_id,
			typeLabel: location.location_type?.trim() || '-'
		};
	}

	function resetForm() {
		locationId = '';
		plantId = '';
		name = '';
		locationType = '';
		formError = '';
	}

	function openAdd() {
		resetForm();
		isAddOpen = true;
	}

	function openEdit(row: LocationRow) {
		activeLocation = row;
		locationId = row.location_id;
		plantId = row.plant_id;
		name = row.name;
		locationType = row.location_type ?? '';
		formError = '';
		isEditOpen = true;
	}

	function openDelete(row: LocationRow) {
		activeLocation = row;
		isDeleteOpen = true;
	}

	async function handleAddConfirm() {
		if (!locationId.trim() || !plantId.trim() || !name.trim()) {
			formError = 'Please fill in all required fields.';
			return;
		}
		isSaving = true;
		formError = '';
		try {
			const created = await createLocation({
				location_id: locationId.trim(),
				plant_id: plantId.trim(),
				name: name.trim(),
				location_type: locationType.trim() || null
			});
			rows = [...rows, toRow(created)].sort((a, b) => a.location_id.localeCompare(b.location_id));
			isAddOpen = false;
			resetForm();
			pushSuccessToast({ title: 'Location created.' });
		} catch (error) {
			formError = formatApiErrorMessage(error);
		} finally {
			isSaving = false;
		}
	}

	async function handleEditConfirm() {
		if (!activeLocation) return;
		if (!plantId.trim() || !name.trim()) {
			formError = 'Please fill in all required fields.';
			return;
		}
		isSaving = true;
		formError = '';
		try {
			const updated = await updateLocation(activeLocation.location_id, {
				plant_id: plantId.trim(),
				name: name.trim(),
				location_type: locationType.trim() || null
			});
			rows = rows.map((row) => (row.location_id === updated.location_id ? toRow(updated) : row));
			isEditOpen = false;
			activeLocation = null;
			resetForm();
			pushSuccessToast({ title: 'Location updated.' });
		} catch (error) {
			formError = formatApiErrorMessage(error);
		} finally {
			isSaving = false;
		}
	}

	async function handleDeleteConfirm() {
		if (!activeLocation || isDeleting) return;
		isDeleting = true;
		try {
			await deleteLocation(activeLocation.location_id);
			rows = rows.filter((row) => row.location_id !== activeLocation?.location_id);
			pushSuccessToast({ title: 'Location deleted.' });
			isDeleteOpen = false;
			activeLocation = null;
		} catch (error) {
			if (isAbortError(error)) return;
			pushErrorToast({
				title: 'Could not delete location',
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
				const [locations, plants] = await Promise.all([
					listLocations(controller.signal),
					listPlants(controller.signal)
				]);
				plantNameById = new Map(plants.map((plant) => [plant.plant_id, plant.name]));
				plantItems = plants.map((plant) => ({
					value: plant.plant_id,
					label: `${plant.name} (${plant.plant_id})`
				}));
				rows = locations.map(toRow);
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
			<Alert variant="error" title="Could not load locations" description={errorMessage} />
		</div>
	{/if}

	<DataTable
		{columns}
		{rows}
		{loading}
		rowKey={(row) => row.location_id}
		search={{ enabled: true, placeholder: 'Search locations' }}
		toolbarButton={[
			{
				enabled: true,
				label: 'Add Location',
				icon: Plus,
				onClick: openAdd
			}
		]}
		emptyState={{
			icon: MapPin,
			title: 'No locations yet',
			description: 'Add a location under a plant to define transfer times',
			actionLabel: 'Add Location',
			actionIcon: Plus,
			onAction: openAdd
		}}
		pagination={{ enabled: rows.length > 0 }}
	/>
</div>

<Dialog
	bind:open={isAddOpen}
	title="Add Location"
	hideFooter={true}
	onConfirm={handleAddConfirm}
	class={dialogClass}
	headerClass="shrink-0"
	bodyClass="flex min-h-0 flex-1 flex-col overflow-hidden px-0 py-0"
>
	<div class={dialogBodyClass}>
		{#if formError}
			<Alert variant="error" title="Could not create location" description={formError} />
		{/if}
		<div class="space-y-2">
			<Label for="add-location-id" text="Location ID" required />
			<Input id="add-location-id" autofocus bind:value={locationId} placeholder="e.g. LOC-WH-01" />
		</div>
		<div class="space-y-2">
			<Label for="add-location-plant" text="Plant" required />
			<Combobox
				id="add-location-plant"
				placeholder={plantItems.length === 0 ? 'No plants available' : 'Select plant'}
				items={plantItems}
				bind:value={plantId}
				disabled={plantItems.length === 0}
			/>
		</div>
		<div class="space-y-2">
			<Label for="add-location-name" text="Name" required />
			<Input id="add-location-name" bind:value={name} placeholder="Location name" />
		</div>
		<div class="space-y-2">
			<Label for="add-location-type" text="Type" />
			<Input
				id="add-location-type"
				bind:value={locationType}
				placeholder="e.g. warehouse, line, staging"
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
	title="Edit Location"
	hideFooter={true}
	onConfirm={handleEditConfirm}
	class={dialogClass}
	headerClass="shrink-0"
	bodyClass="flex min-h-0 flex-1 flex-col overflow-hidden px-0 py-0"
>
	<div class={dialogBodyClass}>
		{#if formError}
			<Alert variant="error" title="Could not update location" description={formError} />
		{/if}
		<div class="space-y-2">
			<Label for="edit-location-id" text="Location ID" />
			<Input id="edit-location-id" value={locationId} disabled />
		</div>
		<div class="space-y-2">
			<Label for="edit-location-plant" text="Plant" required />
			<Combobox
				id="edit-location-plant"
				placeholder={plantItems.length === 0 ? 'No plants available' : 'Select plant'}
				items={plantItems}
				bind:value={plantId}
				disabled={plantItems.length === 0}
			/>
		</div>
		<div class="space-y-2">
			<Label for="edit-location-name" text="Name" required />
			<Input id="edit-location-name" autofocus bind:value={name} placeholder="Location name" />
		</div>
		<div class="space-y-2">
			<Label for="edit-location-type" text="Type" />
			<Input
				id="edit-location-type"
				bind:value={locationType}
				placeholder="e.g. warehouse, line, staging"
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
	title="Delete Location"
	description="Are you sure you want to delete location '{activeLocation?.name}'?"
	confirmLabel={isDeleting ? 'Deleting...' : 'Delete'}
	confirmVariant="danger"
	iconTone="danger"
	onConfirm={handleDeleteConfirm}
/>
