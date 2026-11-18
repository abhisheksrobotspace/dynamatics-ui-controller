<script lang="ts">
	import { onMount } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import {
		Alert,
		Button,
		Combobox,
		DataTable,
		type DataTableColumn,
		Dialog,
		ConfirmationDialog,
		Input,
		Label,
		type ComboboxItem
	} from '@ifactory/ui-v2';
	import { Plus, Pencil, Trash2, MoreVertical, FolderPlus } from '@lucide/svelte';
	import { showPageTopLoadErrors } from '../lib/show-page-top-load-errors.js';

	import { formatApiErrorMessage } from '../../lib/api/types.js';
	import { formatUtcAsIst } from '../../lib/datetime/format-ist.js';
	import { pmPushErrorToast, pmPushSuccessToast } from '../lib/toast.js';
	import {
		loadProjectCustomerCatalog,
		loadProjectsPageData,
		removeProjectBreadcrumb,
		upsertProjectBreadcrumb
	} from '../lib/projects/load-project.js';
	import { createProject, deleteProject, updateProject } from '../lib/projects/projects.api.js';
	import type { Project } from '../lib/store.svelte';
	import type { Customer } from '../lib/projects/types.js';

	let formError = $state('');
	let loadError = $state('');
	let isLoading = $state(true);
	let isSaving = $state(false);
	let customers = $state<Customer[]>([]);
	let customersLoading = $state(false);
	let projects = $state<Project[]>([]);

	let isAddDialogOpen = $state(false);
	let isEditDialogOpen = $state(false);
	let isDeleteDialogOpen = $state(false);
	let activeProject = $state<Project | null>(null);

	let formData = $state({
		projectName: '',
		workOrderNo: '',
		customerId: '',
		projectDetails: '',
		lineDetails: '',
		loaNo: ''
	});

	const customerComboboxItems = $derived(
		customers.map((customer): ComboboxItem => ({
			value: customer.id,
			label: customer.name
		}))
	);

	const projectDialogClass =
		'flex w-full max-h-[min(90dvh,85vh)] flex-col overflow-hidden sm:max-w-lg md:max-w-xl';
	const projectDialogBodyScrollClass = 'min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-6';
	const projectDialogFooterClass =
		'flex shrink-0 flex-col-reverse gap-3 border-t border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-end md:px-6';

	function contractorNamesFromProjects(): Map<string, string> {
		const map = new SvelteMap<string, string>();
		for (const project of projects) {
			if (project.contractorId && project.contractorName) {
				map.set(project.contractorId, project.contractorName);
			}
		}
		return map;
	}

	async function ensureCustomersLoaded() {
		if (customers.length > 0 || customersLoading) return;
		customersLoading = true;
		try {
			customers = await loadProjectCustomerCatalog();
		} catch (error) {
			const message = errorMessage(error);
			if (message) formError = message;
		} finally {
			customersLoading = false;
		}
	}

	function resetForm() {
		formData = {
			projectName: '',
			workOrderNo: '',
			customerId: '',
			projectDetails: '',
			lineDetails: '',
			loaNo: ''
		};
		formError = '';
	}

	function openAddDialog() {
		resetForm();
		isAddDialogOpen = true;
		void ensureCustomersLoaded();
	}

	function openEditDialog(project: Project) {
		activeProject = project;
		formData = {
			projectName: project.projectName,
			workOrderNo: project.workOrderNo || '',
			customerId: project.customerId,
			projectDetails: project.projectDetails || '',
			lineDetails: project.lineDetails || '',
			loaNo: project.loaNo || ''
		};
		formError = '';
		isEditDialogOpen = true;
		void ensureCustomersLoaded();
	}

	function openDeleteDialog(project: Project) {
		activeProject = project;
		formError = '';
		isDeleteDialogOpen = true;
	}

	function validateForm(): boolean {
		if (!formData.projectName.trim()) {
			formError = 'Project name is required.';
			return false;
		}
		if (!formData.workOrderNo.trim()) {
			formError = 'Work order number is required.';
			return false;
		}
		if (!formData.customerId) {
			formError = 'Customer is required.';
			return false;
		}
		return true;
	}

	function errorMessage(error: unknown): string {
		if (error instanceof DOMException && error.name === 'AbortError') return '';
		return formatApiErrorMessage(error);
	}

	onMount(() => {
		const controller = new AbortController();

		void (async () => {
			isLoading = true;
			loadError = '';
			try {
				const { projects: loadedProjects } = await loadProjectsPageData(controller.signal);
				projects = loadedProjects;
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
			const customerNameById = new Map(customers.map((c) => [c.id, c.name]));
			const created = await createProject(
				{
					projectName: formData.projectName,
					shortName: '',
					workOrderNo: formData.workOrderNo,
					customerId: formData.customerId,
					projectDetails: formData.projectDetails,
					lineDetails: formData.lineDetails,
					loaNo: formData.loaNo
				},
				customerNameById,
				contractorNamesFromProjects(),
				1
			);
			projects = [created, ...projects].map((project, index) => ({
				...project,
				sNo: index + 1
			}));
			upsertProjectBreadcrumb(created);
			isAddDialogOpen = false;
			resetForm();
			pmPushSuccessToast({ title: 'Project created' });
		} catch (error) {
			formError = errorMessage(error);
		} finally {
			isSaving = false;
		}
	}

	async function handleEditConfirm() {
		if (!activeProject || !validateForm()) return;

		isSaving = true;
		formError = '';
		try {
			const customerNameById = new Map(customers.map((c) => [c.id, c.name]));
			const updated = await updateProject(
				{
					projectId: activeProject.id,
					projectName: formData.projectName,
					shortName: activeProject.shortName || '',
					workOrderNo: formData.workOrderNo,
					customerId: formData.customerId,
					projectDetails: formData.projectDetails,
					lineDetails: formData.lineDetails,
					loaNo: formData.loaNo,
					existingMetadata: activeProject.metadata
				},
				customerNameById,
				contractorNamesFromProjects(),
				activeProject.sNo
			);
			projects = projects.map((project) => (project.id === updated.id ? updated : project));
			upsertProjectBreadcrumb(updated);
			isEditDialogOpen = false;
			pmPushSuccessToast({ title: 'Project updated' });
		} catch (error) {
			formError = errorMessage(error);
		} finally {
			isSaving = false;
		}
	}

	async function handleDeleteConfirm() {
		if (!activeProject) return;

		isSaving = true;
		formError = '';
		try {
			await deleteProject(activeProject.id);
			projects = projects
				.filter((project) => project.id !== activeProject!.id)
				.map((project, index) => ({ ...project, sNo: index + 1 }));
			removeProjectBreadcrumb(activeProject.id);
			isDeleteDialogOpen = false;
			pmPushSuccessToast({ title: 'Project deleted' });
		} catch (error) {
			const message = errorMessage(error);
			if (message) {
				pmPushErrorToast({
					title: 'Could not delete project',
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

	function handleView(project: Project) {
		window.location.hash = `#/ProjectManagement/Home/${project.id}`;
	}

	const VIEW_COL_BTN =
		"inline-flex h-8 w-[7rem] shrink-0 items-center justify-center box-border rounded-none border-0 px-2 py-0 text-xs font-bold text-white font-['Space_Grotesk']";

	const columns: DataTableColumn<Project>[] = [
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
			key: 'workOrderNo',
			header: 'Work Order No',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => row.workOrderNo || '-'
		},
		{
			type: 'text',
			key: 'projectName',
			header: 'Name',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => row.projectName
		},
		{
			type: 'text',
			key: 'customerName',
			header: 'Customer',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => row.customerName
		},
		{
			type: 'text',
			key: 'contractorName',
			header: 'Contractor',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => row.contractorName || '-'
		},
		{
			type: 'text',
			key: 'createdBy',
			header: 'Created By',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => row.createdBy || '-'
		},
		{
			type: 'text',
			key: 'createdAt',
			header: 'Created At',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => (row.createdAt ? formatUtcAsIst(row.createdAt) : '-')
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

<div class="flex h-full min-h-0 flex-col overflow-hidden p-3 md:p-4">
	{#if showPageTopLoadErrors && loadError}
		<div class="mb-4">
			<Alert variant="error" title="Could not load projects" description={loadError} />
		</div>
	{/if}

	<DataTable
		{columns}
		rows={projects}
		loading={isLoading}
		rowKey={(row) => row.id}
		onRowClick={handleView}
		search={{
			enabled: true,
			placeholder: 'Search projects...'
		}}
		toolbarButton={{
			enabled: isLoading || projects.length > 0,
			label: 'New Project',
			icon: Plus,
			onClick: openAddDialog
		}}
		emptyState={{
			icon: FolderPlus,
			title: 'No projects',
			description: 'Get started by creating a new project.',
			actionLabel: 'New Project',
			actionIcon: Plus,
			onAction: openAddDialog
		}}
		pagination={{ pageSize: 10 }}
	/>
</div>

<Dialog
	bind:open={isAddDialogOpen}
	title="Create New Project"
	size="lg"
	hideFooter={true}
	onConfirm={handleAddConfirm}
	class={projectDialogClass}
	headerClass="shrink-0"
	bodyClass="flex min-h-0 flex-1 flex-col overflow-hidden px-0 py-0"
>
	<div class={projectDialogBodyScrollClass}>
		<div class="space-y-4">
			{#if formError}
				<Alert variant="error" title="Could not create project" description={formError} />
			{/if}
			<div class="space-y-2">
				<Label for="add-projectName" text="Name" required />
				<Input
					id="add-projectName"
					autofocus
					bind:value={formData.projectName}
					placeholder="Enter project name"
				/>
			</div>
			<div class="space-y-2">
				<Label for="add-workOrderNo" text="Work Order No" required />
				<Input
					id="add-workOrderNo"
					bind:value={formData.workOrderNo}
					placeholder="Enter work order number"
				/>
			</div>
			<div class="space-y-2">
				{#if customerComboboxItems.length > 0}
					<Label for="add-customerId" text="Customer" required />
					<Combobox
						id="add-customerId"
						placeholder="Select Customer"
						items={customerComboboxItems}
						bind:value={formData.customerId}
					/>
				{:else}
					<Label for="add-customerId" text="Customer" required />
					<p class="text-sm text-muted-foreground">
						{customersLoading ? 'Loading customers…' : 'No active customers found.'}
					</p>
				{/if}
			</div>
			<div class="space-y-2">
				<Label for="add-projectDetails" text="Project Details" />
				<Input
					id="add-projectDetails"
					bind:value={formData.projectDetails}
					placeholder="Enter project details"
				/>
			</div>
			<div class="space-y-2">
				<Label for="add-lineDetails" text="Line Details" />
				<Input
					id="add-lineDetails"
					bind:value={formData.lineDetails}
					placeholder="Enter line details"
				/>
			</div>
			<div class="space-y-2">
				<Label for="add-loaNo" text="LOA No." />
				<Input id="add-loaNo" bind:value={formData.loaNo} placeholder="Enter LOA number" />
			</div>
		</div>
	</div>

	<div class={projectDialogFooterClass}>
		<Button
			class="w-full sm:w-auto"
			variant="outline"
			label="Cancel"
			onclick={() => (isAddDialogOpen = false)}
		/>
		<Button
			class="min-w-36 w-full sm:w-auto"
			variant="primary"
			label={isSaving ? 'Creating...' : 'Create Project'}
			disabled={isSaving}
			onclick={handleAddConfirm}
		/>
	</div>
</Dialog>

<Dialog
	bind:open={isEditDialogOpen}
	title="Edit Project"
	size="lg"
	hideFooter={true}
	onConfirm={handleEditConfirm}
	class={projectDialogClass}
	headerClass="shrink-0"
	bodyClass="flex min-h-0 flex-1 flex-col overflow-hidden px-0 py-0"
>
	<div class={projectDialogBodyScrollClass}>
		<div class="space-y-4">
			{#if formError}
				<Alert variant="error" title="Could not update project" description={formError} />
			{/if}
			<div class="space-y-2">
				<Label for="edit-projectName" text="Name" required />
				<Input
					id="edit-projectName"
					autofocus
					bind:value={formData.projectName}
					placeholder="Enter project name"
				/>
			</div>
			<div class="space-y-2">
				<Label for="edit-workOrderNo" text="Work Order No" required />
				<Input
					id="edit-workOrderNo"
					bind:value={formData.workOrderNo}
					placeholder="Enter work order number"
				/>
			</div>
			<div class="space-y-2">
				{#if customerComboboxItems.length > 0}
					<Label for="edit-customerId" text="Customer" required />
					<Combobox
						id="edit-customerId"
						placeholder="Select Customer"
						items={customerComboboxItems}
						bind:value={formData.customerId}
					/>
				{:else}
					<Label for="edit-customerId" text="Customer" required />
					<p class="text-sm text-muted-foreground">
						{customersLoading ? 'Loading customers…' : 'No active customers found.'}
					</p>
				{/if}
			</div>
			<div class="space-y-2">
				<Label for="edit-projectDetails" text="Project Details" />
				<Input
					id="edit-projectDetails"
					bind:value={formData.projectDetails}
					placeholder="Enter project details"
				/>
			</div>
			<div class="space-y-2">
				<Label for="edit-lineDetails" text="Line Details" />
				<Input
					id="edit-lineDetails"
					bind:value={formData.lineDetails}
					placeholder="Enter line details"
				/>
			</div>
			<div class="space-y-2">
				<Label for="edit-loaNo" text="LOA No." />
				<Input id="edit-loaNo" bind:value={formData.loaNo} placeholder="Enter LOA number" />
			</div>
		</div>
	</div>

	<div class={projectDialogFooterClass}>
		<Button
			class="w-full sm:w-auto"
			variant="outline"
			label="Cancel"
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
	title="Delete Project"
	description="Are you sure you want to delete '{activeProject?.projectName}'? This action cannot be undone."
	confirmLabel={isSaving ? 'Deleting...' : 'Delete'}
	confirmVariant="danger"
	iconTone="danger"
	onConfirm={handleDeleteConfirm}
/>
