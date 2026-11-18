<script lang="ts">
	import { onMount } from 'svelte';
	import {
		Alert,
		Button,
		DataTable,
		type DataTableColumn,
		Dialog,
		ConfirmationDialog,
		Input,
		Label
	} from '@ifactory/ui-v2';
	import { Plus, Pencil, Trash2, MoreVertical, Building2 } from '@lucide/svelte';
	import { showPageTopLoadErrors } from '../lib/show-page-top-load-errors.js';

	import { formatApiErrorMessage } from '../../lib/api/types.js';
	import { pmPushErrorToast, pmPushSuccessToast } from '../lib/toast.js';
	import {
		createCustomer,
		deleteCustomer,
		listCustomers,
		updateCustomer
	} from '../lib/projects/customers.api.js';
	import type { Customer } from '../lib/projects/types.js';

	type CustomerRow = Customer & { sNo: number };

	let formError = $state('');
	let loadError = $state('');
	let isLoading = $state(true);
	let isSaving = $state(false);
	let customers = $state<CustomerRow[]>([]);

	let isAddDialogOpen = $state(false);
	let isEditDialogOpen = $state(false);
	let isDeleteDialogOpen = $state(false);
	let activeCustomer = $state<Customer | null>(null);
	let customerName = $state('');

	function withSerialNumbers(rows: Customer[]): CustomerRow[] {
		return rows.map((row, index) => ({ ...row, sNo: index + 1 }));
	}

	function resetForm() {
		customerName = '';
		formError = '';
	}

	function openAddDialog() {
		resetForm();
		isAddDialogOpen = true;
	}

	function openEditDialog(customer: Customer) {
		activeCustomer = customer;
		customerName = customer.name;
		formError = '';
		isEditDialogOpen = true;
	}

	function openDeleteDialog(customer: Customer) {
		activeCustomer = customer;
		formError = '';
		isDeleteDialogOpen = true;
	}

	function validateForm(): boolean {
		if (!customerName.trim()) {
			formError = 'Customer name is required.';
			return false;
		}
		return true;
	}

	function errorMessage(error: unknown): string {
		if (error instanceof DOMException && error.name === 'AbortError') return '';
		return formatApiErrorMessage(error);
	}

	async function loadPageData(signal?: AbortSignal) {
		const rows = await listCustomers(signal);
		customers = withSerialNumbers(rows);
	}

	onMount(() => {
		const controller = new AbortController();

		void (async () => {
			isLoading = true;
			loadError = '';
			try {
				await loadPageData(controller.signal);
			} catch (error) {
				const message = errorMessage(error);
				if (message) loadError = message;
			} finally {
				isLoading = false;
			}
		})();

		return () => {
			controller.abort();
		};
	});

	async function handleAddConfirm() {
		if (!validateForm()) return;

		isSaving = true;
		formError = '';
		try {
			const created = await createCustomer(customerName);
			customers = withSerialNumbers([...customers, created]);
			isAddDialogOpen = false;
			resetForm();
			pmPushSuccessToast({ title: 'Customer created' });
		} catch (error) {
			formError = errorMessage(error);
		} finally {
			isSaving = false;
		}
	}

	async function handleEditConfirm() {
		if (!activeCustomer || !validateForm()) return;

		isSaving = true;
		formError = '';
		try {
			const updated = await updateCustomer(activeCustomer.id, customerName);
			customers = withSerialNumbers(
				customers.map((customer) => (customer.id === updated.id ? updated : customer))
			);
			isEditDialogOpen = false;
			pmPushSuccessToast({ title: 'Customer updated' });
		} catch (error) {
			formError = errorMessage(error);
		} finally {
			isSaving = false;
		}
	}

	async function handleDeleteConfirm() {
		if (!activeCustomer) return;

		isSaving = true;
		formError = '';
		try {
			await deleteCustomer(activeCustomer.id);
			customers = withSerialNumbers(
				customers.filter((customer) => customer.id !== activeCustomer?.id)
			);
			isDeleteDialogOpen = false;
			activeCustomer = null;
			pmPushSuccessToast({ title: 'Customer deleted' });
		} catch (error) {
			const message = errorMessage(error);
			if (message) {
				pmPushErrorToast({
					title: 'Could not delete customer',
					description: message
				});
			}
			queueMicrotask(() => {
				isDeleteDialogOpen = true;
			});
		} finally {
			isSaving = false;
		}
	}

	const columns: DataTableColumn<CustomerRow>[] = [
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
								label: 'Edit',
								icon: Pencil,
								onClick: (selectedRow) => openEditDialog(selectedRow)
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

	const customerDialogClass =
		'flex w-full max-h-[min(90dvh,85vh)] flex-col overflow-hidden sm:max-w-lg';
	const customerDialogBodyScrollClass =
		'min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 md:px-6';
	const customerDialogFooterClass =
		'flex shrink-0 flex-col-reverse gap-3 border-t border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-end md:px-6';
</script>

<div class="flex h-full min-h-0 flex-col overflow-hidden p-3 md:p-4">
	{#if showPageTopLoadErrors && loadError}
		<div class="mb-4">
			<Alert variant="error" title="Could not load customers" description={loadError} />
		</div>
	{/if}

	<DataTable
		{columns}
		rows={customers}
		loading={isLoading}
		rowKey={(row) => row.id}
		search={{
			enabled: true,
			placeholder: 'Search customers...'
		}}
		toolbarButton={{
			enabled: isLoading || customers.length > 0,
			label: 'New Customer',
			icon: Plus,
			onClick: openAddDialog
		}}
		emptyState={{
			icon: Building2,
			title: 'No customers',
			description: 'Get started by creating a new customer.',
			actionLabel: 'New Customer',
			actionIcon: Plus,
			onAction: openAddDialog
		}}
		pagination={{ pageSize: 10 }}
	/>
</div>

<Dialog
	bind:open={isAddDialogOpen}
	title="Create Customer"
	hideFooter={true}
	onConfirm={handleAddConfirm}
	class={customerDialogClass}
	headerClass="shrink-0"
	bodyClass="flex min-h-0 flex-1 flex-col overflow-hidden px-0 py-0"
>
	<div class={customerDialogBodyScrollClass}>
		{#if formError}
			<Alert variant="error" title="Could not create customer" description={formError} />
		{/if}
		<div class="space-y-2">
			<Label for="add-customer-name" text="Name" required />
			<Input
				id="add-customer-name"
				autofocus
				bind:value={customerName}
				placeholder="Enter customer name"
			/>
		</div>
	</div>

	<div class={customerDialogFooterClass}>
		<Button variant="outline" label="Cancel" onclick={() => (isAddDialogOpen = false)} />
		<Button
			variant="primary"
			label={isSaving ? 'Creating...' : 'Create Customer'}
			disabled={isSaving}
			onclick={handleAddConfirm}
			class="min-w-36"
		/>
	</div>
</Dialog>

<Dialog
	bind:open={isEditDialogOpen}
	title="Edit Customer"
	hideFooter={true}
	onConfirm={handleEditConfirm}
	class={customerDialogClass}
	headerClass="shrink-0"
	bodyClass="flex min-h-0 flex-1 flex-col overflow-hidden px-0 py-0"
>
	<div class={customerDialogBodyScrollClass}>
		{#if formError}
			<Alert variant="error" title="Could not update customer" description={formError} />
		{/if}
		<div class="space-y-2">
			<Label for="edit-customer-name" text="Name" required />
			<Input
				id="edit-customer-name"
				autofocus
				bind:value={customerName}
				placeholder="Enter customer name"
			/>
		</div>
	</div>

	<div class={customerDialogFooterClass}>
		<Button variant="outline" label="Cancel" onclick={() => (isEditDialogOpen = false)} />
		<Button
			variant="primary"
			label={isSaving ? 'Saving...' : 'Save Changes'}
			disabled={isSaving}
			onclick={handleEditConfirm}
			class="min-w-32"
		/>
	</div>
</Dialog>

<ConfirmationDialog
	bind:open={isDeleteDialogOpen}
	title="Delete Customer"
	description="Are you sure you want to delete '{activeCustomer?.name}'? Customers linked to projects cannot be deleted."
	confirmLabel={isSaving ? 'Deleting...' : 'Delete'}
	confirmVariant="danger"
	iconTone="danger"
	onConfirm={handleDeleteConfirm}
/>
