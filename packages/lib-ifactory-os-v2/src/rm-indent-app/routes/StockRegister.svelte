<script lang="ts">
	import { onMount } from 'svelte';
	import {
		ClipboardCheck,
		Component,
		Copy,
		Download,
		EllipsisVertical,
		FileUp,
		Info,
		Loader2,
		Lock,
		Pencil,
		SearchX,
		TriangleAlert,
		Trash2
	} from '@lucide/svelte';
	import {
		Button,
		Combobox,
		ConfirmationDialog,
		DataTable,
		Dialog,
		FilterCardStrip,
		Input,
		Label,
		Table,
		type ComboboxItem,
		type DataTableColumn,
		type FilterCardItem,
		type TableColumn
	} from '@ifactory/ui-v2';
	import {
		buildStockUploadProjectMap,
		collectStockUploadProjectCodes,
		downloadStockUploadTemplate,
		parseStockUploadCsvFile,
		previewStockUploadCsv,
		stockUploadPreviewTableColumns,
		suggestStockUploadProjectMapping,
		StockUploadCsvError,
		type StockUploadProjectCodeCount,
		type StockUploadPreviewRow
	} from '../lib/parse-stock-upload-csv';
	import { rmiPushToast } from '../lib/toast';
	import type { StockFilter } from '../lib/stock-register.types';
	import {
		correctStockLineQty,
		formatApplyUploadSummaryParts,
		listStockRegister,
		listStockUploadValidationRefs,
		rowMatchesStockFilter,
		uploadAndApplyStockCsv,
		zeroStockLine,
		type StockRegisterDisplayRow
	} from '../lib/stock-register.api';
	import { type StockAvailableProjectRow } from '../lib/stock-available.api';
	import { formatApiErrorMessage } from '../../lib/api/types';
	import type { PlantRow } from '../lib/inv.types';

	// When navigated to from the new hierarchy (StockRegister/:projectId),
	// `params` carries the projectId — project dropdown is hidden and pre-filled.
	let { params = {} }: { params?: Record<string, string> } = $props();
	const contextProjectId = $derived(params.projectId ? decodeURIComponent(params.projectId) : '');

	let allRows = $state<StockRegisterDisplayRow[]>([]);
	let isLoading = $state(true);
	let selectedCsvFile = $state<File | null>(null);
	let isUploadDialogOpen = $state(false);
	let isUploading = $state(false);
	let isLoadingProjects = $state(false);
	let projectLoadError = $state('');
	let selectedPlantId = $state('');
	let projects = $state<StockAvailableProjectRow[]>([]);
	let plants = $state<PlantRow[]>([]);
	let previewTableRows = $state<StockUploadPreviewRow[]>([]);
	let csvProjectCodes = $state<StockUploadProjectCodeCount[]>([]);
	let projectMapping = $state<Record<string, string>>({});
	/** Remount file input so the browser clears the displayed filename. */
	let csvFileInputKey = $state(0);
	let isDeleteDialogOpen = $state(false);
	let isEditDialogOpen = $state(false);
	let activeRow = $state<StockRegisterDisplayRow | null>(null);
	let activeFilter = $state<StockFilter>('total-stock');
	/** Table scope: prefer route context; never cleared by the upload dialog. */
	let scopedProjectId = $state('');

	let editQty = $state('');
	let editBatch = $state('');
	let editPhysicalLocation = $state('');
	let editBundleNo = $state('');

	const registerProjectId = $derived(contextProjectId || scopedProjectId);

	const allProjectsMapped = $derived(
		csvProjectCodes.length > 0 &&
			csvProjectCodes.every((entry) => Boolean(projectMapping[entry.project_ref]?.trim()))
	);

	const totalCount = $derived(allRows.length);
	const freeCount = $derived(allRows.reduce((sum, row) => sum + row.free_base, 0));
	const lockedCount = $derived(allRows.reduce((sum, row) => sum + row.locked_base, 0));
	const sectionsCount = $derived(
		new Set(allRows.filter((row) => row.has_bom_section).map((row) => row.section)).size
	);
	const plantsCount = $derived(new Set(allRows.map((row) => row.plant_id).filter(Boolean)).size);

	const filterCards: FilterCardItem[] = $derived([
		{ id: 'total-stock', label: 'Total Stock', count: totalCount, icon: Copy },
		{ id: 'free', label: 'Free', count: freeCount, icon: ClipboardCheck },
		{ id: 'locked', label: 'Locked', count: lockedCount, icon: Lock },
		{ id: 'sections', label: 'Sections', count: sectionsCount, icon: SearchX },
		{ id: 'plants', label: 'Plants', count: plantsCount, icon: TriangleAlert }
	]);

	const projectComboboxItems = $derived.by((): ComboboxItem[] =>
		projects.map((project) => ({
			value: project.project_id,
			label: project.project_name
		}))
	);

	const plantComboboxItems = $derived.by((): ComboboxItem[] =>
		plants.map((plant) => ({
			value: plant.plant_id,
			label: plant.name
		}))
	);

	const previewColumns = $derived.by((): TableColumn<StockUploadPreviewRow>[] => {
		if (previewTableRows.length === 0) {
			return [
				{
					type: 'text' as const,
					key: 'placeholder',
					header: ' ',
					value: () => ''
				}
			];
		}
		return stockUploadPreviewTableColumns();
	});

	const editDialogTitle = $derived.by(() => {
		if (!activeRow) return 'Edit Stock Line';
		return `Edit Stock Line – ${activeRow.item_code} / ${activeRow.bundle_no}`;
	});

	const filteredRows = $derived(allRows.filter((row) => rowMatchesStockFilter(row, activeFilter)));

	/** Priority columns first, then remaining ERP template columns, then Actions. */
	const resultColumns: DataTableColumn<StockRegisterDisplayRow>[] = [
		{
			type: 'text',
			key: 'plant_label',
			header: 'Primary Location',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => row.plant_label
		},
		{
			type: 'text',
			key: 'project_label',
			header: 'Project #',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => row.project_label
		},
		{
			type: 'text',
			key: 'item_code',
			header: 'Item',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => row.item_code
		},
		{
			type: 'text',
			key: 'section',
			header: 'Section',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => row.section
		},
		{
			type: 'text',
			key: 'length_label',
			header: 'Length',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => row.length_label
		},
		{
			type: 'text',
			key: 'width_label',
			header: 'Width',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => row.width_label
		},
		{
			type: 'text',
			key: 'qty_label',
			header: 'Closing(Summ.) Nos.',
			sortable: true,
			filterable: true,
			dataType: 'number',
			value: (row) => row.qty_label
		},
		{
			type: 'text',
			key: 'physical_location',
			header: 'Physical Location',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => row.physical_location
		},
		{
			type: 'text',
			key: 'bundle_no',
			header: 'Bundle',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => row.bundle_no
		},
		{
			type: 'text',
			key: 'free_label',
			header: 'Free',
			sortable: true,
			filterable: true,
			dataType: 'number',
			value: (row) => row.free_label
		},
		{
			type: 'text',
			key: 'locked_label',
			header: 'Locked',
			sortable: true,
			filterable: true,
			dataType: 'number',
			value: (row) => row.locked_label
		},
		{
			type: 'text',
			key: 'locked_against',
			header: 'Locked Against',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => row.locked_against
		},
		{
			type: 'text',
			key: 'location_code',
			header: 'Location Code',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: () => '-'
		},
		{
			type: 'text',
			key: 'project_description',
			header: 'Project Description',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: () => '-'
		},
		{
			type: 'text',
			key: 'description',
			header: 'Description',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => row.description
		},
		{
			type: 'text',
			key: 'unit',
			header: 'Unit',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => row.unit
		},
		{
			type: 'text',
			key: 'location_party',
			header: 'Location/Party',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => row.location_party
		},
		{
			type: 'text',
			key: 'warehouse_name',
			header: 'Name',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: () => '-'
		},
		{
			type: 'text',
			key: 'batch',
			header: 'Batch',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => row.batch
		},
		{
			type: 'text',
			key: 'opening_nos',
			header: 'Opening Nos.',
			sortable: false,
			filterable: false,
			dataType: 'string',
			value: () => '-'
		},
		{
			type: 'text',
			key: 'opening_qty_mt',
			header: 'Opening Qty.(MT)',
			sortable: false,
			filterable: false,
			dataType: 'string',
			value: () => '-'
		},
		{
			type: 'text',
			key: 'opening_value',
			header: 'Opening Value',
			sortable: false,
			filterable: false,
			dataType: 'string',
			value: () => '-'
		},
		{
			type: 'text',
			key: 'receipt_nos',
			header: 'Receipt Nos.',
			sortable: false,
			filterable: false,
			dataType: 'string',
			value: () => '-'
		},
		{
			type: 'text',
			key: 'receipt_qty_mt',
			header: 'Receipt Qty.(MT)',
			sortable: false,
			filterable: false,
			dataType: 'string',
			value: () => '-'
		},
		{
			type: 'text',
			key: 'receipt_value',
			header: 'Receipt Value',
			sortable: false,
			filterable: false,
			dataType: 'string',
			value: () => '-'
		},
		{
			type: 'text',
			key: 'issue_nos',
			header: 'Issue Nos.',
			sortable: false,
			filterable: false,
			dataType: 'string',
			value: () => '-'
		},
		{
			type: 'text',
			key: 'issue_qty_mt',
			header: 'Issue Qty.(MT)',
			sortable: false,
			filterable: false,
			dataType: 'string',
			value: () => '-'
		},
		{
			type: 'text',
			key: 'issue_value',
			header: 'Issue Value',
			sortable: false,
			filterable: false,
			dataType: 'string',
			value: () => '-'
		},
		{
			type: 'text',
			key: 'closing_qty_mt_label',
			header: 'Closing(Summ.) Qty. (MT)',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => row.closing_qty_mt_label
		},
		{
			type: 'text',
			key: 'closing_value',
			header: 'Closing(Summ.) Value.',
			sortable: false,
			filterable: false,
			dataType: 'string',
			value: () => '-'
		},
		{
			type: 'text',
			key: 'closing_rate_mt',
			header: 'Closing(Summ.) Rate. (MT)',
			sortable: false,
			filterable: false,
			dataType: 'string',
			value: () => '-'
		},
		{
			key: 'actions',
			header: 'Actions',
			type: 'actions',
			align: 'start',
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
								onClick: (selectedRow) => openEditRow(selectedRow)
							},
							{
								label: 'Zero qty',
								icon: Trash2,
								onClick: (selectedRow) => openDeleteRow(selectedRow)
							}
						]
					]
				}
			]
		}
	];

	async function reloadRegister(signal?: AbortSignal, projectIdOverride?: string) {
		isLoading = true;
		try {
			const projectId = projectIdOverride ?? registerProjectId;
			allRows = await listStockRegister(projectId || undefined, signal);
		} catch (error) {
			if (signal?.aborted) return;
			rmiPushToast({
				title: 'Failed to load stock register',
				description: formatApiErrorMessage(error)
			});
			allRows = [];
		} finally {
			if (!signal?.aborted) isLoading = false;
		}
	}

	function clearUploadPreview() {
		previewTableRows = [];
		csvProjectCodes = [];
		projectMapping = {};
	}

	function clearCsvFileInput() {
		selectedCsvFile = null;
		csvFileInputKey += 1;
	}

	function openEditRow(row: StockRegisterDisplayRow) {
		activeRow = row;
		editQty = String(row.qty_base);
		editBatch = row.batch === '-' ? '' : row.batch;
		editPhysicalLocation = row.physical_location === '-' ? '' : row.physical_location;
		editBundleNo = row.bundle_no === '-' ? '' : row.bundle_no;
		isEditDialogOpen = true;
	}

	function openDeleteRow(row: StockRegisterDisplayRow) {
		activeRow = row;
		isDeleteDialogOpen = true;
	}

	async function handleDeleteConfirm() {
		if (!activeRow) return;
		try {
			await zeroStockLine(activeRow);
			isDeleteDialogOpen = false;
			activeRow = null;
			await reloadRegister();
			rmiPushToast({
				title: 'Stock zeroed',
				description: 'Quantity set to 0 and logged as a correction.'
			});
		} catch (error) {
			rmiPushToast({
				title: 'Failed to zero stock',
				description: formatApiErrorMessage(error)
			});
		}
	}

	function resetUploadDialog() {
		isUploadDialogOpen = false;
		isUploading = false;
		clearCsvFileInput();
		selectedPlantId = '';
		projectLoadError = '';
		clearUploadPreview();
	}

	async function handleCsvFileChange(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0] ?? null;
		selectedCsvFile = file;
		clearUploadPreview();
		if (!file) return;
		try {
			previewTableRows = await previewStockUploadCsv(file, { maxRows: 5 });
			const plantsForParse = plants.length
				? plants
				: [{ plant_id: selectedPlantId || 'pending', name: 'pending' }];
			const rows = await parseStockUploadCsvFile(file, {
				plants: plantsForParse,
				uploadPlantId: selectedPlantId || undefined,
				plantRefOverride: selectedPlantId || undefined
			});
			csvProjectCodes = collectStockUploadProjectCodes(rows);
			const suggested = suggestStockUploadProjectMapping(
				csvProjectCodes.map((entry) => entry.project_ref),
				projects
			);
			if (
				contextProjectId &&
				csvProjectCodes.length === 1 &&
				!suggested[csvProjectCodes[0].project_ref]
			) {
				suggested[csvProjectCodes[0].project_ref] = contextProjectId;
			}
			projectMapping = suggested;
		} catch {
			clearUploadPreview();
		}
	}

	function handlePlantChange(value: string | string[]) {
		selectedPlantId = typeof value === 'string' ? value : (value[0] ?? '');
	}

	function handleProjectMappingChange(projectRef: string, value: string | string[]) {
		const next = typeof value === 'string' ? value : (value[0] ?? '');
		projectMapping = { ...projectMapping, [projectRef]: next };
	}

	async function handleEditSave() {
		if (!activeRow) return;
		const qty = Number(editQty.trim());
		if (!Number.isFinite(qty) || qty < 0) {
			rmiPushToast({ title: 'Invalid quantity', description: 'Enter a non-negative quantity.' });
			return;
		}
		try {
			await correctStockLineQty({
				row: activeRow,
				qtyBase: qty,
				lotCode: editBatch.trim(),
				physicalLocation: editPhysicalLocation.trim(),
				bundleNo: editBundleNo.trim()
			});
			isEditDialogOpen = false;
			activeRow = null;
			await reloadRegister();
			rmiPushToast({ title: 'Stock line updated', description: 'Manual changes are logged.' });
		} catch (error) {
			rmiPushToast({
				title: 'Failed to update stock',
				description: formatApiErrorMessage(error)
			});
		}
	}

	async function handleUploadConfirm() {
		if (!selectedCsvFile || isUploading) return;
		if (!selectedPlantId) {
			rmiPushToast({
				title: 'Plant required',
				description: 'Select a plant for stock upload.'
			});
			return;
		}
		if (!allProjectsMapped) {
			rmiPushToast({
				title: 'Map all Project # values',
				description: 'Every CSV Project # must be mapped to a system project before upload.'
			});
			return;
		}
		isUploading = true;
		try {
			const projectMap = buildStockUploadProjectMap(projectMapping);
			const validationRefs = await listStockUploadValidationRefs();
			const rows = await parseStockUploadCsvFile(selectedCsvFile, {
				plants,
				items: validationRefs.items,
				uploadPlantId: selectedPlantId,
				plantRefOverride: selectedPlantId,
				projectMap
			});

			const invalidCount = rows.filter((row) => row.validation_status === 'error').length;
			if (invalidCount === rows.length) {
				const codes = [
					...new Set(
						rows.map((row) => row.validation_code).filter((code): code is string => Boolean(code))
					)
				];
				rmiPushToast({
					title: 'CSV failed validation',
					description: `All ${rows.length} rows were rejected (${codes.join(', ') || 'unknown'}). Fix the file and try again.`
				});
				return;
			}

			const warnedCount = rows.filter((row) => row.validation_status === 'warning').length;
			const { result } = await uploadAndApplyStockCsv({
				plantId: selectedPlantId,
				projectMap,
				projectId: contextProjectId || null,
				uploadedBy: 'ui',
				rows
			});

			const firstProjectId =
				result.projects?.[0]?.project_id ||
				Object.values(projectMap)[0] ||
				contextProjectId ||
				scopedProjectId;
			if (!contextProjectId && firstProjectId) {
				scopedProjectId = firstProjectId;
			}

			activeFilter = 'total-stock';
			resetUploadDialog();
			await reloadRegister(undefined, contextProjectId || scopedProjectId);

			const parts = formatApplyUploadSummaryParts({
				result,
				invalidCount,
				warnedCount,
				projectMapSize: Object.keys(projectMap).length
			});

			rmiPushToast({
				title: (result.locks_released ?? 0) > 0 ? 'Upload applied - locks released' : 'CSV applied',
				description: parts.join(' · ')
			});
		} catch (error) {
			const description =
				error instanceof StockUploadCsvError
					? error.message
					: formatApiErrorMessage(error) || 'Unable to apply the CSV.';
			rmiPushToast({ title: 'CSV upload failed', description });
		} finally {
			isUploading = false;
		}
	}

	onMount(() => {
		if (contextProjectId) scopedProjectId = contextProjectId;
		const controller = new AbortController();
		void reloadRegister(controller.signal);
		return () => controller.abort();
	});

	$effect(() => {
		if (contextProjectId && scopedProjectId !== contextProjectId) {
			scopedProjectId = contextProjectId;
		}
	});
</script>

<div class="flex h-full min-h-0 flex-col overflow-hidden p-3 md:p-4">
	<div class="flex min-h-0 flex-1 flex-col gap-4">
		<div class="flex shrink-0 flex-col gap-4">
			<FilterCardStrip items={filterCards} bind:value={activeFilter} />
		</div>

		<div class="min-h-0 flex-1">
			<DataTable
				columns={resultColumns}
				rows={filteredRows}
				loading={isLoading}
				rowKey={(row) => row.id}
				toolbarButton={[
					{
						enabled: true,
						label: 'Download Template',
						icon: Download,
						variant: 'outline',
						onClick: () => downloadStockUploadTemplate()
					}
				]}
				emptyState={{
					icon: Component,
					title: 'No stock lines',
					description: 'Upload stock from Stock Available using Update Stock.'
				}}
				pagination={{ pageSize: 10 }}
			/>
		</div>
	</div>
</div>

<Dialog
	bind:open={isUploadDialogOpen}
	title="Upload CSV"
	size="lg"
	hideFooter={true}
	closeOnBackdrop={!isUploading}
	showCloseButton={!isUploading}
	class="flex w-full max-h-[min(90dvh,85vh)] flex-col overflow-hidden sm:max-w-2xl"
	headerClass="shrink-0"
	bodyClass="flex min-h-0 flex-1 flex-col overflow-hidden px-0 py-0"
	onOpenChange={(open) => {
		if (!open) {
			isUploading = false;
			clearCsvFileInput();
			selectedPlantId = '';
			projectLoadError = '';
			clearUploadPreview();
		}
	}}
>
	<div class="relative flex min-h-0 flex-1 flex-col overflow-hidden">
		{#if isUploading || isLoadingProjects}
			<div
				class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-white/85"
				role="status"
				aria-live="polite"
				aria-busy="true"
			>
				<Loader2 class="size-8 animate-spin text-primary" aria-hidden="true" />
				<p class="text-sm text-muted-foreground">
					{isUploading ? 'Applying upload…' : 'Loading…'}
				</p>
			</div>
		{/if}
		<div class="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
			{#if projectLoadError}
				<p class="text-sm text-status-error">{projectLoadError}</p>
			{/if}

			<div class="space-y-2">
				<Label for="upload-plant" text="Plant" required />
				<Combobox
					id="upload-plant"
					placeholder={plantComboboxItems.length === 0 ? 'No plants' : 'Select plant'}
					items={plantComboboxItems}
					value={selectedPlantId}
					onValueChange={handlePlantChange}
					disabled={isUploading || isLoadingProjects || plantComboboxItems.length === 0}
				/>
			</div>

			<div class="space-y-2">
				<Label for="csv-file" text="CSV File" required />
				{#key csvFileInputKey}
					<Input
						id="csv-file"
						type="file"
						accept=".csv,text/csv"
						disabled={isUploading}
						class="cursor-pointer pt-1 file:mr-4 file:border-0 file:bg-gray-100 file:px-3 file:py-1 file:text-gray-700 hover:file:bg-gray-200"
						onchange={(event) => void handleCsvFileChange(event)}
					/>
				{/key}
			</div>

			{#if csvProjectCodes.length > 0}
				<div class="space-y-2">
					<p class="text-sm font-medium text-foreground">Map CSV Project # to system projects</p>
					<p class="text-xs text-muted-foreground">
						Every Project # in the file must be mapped before upload.
					</p>
					<div class="max-h-40 space-y-3 overflow-y-auto rounded-md border border-border p-3">
						{#each csvProjectCodes as entry (entry.project_ref)}
							<div
								class="grid grid-cols-1 items-end gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]"
							>
								<div class="space-y-1">
									<p class="text-xs text-muted-foreground">CSV Project #</p>
									<p class="text-sm font-medium text-foreground">
										{entry.project_ref}
										<span class="font-normal text-muted-foreground"
											>({entry.stock_row_count} with stock · {entry.row_count} row{entry.row_count ===
											1
												? ''
												: 's'})</span
										>
									</p>
								</div>
								<div class="space-y-1">
									<Label for={`map-project-${entry.project_ref}`} text="System project" required />
									<Combobox
										id={`map-project-${entry.project_ref}`}
										placeholder={projectComboboxItems.length === 0
											? 'No projects'
											: 'Select project'}
										items={projectComboboxItems}
										value={projectMapping[entry.project_ref] ?? ''}
										onValueChange={(value) => handleProjectMappingChange(entry.project_ref, value)}
										disabled={isUploading || projectComboboxItems.length === 0}
									/>
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<div class="space-y-2">
				<p class="text-sm font-medium text-foreground">Preview (first 5 rows)</p>
				<div class="overflow-hidden rounded-md border border-border">
					<Table
						layout="content"
						columns={previewColumns}
						rows={previewTableRows}
						rowKey={(row) => row.id}
						maxHeight="10rem"
						emptyState={{
							icon: FileUp,
							title: 'No preview',
							description: 'Choose a CSV file to preview the first 5 rows.'
						}}
					/>
				</div>
			</div>
		</div>

		<div class="flex shrink-0 items-center justify-end gap-3 border-t border-border px-6 py-4">
			<Button variant="outline" label="Cancel" disabled={isUploading} onclick={resetUploadDialog} />
			<Button
				variant="primary"
				label={isUploading ? 'Uploading...' : 'Upload CSV'}
				disabled={isUploading ||
					isLoadingProjects ||
					!selectedCsvFile ||
					!selectedPlantId ||
					!allProjectsMapped ||
					csvProjectCodes.length === 0}
				loading={isUploading}
				onclick={() => void handleUploadConfirm()}
			/>
		</div>
	</div>
</Dialog>

<Dialog
	bind:open={isEditDialogOpen}
	title={editDialogTitle}
	size="lg"
	cancelLabel="Cancel"
	confirmLabel="Save"
	onConfirm={handleEditSave}
	onOpenChange={(open) => {
		if (!open) activeRow = null;
	}}
>
	{#if activeRow}
		<div class="space-y-6">
			<div class="grid grid-cols-1 gap-x-8 gap-y-4 bg-foreground/[0.04] px-4 py-4 sm:grid-cols-3">
				<div class="space-y-1">
					<p class="text-xs text-muted-foreground">Primary Location</p>
					<p class="text-sm font-semibold text-foreground">{activeRow.plant_label}</p>
				</div>
				<div class="space-y-1">
					<p class="text-xs text-muted-foreground">Project</p>
					<p class="text-sm font-semibold text-foreground">{activeRow.project_label}</p>
				</div>
				<div class="space-y-1">
					<p class="text-xs text-muted-foreground">Item</p>
					<p class="text-sm font-semibold text-foreground">{activeRow.item_code}</p>
				</div>
				<div class="space-y-1 sm:col-span-2">
					<p class="text-xs text-muted-foreground">Section</p>
					<p class="text-sm font-semibold text-foreground">{activeRow.section}</p>
				</div>
				<div class="space-y-1">
					<p class="text-xs text-muted-foreground">Unit</p>
					<p class="text-sm font-semibold text-foreground">{activeRow.unit}</p>
				</div>
				<div class="space-y-1">
					<p class="text-xs text-muted-foreground">Length</p>
					<p class="text-sm font-semibold text-foreground">{activeRow.length_label}</p>
				</div>
				<div class="space-y-1">
					<p class="text-xs text-muted-foreground">Width</p>
					<p class="text-sm font-semibold text-foreground">{activeRow.width_label}</p>
				</div>
			</div>

			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
				<div class="space-y-2">
					<Label for="edit-qty" text="Closing(Summ.) Nos." />
					<Input id="edit-qty" bind:value={editQty} />
				</div>
				<div class="space-y-2">
					<Label for="edit-batch" text="Batch" />
					<Input id="edit-batch" bind:value={editBatch} />
				</div>
				<div class="space-y-2">
					<Label for="edit-physical-location" text="Physical Location" />
					<Input id="edit-physical-location" bind:value={editPhysicalLocation} />
				</div>
				<div class="space-y-2">
					<Label for="edit-bundle-no" text="Bundle No" />
					<Input id="edit-bundle-no" bind:value={editBundleNo} />
				</div>
			</div>

			<div class="flex items-center gap-2 text-sm text-muted-foreground">
				<Info class="size-4 shrink-0" aria-hidden="true" />
				<span>Manual changes are logged</span>
			</div>
		</div>
	{/if}
</Dialog>

<ConfirmationDialog
	bind:open={isDeleteDialogOpen}
	title="Zero stock quantity"
	description="Set quantity to 0 for '{activeRow
		? `${activeRow.item_code} / ${activeRow.bundle_no}`
		: 'this row'}'? This is logged as a correction."
	confirmLabel="Zero qty"
	confirmVariant="danger"
	iconTone="danger"
	onConfirm={handleDeleteConfirm}
	onOpenChange={(open) => {
		if (!open) activeRow = null;
	}}
/>
