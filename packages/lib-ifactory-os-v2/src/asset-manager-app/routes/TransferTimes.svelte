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
	import { EllipsisVertical, Pencil, Plus, Timer, Trash2 } from '@lucide/svelte';
	import { listLocations } from '../lib/locations.api.js';
	import {
		createTransferTime,
		deleteTransferTime,
		listTransferTimes,
		updateTransferTime
	} from '../lib/transfer-times.api.js';
	import { isAbortError } from '../lib/errors.js';
	import { formatApiErrorMessage } from '../../lib/api/types.js';
	import { pushErrorToast, pushSuccessToast } from '../lib/toast.js';
	import type { TransferTime } from '../lib/types.js';

	const dialogClass = 'flex w-full max-h-[min(90dvh,85vh)] flex-col overflow-hidden sm:max-w-lg';
	const dialogBodyClass = 'min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 md:px-6';
	const dialogFooterClass =
		'flex shrink-0 flex-col-reverse gap-3 border-t border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-end md:px-6';

	type TransferRow = TransferTime & {
		fromLabel: string;
		toLabel: string;
	};

	let rows = $state.raw<TransferRow[]>([]);
	let locationItems = $state.raw<ComboboxItem[]>([]);
	let locationLabelById = $state.raw(new Map<string, string>());
	let loading = $state(true);
	let errorMessage = $state<string | null>(null);
	let formError = $state('');
	let isSaving = $state(false);
	let isDeleting = $state(false);

	let isAddOpen = $state(false);
	let isEditOpen = $state(false);
	let isDeleteOpen = $state(false);
	let activeTransfer = $state<TransferRow | null>(null);

	let fromLocationId = $state('');
	let toLocationId = $state('');
	let transferMinutes = $state('0');

	const columns: DataTableColumn<TransferRow>[] = [
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
			key: 'fromLabel',
			header: 'From',
			sortable: true,
			dataType: 'string',
			value: (row) => row.fromLabel
		},
		{
			type: 'text',
			key: 'toLabel',
			header: 'To',
			sortable: true,
			dataType: 'string',
			value: (row) => row.toLabel
		},
		{
			type: 'text',
			key: 'transfer_minutes',
			header: 'Minutes',
			sortable: true,
			dataType: 'number',
			value: (row) => String(row.transfer_minutes)
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

	function toRow(transfer: TransferTime): TransferRow {
		return {
			...transfer,
			fromLabel: locationLabelById.get(transfer.from_location_id) ?? transfer.from_location_id,
			toLabel: locationLabelById.get(transfer.to_location_id) ?? transfer.to_location_id
		};
	}

	async function reloadTransfers(signal?: AbortSignal) {
		const transfers = await listTransferTimes(signal);
		rows = transfers.map(toRow);
	}

	function resetForm() {
		fromLocationId = '';
		toLocationId = '';
		transferMinutes = '0';
		formError = '';
	}

	function openAdd() {
		resetForm();
		isAddOpen = true;
	}

	function openEdit(row: TransferRow) {
		activeTransfer = row;
		fromLocationId = row.from_location_id;
		toLocationId = row.to_location_id;
		transferMinutes = String(row.transfer_minutes);
		formError = '';
		isEditOpen = true;
	}

	function openDelete(row: TransferRow) {
		activeTransfer = row;
		isDeleteOpen = true;
	}

	function validateForm(): boolean {
		const minutes = Number(transferMinutes);
		if (!fromLocationId.trim() || !toLocationId.trim()) {
			formError = 'Please fill in all required fields.';
			return false;
		}
		if (!Number.isFinite(minutes) || minutes < 0) {
			formError = 'Transfer minutes must be zero or greater.';
			return false;
		}
		if (fromLocationId.trim() === toLocationId.trim()) {
			formError = 'From and to locations must be different.';
			return false;
		}
		return true;
	}

	async function handleAddConfirm() {
		if (!validateForm()) return;
		isSaving = true;
		formError = '';
		try {
			await createTransferTime({
				from_location_id: fromLocationId.trim(),
				to_location_id: toLocationId.trim(),
				transfer_minutes: Math.floor(Number(transferMinutes))
			});
			await reloadTransfers();
			isAddOpen = false;
			resetForm();
			pushSuccessToast({ title: 'Transfer time created.' });
		} catch (error) {
			formError = formatApiErrorMessage(error);
		} finally {
			isSaving = false;
		}
	}

	async function handleEditConfirm() {
		if (!activeTransfer || !validateForm()) return;
		isSaving = true;
		formError = '';
		try {
			await updateTransferTime(activeTransfer.transfer_id, {
				from_location_id: fromLocationId.trim(),
				to_location_id: toLocationId.trim(),
				transfer_minutes: Math.floor(Number(transferMinutes))
			});
			await reloadTransfers();
			isEditOpen = false;
			activeTransfer = null;
			resetForm();
			pushSuccessToast({ title: 'Transfer time updated.' });
		} catch (error) {
			formError = formatApiErrorMessage(error);
		} finally {
			isSaving = false;
		}
	}

	async function handleDeleteConfirm() {
		if (!activeTransfer || isDeleting) return;
		isDeleting = true;
		try {
			await deleteTransferTime(activeTransfer.transfer_id);
			await reloadTransfers();
			pushSuccessToast({ title: 'Transfer time deleted.' });
			isDeleteOpen = false;
			activeTransfer = null;
		} catch (error) {
			if (isAbortError(error)) return;
			pushErrorToast({
				title: 'Could not delete transfer time',
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
				const [transfers, locations] = await Promise.all([
					listTransferTimes(controller.signal),
					listLocations(controller.signal)
				]);
				locationLabelById = new Map(
					locations.map((location) => [location.location_id, location.name])
				);
				locationItems = locations.map((location) => ({
					value: location.location_id,
					label: location.name
				}));
				rows = transfers.map(toRow);
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
			<Alert variant="error" title="Could not load transfer times" description={errorMessage} />
		</div>
	{/if}

	<DataTable
		{columns}
		{rows}
		{loading}
		rowKey={(row) => row.transfer_id}
		search={{ enabled: true, placeholder: 'Search transfer times' }}
		toolbarButton={[
			{
				enabled: true,
				label: 'Add Transfer Time',
				icon: Plus,
				onClick: openAdd
			}
		]}
		emptyState={{
			icon: Timer,
			title: 'No transfer times yet',
			description: 'Define travel time between locations',
			actionLabel: 'Add Transfer Time',
			actionIcon: Plus,
			onAction: openAdd
		}}
		pagination={{ enabled: rows.length > 0 }}
	/>
</div>

<Dialog
	bind:open={isAddOpen}
	title="Add Transfer Time"
	hideFooter={true}
	onConfirm={handleAddConfirm}
	class={dialogClass}
	headerClass="shrink-0"
	bodyClass="flex min-h-0 flex-1 flex-col overflow-hidden px-0 py-0"
>
	<div class={dialogBodyClass}>
		{#if formError}
			<Alert variant="error" title="Could not create transfer time" description={formError} />
		{/if}
		<div class="space-y-2">
			<Label for="add-transfer-from" text="From location" required />
			<Combobox
				id="add-transfer-from"
				placeholder={locationItems.length === 0 ? 'No locations available' : 'Select location'}
				items={locationItems}
				bind:value={fromLocationId}
				disabled={locationItems.length === 0}
			/>
		</div>
		<div class="space-y-2">
			<Label for="add-transfer-to" text="To location" required />
			<Combobox
				id="add-transfer-to"
				placeholder={locationItems.length === 0 ? 'No locations available' : 'Select location'}
				items={locationItems}
				bind:value={toLocationId}
				disabled={locationItems.length === 0}
			/>
		</div>
		<div class="space-y-2">
			<Label for="add-transfer-minutes" text="Transfer minutes" required />
			<Input
				id="add-transfer-minutes"
				type="number"
				min="0"
				step="1"
				bind:value={transferMinutes}
				placeholder="0"
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
	title="Edit Transfer Time"
	hideFooter={true}
	onConfirm={handleEditConfirm}
	class={dialogClass}
	headerClass="shrink-0"
	bodyClass="flex min-h-0 flex-1 flex-col overflow-hidden px-0 py-0"
>
	<div class={dialogBodyClass}>
		{#if formError}
			<Alert variant="error" title="Could not update transfer time" description={formError} />
		{/if}
		<div class="space-y-2">
			<Label for="edit-transfer-from" text="From location" required />
			<Combobox
				id="edit-transfer-from"
				placeholder={locationItems.length === 0 ? 'No locations available' : 'Select location'}
				items={locationItems}
				bind:value={fromLocationId}
				disabled={locationItems.length === 0}
			/>
		</div>
		<div class="space-y-2">
			<Label for="edit-transfer-to" text="To location" required />
			<Combobox
				id="edit-transfer-to"
				placeholder={locationItems.length === 0 ? 'No locations available' : 'Select location'}
				items={locationItems}
				bind:value={toLocationId}
				disabled={locationItems.length === 0}
			/>
		</div>
		<div class="space-y-2">
			<Label for="edit-transfer-minutes" text="Transfer minutes" required />
			<Input
				id="edit-transfer-minutes"
				type="number"
				min="0"
				step="1"
				bind:value={transferMinutes}
				placeholder="0"
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
	title="Delete Transfer Time"
	description="Are you sure you want to delete the transfer from '{activeTransfer?.fromLabel}' to '{activeTransfer?.toLabel}'?"
	confirmLabel={isDeleting ? 'Deleting...' : 'Delete'}
	confirmVariant="danger"
	iconTone="danger"
	onConfirm={handleDeleteConfirm}
/>
