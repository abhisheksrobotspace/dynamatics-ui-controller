<script lang="ts">
	import { onMount } from 'svelte';
	import type { ProjectRelease } from '../lib/store.svelte';
	import {
		removeReleaseBreadcrumb,
		replaceReleaseBreadcrumbs,
		upsertReleaseBreadcrumb
	} from '../lib/projects/breadcrumb-registry.js';
	import {
		createRelease,
		ddMmYyyyToIsoDate,
		deleteRelease,
		listReleases,
		updateRelease
	} from '../lib/projects/releases.api.js';
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
	let releases = $state<ProjectRelease[]>([]);

	async function loadReleases(signal?: AbortSignal) {
		const rows = await listReleases(projectId, signal);
		releases = rows;
		replaceReleaseBreadcrumbs(
			projectId,
			rows.map((release) => ({
				id: release.id,
				projectId: release.projectId,
				name: release.name,
				date: release.date
			}))
		);
	}

	onMount(() => {
		const controller = new AbortController();
		void (async () => {
			isLoading = true;
			try {
				await loadReleases(controller.signal);
			} catch (error) {
				if (!controller.signal.aborted) {
					pmPushToast({
						title: 'Failed to load releases',
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
	let activeRelease = $state<ProjectRelease | null>(null);
	let releaseName = $state('');
	let releaseDate = $state('');

	function formatDisplayDate(date: string): string {
		if (/^\d{2}\/\d{2}\/\d{4}$/.test(date)) return date;
		if (/^\d{4}-\d{2}-\d{2}/.test(date)) {
			const [year, month, day] = date.slice(0, 10).split('-');
			if (year && month && day) return `${day}/${month}/${year}`;
		}
		return date;
	}

	function openCreateDialog() {
		releaseName = '';
		releaseDate = '';
		formError = '';
		isCreateDialogOpen = true;
	}

	async function handleCreateConfirm() {
		const name = releaseName.trim();
		const releaseDateIso = ddMmYyyyToIsoDate(releaseDate);
		if (!name || !releaseDateIso || !isValidDdMmYyyy(releaseDate)) {
			formError = 'Enter a release name and a valid plan date.';
			return;
		}

		isSaving = true;
		formError = '';
		try {
			const created = await createRelease(
				{
					projectId,
					name,
					releaseDateIso
				},
				releases.length + 1
			);
			releases = [...releases, created];
			upsertReleaseBreadcrumb(created);
			isCreateDialogOpen = false;
			pmPushSuccessToast({ title: 'Release created' });
			navigateToRelease(created);
		} catch (error) {
			formError = formatApiErrorMessage(error);
		} finally {
			isSaving = false;
		}
	}

	function openEditDialog(release: ProjectRelease) {
		activeRelease = release;
		releaseName = release.name;
		releaseDate = formatDisplayDate(release.date);
		formError = '';
		isEditDialogOpen = true;
	}

	async function handleEditConfirm() {
		if (!activeRelease) return;

		const name = releaseName.trim();
		const releaseDateIso = ddMmYyyyToIsoDate(releaseDate);
		if (!name || !releaseDateIso || !isValidDdMmYyyy(releaseDate)) {
			formError = 'Enter a release name and a valid plan date.';
			return;
		}

		isSaving = true;
		formError = '';
		try {
			const updated = await updateRelease({
				releaseId: activeRelease.id,
				name,
				releaseDateIso,
				sNo: activeRelease.sNo
			});
			releases = releases.map((release) =>
				release.id === updated.id ? { ...release, ...updated } : release
			);
			upsertReleaseBreadcrumb(updated);
			isEditDialogOpen = false;
			activeRelease = null;
			pmPushSuccessToast({ title: 'Release updated' });
		} catch (error) {
			formError = formatApiErrorMessage(error);
		} finally {
			isSaving = false;
		}
	}

	function openDeleteDialog(release: ProjectRelease) {
		activeRelease = release;
		isDeleteDialogOpen = true;
	}

	function navigateToRelease(release: ProjectRelease) {
		window.location.hash = `#/ProjectManagement/Home/${projectId}/Releases/${release.id}`;
	}

	async function handleDeleteConfirm() {
		if (!activeRelease) return;
		isSaving = true;
		try {
			await deleteRelease(activeRelease.id);
			removeReleaseBreadcrumb(activeRelease.id);
			const remaining = releases.filter((r) => r.id !== activeRelease!.id);
			releases = remaining.map((r, index) => ({ ...r, sNo: index + 1 }));
			isDeleteDialogOpen = false;
			activeRelease = null;
			pmPushSuccessToast({ title: 'Release deleted' });
		} catch (error) {
			pmPushErrorToast({
				title: 'Failed to delete release',
				description: formatApiErrorMessage(error)
			});
		} finally {
			isSaving = false;
		}
	}

	const columns: DataTableColumn<ProjectRelease>[] = [
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
					onClick: (selectedRow: ProjectRelease) => void;
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

	const releaseDialogClass =
		'flex w-full max-h-[min(90dvh,85vh)] flex-col overflow-hidden sm:max-w-lg';
	const releaseDialogBodyScrollClass = 'min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 md:px-6';
	const releaseDialogFooterClass =
		'flex shrink-0 flex-col-reverse gap-3 border-t border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-end md:px-6';
</script>

<div class="flex h-full min-h-0 flex-col overflow-hidden p-4">
	<DataTable
		{columns}
		rows={releases}
		loading={isLoading}
		rowKey={(row) => row.id}
		onRowClick={(row) => navigateToRelease(row)}
		search={{
			enabled: true,
			placeholder: 'Search releases...'
		}}
		toolbarButton={{
			enabled: isLoading || releases.length > 0,
			label: 'Add Release',
			icon: Plus,
			onClick: openCreateDialog
		}}
		emptyState={{
			icon: Package,
			title: 'No releases',
			description: 'Get started by creating a new release.',
			actionLabel: 'Add Release',
			actionIcon: Plus,
			onAction: openCreateDialog
		}}
		pagination={{ pageSize: 10 }}
	/>
</div>

<Dialog
	bind:open={isCreateDialogOpen}
	title="Add Release"
	hideFooter={true}
	onConfirm={handleCreateConfirm}
	class={releaseDialogClass}
	headerClass="shrink-0"
	bodyClass="flex min-h-0 flex-1 flex-col overflow-hidden px-0 py-0"
>
	<div class={releaseDialogBodyScrollClass}>
		{#if formError}
			<Alert variant="error" title="Could not create release" description={formError} />
		{/if}
		<div class="space-y-2">
			<Label for="release-name" text="Name" required />
			<Input
				id="release-name"
				autofocus
				bind:value={releaseName}
				placeholder="e.g. Phase 1 / July batch"
				disabled={isSaving}
			/>
		</div>
		<div class="space-y-2">
			<Label for="release-date" text="Plan Date" required />
			<DateInput id="release-date" bind:value={releaseDate} />
		</div>
	</div>
	<div class={releaseDialogFooterClass}>
		<Button
			class="w-full sm:w-auto"
			variant="outline"
			label="Cancel"
			disabled={isSaving}
			onclick={() => (isCreateDialogOpen = false)}
		/>
		<Button
			class="min-w-32 w-full sm:w-auto"
			variant="primary"
			label={isSaving ? 'Adding...' : 'Add Release'}
			disabled={isSaving}
			onclick={handleCreateConfirm}
		/>
	</div>
</Dialog>

<Dialog
	bind:open={isEditDialogOpen}
	title="Edit Release"
	hideFooter={true}
	onConfirm={handleEditConfirm}
	class={releaseDialogClass}
	headerClass="shrink-0"
	bodyClass="flex min-h-0 flex-1 flex-col overflow-hidden px-0 py-0"
>
	<div class={releaseDialogBodyScrollClass}>
		{#if formError}
			<Alert variant="error" title="Could not update release" description={formError} />
		{/if}
		<div class="space-y-2">
			<Label for="edit-release-name" text="Name" required />
			<Input
				id="edit-release-name"
				autofocus
				bind:value={releaseName}
				placeholder="e.g. Phase 1 / July batch"
				disabled={isSaving}
			/>
		</div>
		<div class="space-y-2">
			<Label for="edit-release-date" text="Plan Date" required />
			<DateInput id="edit-release-date" bind:value={releaseDate} />
		</div>
	</div>
	<div class={releaseDialogFooterClass}>
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
	title="Delete Release"
	description="Are you sure you want to delete release '{activeRelease?.name}'? This action cannot be undone."
	confirmLabel={isSaving ? 'Deleting...' : 'Delete'}
	confirmVariant="danger"
	iconTone="danger"
	onConfirm={handleDeleteConfirm}
/>
