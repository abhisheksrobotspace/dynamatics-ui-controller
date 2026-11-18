<script lang="ts">
	import { onMount } from 'svelte';
	import { EllipsisVertical, FileText, Loader2, Trash2, Upload } from '@lucide/svelte';
	import {
		DataTable,
		ConfirmationDialog,
		type DataTableColumn,
		type TableAction
	} from '@ifactory/ui-v2';
	import ApiErrorBanner from '../components/ApiErrorBanner.svelte';
	import { bomStructureFromParams, structureId } from '../lib/bom-structure-routes.js';
	import { showPageTopLoadErrors } from '../lib/show-page-top-load-errors.js';
	import { formatApiErrorMessage } from '../../lib/api/types.js';
	import { pmPushErrorToast, pmPushSuccessToast } from '../lib/toast';
	import { getBomById } from '../lib/projects/boms.api.js';
	import { bomFileDisplayStatusBadge } from '../lib/projects/bom-status-badges.js';
	import {
		buildDrawingFileListRows,
		deleteBomDrawingFile,
		listBomDrawingFiles,
		nextFileSortOrder,
		readPendingDrawingSetNames,
		type BomDrawingFile,
		type BomDrawingFileListRow,
		uploadDrawingPdfToSet
	} from '../lib/projects/drawing-sets.api.js';
	import type { BomConfig } from '../lib/store.svelte.js';

	interface Props {
		params: {
			projectId: string;
			towerId?: string;
			stubId?: string;
			bomId: string;
			drawingSetName: string;
		};
	}

	let { params }: Props = $props();

	const projectId = $derived(params.projectId);
	const structure = $derived(bomStructureFromParams(params));
	const structureKey = $derived(structureId(structure));
	const bomId = $derived(params.bomId);
	const drawingSetName = $derived(decodeURIComponent(params.drawingSetName ?? ''));

	const BOM_DETAIL_FETCH = {
		includeDrawings: false,
		includePublishedCp: false
	} as const;

	const EMPTY_TABLE_STATE_CLASS = 'min-h-48';

	type DrawingFileTableRow = Omit<BomDrawingFileListRow, 'status'> & {
		isUploading?: boolean;
		status: BomDrawingFileListRow['status'] | 'Uploading…';
	};

	let bom = $state<BomConfig | null>(null);
	let drawingFiles = $state<BomDrawingFile[]>([]);
	let resolvedFileRows = $state<BomDrawingFileListRow[]>([]);
	let isLoading = $state(true);
	let loadError = $state('');
	let uploadError = $state('');
	let isUploading = $state(false);
	let uploadingFileNames = $state<string[]>([]);
	let isDeleting = $state(false);
	let isDeleteFileDialogOpen = $state(false);
	let activeFile = $state<BomDrawingFileListRow | null>(null);
	let fileInputKey = $state(0);
	let fileInput = $state<HTMLInputElement | null>(null);

	const setSortOrder = $derived(
		drawingFiles.find((file) => file.drawingSet === drawingSetName)?.setSortOrder ??
			readPendingDrawingSetNames(bomId).indexOf(drawingSetName)
	);

	const fileRows = $derived.by((): DrawingFileTableRow[] => {
		if (!bom) return [];

		const placeholders = uploadingFileNames
			.filter((name) => !resolvedFileRows.some((row) => row.fileName === name))
			.map((name, index): DrawingFileTableRow => ({
				id: `uploading-${name}-${index}`,
				bomDrawingId: '',
				fileId: '',
				fileName: name,
				status: 'Uploading…',
				updated: '—',
				sortOrder: resolvedFileRows.length + index,
				isUploading: true
			}));

		return [...resolvedFileRows, ...placeholders];
	});

	const useCompactDrawingsTable = $derived(isLoading || fileRows.length === 0);
	const drawingsEditable = $derived(bom?.stage !== 'mass');

	function errorMessage(error: unknown): string {
		if (error instanceof DOMException && error.name === 'AbortError') return '';
		return formatApiErrorMessage(error);
	}

	function toStructureBom(next: BomConfig): BomConfig {
		if (structure.kind === 'stub') {
			return { ...next, towerId: undefined, stubId: structure.stubId };
		}
		return { ...next, stubId: undefined, towerId: structure.towerId };
	}

	async function reloadDrawingFiles(signal?: AbortSignal) {
		drawingFiles = await listBomDrawingFiles(bomId, signal);
		if (bom) {
			resolvedFileRows = await buildDrawingFileListRows(drawingFiles, drawingSetName, bom.stage);
		} else {
			resolvedFileRows = [];
		}
	}

	function resetFileInput() {
		fileInputKey += 1;
	}

	function openFilePicker() {
		if (!drawingsEditable || isUploading || isDeleting) return;
		fileInput?.click();
	}

	function isPdfFile(name: string): boolean {
		return name.toLowerCase().endsWith('.pdf');
	}

	async function handleFilesChange(event: Event) {
		const target = event.target as HTMLInputElement;
		const selected = [...(target.files ?? [])];
		if (selected.length === 0 || !bom) {
			resetFileInput();
			return;
		}

		uploadError = '';
		uploadingFileNames = selected.map((file) => file.name);
		isUploading = true;
		let sortOrder = nextFileSortOrder(drawingFiles, drawingSetName);
		const resolvedSetSortOrder =
			setSortOrder >= 0
				? setSortOrder
				: drawingFiles.length > 0
					? Math.max(...drawingFiles.map((file) => file.setSortOrder)) + 1
					: 0;

		try {
			for (const file of selected) {
				if (!isPdfFile(file.name)) {
					throw new Error('Drawing files must be PDFs.');
				}

				await uploadDrawingPdfToSet(bomId, drawingSetName, file, resolvedSetSortOrder, sortOrder);
				sortOrder += 1;
			}

			await reloadDrawingFiles();
			pmPushSuccessToast({
				title: selected.length === 1 ? 'Drawing uploaded' : 'Drawings uploaded'
			});
		} catch (error) {
			uploadError = errorMessage(error);
		} finally {
			isUploading = false;
			uploadingFileNames = [];
			resetFileInput();
		}
	}

	function openDeleteFileDialog(row: BomDrawingFileListRow) {
		if (!drawingsEditable) return;
		activeFile = row;
		isDeleteFileDialogOpen = true;
	}

	async function handleDeleteFileConfirm() {
		if (!activeFile || isDeleting || !drawingsEditable) return;

		const target = drawingFiles.find((file) => file.bomDrawingId === activeFile!.bomDrawingId);
		if (!target) return;

		isDeleting = true;
		try {
			await deleteBomDrawingFile(bomId, target);
			await reloadDrawingFiles();
			if (bom) bom = { ...bom, ocrStatus: 'not_verified', operationsCountRoi: null };
			activeFile = null;
			pmPushSuccessToast({ title: 'Drawing deleted' });
		} catch (error) {
			const message = errorMessage(error);
			if (message) {
				pmPushErrorToast({
					title: 'Could not delete drawing',
					description: message
				});
			}
			throw error;
		} finally {
			isDeleting = false;
		}
	}

	function fileActions(row: DrawingFileTableRow): TableAction<DrawingFileTableRow>[] {
		if (row.isUploading) {
			return [
				{
					type: 'button',
					label: 'Uploading',
					variant: 'ghost',
					size: 'sm',
					loading: true,
					disabled: true,
					class: 'pointer-events-none cursor-default opacity-70',
					onClick: () => {}
				}
			];
		}

		if (!drawingsEditable) return [];

		return [
			{
				type: 'dropdown',
				icon: EllipsisVertical,
				align: 'end',
				ariaLabel: 'More actions',
				items: () => [
					[
						{
							label: 'Delete',
							icon: Trash2,
							onClick: (selectedRow) => openDeleteFileDialog(selectedRow)
						}
					]
				]
			}
		];
	}

	const columns = $derived.by((): DataTableColumn<DrawingFileTableRow>[] => [
		{
			type: 'serial',
			key: 'sNo',
			header: 'S.No',
			sortable: true,
			filterable: true,
			dataType: 'number',
			value: (row) => String(fileRows.findIndex((entry) => entry.id === row.id) + 1)
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
			actions: fileActions
		}
	]);

	onMount(() => {
		const controller = new AbortController();

		void (async () => {
			isLoading = true;
			loadError = '';
			try {
				const [loaded, files] = await Promise.all([
					getBomById(projectId, structureKey, bomId, controller.signal, BOM_DETAIL_FETCH),
					listBomDrawingFiles(bomId, controller.signal)
				]);
				bom = loaded ? toStructureBom(loaded) : null;
				drawingFiles = files;
				if (bom) {
					resolvedFileRows = await buildDrawingFileListRows(
						drawingFiles,
						drawingSetName,
						bom.stage
					);
				}
			} catch (error) {
				const message = errorMessage(error);
				if (message) loadError = message;
			} finally {
				isLoading = false;
			}
		})();

		return () => controller.abort();
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
		<div class="flex flex-col {useCompactDrawingsTable ? '' : 'min-h-0 flex-1 overflow-hidden'}">
			{#key fileInputKey}
				<input
					type="file"
					accept=".pdf,application/pdf"
					multiple
					class="hidden"
					bind:this={fileInput}
					onchange={handleFilesChange}
				/>
			{/key}

			<div class="relative {useCompactDrawingsTable ? 'shrink-0' : 'min-h-0 flex-1'}">
				{#if isUploading}
					<div
						class="absolute inset-0 z-50 flex flex-col items-center justify-center gap-2 bg-white/85"
						role="status"
						aria-live="polite"
						aria-busy="true"
					>
						<Loader2 class="size-8 animate-spin text-primary" aria-hidden="true" />
						<p class="text-sm text-muted-foreground">Uploading files…</p>
					</div>
				{/if}
				<DataTable
					stickyHeader={!useCompactDrawingsTable}
					skeletonRowCount={useCompactDrawingsTable ? 1 : undefined}
					class={useCompactDrawingsTable ? undefined : 'min-h-0 flex-1'}
					{columns}
					rows={fileRows}
					loading={isLoading}
					rowKey={(row) => row.id}
					search={{
						enabled: true,
						placeholder: 'Search drawings...'
					}}
					export={{ enabled: false }}
					pagination={{ pageSize: 10 }}
					toolbarButton={{
						enabled: !isLoading && drawingsEditable && fileRows.length > 0,
						label: 'Add drawings',
						icon: Upload,
						loading: isUploading,
						disabled: !drawingsEditable || isUploading || isDeleting,
						variant: 'primary',
						onClick: openFilePicker
					}}
					emptyState={{
						icon: FileText,
						title: 'No drawings in this set',
						description: drawingsEditable
							? 'Add one or more PDF drawings for this set.'
							: 'This published BOM version is read-only. Create a new version to change drawings.',
						actionLabel: drawingsEditable ? 'Add drawings' : undefined,
						actionIcon: drawingsEditable ? Upload : undefined,
						onAction: drawingsEditable ? openFilePicker : undefined,
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
	bind:open={isDeleteFileDialogOpen}
	title="Delete drawing"
	description={activeFile
		? `Remove “${activeFile.fileName}” from the set?`
		: 'Remove this drawing file from the set?'}
	confirmLabel={isDeleting ? 'Deleting...' : 'Delete'}
	confirmVariant="danger"
	iconTone="danger"
	onConfirm={handleDeleteFileConfirm}
/>
