<script lang="ts">
	import OperationsCountHoleReviewDialog from '../components/OperationsCountHoleReviewDialog.svelte';
	import OperationsCountMarkEditDialog from '../components/OperationsCountMarkEditDialog.svelte';
	import { isFirstRowOnPage } from '../lib/ocr-hole-review';
	import {
		buildBomNumericMap,
		enrichPdfResultsWithBomSuggestions,
		ensureResultRowIds,
		isMarkEditable,
		isOcrNotFoundStatus,
		displaySketchMark,
		operationsCountStatusSortPriority,
		type BomNumericMap
	} from '../lib/ocr-mark-edit';
	import { BOM_MATCH_STATUS } from '../lib/ocr.constants.js';
	import { ocrFetch } from '../lib/ocr.api';
	import {
		OCR_MODE,
		applyPdfRoiFallback,
		loadPersistedOperationsCountResults
	} from '../lib/ocr.backend';
	import { readOcrGenerateSessionForBom } from '../lib/ocr-generate-session.js';
	import {
		getOperationsCountResults,
		setOperationsCountResults,
		updateOperationsCountResults
	} from '../lib/operations-count-results.svelte';
	import { buildOperationsCountCsv } from '../lib/operations-count-csv';
	import type { OcrResultRow, PdfJob, UploadBomResponse } from '../lib/ocr.types';
	import type {
		BomConfig,
		Project,
		StubType,
		TowerType
	} from '../../project-management-app/lib/store.svelte';
	import { loadOcrBomPageContext } from '../lib/ocr-bom-page-context.api.js';
	import {
		downloadFile,
		listBomItems,
		setBomOcrStatus,
		type ProjBomItemRow
	} from '../../project-management-app/lib/projects/boms.api';
	import {
		bomStructureFromParams,
		ocrBomDetailHash,
		ocrDrawingSetHash,
		ocrDrawingsHomeHash,
		ocrMarkRegionHash
	} from '../lib/ocr-app-routes.js';
	import { onMount } from 'svelte';
	import { ocrPushErrorToast, ocrPushSuccessToast } from '../lib/toast.js';
	import { errorDescription } from '../../lib/api/types.js';
	import {
		Button,
		ConfirmationDialog,
		DataTable,
		type DataTableColumn,
		Alert,
		FilterCardStrip,
		type FilterCardItem,
		filterCardCellClass,
		filterCardStripClassFor,
		Skeleton
	} from '@ifactory/ui-v2';
	import {
		ClipboardCheck,
		ClipboardList,
		Copy,
		FileDown,
		List,
		RotateCcw,
		SearchX,
		TriangleAlert
	} from '@lucide/svelte';

	let { params } = $props();
	const projectId = $derived(params.projectId);
	const bomId = $derived(params.bomId);
	const structure = $derived(bomStructureFromParams(params));

	let project = $state<Project | null>(null);
	let tower = $state<TowerType | null>(null);
	let stub = $state<StubType | null>(null);
	let bom = $state<BomConfig | null>(null);
	let isContextLoading = $state(true);
	let contextLoadError = $state('');

	onMount(() => {
		const controller = new AbortController();
		void (async () => {
			isContextLoading = true;
			contextLoadError = '';
			try {
				const context = await loadOcrBomPageContext(projectId, params, bomId, controller.signal);
				project = context.project;
				tower = context.tower;
				stub = context.stub;
				bom = context.bom;
			} catch (error) {
				if (error instanceof DOMException && error.name === 'AbortError') return;
				contextLoadError = errorDescription(error);
				project = null;
				tower = null;
				stub = null;
				bom = null;
			} finally {
				if (!controller.signal.aborted) isContextLoading = false;
			}
		})();
		return () => controller.abort();
	});

	let pdfs = $state<PdfJob[]>([]);
	let activeFilter = $state<'all' | 'matched' | 'duplicate' | 'not-found' | 'missing'>('all');
	let loadAttempted = $state(false);
	let isResultsLoading = $state(false);
	let bomNumericMap = $state<BomNumericMap>({});
	let bomItemIdByMark = $state<Record<string, string>>({});
	// BOM items are immutable while on this page (re-upload happens on the BOMs page),
	// so one fetch serves both the numeric map and the CSV export.
	let bomItems = $state.raw<ProjBomItemRow[]>([]);
	let editOpen = $state(false);
	let holeOpen = $state(false);
	let startOverOpen = $state(false);
	let isConfirming = $state(false);
	let editSession = $state<{
		row: OcrResultRow;
		pdf: PdfJob;
		isDuplicate: boolean;
		rowId: string;
	} | null>(null);
	let holeSession = $state<{
		row: OcrResultRow;
		pdf: PdfJob;
		rowId: string;
	} | null>(null);

	const allRows = $derived(pdfs.flatMap((pdf) => pdf.results ?? []));

	const totalSketchesCount = $derived(allRows.length);
	const totalMarksInBom = $derived(
		new Set(
			bomItems.map((item) => item.mark_no.trim().toUpperCase()).filter((mark) => mark.length > 0)
		).size
	);
	const matchedCount = $derived(allRows.filter((row) => row.bom_match_status === 'MATCHED').length);
	const duplicateCount = $derived(
		allRows.filter((row) => row.bom_match_status === 'DUPLICATE_SUFFIX').length
	);
	const notFoundCount = $derived(allRows.filter((row) => isOcrNotFoundStatus(row)).length);
	const missingCount = $derived(
		allRows.filter(
			(row) =>
				row.bom_match_status === BOM_MATCH_STATUS.MISSING_IN_SKETCH ||
				row.bom_match_status === BOM_MATCH_STATUS.MISSING_IN_BOM
		).length
	);

	const resultsFilterLayout = {
		columns: 3,
		wideColumns: 6,
		wideMinWidth: 1441 as const
	};

	type ResultFilter = 'all' | 'matched' | 'duplicate' | 'not-found' | 'missing';

	const filterCards: FilterCardItem[] = $derived([
		{
			id: 'bom_marks',
			label: 'Total Marks in BOM',
			count: totalMarksInBom,
			icon: ClipboardList,
			clickable: false
		},
		{ id: 'all', label: 'Total Sketches', count: totalSketchesCount, icon: List },
		{ id: 'matched', label: 'Matched', count: matchedCount, icon: ClipboardCheck },
		{ id: 'duplicate', label: 'Duplicate', count: duplicateCount, icon: Copy },
		{
			id: 'not-found',
			label: 'Not found',
			count: notFoundCount,
			icon: SearchX
		},
		{
			id: 'missing',
			label: 'Missing in BOM/Sketch',
			count: missingCount,
			icon: TriangleAlert
		}
	]);

	function rowMatchesFilter(row: OcrResultRow, filter: ResultFilter): boolean {
		switch (filter) {
			case 'matched':
				return row.bom_match_status === 'MATCHED';
			case 'duplicate':
				return row.bom_match_status === 'DUPLICATE_SUFFIX';
			case 'not-found':
				return isOcrNotFoundStatus(row);
			case 'missing':
				return (
					row.bom_match_status === BOM_MATCH_STATUS.MISSING_IN_SKETCH ||
					row.bom_match_status === BOM_MATCH_STATUS.MISSING_IN_BOM
				);
			default:
				return true;
		}
	}

	const filteredRows = $derived(
		allRows
			.filter((row) => rowMatchesFilter(row, activeFilter))
			.sort((a, b) => {
				const priorityDiff =
					operationsCountStatusSortPriority(a) - operationsCountStatusSortPriority(b);
				if (priorityDiff !== 0) return priorityDiff;
				return (a.source_page ?? a.page) - (b.source_page ?? b.page);
			})
	);

	const isPageLoading = $derived(isContextLoading || isResultsLoading);

	function sketchMarkNumber(row: OcrResultRow): string {
		return displaySketchMark(row);
	}

	function bomStatusBadge(row: OcrResultRow) {
		const status = row.bom_match_status ?? '-';
		if (status === 'MATCHED')
			return {
				variant: 'online' as const,
				label: 'MATCHED',
				dot: false
			};
		if (status === 'DUPLICATE_SUFFIX')
			return {
				variant: 'loading' as const,
				label: 'DUPLICATE SUFFIX',
				dot: false,
				class: 'bg-yellow-100 text-[#F59E0B]'
			};
		if (isOcrNotFoundStatus(row)) {
			return {
				variant: 'error' as const,
				label: 'NOT FOUND',
				dot: false
			};
		}
		return { variant: 'secondary' as const, label: status };
	}

	const resultColumns = $derived.by((): DataTableColumn<OcrResultRow>[] => {
		const rows = filteredRows;

		return [
			{
				type: 'text',
				key: 'page',
				header: 'Page',
				sortable: true,
				filterable: true,
				dataType: 'number',
				value: (row) =>
					row.bom_match_status === BOM_MATCH_STATUS.MISSING_IN_SKETCH
						? '-'
						: String(row.source_page ?? row.page)
			},
			{
				type: 'text',
				key: 'bom_mark_number',
				header: 'BOM Mark No',
				sortable: true,
				filterable: true,
				dataType: 'string',
				value: (row) => row.bom_mark_number ?? '-'
			},
			{
				type: 'text',
				key: 'sketch_mark',
				header: 'Sketch Mark Number',
				sortable: true,
				filterable: true,
				dataType: 'string',
				value: sketchMarkNumber
			},
			{
				type: 'badge',
				key: 'bom_match_status',
				header: 'Match Status',
				sortable: true,
				filterable: true,
				dataType: 'string',
				badge: bomStatusBadge
			},
			{
				type: 'actions',
				key: 'hole_count',
				header: 'Operations',
				align: 'start',
				actions: (row) => {
					if (row.bom_match_status === BOM_MATCH_STATUS.MISSING_IN_SKETCH) {
						return [
							{
								type: 'button',
								label: '-',
								variant: 'ghost',
								size: 'sm',
								disabled: true,
								class: 'w-8 justify-center px-0 text-muted-foreground'
							}
						];
					}
					if (!isFirstRowOnPage(row, rows)) {
						return [
							{
								type: 'button',
								label: '-',
								variant: 'ghost',
								size: 'sm',
								disabled: true,
								class: 'w-8 justify-center px-0 text-muted-foreground'
							}
						];
					}

					return [
						{
							type: 'button',
							label: String(row.hole_count ?? 0),
							variant: 'ghost',
							size: 'sm',
							disabled: true,
							class: 'w-8 justify-center px-0 cursor-default text-foreground pointer-events-none'
						},
						{
							type: 'button',
							label: 'View',
							variant: 'primary',
							size: 'sm',
							class: 'border-green-500 bg-green-500 text-white hover:bg-green-600',
							ariaLabel: `View operations on page ${row.page}`,
							onClick: () => startHoleReview(row)
						}
					];
				}
			},
			{
				key: 'actions',
				header: 'Actions',
				type: 'actions',
				align: 'start',
				actions: (row) => {
					if (row.bom_match_status === BOM_MATCH_STATUS.MISSING_IN_SKETCH) return [];
					if (row.bom_match_status === 'MATCHED') {
						return [
							{
								type: 'button',
								label: 'Edit',
								variant: 'primary',
								size: 'sm',
								class:
									'min-w-[5rem] justify-center border-green-500 bg-green-500 text-white hover:bg-green-600',
								ariaLabel: `Edit mark on page ${row.page}`,
								onClick: () => startEdit(row)
							}
						];
					}
					if (isMarkEditable(row)) {
						return [
							{
								type: 'button',
								label: 'Verify',
								variant: 'primary',
								size: 'sm',
								class: 'min-w-[5rem] justify-center',
								ariaLabel: `Verify mark on page ${row.page}`,
								onClick: () => startEdit(row)
							}
						];
					}
					return [];
				}
			}
		];
	});

	function navigateToMarkingSelection() {
		window.location.hash = ocrMarkRegionHash(projectId, structure, bomId);
	}

	function navigateToBoms() {
		const session = readOcrGenerateSessionForBom(bomId);
		if (session?.drawingSet) {
			window.location.hash = ocrDrawingSetHash(projectId, structure, bomId, session.drawingSet);
			return;
		}
		if (projectId && bomId) {
			window.location.hash = ocrBomDetailHash(projectId, structure, bomId);
			return;
		}
		window.location.hash = ocrDrawingsHomeHash();
	}

	async function handleConfirmAndSave() {
		if (!bom || isConfirming || bom.ocrStatus === 'verified') return;
		isConfirming = true;
		try {
			await setBomOcrStatus(bomId, 'verified');
			bom = { ...bom, ocrStatus: 'verified' };
			ocrPushSuccessToast({ title: 'Operations Count confirmed' });
			navigateToBoms();
		} catch (err) {
			ocrPushErrorToast({
				title: 'Could not confirm Operations Count',
				description: errorDescription(err, 'Save failed')
			});
		} finally {
			isConfirming = false;
		}
	}

	function persistResults(next: PdfJob[]) {
		pdfs = next;
		updateOperationsCountResults(bomId, next);
	}

	function startEdit(row: OcrResultRow) {
		const pdf = pdfs.find((p) => p.results?.some((r) => r.id === row.id));
		if (!row.id || !pdf) return;
		editSession = {
			row,
			pdf,
			isDuplicate: row.bom_match_status === 'DUPLICATE_SUFFIX',
			rowId: row.id
		};
		editOpen = true;
	}

	function closeEdit() {
		editOpen = false;
	}

	function startHoleReview(row: OcrResultRow) {
		const pdf = pdfs.find((p) => p.results?.some((r) => r.id === row.id));
		if (!row.id || !pdf) return;
		holeSession = {
			row,
			pdf,
			rowId: row.id
		};
		holeOpen = true;
	}

	function closeHoleReview() {
		holeOpen = false;
		holeSession = null;
	}

	function exportCsv() {
		const csv = buildOperationsCountCsv(pdfs, bomItems);
		const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = `operations-count-${bom?.bomName ?? bomId}.csv`;
		document.body.append(link);
		try {
			link.click();
		} finally {
			link.remove();
			window.setTimeout(() => URL.revokeObjectURL(url), 0);
		}
	}

	async function loadBomMap() {
		// core mode: build numeric map from proj_bom_items (so Verify can classify MATCHED vs MISSING IN BOM)
		if (OCR_MODE === 'core') {
			try {
				const items = await listBomItems(bomId);
				bomItems = items;
				const numeric: Record<string, string[]> = {};
				const suffixMap: Record<string, string> = {};
				const idByMark: Record<string, string> = {};
				for (const item of items) {
					const mark = (item.mark_no ?? '').trim();
					if (!mark) continue;
					idByMark[mark] = item.bom_item_id;
					const numMatch = /([0-9]+)[A-Za-z]*$/i.exec(mark);
					if (numMatch?.[1]) {
						const k = numMatch[1];
						if (!numeric[k]) numeric[k] = [];
						numeric[k]!.push(mark);
					}
					const suffixMatch = /([0-9]+[A-Za-z]*)$/i.exec(mark);
					if (suffixMatch?.[1]) suffixMap[suffixMatch[1].toUpperCase()] = mark;
				}
				const map = numeric as BomNumericMap;
				map._suffixMap = suffixMap;
				bomNumericMap = map;
				bomItemIdByMark = idByMark;
				pdfs = enrichPdfResultsWithBomSuggestions(pdfs, map);
				updateOperationsCountResults(bomId, pdfs);
			} catch (error) {
				ocrPushErrorToast({
					title: 'Could not load BOM items',
					description: errorDescription(error)
				});
			}
			return;
		}
		if (!bom?.bomFileId) return;

		try {
			const bomFile = await downloadFile(bom.bomFileId, `${bom.bomName || 'bom'}.csv`);
			const formData = new FormData();
			formData.append('bom', bomFile);
			const data = await ocrFetch<UploadBomResponse>('/upload_bom', {
				method: 'POST',
				body: formData
			});
			const map = buildBomNumericMap(data.marks ?? [], data.bom_suffix_map ?? {});
			bomNumericMap = map;
			pdfs = enrichPdfResultsWithBomSuggestions(pdfs, map);
			updateOperationsCountResults(bomId, pdfs);
		} catch (err) {
			ocrPushErrorToast({
				title: 'Could not load BOM for editing',
				description: errorDescription(err, 'Upload the BOM CSV again from BOMs.')
			});
		}
	}

	async function loadResultsFromServer(currentBom: BomConfig) {
		isResultsLoading = true;
		try {
			const session = readOcrGenerateSessionForBom(bomId);
			const focusIds = session?.drawingFileIds?.filter(Boolean) ?? [];
			const displayName =
				focusIds.length === 1
					? (session?.filenamesByFileId?.[focusIds[0]] ?? currentBom.drawingsFile ?? 'drawings.pdf')
					: (currentBom.drawingsFile ?? 'drawings.pdf');
			const loaded = await loadPersistedOperationsCountResults(
				bomId,
				displayName,
				currentBom.operationsCountRoi ?? null,
				focusIds.length > 0
					? {
							drawingFileIds: focusIds,
							filenamesByFileId: session?.filenamesByFileId
						}
					: undefined
			);
			if (!loaded?.length) {
				pdfs = [];
				return;
			}
			setOperationsCountResults(bomId, loaded);
			pdfs = ensureResultRowIds(loaded);
			await loadBomMap();
		} catch (err) {
			ocrPushErrorToast({
				title: 'Could not load OCR results',
				description: errorDescription(err, 'Load failed')
			});
			pdfs = [];
		} finally {
			isResultsLoading = false;
		}
	}

	$effect(() => {
		if (!bom || loadAttempted) return;
		loadAttempted = true;

		if (OCR_MODE !== 'core') {
			const stored = getOperationsCountResults(bomId) ?? [];
			if (stored.length > 0) {
				pdfs = ensureResultRowIds(applyPdfRoiFallback(stored, bom.operationsCountRoi ?? null));
				void loadBomMap();
			}
			return;
		}

		void loadResultsFromServer(bom);
	});
</script>

<div class="flex h-full min-h-0 flex-col overflow-hidden bg-white p-3 md:p-4">
	{#if contextLoadError}
		<div class="p-4">
			<Alert variant="error" title="Could not load BOM context" description={contextLoadError} />
		</div>
	{:else if !isPageLoading && (!project || (!tower && !stub) || !bom)}
		<p class="text-gray-500">BOM not found.</p>
	{:else if !isPageLoading && pdfs.length === 0}
		<div class="flex flex-col items-center gap-4 py-16 text-center">
			<p class="text-base font-semibold text-foreground">No results available</p>
			<p class="max-w-md text-sm text-muted-foreground">
				Run operations count extraction from Marking Selection to see results here.
			</p>
			<Button
				variant="primary"
				label="Go to Marking Selection"
				onclick={navigateToMarkingSelection}
			/>
		</div>
	{:else}
		<div class="flex min-h-0 flex-1 flex-col gap-4">
			{#if isPageLoading}
				<div class={filterCardStripClassFor(resultsFilterLayout)} aria-busy="true" role="status">
					{#each Array.from({ length: 6 }, (_, i) => i) as index (index)}
						<div class="border-border px-6 py-5 {filterCardCellClass(index, resultsFilterLayout)}">
							<Skeleton class="h-4 w-24" />
							<Skeleton class="mt-3 h-8 w-12" />
						</div>
					{/each}
				</div>
			{:else}
				<FilterCardStrip
					items={filterCards}
					bind:value={activeFilter}
					columns={resultsFilterLayout.columns}
					wideColumns={resultsFilterLayout.wideColumns}
					wideMinWidth={resultsFilterLayout.wideMinWidth}
				/>
			{/if}

			<div class="min-h-0 flex-1">
				<DataTable
					class="min-h-0 flex-1"
					columns={resultColumns}
					rows={filteredRows}
					rowKey={(row) => row.id ?? `${row.page}-${row.mark_number}`}
					loading={isPageLoading}
					search={{ enabled: true, placeholder: 'Search Mark Nos…' }}
					toolbarButton={[
						{
							enabled: true,
							label: 'Export All (CSV)',
							icon: FileDown,
							variant: 'outline',
							disabled: isPageLoading,
							onClick: exportCsv
						},
						{
							enabled: true,
							label: 'Re-Run',
							icon: RotateCcw,
							variant: 'outline',
							disabled: isPageLoading,
							onClick: () => (startOverOpen = true)
						},
						{
							enabled: true,
							label:
								bom?.ocrStatus === 'verified'
									? 'Verified'
									: isConfirming
										? 'Confirming...'
										: 'Confirm & Save',
							icon: ClipboardCheck,
							variant: 'primary',
							disabled: isPageLoading || isConfirming || bom?.ocrStatus === 'verified',
							loading: isConfirming,
							onClick: handleConfirmAndSave
						}
					]}
					emptyState={{
						title: 'No results',
						description:
							activeFilter === 'all'
								? 'No mark numbers were extracted.'
								: `No rows match the ${filterCards.find((card) => card.id === activeFilter)?.label ?? 'selected'} filter.`
					}}
					pagination={{ pageSize: 15 }}
					sorting={{ rowSortPriority: operationsCountStatusSortPriority }}
				/>
			</div>
		</div>
	{/if}
</div>

<ConfirmationDialog
	bind:open={startOverOpen}
	title="Re-Run extraction?"
	description="This uses your existing uploaded drawing - no file re-upload. You can change the region of interest and run extraction again from Marking Selection."
	cancelLabel="Cancel"
	confirmLabel="Re-Run"
	confirmVariant="danger"
	iconTone="danger"
	onConfirm={() => {
		startOverOpen = false;
		navigateToMarkingSelection();
	}}
/>

<OperationsCountMarkEditDialog
	bind:open={editOpen}
	{bomId}
	session={editSession}
	{pdfs}
	{bomNumericMap}
	{bomItemIdByMark}
	onClose={closeEdit}
	onSave={persistResults}
/>

<OperationsCountHoleReviewDialog
	bind:open={holeOpen}
	{bomId}
	session={holeSession}
	{pdfs}
	onClose={closeHoleReview}
	onSave={persistResults}
/>
