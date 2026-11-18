<script lang="ts">
	import { onMount } from 'svelte';
	import {
		Button,
		DataTable,
		type DataTableColumn,
		Dialog,
		ConfirmationDialog,
		Input,
		Label
	} from '@ifactory/ui-v2';
	import { Plus, Trash2, MoreVertical, Server, Pencil } from '@lucide/svelte';
	import { formatApiErrorMessage } from '../../lib/api/types.js';
	import { pmPushErrorToast, pmPushSuccessToast } from '../lib/toast.js';
	import ApiErrorBanner from '../components/ApiErrorBanner.svelte';
	import { showPageTopLoadErrors } from '../lib/show-page-top-load-errors.js';
	import { createStub, deleteStub, updateStub } from '../lib/projects/structures.api.js';
	import {
		loadStubsPageData,
		removeStubBreadcrumb,
		upsertStubBreadcrumb,
		type StubBomSummary
	} from '../lib/projects/load-stubs.js';
	import type { StubType } from '../lib/store.svelte';

	let { params } = $props();
	const projectId = $derived(params.projectId);

	let stubs = $state<StubType[]>([]);
	let bomsByStubId = $state<Record<string, StubBomSummary[]>>({});

	let isLoading = $state(true);
	let isSaving = $state(false);
	let loadError = $state('');
	let formError = $state('');

	let isAddDialogOpen = $state(false);
	let isEditDialogOpen = $state(false);
	let isDeleteDialogOpen = $state(false);
	let activeStub = $state<StubType | null>(null);

	let stubTypeName = $state('');

	function errorMessage(error: unknown): string {
		if (error instanceof DOMException && error.name === 'AbortError') return '';
		return formatApiErrorMessage(error);
	}

	function resetForm() {
		stubTypeName = '';
		formError = '';
	}

	function validateForm(): boolean {
		if (!stubTypeName.trim()) {
			formError = 'Stub name is required.';
			return false;
		}
		return true;
	}

	function openAddDialog() {
		resetForm();
		isAddDialogOpen = true;
	}

	function openEditDialog(stub: StubType) {
		activeStub = stub;
		stubTypeName = stub.stubTypeName;
		formError = '';
		isEditDialogOpen = true;
	}

	function openDeleteDialog(stub: StubType) {
		activeStub = stub;
		formError = '';
		isDeleteDialogOpen = true;
	}

	function renumberStubs(rows: StubType[]): StubType[] {
		return rows.map((stub, index) => ({ ...stub, sNo: index + 1 }));
	}

	function handleView(stub: StubType) {
		window.location.hash = `#/ProjectManagement/Home/${projectId}/Stubs/${stub.id}/Boms`;
	}

	const VIEW_COL_BTN =
		"inline-flex h-8 w-[7rem] shrink-0 items-center justify-center box-border rounded-none border-0 px-2 py-0 text-xs font-bold text-white font-['Space_Grotesk']";

	onMount(() => {
		const controller = new AbortController();

		void (async () => {
			isLoading = true;
			loadError = '';
			try {
				const data = await loadStubsPageData(projectId, controller.signal);
				stubs = data.stubs;
				bomsByStubId = data.bomsByStubId;
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
			const created = await createStub({
				projectId,
				stubTypeName,
				nextSNo: stubs.length + 1
			});
			stubs = [...stubs, created];
			bomsByStubId = { ...bomsByStubId, [created.id]: [] };
			upsertStubBreadcrumb(created);
			isAddDialogOpen = false;
			resetForm();
			pmPushSuccessToast({ title: 'Stub created' });
		} catch (error) {
			formError = errorMessage(error);
		} finally {
			isSaving = false;
		}
	}

	async function handleEditConfirm() {
		if (!activeStub || !validateForm()) return;

		isSaving = true;
		formError = '';
		try {
			const updated = await updateStub({
				stubId: activeStub.id,
				stubTypeName,
				sNo: activeStub.sNo,
				sortOrder: activeStub.sNo
			});
			stubs = stubs.map((stub) => (stub.id === updated.id ? updated : stub));
			upsertStubBreadcrumb(updated);
			isEditDialogOpen = false;
			pmPushSuccessToast({ title: 'Stub updated' });
		} catch (error) {
			formError = errorMessage(error);
		} finally {
			isSaving = false;
		}
	}

	async function handleDeleteConfirm() {
		if (!activeStub) return;

		isSaving = true;
		formError = '';
		try {
			await deleteStub(activeStub.id);
			stubs = renumberStubs(stubs.filter((stub) => stub.id !== activeStub!.id));
			const remainingBoms = { ...bomsByStubId };
			delete remainingBoms[activeStub.id];
			bomsByStubId = remainingBoms;
			removeStubBreadcrumb(activeStub.id);
			isDeleteDialogOpen = false;
			activeStub = null;
			pmPushSuccessToast({ title: 'Stub deleted' });
		} catch (error) {
			const message = errorMessage(error);
			if (message) {
				pmPushErrorToast({
					title: 'Could not delete stub',
					description: message
				});
			}
		} finally {
			isSaving = false;
		}
	}

	const columns: DataTableColumn<StubType>[] = [
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
			key: 'stubTypeName',
			header: 'Name',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => row.stubTypeName
		},
		{
			type: 'multi-badge',
			key: 'bomsConfigured',
			header: 'BOMs Configured',
			maxBadges: 2,
			label: (row) => {
				const boms = bomsByStubId[row.id] ?? [];
				return `${boms.length} BOMs`;
			},
			badges: (row) => {
				const boms = bomsByStubId[row.id] ?? [];
				return boms.map((bom) => ({
					variant: 'secondary' as const,
					label: bom.bomName
				}));
			}
		},
		{
			type: 'actions',
			key: 'actions',
			header: 'Actions',
			headerClass: 'text-right',
			class: 'text-right',
			actions: (row) => [
				{
					type: 'button',
					label: 'View',
					variant: 'primary',
					size: 'sm',
					class: VIEW_COL_BTN,
					onClick: () => handleView(row)
				},
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
</script>

<div class="flex h-full min-h-0 flex-col overflow-hidden p-4">
	{#if showPageTopLoadErrors && loadError}
		<div class="mb-4">
			<ApiErrorBanner message={loadError} />
		</div>
	{/if}

	<DataTable
		{columns}
		rows={stubs}
		loading={isLoading}
		rowKey={(row) => row.id}
		onRowClick={handleView}
		search={{
			enabled: true,
			placeholder: 'Search stub types...'
		}}
		toolbarButton={{
			enabled: isLoading || stubs.length > 0,
			label: 'Add Stub',
			icon: Plus,
			onClick: openAddDialog
		}}
		emptyState={{
			icon: Server,
			title: 'No stub types',
			description: 'Get started by creating a new stub type.',
			actionLabel: 'Add Stub',
			actionIcon: Plus,
			onAction: openAddDialog
		}}
		pagination={{ pageSize: 10 }}
	/>
</div>

<Dialog bind:open={isAddDialogOpen} title="Add Stub" hideFooter={true} onConfirm={handleAddConfirm}>
	<div class="space-y-4 pt-2 pb-4">
		{#if formError}
			<ApiErrorBanner message={formError} />
		{/if}
		<div class="space-y-2">
			<Label for="stub-name" text="Name" required />
			<Input
				id="stub-name"
				autofocus
				bind:value={stubTypeName}
				placeholder="Enter stub name (e.g., Stub A)"
			/>
		</div>
	</div>

	<div class="flex items-center justify-end gap-3 border-t border-border pt-4">
		<Button variant="outline" label="Cancel" onclick={() => (isAddDialogOpen = false)} />
		<Button
			variant="primary"
			label={isSaving ? 'Adding...' : 'Add Stub'}
			disabled={isSaving}
			onclick={handleAddConfirm}
			class="min-w-28"
		/>
	</div>
</Dialog>

<Dialog
	bind:open={isEditDialogOpen}
	title="Edit Stub"
	hideFooter={true}
	onConfirm={handleEditConfirm}
>
	<div class="space-y-4 pt-2 pb-4">
		{#if formError}
			<ApiErrorBanner message={formError} />
		{/if}
		<div class="space-y-2">
			<Label for="edit-stub-name" text="Name" required />
			<Input
				id="edit-stub-name"
				autofocus
				bind:value={stubTypeName}
				placeholder="Enter stub name (e.g., Stub A)"
			/>
		</div>
	</div>

	<div class="flex items-center justify-end gap-3 border-t border-border pt-4">
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
	title="Delete Stub"
	description="Are you sure you want to delete '{activeStub?.stubTypeName}'?"
	confirmLabel={isSaving ? 'Deleting...' : 'Delete'}
	confirmVariant="danger"
	iconTone="danger"
	onConfirm={handleDeleteConfirm}
/>
