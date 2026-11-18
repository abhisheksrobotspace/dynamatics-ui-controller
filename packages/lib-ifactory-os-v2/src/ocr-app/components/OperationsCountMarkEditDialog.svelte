<script lang="ts">
	import {
		bomSuggestionsForNumeric,
		bomSuggestionsForRow,
		numericFromMark,
		saveMarkEdit,
		findMarkMatchChangedRows,
		removeResultRow,
		validateBomMarkEntry,
		displaySketchMark,
		initialSketchMarkValue,
		initialBomMarkValue,
		isNotFoundMark,
		type BomNumericMap
	} from '../lib/ocr-mark-edit';
	import { BOM_MATCH_STATUS } from '../lib/ocr.constants.js';
	import type { OcrResultRow, PdfJob } from '../lib/ocr.types';
	import {
		OCR_MODE,
		persistOcrMarkMatchRows,
		persistOcrResultDelete,
		resolvePageImageUrl
	} from '../lib/ocr.backend';
	import { errorDescription } from '../../lib/api/types.js';
	import { pmPushErrorToast, pmPushSuccessToast } from '../lib/toast.js';
	import { Button, ConfirmationDialog, Dialog, Input, Tabs } from '@ifactory/ui-v2';

	export type MarkEditSession = {
		row: OcrResultRow;
		pdf: PdfJob;
		isDuplicate: boolean;
		rowId: string;
	};

	type Props = {
		open: boolean;
		bomId: string;
		session: MarkEditSession | null;
		bomNumericMap: BomNumericMap;
		bomItemIdByMark: Record<string, string>;
		pdfs: PdfJob[];
		onClose: () => void;
		onSave: (pdfs: PdfJob[]) => void;
	};

	let {
		open = $bindable(false),
		bomId,
		session,
		bomNumericMap,
		bomItemIdByMark,
		pdfs,
		onClose,
		onSave
	}: Props = $props();

	let editingSketchValue = $state('');
	let editingBomValue = $state('');
	let sketchInputRef = $state<HTMLInputElement | null>(null);
	let imageViewMode = $state<'roi' | 'full'>('roi');
	const showFullImage = $derived(imageViewMode === 'full');
	let canvasRef = $state<HTMLCanvasElement | null>(null);
	let viewerRef = $state<HTMLDivElement | null>(null);
	let imageLoaded = $state(false);
	let imageError = $state(false);
	let manualError = $state<string | null>(null);
	let bomError = $state<string | null>(null);
	let isSaving = $state(false);
	let deleteConfirmOpen = $state(false);
	let drawGeneration = $state(0);
	let initializedForRowId = '';
	let cachedDrawImage: HTMLImageElement | null = null;

	let fullImageZoom = $state(1);
	let panX = $state(0);
	let panY = $state(0);
	let isPanning = $state(false);
	let panAnchorX = 0;
	let panAnchorY = 0;
	let panStartX = 0;
	let panStartY = 0;

	const MIN_FULL_ZOOM = 0.75;
	const MAX_FULL_ZOOM = 3;

	function clearCanvas() {
		if (!canvasRef) return;
		const ctx = canvasRef.getContext('2d');
		if (!ctx) return;
		canvasRef.width = 0;
		canvasRef.height = 0;
	}

	function invalidateCanvasDraw() {
		drawGeneration += 1;
		cachedDrawImage = null;
		clearCanvas();
		imageLoaded = false;
		imageError = false;
	}

	function requestCanvasRedraw() {
		if (!open || !session || !canvasRef || !viewerRef || !cachedDrawImage) return;
		paintCanvas(session.pdf, cachedDrawImage, drawGeneration);
	}

	function handleImageViewModeChange() {
		resetFullImageView();
		requestCanvasRedraw();
	}

	function resetFullImageView() {
		fullImageZoom = 1;
		panX = 0;
		panY = 0;
		isPanning = false;
	}

	function clampFullZoom(zoom: number): number {
		return Math.min(MAX_FULL_ZOOM, Math.max(MIN_FULL_ZOOM, Math.round(zoom * 4) / 4));
	}

	function bumpFullImageZoom(delta: number) {
		fullImageZoom = clampFullZoom(fullImageZoom + delta);
		requestCanvasRedraw();
	}

	function fitFullImageView() {
		resetFullImageView();
		requestCanvasRedraw();
	}

	function startPan(event: PointerEvent) {
		if (!imageLoaded) return;
		event.preventDefault();
		isPanning = true;
		panAnchorX = event.clientX;
		panAnchorY = event.clientY;
		panStartX = panX;
		panStartY = panY;
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
	}

	function movePan(event: PointerEvent) {
		if (!isPanning) return;
		panX = panStartX + (event.clientX - panAnchorX);
		panY = panStartY + (event.clientY - panAnchorY);
		requestCanvasRedraw();
	}

	function endPan(event: PointerEvent) {
		if (!isPanning) return;
		isPanning = false;
		try {
			(event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
		} catch {
			// pointer may already be released
		}
	}

	const sketchNumeric = $derived(numericFromMark(editingSketchValue));
	const bomSuggestions = $derived.by(() => {
		if (!session) return [];
		// Prefer suggestions for the mark the user is typing (sketch may have been corrected).
		if (sketchNumeric) {
			const fromSketch = bomSuggestionsForNumeric(sketchNumeric, bomNumericMap);
			if (fromSketch.length > 0) return fromSketch;
		}
		return bomSuggestionsForRow(session.row, bomNumericMap);
	});
	/** Chip picker is for disambiguation — not for already-matched unique rows. */
	const showBomSuggestionPicker = $derived.by(() => {
		if (bomSuggestions.length === 0) return false;
		if (bomSuggestions.length > 1) return true;
		const status = session?.row.bom_match_status;
		return status === 'DUPLICATE_SUFFIX' || session?.isDuplicate === true;
	});
	const showDuplicateHint = $derived(bomSuggestions.length > 1);
	const imageViewTabs = $derived(
		session?.pdf.roi
			? [
					{ value: 'roi', label: 'ROI Crop' },
					{ value: 'full', label: 'Full Page' }
				]
			: []
	);
	const dialogTitle = $derived(
		session
			? `Map Marking No For Shop Sketch - Page ${session.row.page} - ${isNotFoundMark(session.row) ? 'No mark number' : displaySketchMark(session.row)}`
			: 'Map Marking No For Shop Sketch'
	);
	const deleteConfirmDescription = $derived.by(() => {
		if (!session) {
			return 'Remove this operations count row? Re-run OCR to restore it.';
		}
		const row = session.row;
		if (row.bom_match_status === BOM_MATCH_STATUS.MATCHED) {
			const mark = row.bom_mark_number?.trim();
			if (mark && mark !== '-') {
				return `Remove the matched row for "${mark}"? Its operation count will no longer be used for scheduling unless another row covers this mark. Re-run OCR to restore it.`;
			}
		}
		return 'Remove this operations count row? Use this for duplicate or incorrect detections. Re-run OCR to restore it.';
	});

	function handleOpenChange(next: boolean) {
		open = next;
		if (!next) {
			deleteConfirmOpen = false;
			initializedForRowId = '';
			invalidateCanvasDraw();
			resetFullImageView();
			imageViewMode = 'roi';
			onClose();
		}
	}

	$effect(() => {
		if (!open || !session || !canvasRef) return;
		const generation = drawGeneration;
		void drawCanvas(session.pdf, session.row.page, generation);
	});

	$effect(() => {
		if (!open || !session || !canvasRef) return;
		void showFullImage;
		void fullImageZoom;
		void panX;
		void panY;
		if (!cachedDrawImage) return;
		paintCanvas(session.pdf, cachedDrawImage, drawGeneration);
	});

	function initSessionForm() {
		if (!session) return;
		editingSketchValue = initialSketchMarkValue(session.row);
		editingBomValue = initialBomMarkValue(session.row);
		manualError = null;
		bomError = null;
		queueMicrotask(() => sketchInputRef?.focus());
	}

	$effect(() => {
		if (!open || !session) {
			initializedForRowId = '';
			return;
		}
		if (initializedForRowId === session.rowId) return;

		initializedForRowId = session.rowId;
		imageViewMode = 'roi';
		resetFullImageView();
		invalidateCanvasDraw();
		initSessionForm();
	});

	async function drawCanvas(pdf: PdfJob, page: number, generation: number) {
		if (!canvasRef || !viewerRef) return;

		clearCanvas();
		imageLoaded = false;
		imageError = false;
		cachedDrawImage = null;

		let src: string | null;
		try {
			src = await resolvePageImageUrl(bomId, pdf, page);
		} catch (error) {
			if (generation !== drawGeneration) return;
			imageError = true;
			pmPushErrorToast({
				title: 'Could not load page image',
				description: errorDescription(error)
			});
			return;
		}
		if (generation !== drawGeneration || !canvasRef || !viewerRef) return;

		if (!src) {
			imageError = true;
			return;
		}

		const img = new Image();
		img.crossOrigin = 'anonymous';

		const finish = () => {
			if (generation !== drawGeneration || !canvasRef || !viewerRef) return;
			cachedDrawImage = img;
			paintCanvas(pdf, img, generation);
		};

		img.onload = finish;
		img.onerror = () => {
			if (generation !== drawGeneration) return;
			clearCanvas();
			cachedDrawImage = null;
			imageLoaded = false;
			imageError = true;
		};
		img.src = src;
		if (img.complete && img.naturalWidth > 0) {
			finish();
		}
	}

	function paintCanvas(pdf: PdfJob, img: HTMLImageElement, generation: number) {
		if (generation !== drawGeneration || !canvasRef || !viewerRef) return;

		const imgW = img.naturalWidth;
		const imgH = img.naturalHeight;
		const ctx = canvasRef.getContext('2d');
		if (!ctx || !imgW || !imgH) return;

		const pad = 16;
		const containerW = Math.max(1, viewerRef.clientWidth - pad);
		const containerH = Math.max(1, viewerRef.clientHeight - pad);

		imageLoaded = true;
		imageError = false;

		if (!showFullImage && pdf.roi) {
			const sx = Math.max(0, Math.floor(pdf.roi.x * imgW));
			const sy = Math.max(0, Math.floor(pdf.roi.y * imgH));
			const sw = Math.min(Math.floor(pdf.roi.w * imgW), imgW - sx);
			const sh = Math.min(Math.floor(pdf.roi.h * imgH), imgH - sy);
			const fitScale = Math.min(containerW / sw, containerH / sh);
			const scale = fitScale * fullImageZoom;
			const drawW = sw * scale;
			const drawH = sh * scale;
			const x = (containerW - drawW) / 2 + panX;
			const y = (containerH - drawH) / 2 + panY;

			canvasRef.width = Math.max(1, Math.floor(containerW));
			canvasRef.height = Math.max(1, Math.floor(containerH));
			ctx.clearRect(0, 0, canvasRef.width, canvasRef.height);
			ctx.drawImage(img, sx, sy, sw, sh, x, y, drawW, drawH);
			return;
		}

		const fitScale = Math.min(containerW / imgW, containerH / imgH);
		const scale = fitScale * fullImageZoom;
		const drawW = imgW * scale;
		const drawH = imgH * scale;

		canvasRef.width = Math.max(1, Math.floor(containerW));
		canvasRef.height = Math.max(1, Math.floor(containerH));
		ctx.clearRect(0, 0, canvasRef.width, canvasRef.height);

		const x = (containerW - drawW) / 2 + panX;
		const y = (containerH - drawH) / 2 + panY;
		ctx.drawImage(img, 0, 0, imgW, imgH, x, y, drawW, drawH);

		if (pdf.roi) {
			const rx = x + pdf.roi.x * drawW;
			const ry = y + pdf.roi.y * drawH;
			const rw = pdf.roi.w * drawW;
			const rh = pdf.roi.h * drawH;
			ctx.strokeStyle = '#EA580C';
			ctx.lineWidth = 2;
			ctx.setLineDash([8, 6]);
			ctx.strokeRect(rx, ry, rw, rh);
			ctx.setLineDash([]);
			ctx.fillStyle = 'rgba(234, 88, 12, 0.10)';
			ctx.fillRect(rx, ry, rw, rh);
		}
	}

	function removeReconciledNotInPdfRows(pdfs: PdfJob[], matchedMarks: Set<string>): PdfJob[] {
		if (matchedMarks.size === 0) return pdfs;
		return pdfs.map((pdf) => ({
			...pdf,
			results: (pdf.results ?? []).filter(
				(r) =>
					!(
						r.bom_match_status === BOM_MATCH_STATUS.MISSING_IN_SKETCH &&
						matchedMarks.has((r.bom_mark_number ?? '').trim())
					)
			)
		}));
	}

	async function applyMarkEditResult(next: PdfJob[]): Promise<PdfJob[]> {
		const changedRows = findMarkMatchChangedRows(pdfs, next);
		const matchedMarks = new Set(
			changedRows
				.filter((row) => row.bom_match_status === 'MATCHED')
				.map((row) => (row.bom_mark_number ?? '').trim())
				.filter(Boolean)
		);
		const reconciledRemoved = removeReconciledNotInPdfRows(next, matchedMarks);

		if (OCR_MODE === 'core' && changedRows.length > 0) {
			await persistOcrMarkMatchRows(bomId, changedRows, bomItemIdByMark);
		}

		return reconciledRemoved;
	}

	async function handleSave() {
		if (!session?.rowId || isSaving) return;

		const bomConflict = validateBomMarkEntry(pdfs, session.rowId, editingBomValue, bomNumericMap);
		if (bomConflict) {
			bomError = bomConflict;
			pmPushErrorToast({ title: 'Invalid BOM mark', description: bomConflict });
			return;
		}

		const next = saveMarkEdit(
			pdfs,
			session.rowId,
			editingSketchValue,
			editingBomValue,
			bomNumericMap
		);
		if (!next) return;

		isSaving = true;
		try {
			const saved = await applyMarkEditResult(next);
			onSave(saved);
			pmPushSuccessToast({ title: 'Mark saved' });
			handleOpenChange(false);
		} catch (error) {
			pmPushErrorToast({
				title: 'Could not save mark',
				description: errorDescription(error)
			});
		} finally {
			isSaving = false;
		}
	}

	async function handlePickSuggestion(suggestion: string) {
		if (!session?.rowId || isSaving) return;

		const bomConflict = validateBomMarkEntry(pdfs, session.rowId, suggestion, bomNumericMap);
		if (bomConflict) {
			bomError = bomConflict;
			pmPushErrorToast({ title: 'Mark already matched', description: bomConflict });
			return;
		}

		editingBomValue = suggestion;
		const next = saveMarkEdit(pdfs, session.rowId, editingSketchValue, suggestion, bomNumericMap);
		if (!next) return;

		isSaving = true;
		try {
			const saved = await applyMarkEditResult(next);
			onSave(saved);
			pmPushSuccessToast({ title: 'Mark saved' });
			handleOpenChange(false);
		} catch (error) {
			pmPushErrorToast({
				title: 'Could not save mark',
				description: errorDescription(error)
			});
		} finally {
			isSaving = false;
		}
	}

	async function handleDeleteConfirm() {
		if (!session?.rowId || isSaving) return;

		deleteConfirmOpen = false;
		isSaving = true;
		try {
			if (OCR_MODE === 'core') {
				await persistOcrResultDelete(session.rowId);
			}
			onSave(removeResultRow(pdfs, session.rowId));
			pmPushSuccessToast({ title: 'Row removed' });
			handleOpenChange(false);
		} catch (error) {
			pmPushErrorToast({
				title: 'Could not delete row',
				description: errorDescription(error)
			});
		} finally {
			isSaving = false;
		}
	}
</script>

<Dialog
	bind:open
	title={dialogTitle}
	size="lg"
	hideFooter={true}
	onConfirm={() => handleSave()}
	onOpenChange={handleOpenChange}
	class="flex max-h-[92vh] flex-col overflow-hidden sm:max-w-4xl"
	headerClass="shrink-0"
	bodyClass="flex min-h-0 flex-1 flex-col overflow-hidden px-0 py-0"
>
	{#if session}
		{@const row = session.row}
		{@const pdf = session.pdf}
		<div class="min-h-0 flex-1 overflow-y-auto px-6 py-4">
			<div class="flex flex-col gap-4">
				{#if showDuplicateHint}
					<div class="border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
						Multiple BOM entries share numeric key {sketchNumeric ??
							session.row.extracted_number ??
							'-'} - pick the correct one.
					</div>
				{/if}

				<div class="flex flex-col gap-3">
					<div class="flex min-h-8 items-center justify-between gap-3">
						{#if pdf.roi}
							<div class="min-w-0 flex-1">
								<Tabs
									items={imageViewTabs}
									bind:value={imageViewMode}
									onValueChange={handleImageViewModeChange}
									mobileSelect={false}
									ariaLabel="Sketch image view"
								/>
							</div>
						{:else}
							<p class="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
								Page {row.page}
							</p>
						{/if}
						<div class="flex shrink-0 items-center gap-1">
							<button
								type="button"
								class="border border-border bg-white px-2 py-0.5 text-xs font-medium text-foreground hover:bg-slate-50 disabled:opacity-40"
								disabled={!imageLoaded || fullImageZoom <= MIN_FULL_ZOOM}
								onclick={() => bumpFullImageZoom(-0.25)}
							>
								−
							</button>
							<span class="min-w-12 text-center text-xs text-muted-foreground">
								{Math.round(fullImageZoom * 100)}%
							</span>
							<button
								type="button"
								class="border border-border bg-white px-2 py-0.5 text-xs font-medium text-foreground hover:bg-slate-50 disabled:opacity-40"
								disabled={!imageLoaded || fullImageZoom >= MAX_FULL_ZOOM}
								onclick={() => bumpFullImageZoom(0.25)}
							>
								+
							</button>
							<button
								type="button"
								class="border border-border bg-white px-2 py-0.5 text-xs font-medium text-foreground hover:bg-slate-50 disabled:opacity-40"
								disabled={!imageLoaded}
								onclick={fitFullImageView}
							>
								Fit
							</button>
						</div>
					</div>
					<div
						bind:this={viewerRef}
						class="relative flex h-[min(32vh,300px)] w-full shrink-0 items-center justify-center overflow-hidden border border-border bg-slate-100 p-2 {imageLoaded
							? isPanning
								? 'cursor-grabbing'
								: 'cursor-grab'
							: ''}"
						onpointerdown={startPan}
						onpointermove={movePan}
						onpointerup={endPan}
						onpointercancel={endPan}
					>
						<canvas bind:this={canvasRef} class="block h-full w-full"></canvas>
						<div
							class="absolute inset-0 flex items-center justify-center bg-white/80 p-8 text-sm text-muted-foreground pointer-events-none"
							class:hidden={imageLoaded || imageError}
						>
							Loading crop…
						</div>
						<div
							class="absolute inset-0 flex items-center justify-center bg-slate-100 p-8 text-center text-sm text-muted-foreground pointer-events-none"
							class:hidden={!imageError}
						>
							Page image is not available for this page.
						</div>
					</div>
				</div>

				{#if showBomSuggestionPicker}
					<div class="flex flex-col gap-3">
						<p class="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
							Select Mark Number From BOM
						</p>
						<div class="flex flex-wrap gap-2">
							{#each bomSuggestions as suggestion (suggestion)}
								{@const isSelected = editingBomValue.trim() === suggestion.trim()}
								<button
									type="button"
									onclick={() => handlePickSuggestion(suggestion)}
									class={isSelected
										? 'border border-orange-600 bg-orange-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-orange-600'
										: 'border border-orange-300 bg-white px-4 py-1.5 text-sm font-medium text-orange-700 hover:bg-orange-50'}
								>
									{suggestion}
								</button>
							{/each}
						</div>
					</div>
				{/if}

				<div class="grid shrink-0 gap-4 sm:grid-cols-2">
					<div class="flex flex-col gap-2">
						<label
							for="sketch-mark-input"
							class="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase"
						>
							Sketch Mark Number
						</label>
						<Input
							id="sketch-mark-input"
							bind:ref={sketchInputRef}
							bind:value={editingSketchValue}
							error={!!manualError}
							placeholder="e.g. J47 DA 1163AH"
							oninput={(e) => {
								manualError = null;
								const next = (e.target as HTMLInputElement | null)?.value ?? editingSketchValue;
								const upper = next.toUpperCase();
								if (upper !== editingSketchValue) editingSketchValue = upper;
							}}
						/>
						{#if manualError}
							<p class="text-xs text-red-600">{manualError}</p>
						{:else}
							<p class="text-xs text-muted-foreground">Type the mark number shown on the sketch</p>
						{/if}
					</div>

					<div class="flex flex-col gap-2">
						<label
							for="bom-mark-input"
							class="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase"
						>
							BOM Mark Number
						</label>
						<Input
							id="bom-mark-input"
							bind:value={editingBomValue}
							error={!!bomError}
							placeholder="e.g. JA40 HA 1163AH"
							oninput={(e) => {
								bomError = null;
								const next = (e.target as HTMLInputElement | null)?.value ?? editingBomValue;
								const upper = next.toUpperCase();
								if (upper !== editingBomValue) editingBomValue = upper;
							}}
						/>
						{#if bomError}
							<p class="text-xs text-red-600">{bomError}</p>
						{:else if showBomSuggestionPicker}
							<p class="text-xs text-muted-foreground">
								Type the full BOM mark or pick a suggestion above for duplicate suffix rows.
							</p>
						{:else}
							<p class="text-xs text-muted-foreground">Type the full BOM mark number</p>
						{/if}
					</div>
				</div>
			</div>
		</div>

		<div
			class="flex shrink-0 items-center justify-between gap-3 border-t border-border bg-white px-6 py-4"
		>
			<Button
				variant="primary"
				label="Delete"
				class="border-red-600 bg-red-600 text-white hover:border-red-500 hover:bg-red-500"
				disabled={isSaving}
				onclick={() => (deleteConfirmOpen = true)}
			/>
			<div class="flex items-center gap-3">
				<Button variant="outline" label="Cancel" onclick={() => handleOpenChange(false)} />
				<Button variant="primary" label="Save Changes" onclick={handleSave} disabled={isSaving} />
			</div>
		</div>
	{/if}
</Dialog>

<ConfirmationDialog
	bind:open={deleteConfirmOpen}
	title="Delete this row?"
	description={deleteConfirmDescription}
	cancelLabel="Cancel"
	confirmLabel="Delete"
	confirmVariant="danger"
	iconTone="danger"
	onConfirm={handleDeleteConfirm}
/>
