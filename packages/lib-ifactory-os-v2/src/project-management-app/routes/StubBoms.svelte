<script lang="ts">
	import { onMount } from 'svelte';
	import {
		bindBomExtractHandlers,
		clearLiveExtractStatus,
		hydrateBomExtractStatuses,
		resumeBomExtractPolls,
		seedLiveExtractStatuses,
		stopBomExtractPoll,
		unbindBomExtractHandlers
	} from '../lib/bom-extract-poll.svelte';
	import { bomLineageVersionsHash, type BomStructureRef } from '../lib/bom-structure-routes.js';
	import {
		Button,
		DataTable,
		type DataTableColumn,
		Dialog,
		ConfirmationDialog,
		Input,
		Label
	} from '@ifactory/ui-v2';
	import { pmPushErrorToast, pmPushSuccessToast } from '../lib/toast';
	import { Plus, Trash2, Pencil, Component, EllipsisVertical, Loader2 } from '@lucide/svelte';
	import { formatApiErrorMessage } from '../../lib/api/types.js';
	import { formatUtcAsIst } from '../../lib/datetime/format-ist.js';
	import ApiErrorBanner from '../components/ApiErrorBanner.svelte';
	import { showPageTopLoadErrors } from '../lib/show-page-top-load-errors.js';
	import type { BomConfig, StubType } from '../lib/store.svelte';
	import { bomPublishStatusBadge } from '../lib/projects/bom-status-badges.js';
	import {
		BOM_CSV_FILE_ACCEPT,
		BOM_CSV_MULTIPLE_FILES_ERROR,
		readSingleBomCsvFromInput,
		validateBomCsvHeaders
	} from '../lib/projects/bom-csv-validation.js';
	import { queueBomExtraction } from '../lib/bom-extract-poll.svelte.js';
	import { filesUpload } from '../lib/core-api.js';
	import {
		createBom,
		deleteBomLineage,
		latestBomPerLineage,
		setBomFileId,
		subtypeDeleteDescription,
		updateBom
	} from '../lib/projects/boms.api.js';
	import {
		loadStubBomsPageData,
		patchStubBomInList,
		removeBomBreadcrumb,
		removeStubBomsByLineageFromList,
		upsertBomBreadcrumb
	} from '../lib/projects/load-stub-boms.js';
	import { SUBTYPES_PAGE_LOAD_OPTIONS } from '../lib/projects/load-boms.js';

	let { params } = $props();
	const projectId = $derived(params.projectId);
	const stubId = $derived(params.stubId);
	const structure = $derived({ kind: 'stub', stubId } satisfies BomStructureRef);

	let stub = $state<StubType | null>(null);
	let boms = $state<BomConfig[]>([]);

	let isLoading = $state(true);
	let loadError = $state('');
	let isSaving = $state(false);
	let formError = $state('');

	let isAddDialogOpen = $state(false);
	let isEditDialogOpen = $state(false);
	let isDeleteDialogOpen = $state(false);
	let activeBom = $state<BomConfig | null>(null);

	let formData = $state({
		bomName: '',
		weightMt: ''
	});
	let bomFileInputKey = $state(0);
	let selectedBomFile = $state<File | null>(null);

	const BOM_COL_BTN =
		"inline-flex h-8 w-[7rem] shrink-0 items-center justify-center box-border rounded-none border-0 px-2 py-0 text-xs font-bold text-white font-['Space_Grotesk']";
	const FILE_INPUT_CLASS =
		'cursor-pointer pt-1 file:mr-4 file:rounded-none file:border-0 file:bg-gray-100 file:px-3 file:py-1 file:text-gray-700 hover:file:bg-gray-200';

	function toStubBom(bom: BomConfig): BomConfig {
		return { ...bom, towerId: undefined, stubId };
	}

	const tableBoms = $derived(latestBomPerLineage(boms.map((bom) => toStubBom(bom))));

	const deleteSubtypeDescription = $derived(
		activeBom ? subtypeDeleteDescription(boms, activeBom) : ''
	);

	function formatBomWtInput(bomWt: number | null | undefined): string {
		return bomWt != null && Number.isFinite(bomWt) ? String(bomWt) : '';
	}

	function parseWeightMtInput(
		raw: string | number
	): { ok: true; value: number | null } | { ok: false } {
		const trimmed = String(raw ?? '').trim();
		if (!trimmed) return { ok: true, value: null };
		const n = Number(trimmed);
		if (!Number.isFinite(n) || n < 0) return { ok: false };
		return { ok: true, value: n };
	}

	onMount(() => {
		const controller = new AbortController();

		bindBomExtractHandlers({
			getBom: (id) => boms.find((bom) => bom.id === id),
			updateBom: (next) => syncBomRow(toStubBom(next))
		});

		void (async () => {
			isLoading = true;
			loadError = '';
			try {
				const data = await loadStubBomsPageData(
					projectId,
					stubId,
					controller.signal,
					SUBTYPES_PAGE_LOAD_OPTIONS
				);
				stub = data.stub;
				boms = data.boms;
				seedLiveExtractStatuses(data.boms);
				await hydrateBomExtractStatuses(data.boms);
				resumeBomExtractPolls(data.boms);
			} catch (error) {
				const message = errorMessage(error);
				if (message) loadError = message;
			} finally {
				isLoading = false;
			}
		})();

		return () => {
			controller.abort();
			unbindBomExtractHandlers();
		};
	});

	function errorMessage(error: unknown): string {
		if (error instanceof DOMException && error.name === 'AbortError') return '';
		return formatApiErrorMessage(error);
	}

	function syncBomRow(bom: BomConfig) {
		boms = patchStubBomInList(boms, toStubBom(bom));
		upsertBomBreadcrumb(toStubBom(bom));
	}

	function resetForm() {
		formData = { bomName: '', weightMt: '' };
		selectedBomFile = null;
		bomFileInputKey += 1;
		formError = '';
	}

	function closeAddDialog() {
		isAddDialogOpen = false;
		resetForm();
	}

	function openAddDialog() {
		resetForm();
		isAddDialogOpen = true;
	}

	function closeEditDialog() {
		isEditDialogOpen = false;
		formError = '';
	}

	function openEditDialog(bom: BomConfig) {
		activeBom = bom;
		formData = {
			bomName: bom.bomName || '',
			weightMt: formatBomWtInput(bom.bomWt)
		};
		formError = '';
		isEditDialogOpen = true;
	}

	function openDeleteDialog(bom: BomConfig) {
		activeBom = bom;
		formError = '';
		isDeleteDialogOpen = true;
	}

	function validateForm(isEdit: boolean): boolean {
		const finalName = formData.bomName.trim();
		if (!finalName) {
			formError = 'Subtype is required.';
			return false;
		}

		const weight = parseWeightMtInput(formData.weightMt);
		if (!weight.ok) {
			formError = 'Weight must be a non-negative number (MT).';
			return false;
		}

		const duplicate = boms.some((bom) => {
			if (isEdit && activeBom && bom.id === activeBom.id) return false;
			return bom.bomName === finalName;
		});
		if (duplicate) {
			formError = `A subtype named "${finalName}" already exists.`;
			return false;
		}

		return true;
	}

	function isCsvFile(name: string): boolean {
		return name.toLowerCase().endsWith('.csv');
	}

	async function handleBomFileChange(event: Event) {
		const target = event.target as HTMLInputElement;
		const picked = readSingleBomCsvFromInput(target);
		if (!picked.ok) {
			if (picked.reason === 'multiple') {
				formError = BOM_CSV_MULTIPLE_FILES_ERROR;
				bomFileInputKey += 1;
			} else {
				selectedBomFile = null;
			}
			return;
		}

		const file = picked.file;
		formError = '';
		if (!isCsvFile(file.name)) {
			formError = 'BOM file must be a .csv file.';
			selectedBomFile = null;
			bomFileInputKey += 1;
			return;
		}

		const validation = await validateBomCsvHeaders(file);
		if (!validation.valid) {
			formError = `Invalid BOM CSV headers. Missing columns: ${validation.missingColumns.join(', ')}`;
			selectedBomFile = null;
			bomFileInputKey += 1;
			return;
		}

		selectedBomFile = file;
	}

	function bomMetadataSnapshot(bom: BomConfig): Record<string, unknown> {
		const metadata: Record<string, unknown> = {};
		if (bom.bomFile) metadata.bom_file_name = bom.bomFile;
		if (bom.drawingsFile) metadata.drawings_file_name = bom.drawingsFile;
		if (bom.bomWt != null) metadata.bom_wt = bom.bomWt;
		if (bom.operationsCountRoi != null) metadata.operations_count_roi = bom.operationsCountRoi;
		return metadata;
	}

	async function handleAddConfirm() {
		if (!validateForm(false)) return;
		const weight = parseWeightMtInput(formData.weightMt);
		if (!weight.ok) return;

		isSaving = true;
		formError = '';

		try {
			const bomFile = selectedBomFile;
			const created = await createBom({
				projectId,
				towerId: stubId,
				bomName: formData.bomName,
				bomFileName: bomFile?.name ?? null,
				drawingsFileName: null,
				bomWt: weight.value,
				nextSNo: boms.length + 1
			});

			if (bomFile) {
				const bomFileId = await filesUpload(bomFile, bomFile.name, 'proj_boms', created.bom.id);
				await setBomFileId(
					created.bom.id,
					bomFileId,
					{ bom_file_name: bomFile.name },
					bomFile.name
				);

				const nextBom = toStubBom({
					...created.bom,
					bomFileId,
					bomFile: bomFile.name,
					extractStatus: 'pending'
				});

				syncBomRow(nextBom);
				await queueBomExtraction(projectId, stubId, nextBom, bomFileId);
			} else {
				syncBomRow(toStubBom(created.bom));
			}

			closeAddDialog();
			pmPushSuccessToast({ title: 'Subtype created' });
		} catch (error) {
			formError = errorMessage(error);
		} finally {
			isSaving = false;
		}
	}

	async function handleEditConfirm() {
		if (!activeBom || !validateForm(true)) return;
		const weight = parseWeightMtInput(formData.weightMt);
		if (!weight.ok) return;

		isSaving = true;
		formError = '';

		try {
			const updated = await updateBom({
				projectId,
				towerId: stubId,
				bomId: activeBom.id,
				bomName: formData.bomName,
				sNo: activeBom.sNo,
				bomFileName: activeBom.bomFile,
				drawingsFileName: activeBom.drawingsFile,
				bomWt: weight.value,
				operationsCountRoi: activeBom.operationsCountRoi ?? null,
				existingMetadata: bomMetadataSnapshot(activeBom)
			});
			syncBomRow(updated.bom);
			closeEditDialog();
			pmPushSuccessToast({ title: 'BOM updated' });
		} catch (error) {
			formError = errorMessage(error);
		} finally {
			isSaving = false;
		}
	}

	async function handleDeleteConfirm() {
		if (!activeBom || isSaving) return;

		const lineageId = activeBom.bomLineageId;
		const subtypeName = activeBom.bomName;

		isSaving = true;
		formError = '';
		try {
			const deleted = await deleteBomLineage(stubId, lineageId);
			for (const bom of deleted) {
				stopBomExtractPoll(bom.id);
				clearLiveExtractStatus(bom.id);
				removeBomBreadcrumb(bom.id);
			}
			boms = removeStubBomsByLineageFromList(boms, lineageId);
			activeBom = null;
			isDeleteDialogOpen = false;
			pmPushSuccessToast({ title: 'Subtype deleted', description: subtypeName });
		} catch (error) {
			const message = errorMessage(error);
			if (message) {
				pmPushErrorToast({
					title: 'Could not delete subtype',
					description: message
				});
			}
		} finally {
			isSaving = false;
		}
	}

	function handleViewVersions(row: BomConfig) {
		window.location.hash = bomLineageVersionsHash(projectId, structure, row.bomLineageId);
	}

	const columns = $derived.by((): DataTableColumn<BomConfig>[] => [
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
			key: 'bomName',
			header: 'Subtype',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => row.bomName
		},
		{
			type: 'text',
			key: 'bomWt',
			header: 'Weight (MT)',
			sortable: true,
			filterable: true,
			dataType: 'number',
			value: (row) => (row.bomWt != null && Number.isFinite(row.bomWt) ? String(row.bomWt) : '—')
		},
		{
			type: 'text',
			key: 'version',
			header: 'Latest Version',
			sortable: true,
			filterable: true,
			dataType: 'number',
			value: (row) => `V${row.version}`
		},
		{
			type: 'badge',
			key: 'stage',
			header: 'Status',
			sortable: true,
			filterable: true,
			dataType: 'string',
			badge: bomPublishStatusBadge
		},
		{
			type: 'text',
			key: 'createdAt',
			header: 'Created At',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => (row.createdAt ? formatUtcAsIst(row.createdAt) : '—')
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
					class: BOM_COL_BTN,
					onClick: () => handleViewVersions(row)
				},
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
	]);
</script>

<div class="flex h-full min-h-0 flex-col overflow-hidden p-4">
	{#if showPageTopLoadErrors && loadError}
		<div class="mb-4">
			<ApiErrorBanner message={loadError} />
		</div>
	{/if}

	{#if isLoading || stub}
		<DataTable
			{columns}
			rows={tableBoms}
			loading={isLoading}
			rowKey={(row) => row.id}
			onRowClick={handleViewVersions}
			search={{
				enabled: true,
				placeholder: 'Search subtypes...'
			}}
			toolbarButton={{
				enabled: isLoading || boms.length > 0,
				label: 'Add Subtype',
				icon: Plus,
				onClick: openAddDialog
			}}
			emptyState={{
				icon: Component,
				title: 'No subtypes configured',
				description: stub
					? `Get started by configuring a new subtype for ${stub.stubTypeName}.`
					: 'Get started by configuring a new subtype.',
				actionLabel: 'Add Subtype',
				actionIcon: Plus,
				onAction: openAddDialog
			}}
			pagination={{ pageSize: 10 }}
		/>
	{:else}
		<p class="text-muted-foreground">Stub not found.</p>
	{/if}
</div>

<Dialog
	bind:open={isAddDialogOpen}
	title="Add Subtype"
	hideFooter={true}
	closeOnBackdrop={!isSaving}
	showCloseButton={!isSaving}
	onConfirm={handleAddConfirm}
>
	<div class="relative">
		{#if isSaving}
			<div
				class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-white/85"
				role="status"
				aria-live="polite"
				aria-busy="true"
			>
				<Loader2 class="size-8 animate-spin text-primary" aria-hidden="true" />
				<p class="text-sm text-muted-foreground">Saving…</p>
			</div>
		{/if}
		<div class="space-y-4">
			{#if formError}
				<ApiErrorBanner message={formError} />
			{/if}
			<div class="space-y-2">
				<Label for="stub-bom-name" text="Subtype" required />
				<Input
					id="stub-bom-name"
					autofocus
					bind:value={formData.bomName}
					placeholder="Enter subtype name"
					disabled={isSaving}
				/>
			</div>
			<div class="space-y-2">
				<Label for="stub-add-bom-weight" text="Weight (MT)" />
				<Input
					id="stub-add-bom-weight"
					type="number"
					min="0"
					step="any"
					bind:value={formData.weightMt}
					placeholder="e.g. 2.4"
					disabled={isSaving}
				/>
			</div>
			<div class="space-y-2">
				<Label for="stub-add-bom-file" text="BOM File" />
				{#key bomFileInputKey}
					<Input
						id="stub-add-bom-file"
						type="file"
						accept={BOM_CSV_FILE_ACCEPT}
						multiple={false}
						disabled={isSaving}
						class={FILE_INPUT_CLASS}
						onchange={handleBomFileChange}
					/>
				{/key}
			</div>
		</div>

		<div class="mt-8 flex w-full items-center justify-end gap-3 border-t border-gray-200 pt-6">
			<Button variant="outline" label="Cancel" disabled={isSaving} onclick={closeAddDialog} />
			<Button
				variant="primary"
				label={isSaving ? 'Adding...' : 'Add Subtype'}
				disabled={isSaving}
				loading={isSaving}
				onclick={handleAddConfirm}
				class="min-w-28"
			/>
		</div>
	</div>
</Dialog>

<Dialog
	bind:open={isEditDialogOpen}
	title="Edit Subtype"
	hideFooter={true}
	closeOnBackdrop={!isSaving}
	showCloseButton={!isSaving}
	onConfirm={handleEditConfirm}
	onOpenChange={(open) => {
		if (!open && !isSaving) closeEditDialog();
	}}
>
	<div class="relative">
		{#if isSaving}
			<div
				class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-white/85"
				role="status"
				aria-live="polite"
				aria-busy="true"
			>
				<Loader2 class="size-8 animate-spin text-primary" aria-hidden="true" />
				<p class="text-sm text-muted-foreground">Saving…</p>
			</div>
		{/if}
		<div class="space-y-4">
			{#if formError}
				<ApiErrorBanner message={formError} />
			{/if}
			<div class="space-y-2">
				<Label for="edit-stub-bom-name" text="Subtype name" required />
				<Input
					id="edit-stub-bom-name"
					autofocus
					bind:value={formData.bomName}
					placeholder="Enter subtype name"
					disabled={isSaving}
				/>
			</div>
			<div class="space-y-2">
				<Label for="edit-stub-bom-weight" text="Weight (MT)" />
				<Input
					id="edit-stub-bom-weight"
					type="number"
					min="0"
					step="any"
					bind:value={formData.weightMt}
					placeholder="e.g. 2.4"
					disabled={isSaving}
				/>
			</div>
		</div>

		<div class="mt-8 flex w-full items-center justify-end gap-3 border-t border-gray-200 pt-6">
			<Button variant="outline" label="Cancel" disabled={isSaving} onclick={closeEditDialog} />
			<Button
				variant="primary"
				label={isSaving ? 'Saving...' : 'Update Subtype'}
				disabled={isSaving}
				loading={isSaving}
				onclick={handleEditConfirm}
				class="min-w-28"
			/>
		</div>
	</div>
</Dialog>

<ConfirmationDialog
	bind:open={isDeleteDialogOpen}
	title="Delete subtype"
	description={deleteSubtypeDescription}
	confirmLabel={isSaving ? 'Deleting...' : 'Delete'}
	confirmVariant="danger"
	iconTone="danger"
	onConfirm={handleDeleteConfirm}
/>
