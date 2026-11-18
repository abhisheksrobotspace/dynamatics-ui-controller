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
		createContractor,
		deleteContractor,
		listContractors,
		updateContractor,
		uploadContractorSampleMarkingsFile
	} from '../lib/projects/contractors.api.js';
	import { upsertContractorBreadcrumb } from '../lib/projects/load-contractor.js';
	import type { Contractor } from '../lib/projects/types.js';

	type ContractorRow = Contractor & { sNo: number };

	/** When false, sample-markings upload and detail navigation are hidden. */
	const SAMPLE_MARKINGS_ENABLED = false;
	const SAMPLE_MARKINGS_ACCEPT = '.png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp';

	let formError = $state('');
	let loadError = $state('');
	let isLoading = $state(true);
	let isSaving = $state(false);
	let contractors = $state<ContractorRow[]>([]);

	let isAddDialogOpen = $state(false);
	let isEditDialogOpen = $state(false);
	let isDeleteDialogOpen = $state(false);
	let activeContractor = $state<Contractor | null>(null);
	let contractorName = $state('');
	let pendingSampleFile = $state<File | null>(null);
	let sampleFileInputKey = $state(0);

	function withSerialNumbers(rows: Contractor[]): ContractorRow[] {
		return rows.map((row, index) => ({ ...row, sNo: index + 1 }));
	}

	function resetForm() {
		contractorName = '';
		pendingSampleFile = null;
		sampleFileInputKey += 1;
		formError = '';
	}

	function openAddDialog() {
		resetForm();
		isAddDialogOpen = true;
	}

	function openEditDialog(contractor: Contractor) {
		activeContractor = contractor;
		contractorName = contractor.name;
		pendingSampleFile = null;
		sampleFileInputKey += 1;
		formError = '';
		isEditDialogOpen = true;
	}

	function openDeleteDialog(contractor: Contractor) {
		activeContractor = contractor;
		formError = '';
		isDeleteDialogOpen = true;
	}

	function openSampleMarkings(contractor: Contractor) {
		window.location.hash = `#/ProjectManagement/Contractors/${contractor.id}/SampleMarkings`;
	}

	function handleSampleFileChange(event: Event) {
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0] ?? null;
		if (file && !file.type.startsWith('image/')) {
			formError = 'Sample markings file must be an image (PNG, JPG, or WEBP).';
			target.value = '';
			pendingSampleFile = null;
			return;
		}
		formError = '';
		pendingSampleFile = file;
	}

	function validateForm(): boolean {
		if (!contractorName.trim()) {
			formError = 'Contractor name is required.';
			return false;
		}
		return true;
	}

	function errorMessage(error: unknown): string {
		if (error instanceof DOMException && error.name === 'AbortError') return '';
		return formatApiErrorMessage(error);
	}

	async function loadPageData(signal?: AbortSignal) {
		const rows = await listContractors(signal);
		contractors = withSerialNumbers(rows);
		for (const row of rows) upsertContractorBreadcrumb(row);
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
			let created = await createContractor(contractorName);
			if (SAMPLE_MARKINGS_ENABLED && pendingSampleFile) {
				created = await uploadContractorSampleMarkingsFile(created, pendingSampleFile);
			}
			contractors = withSerialNumbers([...contractors, created]);
			upsertContractorBreadcrumb(created);
			isAddDialogOpen = false;
			resetForm();
			pmPushSuccessToast({ title: 'Contractor created' });
		} catch (error) {
			formError = errorMessage(error);
		} finally {
			isSaving = false;
		}
	}

	async function handleEditConfirm() {
		if (!activeContractor || !validateForm()) return;

		isSaving = true;
		formError = '';
		try {
			let updated = await updateContractor(activeContractor.id, contractorName);
			if (SAMPLE_MARKINGS_ENABLED && pendingSampleFile) {
				updated = await uploadContractorSampleMarkingsFile(
					{ ...activeContractor, ...updated, metadata: activeContractor.metadata },
					pendingSampleFile
				);
			}
			contractors = withSerialNumbers(
				contractors.map((contractor) => (contractor.id === updated.id ? updated : contractor))
			);
			upsertContractorBreadcrumb(updated);
			isEditDialogOpen = false;
			pmPushSuccessToast({ title: 'Contractor updated' });
		} catch (error) {
			formError = errorMessage(error);
		} finally {
			isSaving = false;
		}
	}

	async function handleDeleteConfirm() {
		if (!activeContractor) return;

		isSaving = true;
		formError = '';
		try {
			await deleteContractor(activeContractor.id);
			contractors = withSerialNumbers(
				contractors.filter((contractor) => contractor.id !== activeContractor?.id)
			);
			isDeleteDialogOpen = false;
			activeContractor = null;
			pmPushSuccessToast({ title: 'Contractor deleted' });
		} catch (error) {
			const message = errorMessage(error);
			formError = message;
			if (message) {
				pmPushErrorToast({
					title: 'Could not delete contractor',
					description: message
				});
			}
		} finally {
			isSaving = false;
		}
	}

	const columns: DataTableColumn<ContractorRow>[] = [
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

	const contractorDialogClass =
		'flex w-full max-h-[min(90dvh,85vh)] flex-col overflow-hidden sm:max-w-lg';
	const contractorDialogBodyScrollClass =
		'min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 md:px-6';
	const contractorDialogFooterClass =
		'flex shrink-0 flex-col-reverse gap-3 border-t border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-end md:px-6';
	const sampleFileInputClass =
		'pt-1 cursor-pointer file:mr-4 file:py-1 file:px-3 file:rounded-none file:border-0 file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200';
</script>

<div class="flex h-full min-h-0 flex-col overflow-hidden p-3 md:p-4">
	{#if showPageTopLoadErrors && loadError}
		<div class="mb-4">
			<Alert variant="error" title="Could not load contractors" description={loadError} />
		</div>
	{/if}

	<DataTable
		{columns}
		rows={contractors}
		loading={isLoading}
		rowKey={(row) => row.id}
		search={{
			enabled: true,
			placeholder: 'Search contractors...'
		}}
		toolbarButton={{
			enabled: isLoading || contractors.length > 0,
			label: 'New Contractor',
			icon: Plus,
			onClick: openAddDialog
		}}
		emptyState={{
			icon: Building2,
			title: 'No contractors',
			description: 'Get started by creating a new contractor.',
			actionLabel: 'New Contractor',
			actionIcon: Plus,
			onAction: openAddDialog
		}}
		pagination={{ pageSize: 10 }}
		onRowClick={openSampleMarkings}
	/>
</div>

<Dialog
	bind:open={isAddDialogOpen}
	title="Create Contractor"
	hideFooter={true}
	onConfirm={handleAddConfirm}
	class={contractorDialogClass}
	headerClass="shrink-0"
	bodyClass="flex min-h-0 flex-1 flex-col overflow-hidden px-0 py-0"
>
	<div class={contractorDialogBodyScrollClass}>
		{#if formError}
			<Alert variant="error" title="Could not create contractor" description={formError} />
		{/if}
		<div class="space-y-2">
			<Label for="add-contractor-name" text="Name" required />
			<Input
				id="add-contractor-name"
				autofocus
				bind:value={contractorName}
				placeholder="Enter contractor name"
			/>
		</div>
		{#if SAMPLE_MARKINGS_ENABLED}
			<div class="space-y-2">
				<Label for="add-sample-markings-file" text="Sample markings image" />
				{#if pendingSampleFile}
					<div class="mb-2 flex items-center gap-2 text-sm text-gray-900">
						<span class="rounded-none bg-gray-100 px-2 py-1 text-xs">{pendingSampleFile.name}</span>
					</div>
				{/if}
				{#key sampleFileInputKey}
					<Input
						id="add-sample-markings-file"
						type="file"
						accept={SAMPLE_MARKINGS_ACCEPT}
						disabled={isSaving}
						class={sampleFileInputClass}
						onchange={handleSampleFileChange}
					/>
				{/key}
			</div>
		{/if}
	</div>

	<div class={contractorDialogFooterClass}>
		<Button variant="outline" label="Cancel" onclick={() => (isAddDialogOpen = false)} />
		<Button
			variant="primary"
			label={isSaving ? 'Creating...' : 'Create Contractor'}
			disabled={isSaving}
			onclick={handleAddConfirm}
			class="min-w-40"
		/>
	</div>
</Dialog>

<Dialog
	bind:open={isEditDialogOpen}
	title="Edit Contractor"
	hideFooter={true}
	onConfirm={handleEditConfirm}
	class={contractorDialogClass}
	headerClass="shrink-0"
	bodyClass="flex min-h-0 flex-1 flex-col overflow-hidden px-0 py-0"
>
	<div class={contractorDialogBodyScrollClass}>
		{#if formError}
			<Alert variant="error" title="Could not update contractor" description={formError} />
		{/if}
		<div class="space-y-2">
			<Label for="edit-contractor-name" text="Name" required />
			<Input
				id="edit-contractor-name"
				autofocus
				bind:value={contractorName}
				placeholder="Enter contractor name"
			/>
		</div>
		{#if SAMPLE_MARKINGS_ENABLED}
			<div class="space-y-2">
				<Label for="edit-sample-markings-file" text="Sample markings image" />
				{#if pendingSampleFile}
					<div class="mb-2 flex items-center gap-2 text-sm text-gray-900">
						<span class="rounded-none bg-gray-100 px-2 py-1 text-xs">{pendingSampleFile.name}</span>
					</div>
				{:else if activeContractor?.sampleMarkingsFileId}
					<div class="mb-2 flex items-center gap-2 text-sm text-gray-900">
						<span class="rounded-none bg-gray-100 px-2 py-1 text-xs">Image uploaded</span>
					</div>
				{/if}
				{#key sampleFileInputKey}
					<Input
						id="edit-sample-markings-file"
						type="file"
						accept={SAMPLE_MARKINGS_ACCEPT}
						disabled={isSaving}
						class={sampleFileInputClass}
						onchange={handleSampleFileChange}
					/>
				{/key}
				{#if activeContractor?.sampleMarkingsFileId}
					<p class="text-xs text-gray-400">Upload a new file to replace the existing one</p>
				{/if}
			</div>
		{/if}
	</div>

	<div class={contractorDialogFooterClass}>
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
	title="Delete Contractor"
	description="Are you sure you want to delete '{activeContractor?.name}'? Contractors linked to projects cannot be deleted."
	confirmLabel={isSaving ? 'Deleting...' : 'Delete'}
	confirmVariant="danger"
	iconTone="danger"
	onConfirm={handleDeleteConfirm}
/>
