<script lang="ts">
	import { onMount } from 'svelte';
	import {
		EllipsisVertical,
		FileText,
		Layers,
		Loader2,
		Plus,
		Trash2,
		Upload
	} from '@lucide/svelte';
	import {
		DataTable,
		Dialog,
		Input,
		Label,
		Button,
		ConfirmationDialog,
		type DataTableColumn,
		type TableAction
	} from '@ifactory/ui-v2';
	import ApiErrorBanner from '../components/ApiErrorBanner.svelte';
	import {
		bomDrawingSetHash,
		bomItemsHash,
		bomStructureFromParams,
		structureId
	} from '../lib/bom-structure-routes.js';
	import { showPageTopLoadErrors } from '../lib/show-page-top-load-errors.js';
	import { formatApiErrorMessage } from '../../lib/api/types.js';
	import { formatUtcAsIst } from '../../lib/datetime/format-ist.js';
	import { pmPushErrorToast, pmPushSuccessToast } from '../lib/toast';
	import {
		bindBomExtractHandlers,
		bomExtractStatusVersion,
		clearLiveExtractStatus,
		hydrateBomExtractStatuses,
		queueBomExtraction,
		resolveLiveExtractStatus,
		resumeBomExtractPolls,
		seedLiveExtractStatuses,
		stopBomExtractPoll,
		unbindBomExtractHandlers
	} from '../lib/bom-extract-poll.svelte.js';
	import {
		isBomExtractInProgress,
		isBomExtractReady,
		needsBomExtractAction,
		type BomExtractStatus
	} from '../lib/bom-extract-status.js';
	import { filesUpload } from '../lib/core-api.js';
	import {
		BOM_CSV_FILE_ACCEPT,
		BOM_CSV_MULTIPLE_FILES_ERROR,
		readSingleBomCsvFromInput,
		validateBomCsvHeaders
	} from '../lib/projects/bom-csv-validation.js';
	import {
		cleanupBeforeBomCsvReupload,
		clearBomCsvClientState,
		removeReplacedUploadedFile
	} from '../lib/projects/bom-reupload-cleanup.js';
	import { deleteBomCsvFile, getBomById, setBomFileId } from '../lib/projects/boms.api.js';
	import {
		bomExtractStatusBadge,
		bomFileDisplayStatusBadge
	} from '../lib/projects/bom-status-badges.js';
	import {
		buildDrawingSetListRows,
		deleteDrawingSet,
		listBomDrawingFiles,
		nextDrawingSetName,
		nextSetSortOrder,
		readPendingDrawingSetNames,
		uploadDrawingPdfToSet,
		type BomDrawingFile,
		type BomDrawingSetListRow
	} from '../lib/projects/drawing-sets.api.js';
	import { patchTowerBomInList, upsertBomBreadcrumb } from '../lib/projects/load-boms.js';
	import { patchStubBomInList } from '../lib/projects/load-stub-boms.js';
	import type { BomConfig } from '../lib/store.svelte.js';

	interface Props {
		params: {
			projectId: string;
			towerId?: string;
			stubId?: string;
			bomId: string;
		};
	}

	let { params }: Props = $props();

	const projectId = $derived(params.projectId);
	const structure = $derived(bomStructureFromParams(params));
	const structureKey = $derived(structureId(structure));
	const bomId = $derived(params.bomId);

	const BOM_DETAIL_FETCH = {
		includeDrawings: false,
		includePublishedCp: false
	} as const;

	type BomFileRow = {
		id: string;
		fileName: string;
		extractStatus: BomExtractStatus | 'uploading';
		updated: string;
		isUploading?: boolean;
	};

	type DrawingSetRow = BomDrawingSetListRow;

	let bom = $state<BomConfig | null>(null);
	let drawingFiles = $state<BomDrawingFile[]>([]);
	let drawingSets = $state<DrawingSetRow[]>([]);
	let isLoading = $state(true);
	let loadError = $state('');
	let uploadError = $state('');
	let isUploading = $state(false);
	let isQueuingExtract = $state(false);
	let uploadingBomFileName = $state<string | null>(null);
	let isDeletingBomFile = $state(false);
	let isDeleteBomFileDialogOpen = $state(false);
	let isDeleteDrawingSetDialogOpen = $state(false);
	let isDeletingDrawingSet = $state(false);
	let activeDrawingSet = $state<DrawingSetRow | null>(null);
	let isAddDrawingSetDialogOpen = $state(false);
	let isSavingDrawingSet = $state(false);
	let drawingSetFormError = $state('');
	let drawingSetFileInputKey = $state(0);
	let selectedDrawingFiles = $state<File[]>([]);
	let bomFileInputKey = $state(0);
	let bomFileInput = $state<HTMLInputElement | null>(null);

	const hasBomFile = $derived(Boolean(bom?.bomFileId || bom?.bomFile));

	const BOM_COL_BTN =
		"inline-flex h-8 w-[7rem] shrink-0 items-center justify-center box-border rounded-none border-0 px-2 py-0 text-xs font-bold text-white font-['Space_Grotesk']";

	const EMPTY_TABLE_STATE_CLASS = 'min-h-48';
	const FILE_INPUT_CLASS =
		'cursor-pointer pt-1 file:mr-4 file:rounded-none file:border-0 file:bg-gray-100 file:px-3 file:py-1 file:text-gray-700 hover:file:bg-gray-200';

	const hasDrawingSets = $derived(drawingSets.length > 0);
	const useCompactDrawingSetTable = $derived(isLoading || !hasDrawingSets);
	const drawingsEditable = $derived(bom?.stage !== 'mass');
	const nextDrawingSetLabel = $derived(
		nextDrawingSetName(drawingFiles, readPendingDrawingSetNames(bomId))
	);

	const bomFileRows = $derived.by((): BomFileRow[] => {
		void bomExtractStatusVersion();

		if (isUploading && uploadingBomFileName) {
			return [
				{
					id: '__uploading__',
					fileName: uploadingBomFileName,
					extractStatus: 'uploading',
					updated: '—',
					isUploading: true
				}
			];
		}

		const current = bom;
		if (!current) return [];
		if (!current.bomFileId && !current.bomFile) return [];

		const extractStatus = resolveLiveExtractStatus(current.id, current.extractStatus);
		return [
			{
				id: current.id,
				fileName: current.bomFile?.trim() || 'BOM file',
				extractStatus,
				updated: current.bomFileUploadedAt ? formatUtcAsIst(current.bomFileUploadedAt) : '—'
			}
		];
	});

	function errorMessage(error: unknown): string {
		if (error instanceof DOMException && error.name === 'AbortError') return '';
		return formatApiErrorMessage(error);
	}

	function bomMetadataSnapshot(current: BomConfig): Record<string, unknown> {
		const metadata: Record<string, unknown> = {};
		if (current.bomFile) metadata.bom_file_name = current.bomFile;
		if (current.drawingsFile) metadata.drawings_file_name = current.drawingsFile;
		if (current.operationsCountRoi != null)
			metadata.operations_count_roi = current.operationsCountRoi;
		return metadata;
	}

	function toStructureBom(next: BomConfig): BomConfig {
		if (structure.kind === 'stub') {
			return { ...next, towerId: undefined, stubId: structure.stubId };
		}
		return { ...next, stubId: undefined, towerId: structure.towerId };
	}

	function syncBom(next: BomConfig) {
		bom = toStructureBom(next);
		upsertBomBreadcrumb(bom);
	}

	function resetBomFileInput() {
		bomFileInputKey += 1;
	}

	function isCsvFile(name: string): boolean {
		return name.toLowerCase().endsWith('.csv');
	}

	function openBomFilePicker() {
		if (isUploading || isDeletingBomFile) return;
		bomFileInput?.click();
	}

	function openDeleteBomFileDialog() {
		if (isUploading || isDeletingBomFile || !hasBomFile) return;
		isDeleteBomFileDialogOpen = true;
	}

	async function handleDeleteBomFileConfirm() {
		if (!bom || !hasBomFile || isDeletingBomFile) return;

		isDeletingBomFile = true;
		const fileId = bom.bomFileId;

		try {
			await clearBomCsvClientState(bom.id);
			await deleteBomCsvFile(bom.id, fileId);
			stopBomExtractPoll(bom.id);
			clearLiveExtractStatus(bom.id);
			const refreshed = await getBomById(
				projectId,
				structureKey,
				bomId,
				undefined,
				BOM_DETAIL_FETCH
			);
			if (refreshed) syncBom(refreshed);
			else {
				syncBom({
					...bom,
					bomFileId: null,
					bomFile: null,
					extractStatus: 'pending'
				});
			}
			pmPushSuccessToast({ title: 'BOM file deleted' });
		} catch (error) {
			const message = errorMessage(error);
			if (message) {
				pmPushErrorToast({
					title: 'Could not delete BOM file',
					description: message
				});
			}
			throw error;
		} finally {
			isDeletingBomFile = false;
		}
	}

	function rebuildDrawingSets() {
		const pending = readPendingDrawingSetNames(bomId);
		drawingSets = buildDrawingSetListRows(drawingFiles, bom?.stage ?? 'proto', pending);
	}

	function openAddDrawingSetDialog() {
		if (!drawingsEditable) return;
		drawingSetFormError = '';
		selectedDrawingFiles = [];
		drawingSetFileInputKey += 1;
		isAddDrawingSetDialogOpen = true;
	}

	function closeAddDrawingSetDialog() {
		isAddDrawingSetDialogOpen = false;
		drawingSetFormError = '';
		selectedDrawingFiles = [];
		drawingSetFileInputKey += 1;
	}

	function isPdfFile(name: string): boolean {
		return name.toLowerCase().endsWith('.pdf');
	}

	function handleDrawingSetFileChange(event: Event) {
		const target = event.target as HTMLInputElement;
		const selected = [...(target.files ?? [])];
		if (selected.length === 0) {
			selectedDrawingFiles = [];
			return;
		}

		drawingSetFormError = '';
		const invalid = selected.find((file) => !isPdfFile(file.name));
		if (invalid) {
			drawingSetFormError = 'All drawing files must be .pdf files.';
			selectedDrawingFiles = [];
			drawingSetFileInputKey += 1;
			return;
		}

		selectedDrawingFiles = selected;
	}

	async function handleAddDrawingSetConfirm() {
		if (!drawingsEditable || isSavingDrawingSet) return;
		if (selectedDrawingFiles.length === 0) {
			drawingSetFormError = 'At least one drawing PDF is required.';
			return;
		}

		const pending = readPendingDrawingSetNames(bomId);
		const name = nextDrawingSetLabel;
		const setSortOrder = nextSetSortOrder(drawingFiles, pending);

		isSavingDrawingSet = true;
		drawingSetFormError = '';

		try {
			const created: BomDrawingFile[] = [];
			let sortOrder = 0;
			for (const file of selectedDrawingFiles) {
				created.push(await uploadDrawingPdfToSet(bomId, name, file, setSortOrder, sortOrder));
				sortOrder += 1;
			}
			drawingFiles = [...drawingFiles, ...created];
			rebuildDrawingSets();
			const fileCount = created.length;
			closeAddDrawingSetDialog();
			pmPushSuccessToast({
				title: fileCount === 1 ? `${name} created` : `${name} created with ${fileCount} drawings`
			});
		} catch (error) {
			drawingSetFormError = errorMessage(error);
		} finally {
			isSavingDrawingSet = false;
		}
	}

	function handleViewDrawingSet(row: DrawingSetRow) {
		window.location.hash = bomDrawingSetHash(projectId, structure, bomId, row.name);
	}

	function openDeleteDrawingSetDialog(row: DrawingSetRow) {
		if (!drawingsEditable) return;
		activeDrawingSet = row;
		isDeleteDrawingSetDialogOpen = true;
	}

	async function handleDeleteDrawingSetConfirm() {
		if (!activeDrawingSet || isDeletingDrawingSet || !drawingsEditable) return;

		isDeletingDrawingSet = true;

		try {
			await deleteDrawingSet(bomId, activeDrawingSet.name, drawingFiles);
			drawingFiles = await listBomDrawingFiles(bomId);
			rebuildDrawingSets();
			if (bom) bom = { ...bom, ocrStatus: 'not_verified', operationsCountRoi: null };
			activeDrawingSet = null;
			pmPushSuccessToast({ title: 'Drawing set deleted' });
		} catch (error) {
			const message = errorMessage(error);
			if (message) {
				pmPushErrorToast({
					title: 'Could not delete drawing set',
					description: message
				});
			}
			throw error;
		} finally {
			isDeletingDrawingSet = false;
		}
	}

	function handleViewBomFile() {
		if (!bom || !isBomExtractReady(bom)) return;
		window.location.hash = bomItemsHash(projectId, structure, bomId);
	}

	async function handleExtractBom() {
		const current = bom;
		if (!current?.bomFileId || isQueuingExtract) return;

		isQueuingExtract = true;
		try {
			await queueBomExtraction(projectId, structureKey, current, current.bomFileId, {
				force: current.extractStatus === 'failed'
			});
			const refreshed = await getBomById(
				projectId,
				structureKey,
				bomId,
				undefined,
				BOM_DETAIL_FETCH
			);
			if (refreshed) syncBom(refreshed);
		} catch (error) {
			const message = errorMessage(error);
			if (message) {
				pmPushErrorToast({
					title: 'Could not start BOM extraction',
					description: message
				});
			}
		} finally {
			isQueuingExtract = false;
		}
	}

	async function handleBomFileChange(event: Event) {
		const target = event.target as HTMLInputElement;
		const picked = readSingleBomCsvFromInput(target);
		if (!picked.ok) {
			if (picked.reason === 'multiple') {
				uploadError = BOM_CSV_MULTIPLE_FILES_ERROR;
				resetBomFileInput();
			} else {
				resetBomFileInput();
			}
			return;
		}

		const file = picked.file;
		if (!bom) {
			resetBomFileInput();
			return;
		}

		uploadError = '';

		if (!isCsvFile(file.name)) {
			uploadError = 'BOM file must be a .csv file.';
			resetBomFileInput();
			return;
		}

		const validation = await validateBomCsvHeaders(file);
		if (!validation.valid) {
			uploadError = `Invalid BOM CSV headers. Missing columns: ${validation.missingColumns.join(', ')}`;
			resetBomFileInput();
			return;
		}

		uploadingBomFileName = file.name;
		isUploading = true;
		const isReplacement = Boolean(bom.bomFileId);
		const previousBomFileId = bom.bomFileId;

		try {
			if (isReplacement) {
				await cleanupBeforeBomCsvReupload(bom.id);
			}

			const bomFileId = await filesUpload(file, file.name, 'proj_boms', bom.id);
			await setBomFileId(bom.id, bomFileId, bomMetadataSnapshot(bom), file.name);
			await removeReplacedUploadedFile(previousBomFileId, bomFileId);

			const nextBom: BomConfig = {
				...bom,
				bomFileId,
				bomFile: file.name,
				extractStatus: isReplacement ? 'pending' : bom.extractStatus
			};
			syncBom(nextBom);

			if (nextBom.bomFileId) {
				await queueBomExtraction(projectId, structureKey, nextBom, nextBom.bomFileId, {
					force: isReplacement
				});
				const refreshed = await getBomById(
					projectId,
					structureKey,
					bomId,
					undefined,
					BOM_DETAIL_FETCH
				);
				if (refreshed) syncBom(refreshed);
			}

			pmPushSuccessToast({
				title: 'BOM file updated'
			});
		} catch (error) {
			uploadError = errorMessage(error);
		} finally {
			isUploading = false;
			uploadingBomFileName = null;
			resetBomFileInput();
		}
	}

	function bomPrimaryAction(
		label: string,
		options: { loading?: boolean; disabled?: boolean; onClick?: () => void } = {}
	): TableAction<BomFileRow> {
		return {
			type: 'button',
			label,
			variant: 'primary',
			size: 'sm',
			class: BOM_COL_BTN,
			loading: options.loading ?? false,
			disabled: options.disabled ?? false,
			onClick: options.onClick ?? (() => {})
		};
	}

	function bomFileActions(row: BomFileRow): TableAction<BomFileRow>[] {
		const dropdown: TableAction<BomFileRow> = {
			type: 'dropdown',
			icon: EllipsisVertical,
			align: 'end',
			ariaLabel: 'More actions',
			items: () => [
				[
					{
						label: 'Delete',
						icon: Trash2,
						onClick: () => openDeleteBomFileDialog()
					}
				]
			]
		};

		if (row.isUploading) {
			return [bomPrimaryAction('Uploading', { loading: true, disabled: true }), dropdown];
		}

		const current = bom;
		if (!current) return [dropdown];

		const extractStatus = resolveLiveExtractStatus(current.id, current.extractStatus);
		const bomWithStatus = { ...current, extractStatus };
		const isExtracting = isQueuingExtract || isBomExtractInProgress(extractStatus);

		if (isExtracting) {
			return [bomPrimaryAction('Extracting', { loading: true, disabled: true }), dropdown];
		}

		if (needsBomExtractAction(bomWithStatus)) {
			return [
				bomPrimaryAction('Extract', {
					onClick: handleExtractBom
				}),
				dropdown
			];
		}

		return [bomPrimaryAction('View', { onClick: handleViewBomFile }), dropdown];
	}

	function drawingSetActions(row: DrawingSetRow): TableAction<DrawingSetRow>[] {
		const actions: TableAction<DrawingSetRow>[] = [
			{
				type: 'button',
				label: 'View',
				variant: 'primary',
				size: 'sm',
				class: BOM_COL_BTN,
				onClick: () => handleViewDrawingSet(row)
			}
		];

		if (drawingsEditable) {
			actions.push({
				type: 'dropdown',
				icon: EllipsisVertical,
				align: 'end',
				ariaLabel: 'More actions',
				items: () => [
					[
						{
							label: 'Delete',
							icon: Trash2,
							onClick: () => openDeleteDrawingSetDialog(row)
						}
					]
				]
			});
		}

		return actions;
	}

	const bomFileColumns = $derived.by((): DataTableColumn<BomFileRow>[] => {
		void bomExtractStatusVersion();
		void isQueuingExtract;
		void isUploading;

		return [
			{
				type: 'serial',
				key: 'sNo',
				header: 'S.No',
				sortable: true,
				filterable: true,
				dataType: 'number',
				value: () => '1'
			},
			{
				type: 'text',
				key: 'fileName',
				header: 'File',
				sortable: true,
				filterable: true,
				dataType: 'string',
				value: (row) => row.fileName
			},
			{
				type: 'badge',
				key: 'status',
				header: 'Status',
				sortable: true,
				filterable: true,
				dataType: 'string',
				badge: (row) =>
					row.extractStatus === 'uploading'
						? bomFileDisplayStatusBadge('Uploading…')
						: bomExtractStatusBadge(row.extractStatus)
			},
			{
				type: 'text',
				key: 'updated',
				header: 'Uploaded at',
				sortable: true,
				filterable: true,
				dataType: 'string',
				value: (row) => row.updated
			},
			{
				type: 'actions',
				key: 'actions',
				header: 'Actions',
				headerClass: 'text-right',
				class: 'text-right',
				actions: bomFileActions
			}
		];
	});

	const drawingSetColumns = $derived.by((): DataTableColumn<DrawingSetRow>[] => [
		{
			type: 'serial',
			key: 'sNo',
			header: 'S.No',
			sortable: true,
			filterable: true,
			dataType: 'number',
			value: (row) => String(drawingSets.findIndex((set) => set.id === row.id) + 1)
		},
		{
			type: 'text',
			key: 'name',
			header: 'Drawing set',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => row.name
		},
		{
			type: 'text',
			key: 'files',
			header: 'Files',
			sortable: true,
			filterable: true,
			dataType: 'number',
			value: (row) => String(row.files)
		},
		{
			type: 'badge',
			key: 'status',
			header: 'Status',
			sortable: true,
			filterable: true,
			dataType: 'string',
			badge: (row) => bomFileDisplayStatusBadge(row.status)
		},
		{
			type: 'text',
			key: 'updated',
			header: 'Uploaded at',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => row.updated
		},
		{
			type: 'actions',
			key: 'actions',
			header: 'Actions',
			headerClass: 'text-right',
			class: 'text-right',
			actions: drawingSetActions
		}
	]);

	onMount(() => {
		const controller = new AbortController();

		bindBomExtractHandlers({
			getBom: (id) => (bom?.id === id ? bom : undefined),
			updateBom: (next) => {
				const patched =
					structure.kind === 'stub'
						? patchStubBomInList(bom ? [bom] : [], toStructureBom(next))[0]
						: patchTowerBomInList(bom ? [bom] : [], toStructureBom(next))[0];
				syncBom(patched ?? toStructureBom(next));
			}
		});

		void (async () => {
			isLoading = true;
			loadError = '';
			try {
				const [loaded, files] = await Promise.all([
					getBomById(projectId, structureKey, bomId, controller.signal, BOM_DETAIL_FETCH),
					listBomDrawingFiles(bomId, controller.signal)
				]);
				bom = loaded ? toStructureBom(loaded) : null;
				if (bom) {
					upsertBomBreadcrumb(bom);
					seedLiveExtractStatuses([bom]);
					await hydrateBomExtractStatuses([bom]);
					resumeBomExtractPolls([bom]);
				}
				drawingFiles = files;
				rebuildDrawingSets();
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
</script>

<div class="flex h-full min-h-0 flex-col overflow-y-auto p-4">
	{#if showPageTopLoadErrors && loadError}
		<div class="mb-4">
			<ApiErrorBanner message={loadError} />
		</div>
	{/if}

	{#if uploadError}
		<div class="mb-4">
			<ApiErrorBanner message={uploadError} />
		</div>
	{/if}

	{#if isLoading || bom}
		<div
			class="flex flex-col gap-4 {useCompactDrawingSetTable
				? ''
				: 'min-h-0 flex-1 overflow-hidden'}"
		>
			{#key bomFileInputKey}
				<input
					type="file"
					accept={BOM_CSV_FILE_ACCEPT}
					multiple={false}
					class="hidden"
					bind:this={bomFileInput}
					onchange={handleBomFileChange}
				/>
			{/key}

			<div class="relative shrink-0">
				{#if isUploading}
					<div
						class="absolute inset-0 z-50 flex flex-col items-center justify-center gap-2 bg-white/85"
						role="status"
						aria-live="polite"
						aria-busy="true"
					>
						<Loader2 class="size-8 animate-spin text-primary" aria-hidden="true" />
						<p class="text-sm text-muted-foreground">Uploading BOM file…</p>
					</div>
				{/if}
				<DataTable
					stickyHeader={false}
					columns={bomFileColumns}
					rows={bomFileRows}
					loading={isLoading}
					skeletonRowCount={1}
					rowKey={(row) => row.id}
					onRowClick={hasBomFile && !isUploading ? handleViewBomFile : undefined}
					search={{
						enabled: true,
						placeholder: 'Search BOM file...'
					}}
					export={{ enabled: false }}
					pagination={{ enabled: false }}
					emptyState={{
						icon: FileText,
						title: 'No BOM file',
						description: 'Update this version with a BOM CSV.',
						actionLabel: 'Update BOM',
						actionIcon: Upload,
						onAction: openBomFilePicker,
						class: EMPTY_TABLE_STATE_CLASS
					}}
				/>
			</div>

			<div class="relative {useCompactDrawingSetTable ? 'shrink-0' : 'min-h-0 flex-1'}">
				<DataTable
					stickyHeader={!useCompactDrawingSetTable}
					skeletonRowCount={useCompactDrawingSetTable ? 1 : undefined}
					class={useCompactDrawingSetTable ? undefined : 'min-h-0 flex-1'}
					columns={drawingSetColumns}
					rows={drawingSets}
					loading={isLoading}
					rowKey={(row) => row.id}
					onRowClick={handleViewDrawingSet}
					search={{
						enabled: true,
						placeholder: 'Search drawing sets...'
					}}
					export={{ enabled: false }}
					pagination={{ pageSize: 10 }}
					toolbarButton={{
						enabled: !isLoading && drawingsEditable && hasDrawingSets,
						label: 'New drawing set',
						icon: Plus,
						variant: 'primary',
						onClick: openAddDrawingSetDialog
					}}
					emptyState={{
						icon: Layers,
						title: 'No drawing sets',
						description: drawingsEditable
							? 'Create a drawing set to upload PDF drawings for this version.'
							: 'This published BOM version is read-only. Create a new version to change drawings.',
						actionLabel: drawingsEditable ? 'New drawing set' : undefined,
						actionIcon: drawingsEditable ? Plus : undefined,
						onAction: drawingsEditable ? openAddDrawingSetDialog : undefined,
						class: EMPTY_TABLE_STATE_CLASS
					}}
				/>
			</div>
		</div>
	{:else}
		<p class="text-sm text-muted-foreground">BOM version not found.</p>
	{/if}
</div>

<ConfirmationDialog
	bind:open={isDeleteBomFileDialogOpen}
	title="Delete BOM file"
	description="Removes the CSV, extracted rows, and uploaded file for this version."
	confirmLabel={isDeletingBomFile ? 'Deleting...' : 'Delete'}
	confirmVariant="danger"
	iconTone="danger"
	onConfirm={handleDeleteBomFileConfirm}
/>

<ConfirmationDialog
	bind:open={isDeleteDrawingSetDialogOpen}
	title="Delete drawing set"
	description={activeDrawingSet
		? `Delete “${activeDrawingSet.name}” and all drawings in it?`
		: 'Delete this drawing set?'}
	confirmLabel={isDeletingDrawingSet ? 'Deleting...' : 'Delete'}
	confirmVariant="danger"
	iconTone="danger"
	onConfirm={handleDeleteDrawingSetConfirm}
/>

<Dialog
	bind:open={isAddDrawingSetDialogOpen}
	title="New drawing set"
	hideFooter={true}
	closeOnBackdrop={!isSavingDrawingSet}
	showCloseButton={!isSavingDrawingSet}
	onConfirm={handleAddDrawingSetConfirm}
>
	{#if isSavingDrawingSet}
		<div
			class="flex min-h-48 flex-col items-center justify-center gap-2 py-6"
			role="status"
			aria-live="polite"
			aria-busy="true"
		>
			<Loader2 class="size-8 animate-spin text-primary" aria-hidden="true" />
			<p class="text-sm text-muted-foreground">
				{selectedDrawingFiles.length > 1
					? `Uploading ${selectedDrawingFiles.length} drawings…`
					: 'Uploading drawing…'}
			</p>
		</div>
	{:else}
		<div class="space-y-4">
			{#if drawingSetFormError}
				<ApiErrorBanner message={drawingSetFormError} />
			{/if}
			<div class="space-y-2">
				<Label for="drawing-set-name" text="Drawing set" />
				<Input id="drawing-set-name" value={nextDrawingSetLabel} disabled />
			</div>
			<div class="space-y-2">
				<Label for="drawing-set-file" text="Drawings (PDF)" required />
				{#key drawingSetFileInputKey}
					<Input
						id="drawing-set-file"
						type="file"
						accept=".pdf,application/pdf"
						multiple
						class={FILE_INPUT_CLASS}
						onchange={handleDrawingSetFileChange}
					/>
				{/key}
			</div>
			<div class="mt-8 flex w-full items-center justify-end gap-3 border-t border-gray-200 pt-6">
				<Button variant="outline" label="Cancel" onclick={closeAddDrawingSetDialog} />
				<Button
					variant="primary"
					label="Create"
					onclick={() => void handleAddDrawingSetConfirm()}
					class="min-w-28"
				/>
			</div>
		</div>
	{/if}
</Dialog>
