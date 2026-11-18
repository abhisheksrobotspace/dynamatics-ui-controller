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
	import {
		loadTowersPageData,
		removeTowerBreadcrumb,
		upsertTowerBreadcrumb,
		type TowerBomSummary
	} from '../lib/projects/load-towers.js';
	import { createTower, deleteTower, updateTower } from '../lib/projects/structures.api.js';
	import type { TowerType } from '../lib/store.svelte';

	let { params } = $props();
	const projectId = $derived(params.projectId);

	let towers = $state<TowerType[]>([]);
	let bomsByTowerId = $state<Record<string, TowerBomSummary[]>>({});

	let formError = $state('');
	let loadError = $state('');
	let isLoading = $state(true);
	let isSaving = $state(false);

	let isAddDialogOpen = $state(false);
	let isEditDialogOpen = $state(false);
	let isDeleteDialogOpen = $state(false);
	let activeTower = $state<TowerType | null>(null);

	let towerTypeName = $state('');

	function resetForm() {
		towerTypeName = '';
		formError = '';
	}

	function openAddDialog() {
		resetForm();
		isAddDialogOpen = true;
	}

	function openEditDialog(tower: TowerType) {
		activeTower = tower;
		towerTypeName = tower.towerTypeName;
		formError = '';
		isEditDialogOpen = true;
	}

	function openDeleteDialog(tower: TowerType) {
		activeTower = tower;
		formError = '';
		isDeleteDialogOpen = true;
	}

	function validateForm(): boolean {
		if (!towerTypeName.trim()) {
			formError = 'Tower type name is required.';
			return false;
		}
		return true;
	}

	function errorMessage(error: unknown): string {
		if (error instanceof DOMException && error.name === 'AbortError') return '';
		return formatApiErrorMessage(error);
	}

	function renumberTowers(rows: TowerType[]): TowerType[] {
		return rows.map((tower, index) => ({ ...tower, sNo: index + 1 }));
	}

	function handleView(tower: TowerType) {
		window.location.hash = `#/ProjectManagement/Home/${projectId}/Towers/${tower.id}/Boms`;
	}

	const VIEW_COL_BTN =
		"inline-flex h-8 w-[7rem] shrink-0 items-center justify-center box-border rounded-none border-0 px-2 py-0 text-xs font-bold text-white font-['Space_Grotesk']";

	onMount(() => {
		const controller = new AbortController();

		void (async () => {
			isLoading = true;
			loadError = '';
			try {
				const data = await loadTowersPageData(projectId, controller.signal);
				towers = data.towers;
				bomsByTowerId = data.bomsByTowerId;
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
			const created = await createTower({
				projectId,
				towerTypeName,
				nextSNo: towers.length + 1
			});
			towers = [...towers, created];
			bomsByTowerId = { ...bomsByTowerId, [created.id]: [] };
			upsertTowerBreadcrumb(created);
			isAddDialogOpen = false;
			resetForm();
			pmPushSuccessToast({ title: 'Tower type created' });
		} catch (error) {
			formError = errorMessage(error);
		} finally {
			isSaving = false;
		}
	}

	async function handleEditConfirm() {
		if (!activeTower || !validateForm()) return;

		isSaving = true;
		formError = '';
		try {
			const updated = await updateTower({
				towerId: activeTower.id,
				towerTypeName,
				sNo: activeTower.sNo,
				sortOrder: activeTower.sNo
			});
			towers = towers.map((tower) => (tower.id === updated.id ? updated : tower));
			upsertTowerBreadcrumb(updated);
			isEditDialogOpen = false;
			pmPushSuccessToast({ title: 'Tower type updated' });
		} catch (error) {
			formError = errorMessage(error);
		} finally {
			isSaving = false;
		}
	}

	async function handleDeleteConfirm() {
		if (!activeTower) return;

		isSaving = true;
		formError = '';
		try {
			await deleteTower(activeTower.id);
			towers = renumberTowers(towers.filter((tower) => tower.id !== activeTower!.id));
			const remainingBoms = { ...bomsByTowerId };
			delete remainingBoms[activeTower.id];
			bomsByTowerId = remainingBoms;
			removeTowerBreadcrumb(activeTower.id);
			isDeleteDialogOpen = false;
			activeTower = null;
			pmPushSuccessToast({ title: 'Tower type deleted' });
		} catch (error) {
			const message = errorMessage(error);
			if (message) {
				pmPushErrorToast({
					title: 'Could not delete tower type',
					description: message
				});
			}
		} finally {
			isSaving = false;
		}
	}

	const columns: DataTableColumn<TowerType>[] = [
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
			key: 'towerTypeName',
			header: 'Name',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => row.towerTypeName
		},
		{
			type: 'multi-badge',
			key: 'extensionsConfigured',
			header: 'Extensions Configured',
			maxBadges: 2,
			label: (row) => {
				const boms = bomsByTowerId[row.id] ?? [];
				return `${boms.length} extensions`;
			},
			badges: (row) => {
				const boms = bomsByTowerId[row.id] ?? [];
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
		rows={towers}
		loading={isLoading}
		rowKey={(row) => row.id}
		onRowClick={handleView}
		search={{
			enabled: true,
			placeholder: 'Search tower types...'
		}}
		toolbarButton={{
			enabled: isLoading || towers.length > 0,
			label: 'Add Tower Type',
			icon: Plus,
			onClick: openAddDialog
		}}
		emptyState={{
			icon: Server,
			title: 'No tower types',
			description: 'Get started by creating a new tower type.',
			actionLabel: 'Add Tower Type',
			actionIcon: Plus,
			onAction: openAddDialog
		}}
		pagination={{ pageSize: 10 }}
	/>
</div>

<Dialog
	bind:open={isAddDialogOpen}
	title="Add Tower Type"
	hideFooter={true}
	onConfirm={handleAddConfirm}
>
	<div class="space-y-4 pt-2 pb-4">
		{#if formError}
			<ApiErrorBanner message={formError} />
		{/if}
		<div class="space-y-2">
			<Label for="tower-name" text="Name" required />
			<Input
				id="tower-name"
				autofocus
				bind:value={towerTypeName}
				placeholder="Enter tower name (e.g., HA, 3B5)"
			/>
		</div>
	</div>

	<div class="flex items-center justify-end gap-3 border-t border-border pt-4">
		<Button variant="outline" label="Cancel" onclick={() => (isAddDialogOpen = false)} />
		<Button
			variant="primary"
			label={isSaving ? 'Adding...' : 'Add Tower Type'}
			disabled={isSaving}
			onclick={handleAddConfirm}
			class="min-w-36"
		/>
	</div>
</Dialog>

<Dialog
	bind:open={isEditDialogOpen}
	title="Edit Tower Type"
	hideFooter={true}
	onConfirm={handleEditConfirm}
>
	<div class="space-y-4 pt-2 pb-4">
		{#if formError}
			<ApiErrorBanner message={formError} />
		{/if}
		<div class="space-y-2">
			<Label for="edit-tower-name" text="Name" required />
			<Input
				id="edit-tower-name"
				autofocus
				bind:value={towerTypeName}
				placeholder="Enter tower name (e.g., HA, 3B5)"
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
	title="Delete Tower Type"
	description="Are you sure you want to delete '{activeTower?.towerTypeName}'? This action cannot be undone."
	confirmLabel={isSaving ? 'Deleting...' : 'Delete'}
	confirmVariant="danger"
	iconTone="danger"
	onConfirm={handleDeleteConfirm}
/>
