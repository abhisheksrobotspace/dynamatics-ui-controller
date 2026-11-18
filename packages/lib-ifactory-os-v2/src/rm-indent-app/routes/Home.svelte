<script lang="ts">
	import { onMount } from 'svelte';
	import { Download, FileUp, Loader2, Package } from '@lucide/svelte';
	import {
		Button,
		Combobox,
		DataTable,
		Dialog,
		Input,
		Label,
		Table,
		type ComboboxItem,
		type DataTableColumn,
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
	import {
		listStockAvailableProjects,
		type StockAvailableProjectRow
	} from '../lib/stock-available.api';
	import {
		formatApplyUploadSummaryParts,
		listPlants,
		listStockUploadValidationRefs,
		uploadAndApplyStockCsv
	} from '../lib/stock-register.api';
	import { rmiPushToast } from '../lib/toast';
	import { formatApiErrorMessage } from '../../lib/api/types';
	import { app } from '../app.svelte';
	import type { PlantRow } from '../lib/inv.types';

	let isLoading = $state(true);
	let projectRows = $state<StockAvailableProjectRow[]>([]);

	let isUploadDialogOpen = $state(false);
	let isUploading = $state(false);
	let selectedCsvFile = $state<File | null>(null);
	let previewTableRows = $state<StockUploadPreviewRow[]>([]);
	let plants = $state<PlantRow[]>([]);
	let selectedPlantId = $state('');
	let csvProjectCodes = $state<StockUploadProjectCodeCount[]>([]);
	/** CSV Project # → system project_id */
	let projectMapping = $state<Record<string, string>>({});
	/** Remount file input so the browser clears the displayed filename. */
	let csvFileInputKey = $state(0);

	const plantComboboxItems = $derived.by((): ComboboxItem[] =>
		plants.map((plant) => ({
			value: plant.plant_id,
			label: plant.name?.trim() || plant.plant_id
		}))
	);

	const projectComboboxItems = $derived.by((): ComboboxItem[] =>
		projectRows.map((project) => ({
			value: project.project_id,
			label: project.project_name
		}))
	);

	const allProjectsMapped = $derived(
		csvProjectCodes.length > 0 &&
			csvProjectCodes.every((entry) => Boolean(projectMapping[entry.project_ref]?.trim()))
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

	const columns: DataTableColumn<StockAvailableProjectRow>[] = [
		{
			type: 'text',
			key: 'project_name',
			header: 'Project name',
			sortable: true,
			filterable: true,
			dataType: 'string',
			class: 'font-medium',
			value: (row) => row.project_name
		},
		{
			type: 'text',
			key: 'stock_last_updated_label',
			header: 'Stock last updated',
			sortable: true,
			dataType: 'string',
			value: (row) => row.stock_last_updated_label
		},
		{
			type: 'text',
			key: 'required_rm_mt_label',
			header: 'Required RM (MT)',
			sortable: true,
			dataType: 'string',
			value: (row) => row.required_rm_mt_label
		},
		{
			type: 'text',
			key: 'available_rm_mt_label',
			header: 'Available RM (MT)',
			sortable: true,
			dataType: 'string',
			value: (row) => row.available_rm_mt_label
		},
		{
			type: 'actions',
			key: 'actions',
			header: 'Actions',
			headerClass: 'text-right',
			class: 'text-right',
			actions: () => [
				{
					type: 'button',
					label: 'View',
					variant: 'primary',
					size: 'sm',
					onClick: (selectedRow) => openStockRegister(selectedRow)
				}
			]
		}
	];

	async function reloadProjects(signal?: AbortSignal) {
		isLoading = true;
		try {
			projectRows = await listStockAvailableProjects(signal);
		} catch (error) {
			if (signal?.aborted) return;
			rmiPushToast({
				title: 'Failed to load projects',
				description: formatApiErrorMessage(error)
			});
			projectRows = [];
		} finally {
			if (!signal?.aborted) isLoading = false;
		}
	}

	function openStockRegister(row: StockAvailableProjectRow) {
		window.location.hash = `#/${app.appName}/StockRegister/${encodeURIComponent(row.project_id)}`;
	}

	function clearPreview() {
		previewTableRows = [];
		csvProjectCodes = [];
		projectMapping = {};
	}

	function clearCsvFileInput() {
		selectedCsvFile = null;
		csvFileInputKey += 1;
	}

	async function openUpdateStockDialog() {
		clearCsvFileInput();
		clearPreview();
		selectedPlantId = '';
		isUploadDialogOpen = true;
		try {
			plants = await listPlants();
			selectedPlantId = plants[0]?.plant_id ?? '';
			if (projectRows.length === 0) {
				projectRows = await listStockAvailableProjects();
			}
		} catch (error) {
			plants = [];
			rmiPushToast({
				title: 'Failed to load plants',
				description: formatApiErrorMessage(error)
			});
		}
	}

	function resetUploadDialog() {
		isUploadDialogOpen = false;
		isUploading = false;
		clearCsvFileInput();
		clearPreview();
		selectedPlantId = '';
	}

	function handlePlantChange(value: string | string[]) {
		selectedPlantId = typeof value === 'string' ? value : (value[0] ?? '');
	}

	function handleProjectMappingChange(projectRef: string, value: string | string[]) {
		const next = typeof value === 'string' ? value : (value[0] ?? '');
		projectMapping = { ...projectMapping, [projectRef]: next };
	}

	async function handleCsvFileChange(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0] ?? null;
		selectedCsvFile = file;
		clearPreview();
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
			projectMapping = suggestStockUploadProjectMapping(
				csvProjectCodes.map((entry) => entry.project_ref),
				projectRows
			);
		} catch {
			clearPreview();
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
				uploadedBy: 'ui',
				rows
			});

			resetUploadDialog();
			await reloadProjects();

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
		const controller = new AbortController();
		void reloadProjects(controller.signal);
		return () => controller.abort();
	});
</script>

<div class="flex h-full min-h-0 flex-col overflow-hidden p-3 md:p-4">
	<div class="min-h-0 flex-1">
		<DataTable
			{columns}
			rows={projectRows}
			loading={isLoading}
			rowKey={(row) => row.project_id}
			onRowClick={(row) => openStockRegister(row)}
			toolbarButton={[
				{
					enabled: true,
					label: 'Download Template',
					icon: Download,
					variant: 'outline',
					onClick: () => downloadStockUploadTemplate()
				},
				{
					enabled: true,
					label: 'Update Stock',
					icon: FileUp,
					onClick: () => void openUpdateStockDialog()
				}
			]}
			emptyState={{
				icon: Package,
				title: 'No projects',
				description: 'Projects from Project Management will appear here.'
			}}
			pagination={{ pageSize: 15 }}
			search={{ enabled: true, placeholder: 'Search projects…' }}
		/>
	</div>
</div>

<Dialog
	bind:open={isUploadDialogOpen}
	title="Update Stock"
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
			clearPreview();
			selectedPlantId = '';
		}
	}}
>
	<div class="relative flex min-h-0 flex-1 flex-col overflow-hidden">
		{#if isUploading}
			<div
				class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-white/85"
				role="status"
				aria-live="polite"
				aria-busy="true"
			>
				<Loader2 class="size-8 animate-spin text-primary" aria-hidden="true" />
				<p class="text-sm text-muted-foreground">Applying upload…</p>
			</div>
		{/if}

		<div class="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
			<div class="space-y-2">
				<Label for="stock-available-plant" text="Plant" required />
				<Combobox
					id="stock-available-plant"
					placeholder={plantComboboxItems.length === 0 ? 'No plants' : 'Select plant'}
					items={plantComboboxItems}
					value={selectedPlantId}
					onValueChange={handlePlantChange}
					disabled={isUploading || plantComboboxItems.length === 0}
				/>
			</div>

			<div class="space-y-2">
				<Label for="stock-available-csv" text="CSV File" required />
				{#key csvFileInputKey}
					<Input
						id="stock-available-csv"
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
				label={isUploading ? 'Uploading...' : 'Upload'}
				disabled={isUploading ||
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
