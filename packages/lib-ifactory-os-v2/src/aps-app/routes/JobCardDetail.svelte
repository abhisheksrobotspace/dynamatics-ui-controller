<script lang="ts">
	import { onMount, tick } from 'svelte';
	import {
		AccordionWithTable,
		Alert,
		Button,
		DataTable,
		Dialog,
		EmptyState,
		Skeleton,
		Tabs,
		type DataTableColumn,
		type TabItem
	} from '@ifactory/ui-v2';
	import { ChevronLeft, ChevronRight, FileDown, FileImage, Loader2 } from '@lucide/svelte';
	import { formatApiErrorMessage } from '../../lib/api/types.js';
	import { apsPushErrorToast } from '../lib/toast.js';
	import { toCuttingPlanAccordionItems } from '../lib/job-cards.derive.js';
	import { loadJobCardDetail } from '../lib/job-cards.api.js';
	import type {
		JobCardCuttingMarkTableRow,
		JobCardLoadingRow,
		JobCardMarkRow,
		JobCardRequisitionRow
	} from '../lib/job-cards.types.js';
	import { formatExportWeightKg, formatSheetKg } from '../lib/job-cards.weight.js';

	let { params } = $props();

	const jobId = $derived(String(params.jobId ?? ''));

	let loading = $state(true);
	let errorMessage = $state<string | null>(null);
	let detail = $state<Awaited<ReturnType<typeof loadJobCardDetail>>>(null);
	let activeTab = $state('job-card');
	let generatingPdf = $state(false);
	let drawingIndex = $state(0);

	const tabItems: TabItem[] = [
		{ label: 'Job Card', value: 'job-card' },
		{ label: 'Machine Schedule', value: 'loading' },
		{ label: 'Steel Requisition', value: 'requisition' },
		{ label: 'Cutting Plan', value: 'cutting-plan' },
		{ label: 'Drawings', value: 'drawings' }
	];

	function formatWidthMm(widthMm: number | null | undefined): string {
		if (widthMm == null || !Number.isFinite(widthMm) || widthMm <= 0) return '-';
		return String(widthMm);
	}

	function headerValue(value: string | number | null | undefined, fallback = ''): string {
		if (value == null) return fallback;
		const text = String(value).trim();
		return text || fallback;
	}

	const exportFileName = $derived(
		`job-card-${detail?.jcSrNo ?? (jobId || 'detail')}`.replace(/[^\w.-]+/g, '-')
	);

	const markRows = $derived(detail?.rows ?? []);
	const loadingRows = $derived(detail?.loadingRows ?? []);
	const requisitionRows = $derived(detail?.requisitionRows ?? []);
	const cuttingRows = $derived(detail?.cuttingRows ?? []);
	const cuttingAccordion = $derived(toCuttingPlanAccordionItems(cuttingRows));
	const drawingRows = $derived(detail?.drawings ?? []);
	const currentDrawing = $derived(drawingRows[drawingIndex] ?? drawingRows[0] ?? null);

	$effect(() => {
		void jobId;
		drawingIndex = 0;
	});

	const markTotals = $derived({
		pcs: markRows.reduce((sum, row) => sum + row.totalPcs, 0),
		wt: markRows.reduce((sum, row) => sum + row.totalWtKg, 0),
		notching: markRows.reduce((sum, row) => sum + (row.notchingWtKg ?? 0), 0),
		bending: markRows.reduce((sum, row) => sum + (row.bendingWtKg ?? 0), 0),
		heel: markRows.reduce((sum, row) => sum + (row.heelGrindingWtKg ?? 0), 0)
	});

	const requisitionTotals = $derived({
		qty: requisitionRows.reduce((sum, row) => sum + row.quantity, 0),
		wt: requisitionRows.reduce((sum, row) => sum + row.weightKg, 0)
	});

	const markColumns: DataTableColumn<JobCardMarkRow>[] = [
		{
			key: 'markNo',
			header: 'Mark No',
			sticky: true,
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => row.markNo
		},
		{
			key: 'operation',
			header: 'Operation',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => row.operation
		},
		{
			key: 'lengthMm',
			header: 'Length (mm)',
			sortable: true,
			filterable: true,
			dataType: 'number',
			value: (row) => String(row.lengthMm)
		},
		{
			key: 'widthMm',
			header: 'Width (mm)',
			sortable: true,
			filterable: true,
			dataType: 'number',
			value: (row) => formatWidthMm(row.widthMm)
		},
		{
			key: 'wtPerPieceKg',
			header: 'Wt/Piece (kg)',
			sortable: true,
			filterable: true,
			dataType: 'number',
			value: (row) => formatSheetKg(row.wtPerPieceKg)
		},
		{
			key: 'totalPcs',
			header: 'Total Pcs',
			sortable: true,
			filterable: true,
			dataType: 'number',
			value: (row) => String(row.totalPcs)
		},
		{
			key: 'totalWtKg',
			header: 'Total Wt (kg)',
			sortable: true,
			filterable: true,
			dataType: 'number',
			value: (row) => formatSheetKg(row.totalWtKg)
		},
		{
			key: 'notchingWtKg',
			header: 'Notching Wt (kg)',
			sortable: true,
			filterable: true,
			dataType: 'number',
			value: (row) => formatSheetKg(row.notchingWtKg)
		},
		{
			key: 'bendingWtKg',
			header: 'Bending Wt (kg)',
			sortable: true,
			filterable: true,
			dataType: 'number',
			value: (row) => formatSheetKg(row.bendingWtKg)
		},
		{
			key: 'heelGrindingWtKg',
			header: 'Heel Grind. (kg)',
			sortable: true,
			filterable: true,
			dataType: 'number',
			value: (row) => formatSheetKg(row.heelGrindingWtKg)
		},
		{
			key: 'caseNo',
			header: 'Case No',
			sortable: false,
			filterable: false,
			dataType: 'string',
			value: () => '-'
		},
		{
			key: 'numBundles',
			header: 'No of Bundles',
			sortable: true,
			filterable: true,
			dataType: 'number',
			value: (row) => (row.numBundles == null ? '-' : String(row.numBundles))
		},
		{
			key: 'bundlesLabel',
			header: 'Pcs/Bundle',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => row.bundlesLabel
		}
	];

	const loadingColumns: DataTableColumn<JobCardLoadingRow>[] = [
		{
			key: 'machineName',
			header: 'Machine No. / Name',
			sticky: true,
			sortable: true,
			dataType: 'string',
			value: (row) => row.machineId
		},
		{
			key: 'plannedStart',
			header: 'Planned Start',
			sortable: true,
			dataType: 'string',
			value: (row) => row.plannedStart
		},
		{
			key: 'plannedEnd',
			header: 'Planned End',
			sortable: true,
			dataType: 'string',
			value: (row) => row.plannedEnd
		},
		{
			key: 'materialId',
			header: 'RM ID / Bundle ID',
			sortable: true,
			dataType: 'string',
			value: (row) => row.materialId
		},
		{
			key: 'lengthMm',
			header: 'Length',
			sortable: true,
			dataType: 'number',
			value: (row) => (row.lengthMm == null ? '' : String(row.lengthMm))
		},
		{
			key: 'operation',
			header: 'Operation',
			sortable: true,
			dataType: 'string',
			value: (row) => row.operation
		},
		{
			key: 'qty',
			header: 'Bars or Pcs',
			sortable: true,
			dataType: 'number',
			value: (row) => String(row.qty)
		}
	];

	const requisitionColumns: DataTableColumn<JobCardRequisitionRow>[] = [
		{
			key: 'section',
			header: 'Section',
			sortable: true,
			dataType: 'string',
			value: (row) => row.section
		},
		{
			key: 'lengthMm',
			header: 'Length (mm)',
			sortable: true,
			dataType: 'number',
			value: (row) => String(row.lengthMm)
		},
		{
			key: 'quantity',
			header: 'Quantity (nos)',
			sortable: true,
			dataType: 'number',
			value: (row) => String(row.quantity)
		},
		{
			key: 'weightKg',
			header: 'Weight (kg)',
			sortable: true,
			dataType: 'number',
			value: (row) => formatSheetKg(row.weightKg)
		}
	];

	const cuttingColumns: DataTableColumn<JobCardCuttingMarkTableRow>[] = [
		{
			key: 'markNo',
			header: 'Mark Number',
			dataType: 'string',
			value: (row) => row.markNo
		},
		{
			key: 'lengthMm',
			header: 'Mark Length (mm)',
			dataType: 'number',
			value: (row) => String(row.lengthMm)
		},
		{
			key: 'pcsPerBar',
			header: 'Pcs / Bar',
			dataType: 'number',
			value: (row) => String(row.pcsPerBar)
		}
	];

	function showPreviousDrawing(): void {
		const count = drawingRows.length;
		if (count <= 1) return;
		drawingIndex = (drawingIndex - 1 + count) % count;
	}

	function showNextDrawing(): void {
		const count = drawingRows.length;
		if (count <= 1) return;
		drawingIndex = (drawingIndex + 1) % count;
	}

	onMount(() => {
		const id = jobId;
		if (!id) {
			loading = false;
			detail = null;
			return;
		}
		const controller = new AbortController();
		loading = true;
		errorMessage = null;
		void (async () => {
			try {
				const loaded = await loadJobCardDetail(id, controller.signal);
				if (controller.signal.aborted) return;
				detail = loaded;
			} catch (error) {
				if (error instanceof DOMException && error.name === 'AbortError') return;
				errorMessage = formatApiErrorMessage(error);
				detail = null;
			} finally {
				if (!controller.signal.aborted) loading = false;
			}
		})();
		return () => controller.abort();
	});

	/**
	 * The printed job card is a whole-document action rather than a per-tab one, so it sits with
	 * the tabs instead of in a tab's toolbar. The renderer is imported on demand - pdfmake and its
	 * fonts are around 2 MB and nobody should pay for them just by opening a job card.
	 */
	async function downloadPdf(): Promise<void> {
		if (!detail || generatingPdf) return;
		generatingPdf = true;
		// Let the overlay paint before pdfmake occupies the main thread.
		await tick();
		await new Promise<void>((resolve) => {
			requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
		});
		try {
			const { downloadJobCardPdf } = await import('../lib/job-cards.pdf.runtime.js');
			await downloadJobCardPdf(detail);
		} catch (error) {
			apsPushErrorToast({
				title: 'Could not generate job card PDF',
				description: formatApiErrorMessage(error)
			});
		} finally {
			generatingPdf = false;
		}
	}

	function csvLine(cells: Array<string | number>): string {
		return cells.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',');
	}

	function downloadCsv(fileName: string, headers: string[], lines: string[]): void {
		const csv = [headers.join(','), ...lines].join('\n');
		const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = `${fileName}.csv`;
		link.click();
		URL.revokeObjectURL(url);
	}

	function exportCsv(): void {
		if (!detail) return;
		const base = exportFileName;
		if (activeTab === 'loading') {
			downloadCsv(
				`${base}-machine-loading`,
				[
					'Machine No. / Name',
					'Planned Start',
					'Planned End',
					'RM ID / Bundle ID',
					'Length',
					'Operation',
					'No. of Bars / Pcs'
				],
				detail.loadingRows.map((row) =>
					csvLine([
						row.machineName,
						row.plannedStart,
						row.plannedEnd,
						row.materialId,
						row.lengthMm ?? '',
						row.operation,
						row.qty
					])
				)
			);
			return;
		}
		if (activeTab === 'requisition') {
			downloadCsv(
				`${base}-steel-requisition`,
				['Section', 'Length (mm)', 'Quantity (nos)', 'Weight (kg)'],
				[
					...detail.requisitionRows.map((row) =>
						csvLine([row.section, row.lengthMm, row.quantity, formatExportWeightKg(row.weightKg)])
					),
					csvLine(['TOTAL', '', requisitionTotals.qty, formatExportWeightKg(requisitionTotals.wt)])
				]
			);
			return;
		}
		if (activeTab === 'cutting-plan') {
			const summary = detail.cuttingSummary;
			downloadCsv(
				`${base}-cutting-plan`,
				[
					'Raw Material ID',
					'Length (mm)',
					'Quantity (nos)',
					'Markings × Quantity',
					'Used (mm)',
					'Waste (mm)',
					'Waste (%)',
					'Waste (kg)',
					'Weight (kg)'
				],
				[
					...detail.cuttingRows.map((row) =>
						csvLine([
							row.rmid,
							row.lengthMm,
							row.quantity,
							row.markings,
							row.usedMm,
							row.wasteMm,
							row.wastePct.toFixed(2),
							formatExportWeightKg(row.wasteKg),
							formatExportWeightKg(row.weightKg)
						])
					),
					...(summary
						? [
								csvLine([
									'TOTAL',
									'',
									summary.quantity,
									'',
									'',
									'',
									summary.wastePct.toFixed(2),
									formatExportWeightKg(summary.wasteKg),
									formatExportWeightKg(summary.weightKg)
								])
							]
						: [])
				]
			);
			return;
		}
		downloadCsv(
			base,
			[
				'Mark No',
				'Operation',
				'Length (mm)',
				'Width (mm)',
				'Wt/Piece (kg)',
				'Total Pcs',
				'Total Wt (kg)',
				'Notching Wt (kg)',
				'Bending Wt (kg)',
				'Heel Grind. (kg)',
				'Case No',
				'No of Bundles',
				'Pcs/Bundle'
			],
			[
				...detail.rows.map((row) =>
					csvLine([
						row.markNo,
						row.operation,
						row.lengthMm,
						formatWidthMm(row.widthMm),
						formatExportWeightKg(row.wtPerPieceKg),
						row.totalPcs,
						formatExportWeightKg(row.totalWtKg),
						formatExportWeightKg(row.notchingWtKg ?? 0),
						formatExportWeightKg(row.bendingWtKg ?? 0),
						formatExportWeightKg(row.heelGrindingWtKg ?? 0),
						'',
						row.numBundles ?? '',
						row.bundlesLabel
					])
				),
				csvLine([
					'TOTAL',
					'',
					'',
					'',
					'',
					markTotals.pcs,
					formatExportWeightKg(markTotals.wt),
					formatExportWeightKg(markTotals.notching),
					formatExportWeightKg(markTotals.bending),
					formatExportWeightKg(markTotals.heel),
					'',
					'',
					''
				])
			]
		);
	}
</script>

<div class="flex h-full min-h-0 flex-col gap-4 overflow-hidden p-4">
	{#if errorMessage}
		<Alert variant="error" title="Could not load job card" description={errorMessage} />
	{:else if loading}
		<div class="space-y-3" aria-busy="true" role="status">
			<span class="sr-only">Loading job card</span>
			<Skeleton class="h-10 w-full" />
			<Skeleton class="h-64 w-full" />
		</div>
	{:else if !detail}
		<div class="border border-border bg-surface p-6">
			<p class="text-sm font-medium text-foreground">Job card not found</p>
		</div>
	{:else}
		<dl
			class="grid grid-cols-1 gap-x-8 gap-y-2 border border-border bg-surface p-4 text-sm sm:grid-cols-2"
		>
			<div class="flex gap-2">
				<dt class="w-32 shrink-0 text-muted-foreground">Project</dt>
				<dd class="font-medium">{headerValue(detail.projectName)}</dd>
			</div>
			<div class="flex gap-2">
				<dt class="w-32 shrink-0 text-muted-foreground">Tower Type</dt>
				<dd class="font-medium">{headerValue(detail.towerType)}</dd>
			</div>
			<div class="flex gap-2">
				<dt class="w-32 shrink-0 text-muted-foreground">Wo No</dt>
				<dd class="font-medium">{headerValue(detail.workOrder)}</dd>
			</div>
			<div class="flex gap-2">
				<dt class="w-32 shrink-0 text-muted-foreground">Batch No</dt>
				<dd class="font-medium">{headerValue(detail.batchNo)}</dd>
			</div>
			<div class="flex gap-2">
				<dt class="w-32 shrink-0 text-muted-foreground">JC No</dt>
				<dd class="font-medium">{headerValue(detail.jcSrNo)}</dd>
			</div>
			<div class="flex gap-2">
				<dt class="w-32 shrink-0 text-muted-foreground">Date</dt>
				<dd class="font-medium">{headerValue(detail.date, '')}</dd>
			</div>
			<div class="flex gap-2">
				<dt class="w-32 shrink-0 text-muted-foreground">Section</dt>
				<dd class="font-medium">{headerValue(detail.section)}</dd>
			</div>
			<div class="flex gap-2">
				<dt class="w-32 shrink-0 text-muted-foreground">Subtype</dt>
				<dd class="font-medium">{headerValue(detail.subtype)}</dd>
			</div>
			<div class="flex gap-2">
				<dt class="w-32 shrink-0 text-muted-foreground">No of Sets</dt>
				<dd class="font-medium">{detail.sets}</dd>
			</div>
			<div class="flex gap-2">
				<dt class="w-32 shrink-0 text-muted-foreground">Material Grade</dt>
				<dd class="font-medium">{headerValue(detail.rmGrade, '-')}</dd>
			</div>
		</dl>

		<div class="flex flex-wrap items-center justify-between gap-3">
			<Tabs items={tabItems} bind:value={activeTab} variant="underline" mobileSelect={false} />
			<Button
				variant="outline"
				size="sm"
				label="Download Job Card"
				icon={FileDown}
				class="shrink-0 rounded-none"
				loading={generatingPdf}
				onclick={downloadPdf}
			/>
		</div>

		{#if activeTab === 'job-card'}
			<DataTable
				columns={markColumns}
				rows={markRows}
				rowKey={(row) => row.id}
				search={{ enabled: true, placeholder: 'Filter marks…' }}
				pagination={{ pageSize: 50 }}
				export={{
					enabled: true,
					fileName: exportFileName,
					onClick: exportCsv
				}}
			/>
		{:else if activeTab === 'loading'}
			<DataTable
				columns={loadingColumns}
				rows={loadingRows}
				rowKey={(row) => row.id}
				pagination={{ pageSize: 50 }}
				export={{
					enabled: true,
					fileName: `${exportFileName}-machine-loading`,
					onClick: exportCsv
				}}
				emptyState={{
					title: 'No scheduled machines',
					description:
						'Machine rows appear after this card has tasks with a machine and start time.'
				}}
			/>
		{:else if activeTab === 'requisition'}
			<DataTable
				columns={requisitionColumns}
				rows={requisitionRows}
				rowKey={(row) => row.id}
				pagination={{ pageSize: 50 }}
				export={{
					enabled: true,
					fileName: `${exportFileName}-steel-requisition`,
					onClick: exportCsv
				}}
			/>
		{:else if activeTab === 'drawings'}
			{#if drawingRows.length === 0}
				<EmptyState
					icon={FileImage}
					title="No marking drawings for this section"
					description="Drawings appear after OCR has extracted shop sketches for this BOM."
					class="border border-border bg-surface py-8"
				/>
			{:else if currentDrawing}
				<div class="flex min-h-0 flex-1 flex-col gap-3">
					<div class="flex items-center justify-between gap-3">
						<p class="text-sm font-medium text-foreground">{currentDrawing.markNo}</p>
						<div class="flex items-center gap-2">
							<Button
								variant="outline"
								size="icon"
								icon={ChevronLeft}
								disabled={drawingRows.length <= 1}
								aria-label="Previous marking"
								onclick={showPreviousDrawing}
							/>
							<span class="min-w-12 text-center text-xs text-muted-foreground">
								{drawingIndex + 1} / {drawingRows.length}
							</span>
							<Button
								variant="outline"
								size="icon"
								icon={ChevronRight}
								disabled={drawingRows.length <= 1}
								aria-label="Next marking"
								onclick={showNextDrawing}
							/>
						</div>
					</div>
					<div class="min-h-0 flex-1 overflow-auto border border-border bg-slate-50">
						<img
							src={currentDrawing.imageUrl}
							alt={currentDrawing.markNo}
							class="mx-auto max-h-full w-auto max-w-full object-contain"
						/>
					</div>
				</div>
			{/if}
		{:else if activeTab === 'cutting-plan'}
			{#if cuttingAccordion.length === 0}
				<EmptyState
					title="No cutting plan bars for this section"
					description="The card is still a valid requisition. Bars appear after a published cutting plan (and scheduled tasks) exist for this BOM section."
					class="border border-border bg-surface py-8"
				/>
			{:else}
				<div class="min-h-0 flex-1 overflow-auto">
					<AccordionWithTable
						items={cuttingAccordion}
						columns={cuttingColumns}
						rowKey={(row: JobCardCuttingMarkTableRow) => row.id}
						type="multiple"
						tableClass="rounded-none"
					/>
				</div>
			{/if}
		{/if}
	{/if}

	<Dialog
		open={generatingPdf}
		title="Downloading"
		size="sm"
		hideFooter
		showCloseButton={false}
		closeOnBackdrop={false}
		oncancel={(event) => event.preventDefault()}
	>
		<div class="flex items-center gap-3 py-2">
			<Loader2 class="size-5 shrink-0 animate-spin text-foreground" aria-hidden="true" />
			<p class="text-sm text-muted-foreground">Preparing the job card PDF…</p>
		</div>
	</Dialog>
</div>
