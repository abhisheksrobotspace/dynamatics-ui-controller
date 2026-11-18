<script lang="ts">
	import type {
		BomConfig,
		Project,
		StubType,
		TowerType
	} from '../../project-management-app/lib/store.svelte';
	import { loadOcrBomPageContext } from '../lib/ocr-bom-page-context.api.js';
	import {
		bomStructureFromParams,
		structureId,
		ocrBomDetailHash,
		ocrDrawingSetHash,
		ocrDrawingsHomeHash,
		ocrResultsHash
	} from '../lib/ocr-app-routes.js';
	import { readOcrGenerateSessionForBom } from '../lib/ocr-generate-session.js';
	import {
		uploadDrawings,
		sampleUrl,
		ensureBomForMatching,
		startProcess,
		getStatus,
		applyCompletedStatusToPdfJobs,
		getRasterizeProgress,
		OCR_MODE,
		persistDraftRoi,
		loadDraftRoisByDrawingFileId,
		type ProvisionContext
	} from '../lib/ocr.backend';
	import {
		downloadFile,
		invalidateOperationsCountConfirmation,
		updateBom
	} from '../../project-management-app/lib/projects/boms.api';
	import { upsertBomBreadcrumb } from '../../project-management-app/lib/projects/breadcrumb-registry.js';
	import { setOperationsCountResults } from '../lib/operations-count-results.svelte';
	import { startBackgroundExtraction } from '../lib/operations-count-extraction.svelte';
	import type { PdfJob, RasterizeProgress } from '../lib/ocr.types';
	import { DEFAULT_OCR_ENGINE, OCR_STATUS_POLL_MS } from '../lib/ocr.constants';
	import { getContext, onMount } from 'svelte';
	import { Button, ConfirmationDialog, Skeleton } from '@ifactory/ui-v2';
	import { stashOcrResultsNav, withViewResultsAction } from '../../lib/background-job-toast.js';
	import { APP_INSTANCE_ID_CONTEXT } from '../../lib/appShell/appSharedState.js';
	import { isOsAppInstanceFocused } from '../../lib/os/app-focus.svelte.js';
	import { ocrPushErrorToast, ocrPushSuccessToast, ocrPushToast } from '../lib/toast.js';
	import { errorDescription } from '../../lib/api/types.js';
	import { Check, Loader2, RotateCcw, X } from '@lucide/svelte';
	import { SvelteSet } from 'svelte/reactivity';

	let { params } = $props();
	const projectId = $derived(params.projectId);
	const bomId = $derived(params.bomId);
	const structure = $derived(bomStructureFromParams(params));
	const structureIdValue = $derived(structureId(structure));
	const appInstanceId = getContext<string>(APP_INSTANCE_ID_CONTEXT);

	let project = $state<Project | null>(null);
	let tower = $state<TowerType | null>(null);
	let stub = $state<StubType | null>(null);
	let bom = $state<BomConfig | null>(null);
	let isContextLoading = $state(true);
	let operationsConfig = $state({
		ocrEngine: DEFAULT_OCR_ENGINE,
		regex: ''
	});

	onMount(() => {
		const controller = new AbortController();
		void (async () => {
			isContextLoading = true;
			try {
				const context = await loadOcrBomPageContext(projectId, params, bomId, controller.signal);
				project = context.project;
				tower = context.tower;
				stub = context.stub;
				bom = context.bom;
				if (!context.project) return;
				operationsConfig = {
					ocrEngine: context.operationsConfig.ocrEngine,
					regex: context.operationsConfig.markNumberRegex
				};
			} catch (err) {
				ocrPushToast({
					title: 'Could not load page data',
					description: err instanceof Error ? err.message : 'Failed to load BOM context.'
				});
			} finally {
				isContextLoading = false;
			}
		})();
		return () => {
			controller.abort();
			clearPollTimers();
		};
	});

	let pdfs = $state<PdfJob[]>([]);
	let currentPdfIdx = $state(0);
	let isLoading = $state(false);
	let isProcessing = $state(false);
	let loadError = $state<string | null>(null);
	let processingError = $state<string | null>(null);
	let bomOcrId = $state<string | null>(null);
	let loadAttempted = $state(false);
	let canvas = $state<HTMLCanvasElement | null>(null);
	let canvasContainer = $state<HTMLDivElement | null>(null);
	let samplePagesList = $state<HTMLDivElement | null>(null);
	let imageReady = $state(false);
	let cachedImage: HTMLImageElement | null = null;
	let isDrawing = false;
	let startX = 0;
	let startY = 0;
	let verifiedSamples = $state<Record<string, SvelteSet<number>>>({});
	let rasterizeProgress = $state<RasterizeProgress | null>(null);
	let renderPartialNotice = $state<string | null>(null);
	let extractRasterizeProgress = $state<RasterizeProgress | null>(null);
	let cancelConfirmOpen = $state(false);
	let backgroundConfirmOpen = $state(false);
	/** App switch while extracting — toast on complete instead of navigating. */
	let awayDetached = $state(false);
	/** User chose Run in background — keep detached even if this page is still focused briefly. */
	let stickyBackground = $state(false);
	let activePollTimers: ReturnType<typeof setInterval>[] = [];
	let rasterizePollTimer: ReturnType<typeof setInterval> | null = null;
	let rasterizePollErrors = 0;

	function stopRasterizePoll() {
		if (rasterizePollTimer) {
			clearInterval(rasterizePollTimer);
			rasterizePollTimer = null;
		}
	}

	function clearPollTimers() {
		stopRasterizePoll();
		for (const timer of activePollTimers) clearInterval(timer);
		activePollTimers = [];
	}

	function removePollTimer(timer: ReturnType<typeof setInterval>) {
		clearInterval(timer);
		activePollTimers = activePollTimers.filter((entry) => entry !== timer);
	}

	const currentPdf = $derived(pdfs[currentPdfIdx]);
	const currentSampleIdx = $derived(currentPdf?.currentSampleIdx ?? 0);
	const currentSamplePage = $derived(currentPdf?.samples[currentSampleIdx]?.page ?? 1);

	const overallProgress = $derived(
		pdfs.length
			? Math.round(pdfs.reduce((sum, pdf) => sum + (pdf.progress ?? 0), 0) / pdfs.length)
			: 0
	);

	const renderProgressLabel = $derived.by(() => {
		const progress = rasterizeProgress;
		if (!progress) return null;
		const total = progress.totalPages;
		if (total != null && total > 0) {
			return `Rendering pages - ${progress.pagesReady} of ${total}`;
		}
		return progress.pagesReady > 0
			? `Rendering pages - ${progress.pagesReady} ready`
			: 'Rendering pages…';
	});

	const isRasterizeFailed = $derived(rasterizeProgress?.rasterizeStatus === 'failed');

	const isRasterizeInFlight = $derived(
		rasterizeProgress?.rasterizeStatus === 'pending' ||
			rasterizeProgress?.rasterizeStatus === 'rendering'
	);

	const extractWaitingLabel = $derived.by(() => {
		const progress = extractRasterizeProgress;
		if (!progress?.totalPages) return null;
		return `Waiting for rendering - ${progress.pagesReady} of ${progress.totalPages}`;
	});

	const extractionProgressLabel = $derived.by(() => {
		if (extractWaitingLabel) return extractWaitingLabel;
		if (overallProgress > 0) return `Processing - ${overallProgress}%`;
		return 'Processing…';
	});

	function sampleStatus(idx: number): 'verified' | 'current' | 'pending' {
		if (!currentPdf) return 'pending';
		if (idx === currentSampleIdx) return 'current';
		if (verifiedSamples[currentPdf.pdf_id]?.has(idx)) return 'verified';
		return 'pending';
	}

	function isSampleClickable(idx: number): boolean {
		if (!currentPdf) return false;
		if (idx === currentSampleIdx) return true;
		return verifiedSamples[currentPdf.pdf_id]?.has(idx) ?? false;
	}

	function markSampleVerified(idx: number) {
		if (!currentPdf) return;
		const next = new SvelteSet(verifiedSamples[currentPdf.pdf_id] ?? []);
		next.add(idx);
		verifiedSamples = { ...verifiedSamples, [currentPdf.pdf_id]: next };
	}

	function resetVerificationAfterRoiChange(pdfId?: string) {
		if (!pdfId) {
			verifiedSamples = {};
			return;
		}
		const next = { ...verifiedSamples };
		delete next[pdfId];
		verifiedSamples = next;
	}

	function findNextPendingSample(): { pdfIdx: number; sampleIdx: number } | null {
		const ordered: { pdfIdx: number; sampleIdx: number }[] = [];
		for (let pdfIdx = 0; pdfIdx < pdfs.length; pdfIdx++) {
			for (let sampleIdx = 0; sampleIdx < pdfs[pdfIdx].samples.length; sampleIdx++) {
				ordered.push({ pdfIdx, sampleIdx });
			}
		}

		const currentFlat = ordered.findIndex(
			(s) => s.pdfIdx === currentPdfIdx && s.sampleIdx === currentSampleIdx
		);
		if (currentFlat === -1) return null;

		for (let i = 1; i <= ordered.length; i++) {
			const { pdfIdx, sampleIdx } = ordered[(currentFlat + i) % ordered.length];
			if (!verifiedSamples[pdfs[pdfIdx].pdf_id]?.has(sampleIdx)) {
				return { pdfIdx, sampleIdx };
			}
		}
		return null;
	}

	function verifyAndNext() {
		if (!currentPdf?.roi || allPagesVerified) return;

		markSampleVerified(currentSampleIdx);

		const next = findNextPendingSample();
		if (!next) return;

		if (next.pdfIdx !== currentPdfIdx) currentPdfIdx = next.pdfIdx;
		loadSample(next.sampleIdx);
	}

	function cancelExtraction() {
		clearPollTimers();
		isProcessing = false;
		extractRasterizeProgress = null;
		for (const pdf of pdfs) {
			if (pdf.status === 'processing') {
				pdf.status = 'pending';
				pdf.progress = 0;
			}
		}
	}

	function runInBackground() {
		stickyBackground = true;
		awayDetached = true;
		clearPollTimers();
		startBackgroundExtraction(bomId, pdfs, { projectId, structure });
		isProcessing = false;
		ocrPushToast({
			title: 'Running in background',
			description: 'You will be notified with a link when extraction finishes.'
		});
		navigateToBoms();
	}

	function notifyExtractionCompleteAway() {
		stashOcrResultsNav(bomId, { projectId, structure });
		const resultsHash = ocrResultsHash(projectId, structure, bomId);
		setOperationsCountResults(bomId, pdfs);
		ocrPushSuccessToast(
			withViewResultsAction(
				{
					title: 'Extraction complete',
					description: 'Operations count results are ready.'
				},
				resultsHash
			)
		);
		isProcessing = false;
	}

	function finishForegroundExtraction() {
		if (awayDetached) {
			notifyExtractionCompleteAway();
			return;
		}
		navigateToResults();
	}

	/** Switch away → toast on complete; return while still extracting → navigate to Results. */
	$effect(() => {
		if (!isProcessing || stickyBackground || !appInstanceId) return;
		awayDetached = !isOsAppInstanceFocused(appInstanceId);
	});

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

	function navigateToResults() {
		setOperationsCountResults(bomId, pdfs);
		window.location.hash = ocrResultsHash(projectId, structure, bomId);
	}

	function reset() {
		pdfs = [];
		currentPdfIdx = 0;
		isProcessing = false;
		processingError = null;
		bomOcrId = null;
		loadAttempted = false;
		loadError = null;
		verifiedSamples = {};
		rasterizeProgress = null;
		renderPartialNotice = null;
		extractRasterizeProgress = null;
		clearPollTimers();
		loadBomDrawings();
	}

	const activeProcessingPdf = $derived(
		pdfs.find((pdf) => pdf.status === 'processing') ??
			pdfs.find((pdf) => pdf.status === 'pending') ??
			pdfs[0]
	);

	const allPagesVerified = $derived.by(() => {
		if (pdfs.length === 0) return false;
		return pdfs.every((pdf) =>
			pdf.samples.every((_, idx) => verifiedSamples[pdf.pdf_id]?.has(idx))
		);
	});

	const pageLoading = $derived(isContextLoading || isLoading);

	const verifyAndNextDisabled = $derived(
		pageLoading || !currentPdf?.roi || isProcessing || allPagesVerified
	);

	const startExtractionDisabled = $derived(
		pageLoading ||
			!allPagesVerified ||
			isProcessing ||
			isRasterizeFailed ||
			pdfs.some((pdf) => !pdf.roi) ||
			!operationsConfig.regex.trim()
	);

	const contractorNotConfigured = $derived(!isContextLoading && !operationsConfig.regex.trim());

	const filesWithRoiCount = $derived(pdfs.filter((pdf) => pdf.roi).length);

	const backLabel = 'Back to Drawings';

	function fileStatus(idx: number): 'pending' | 'current' | 'roi_set' {
		if (idx === currentPdfIdx) return 'current';
		if (pdfs[idx]?.roi) return 'roi_set';
		return 'pending';
	}

	function selectFile(idx: number) {
		if (idx < 0 || idx >= pdfs.length || idx === currentPdfIdx) return;
		currentPdfIdx = idx;
		loadSample(pdfs[idx].currentSampleIdx || 0);
	}

	function buildProvisionCtx(files: {
		drawingsFile?: File | null;
		bomFile?: File | null;
		drawingsFilename?: string;
	}): ProvisionContext {
		const session = readOcrGenerateSessionForBom(bomId);
		return {
			localBomId: bomId,
			drawingsFile: files.drawingsFile ?? null,
			bomCsvFile: files.bomFile ?? null,
			drawingsFilename: files.drawingsFilename,
			drawingFileIds: session?.drawingFileIds,
			filenamesByFileId: session?.filenamesByFileId
		};
	}

	function drawingsFilenameForBom(currentBom: BomConfig): string {
		return currentBom.drawingsFile ?? `${currentBom.bomName || 'drawings'}.pdf`;
	}

	function applyRasterizeProgress(progress: RasterizeProgress) {
		rasterizeProgress = progress;
		if (progress.rasterizeStatus === 'partial' && progress.totalPages != null) {
			const skipped = progress.totalPages - progress.pagesReady;
			if (skipped > 0) {
				renderPartialNotice = `${skipped} of ${progress.totalPages} pages could not be rendered and were skipped.`;
			}
		}
	}

	function startRasterizeBackgroundPoll() {
		if (OCR_MODE !== 'core') return;
		stopRasterizePoll();
		rasterizePollErrors = 0;
		rasterizePollTimer = setInterval(async () => {
			try {
				const progress = await getRasterizeProgress(bomId);
				rasterizePollErrors = 0;
				if (!progress) return;
				applyRasterizeProgress(progress);
				if (
					progress.rasterizeStatus === 'complete' ||
					progress.rasterizeStatus === 'partial' ||
					progress.rasterizeStatus === 'failed'
				) {
					stopRasterizePoll();
					if (progress.rasterizeStatus === 'failed') {
						ocrPushErrorToast({
							title: 'Drawing render failed',
							description: 'Some pages could not be rendered. Try re-uploading the drawings PDF.'
						});
					}
				}
			} catch (error) {
				rasterizePollErrors += 1;
				if (rasterizePollErrors >= 3) {
					stopRasterizePoll();
					ocrPushErrorToast({
						title: 'Could not check drawing render progress',
						description: errorDescription(error)
					});
				}
			}
		}, OCR_STATUS_POLL_MS);
	}

	async function hydrateDrawingsFileFromCore(): Promise<File | null> {
		if (!bom?.drawingsPdfId) return null;
		return downloadFile(bom.drawingsPdfId, `${bom.bomName || 'drawings'}.pdf`);
	}

	async function hydrateBomCsvFileFromCore(): Promise<File | null> {
		if (!bom?.bomFileId) return null;
		return downloadFile(bom.bomFileId, `${bom.bomName || 'bom'}.csv`);
	}

	async function loadBomDrawings() {
		if (!bom) return;
		const currentBom = bom;

		isLoading = true;
		loadError = null;
		renderPartialNotice = null;
		rasterizeProgress = null;
		stopRasterizePoll();

		try {
			let data;

			if (OCR_MODE === 'core') {
				if (!currentBom.drawingsPdfId && !currentBom.drawingsFile) {
					loadError = 'Drawings file is missing. Edit this BOM and upload the drawings PDF again.';
					return;
				}
				data = await uploadDrawings(
					buildProvisionCtx({ drawingsFilename: drawingsFilenameForBom(currentBom) }),
					{ onRasterizeProgress: applyRasterizeProgress }
				);
			} else {
				const drawingsFile = await hydrateDrawingsFileFromCore();
				if (!drawingsFile) {
					loadError = 'Drawings file is missing. Edit this BOM and upload the drawings PDF again.';
					return;
				}
				data = await uploadDrawings(
					buildProvisionCtx({
						drawingsFile,
						bomFile: (await hydrateBomCsvFileFromCore()) ?? null
					})
				);
			}

			if (data.rasterize) applyRasterizeProgress(data.rasterize);
			startRasterizeBackgroundPoll();

			pdfs = (data.pdfs || []).map((pdf) => ({
				pdf_id: pdf.pdf_id,
				filename: pdf.filename,
				totalPages: pdf.total_pages,
				samples: (pdf.samples || []).map((sample) => ({
					...sample,
					url: sampleUrl(sample.url)
				})),
				// Per-file Generate: never seed ROI from BOM-level ops-count ROI (stale after re-upload).
				roi: null,
				jobId: pdf.pdf_id,
				progress: 0,
				results: [],
				status: 'pending',
				error: null,
				currentSampleIdx: 0
			}));

			if (pdfs.length === 0) throw new Error('No valid PDFs were processed.');

			if (OCR_MODE === 'core') {
				const drafts = await loadDraftRoisByDrawingFileId(bomId);
				pdfs = pdfs.map((pdf) => ({
					...pdf,
					roi: drafts[pdf.pdf_id] ?? null
				}));
			}

			currentPdfIdx = 0;
		} catch (err) {
			const fallback =
				OCR_MODE === 'core' && currentBom.drawingsPdfId
					? 'Failed to load drawing preview.'
					: 'Failed to load drawings.';
			loadError = err instanceof Error ? err.message : fallback;
			ocrPushToast({
				title:
					OCR_MODE === 'core' && currentBom.drawingsPdfId
						? 'Failed to load drawing preview'
						: 'Failed to load drawings',
				description: loadError
			});
		} finally {
			isLoading = false;
		}
	}

	function getViewerSize() {
		const container = canvasContainer;
		if (!container) return { width: 900, height: 520 };
		const width = container.clientWidth || container.offsetWidth || 900;
		const height = container.clientHeight || container.offsetHeight || 520;
		return { width: Math.max(width, 1), height: Math.max(height, 1) };
	}

	function redrawCanvas(sampleIdx: number) {
		if (!canvas || !currentPdf || isDrawing) return;
		const pdf = currentPdf;
		const sample = pdf.samples[sampleIdx];
		if (!sample?.url) {
			imageReady = false;
			cachedImage = null;
			return;
		}
		imageReady = false;

		const ctx = canvas.getContext('2d');
		if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);

		const img = new Image();
		img.src = sample.url;
		img.onload = () => {
			if (!canvas) return;
			requestAnimationFrame(() => {
				if (!canvas || isDrawing) return;
				const { width: containerWidth, height: containerHeight } = getViewerSize();
				const imgWidth = img.naturalWidth || img.width;
				const imgHeight = img.naturalHeight || img.height;
				const scale = Math.min(containerWidth / imgWidth, containerHeight / imgHeight);
				const displayWidth = Math.max(1, Math.floor(imgWidth * scale));
				const displayHeight = Math.max(1, Math.floor(imgHeight * scale));

				canvas.width = displayWidth;
				canvas.height = displayHeight;
				canvas.style.width = `${displayWidth}px`;
				canvas.style.height = `${displayHeight}px`;

				const drawCtx = canvas.getContext('2d');
				if (!drawCtx) return;
				cachedImage = img;
				drawCtx.drawImage(img, 0, 0, displayWidth, displayHeight);
				if (pdf.roi) paintRoi(drawCtx);
				imageReady = true;
			});
		};
		img.onerror = () => {
			imageReady = false;
			cachedImage = null;
		};
	}

	function loadSample(idx: number) {
		if (!currentPdf) return;
		currentPdf.currentSampleIdx = idx;
		redrawCanvas(idx);
		queueMicrotask(() => scrollSampleIntoView(idx));
	}

	function scrollSampleIntoView(idx: number) {
		if (!samplePagesList) return;
		const card = samplePagesList.querySelector<HTMLElement>(`[data-sample-idx="${idx}"]`);
		card?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
	}

	function paintRoi(ctx: CanvasRenderingContext2D) {
		const roi = currentPdf?.roi;
		if (!roi || !canvas) return;
		const rx = roi.x * canvas.width;
		const ry = roi.y * canvas.height;
		const rw = roi.w * canvas.width;
		const rh = roi.h * canvas.height;
		ctx.strokeStyle = '#EA580C';
		ctx.lineWidth = 2;
		ctx.setLineDash([8, 6]);
		ctx.strokeRect(rx, ry, rw, rh);
		ctx.setLineDash([]);
		ctx.fillStyle = 'rgba(234, 88, 12, 0.12)';
		ctx.fillRect(rx, ry, rw, rh);
	}

	function getScaledCoords(e: MouseEvent) {
		if (!canvas) return { x: 0, y: 0 };
		const rect = canvas.getBoundingClientRect();
		if (rect.width === 0 || rect.height === 0) return { x: 0, y: 0 };
		const x = (e.clientX - rect.left) * (canvas.width / rect.width);
		const y = (e.clientY - rect.top) * (canvas.height / rect.height);
		return {
			x: Math.min(canvas.width, Math.max(0, x)),
			y: Math.min(canvas.height, Math.max(0, y))
		};
	}

	function redrawCanvasImage() {
		if (!canvas || !cachedImage) return;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		ctx.drawImage(cachedImage, 0, 0, canvas.width, canvas.height);
		if (currentPdf?.roi && !isDrawing) paintRoi(ctx);
	}

	function stopDrawing() {
		window.removeEventListener('mousemove', onWindowMouseMove);
		window.removeEventListener('mouseup', onWindowMouseUp);
		isDrawing = false;
	}

	function onWindowMouseMove(e: MouseEvent) {
		if (!isDrawing || !canvas || !cachedImage) return;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		const { x: curX, y: curY } = getScaledCoords(e);
		ctx.drawImage(cachedImage, 0, 0, canvas.width, canvas.height);
		ctx.strokeStyle = '#EA580C';
		ctx.lineWidth = 2;
		ctx.setLineDash([8, 6]);
		ctx.strokeRect(startX, startY, curX - startX, curY - startY);
		ctx.setLineDash([]);
		ctx.fillStyle = 'rgba(234, 88, 12, 0.12)';
		ctx.fillRect(startX, startY, curX - startX, curY - startY);
	}

	function onWindowMouseUp(e: MouseEvent) {
		if (!isDrawing || !canvas || !currentPdf || !bom) {
			stopDrawing();
			return;
		}

		const { x: endX, y: endY } = getScaledCoords(e);
		stopDrawing();

		if (Math.abs(endX - startX) < 4 || Math.abs(endY - startY) < 4) {
			redrawCanvasImage();
			return;
		}

		const left = Math.min(startX, endX);
		const top = Math.min(startY, endY);
		const right = Math.max(startX, endX);
		const bottom = Math.max(startY, endY);
		const width = canvas.width;
		const height = canvas.height;
		const roi = {
			x: left / width,
			y: top / height,
			w: (right - left) / width,
			h: (bottom - top) / height
		};
		// One ROI per file — do not copy across PDFs.
		currentPdf.roi = roi;
		resetVerificationAfterRoiChange(currentPdf.pdf_id);
		if (!bom) return;

		if (pdfs.length === 1) {
			const nextBom = { ...bom, operationsCountRoi: roi };
			bom = nextBom;
			void updateBom({
				projectId,
				towerId: structureIdValue,
				bomId: bom.id,
				bomName: bom.bomName,
				sNo: bom.sNo,
				bomFileName: bom.bomFile,
				drawingsFileName: bom.drawingsFile,
				operationsCountRoi: roi,
				existingMetadata: {
					bom_file_name: bom.bomFile,
					drawings_file_name: bom.drawingsFile,
					operations_count_roi: roi
				}
			})
				.then((result) => {
					bom = result.bom;
					upsertBomBreadcrumb(result.bom);
				})
				.catch((err) => {
					ocrPushToast({
						title: 'Could not save ROI',
						description: err instanceof Error ? err.message : 'Save failed'
					});
				});
		} else {
			void persistDraftRoi(bomId, currentPdf.pdf_id, roi).catch((err) => {
				ocrPushToast({
					title: 'Could not save ROI draft',
					description: err instanceof Error ? err.message : 'Save failed'
				});
			});
		}
		redrawCanvasImage();
	}

	function onMouseDown(e: MouseEvent) {
		if (!canvas || !cachedImage || !imageReady) return;
		e.preventDefault();
		const { x, y } = getScaledCoords(e);
		startX = x;
		startY = y;
		isDrawing = true;
		window.addEventListener('mousemove', onWindowMouseMove);
		window.addEventListener('mouseup', onWindowMouseUp);
	}

	function onMouseMove(e: MouseEvent) {
		onWindowMouseMove(e);
	}

	function onMouseUp(e: MouseEvent) {
		onWindowMouseUp(e);
	}

	function pollStatus(pdfIdx: number) {
		const pdf = pdfs[pdfIdx];
		const interval = setInterval(async () => {
			try {
				const data = await getStatus(bomId, pdf.jobId);
				const shared = pdfs.filter((item) => item.jobId === pdf.jobId);
				for (const item of shared) {
					item.progress = data.progress ?? item.progress;
				}
				extractRasterizeProgress = data.rasterizeProgress ?? null;

				if (data.status === 'completed') {
					removePollTimer(interval);
					await applyCompletedStatusToPdfJobs(bomId, shared, data);
					if (pdfs.every((item) => item.status === 'completed' || item.status === 'failed')) {
						if (pdfs.some((item) => item.status === 'completed')) {
							finishForegroundExtraction();
						} else {
							isProcessing = false;
							if (awayDetached) {
								ocrPushErrorToast({
									title: 'Extraction failed',
									description: 'All PDFs failed to process.'
								});
							} else {
								processingError = 'All PDFs failed to process.';
							}
						}
					}
				} else if (data.status === 'failed') {
					removePollTimer(interval);
					for (const item of shared) {
						item.status = 'failed';
						item.error = data.error || 'OCR processing failed.';
					}
					if (pdfs.every((item) => item.status === 'completed' || item.status === 'failed')) {
						isProcessing = false;
						if (awayDetached) {
							ocrPushErrorToast({
								title: 'Extraction failed',
								description: 'One or more PDFs failed to process.'
							});
						} else {
							processingError = 'One or more PDFs failed to process.';
						}
					}
				}
			} catch (err) {
				removePollTimer(interval);
				pdf.status = 'failed';
				pdf.error = err instanceof Error ? err.message : 'Status poll failed.';
			}
		}, OCR_STATUS_POLL_MS);
		activePollTimers = [...activePollTimers, interval];
	}

	async function uploadBomForOcr(): Promise<string | null> {
		if (OCR_MODE === 'core') {
			return ensureBomForMatching({ localBomId: bomId });
		}

		const drawingsFile = await hydrateDrawingsFileFromCore();
		if (!drawingsFile) return null;
		return ensureBomForMatching(
			buildProvisionCtx({
				drawingsFile,
				bomFile: (await hydrateBomCsvFileFromCore()) ?? null
			})
		);
	}

	async function startProcessing() {
		if (!operationsConfig.regex.trim()) {
			ocrPushToast({
				title: 'Mark number regex required',
				description:
					'Assign a contractor with a mark number regex in Operations Count Configuration before extracting.'
			});
			return;
		}

		if (pdfs.some((pdf) => !pdf.roi)) {
			ocrPushToast({ title: 'Please draw a region of interest for all PDFs.' });
			return;
		}

		isProcessing = true;
		processingError = null;
		extractRasterizeProgress = null;

		if (OCR_MODE === 'core') {
			try {
				await invalidateOperationsCountConfirmation(bomId);
				if (bom) bom = { ...bom, ocrStatus: 'not_verified' };
			} catch (err) {
				isProcessing = false;
				ocrPushErrorToast({
					title: 'Could not start extraction',
					description: errorDescription(err, 'Could not invalidate prior confirmation.')
				});
				return;
			}
		}

		try {
			bomOcrId = await uploadBomForOcr();
			if (!bomOcrId) {
				ocrPushToast({
					title: 'BOM file not found',
					description: 'Edit the BOM and upload the CSV file to enable BOM matching.'
				});
			}
		} catch (err) {
			isProcessing = false;
			processingError = err instanceof Error ? err.message : 'Failed to upload BOM.';
			ocrPushToast({ title: 'BOM upload failed', description: processingError });
			return;
		}

		for (let i = 0; i < pdfs.length; i++) {
			const pdf = pdfs[i];
			pdf.progress = 0;
			pdf.status = 'processing';
		}

		try {
			const rois = pdfs.map((pdf) => ({
				drawing_file_id: pdf.pdf_id,
				roi: pdf.roi!
			}));
			const jobId = await startProcess({
				localBomId: bomId,
				pdf_id: pdfs[0].pdf_id,
				job_id: pdfs[0].jobId,
				roi: pdfs[0].roi!,
				rois,
				regex: operationsConfig.regex,
				bom_id: bomOcrId,
				ocr_engine: operationsConfig.ocrEngine
			});
			for (const pdf of pdfs) pdf.jobId = jobId;
			// One extract job for the selection — poll once and fan out status.
			pollStatus(0);
		} catch (err) {
			for (const pdf of pdfs) {
				pdf.status = 'failed';
				pdf.error = err instanceof Error ? err.message : 'Failed to start processing.';
			}
			processingError = `Failed to process ${pdfs[0]?.filename ?? 'drawings'}`;
		}
	}

	$effect(() => {
		return () => stopDrawing();
	});

	$effect(() => {
		if (!isProcessing && canvas && currentPdf?.samples?.length) {
			redrawCanvas(currentPdf.currentSampleIdx || 0);
		}
	});

	$effect(() => {
		if (!canvasContainer || isProcessing) return;
		const observer = new ResizeObserver(() => {
			if (currentPdf?.samples?.length && !isDrawing) {
				redrawCanvas(currentPdf.currentSampleIdx || 0);
			}
		});
		observer.observe(canvasContainer);
		return () => observer.disconnect();
	});

	$effect(() => {
		if (!currentPdf || isProcessing) return;
		queueMicrotask(() => scrollSampleIntoView(currentSampleIdx));
	});

	$effect(() => {
		if (!bom || loadAttempted) return;
		loadAttempted = true;
		loadBomDrawings();
	});
</script>

<div class="flex h-full min-h-0 flex-col gap-2 overflow-hidden p-3 md:p-4">
	{#if !isContextLoading && (!project || (!tower && !stub) || !bom)}
		<p class="text-gray-500">BOM not found.</p>
	{:else if loadError}
		<div class="border border-border bg-white p-6 shadow-sm md:p-8">
			<div class="flex flex-col items-center gap-4 text-center">
				<p class="text-base font-semibold text-foreground">
					{OCR_MODE === 'core' && bom?.drawingsPdfId
						? 'Unable to load drawing preview'
						: 'Unable to load drawings'}
				</p>
				<p class="max-w-md text-sm text-muted-foreground">{loadError}</p>
				<div class="flex flex-wrap justify-center gap-2">
					{#if isRasterizeFailed}
						<Button variant="primary" label="Retry rendering" onclick={reset} />
					{/if}
					<Button variant="outline" label={backLabel} onclick={navigateToBoms} />
				</div>
			</div>
		</div>
	{:else if isProcessing}
		<div class="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 py-4">
			{#if processingError && pdfs.every((pdf) => pdf.status === 'failed')}
				<div class="w-full max-w-lg border border-red-200 bg-red-50 p-6 text-center shadow-sm">
					<p class="text-base font-semibold text-red-700">Processing Failed</p>
					<p class="mt-2 text-sm text-red-500">{processingError}</p>
					<div class="mt-4">
						<Button variant="outline" label="Try Again" onclick={reset} />
					</div>
				</div>
			{:else}
				<div class="w-full max-w-lg border border-border bg-white p-8 shadow-sm">
					<div class="flex flex-col items-center gap-3 text-center">
						<Loader2 class="h-10 w-10 animate-spin text-orange-600" />
						<h2 class="font-heading text-xl font-bold text-foreground">Extracting Shop Sketches</h2>
					</div>

					{#if activeProcessingPdf}
						<div class="mt-6 border border-border bg-slate-50 p-4">
							<div class="flex min-w-0 items-center gap-2">
								{#if activeProcessingPdf.status === 'failed'}
									<X class="size-4 shrink-0 text-red-600" />
								{/if}
								<p class="truncate text-sm font-medium text-foreground">
									{activeProcessingPdf.filename}
								</p>
							</div>
							<div class="mt-3 h-2 w-full overflow-hidden bg-slate-200">
								<div
									class="h-full bg-orange-600 transition-all duration-300"
									style:width="{activeProcessingPdf.progress}%"
								></div>
							</div>
							<div
								class="mt-2 flex items-center justify-between text-[11px] font-medium tracking-wide text-muted-foreground uppercase"
							>
								<span>{extractionProgressLabel}</span>
							</div>
						</div>
					{/if}

					{#if pdfs.length > 1}
						<div class="mt-4 flex flex-col gap-2">
							{#each pdfs as pdf (pdf.pdf_id)}
								{#if pdf.pdf_id !== activeProcessingPdf?.pdf_id}
									<div
										class="flex items-center justify-between gap-2 border border-border bg-white px-3 py-2 text-xs"
									>
										<span class="truncate text-muted-foreground">{pdf.filename}</span>
										<span
											class="shrink-0 font-semibold uppercase {pdf.status === 'completed'
												? 'text-green-600'
												: pdf.status === 'failed'
													? 'text-red-600'
													: 'text-muted-foreground'}"
										>
											{pdf.status}
										</span>
									</div>
								{/if}
							{/each}
						</div>
					{/if}
				</div>

				<div class="flex flex-wrap items-center justify-center gap-3">
					<Button
						variant="outline"
						label="Run in Background"
						onclick={() => (backgroundConfirmOpen = true)}
					/>
					<Button
						variant="outline"
						label="Cancel Extraction"
						class="border-red-200 text-red-600 hover:bg-red-50"
						onclick={() => (cancelConfirmOpen = true)}
					/>
				</div>
			{/if}
		</div>
	{:else}
		<div class="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
			<div class="flex shrink-0 items-center justify-between gap-2">
				<div class="min-w-0 flex-1 truncate text-sm text-muted-foreground">
					{#if pageLoading}
						<Skeleton class="h-4 w-56 max-w-full" />
					{:else if currentPdf}
						<span class="font-medium text-foreground">{currentPdf.filename}</span>
						{#if pdfs.length > 1}
							<span class="text-muted-foreground"> · {filesWithRoiCount}/{pdfs.length} ROI</span>
						{/if}
						{#if isRasterizeInFlight && renderProgressLabel}
							<span class="text-muted-foreground"> · {renderProgressLabel}</span>
						{/if}
						{#if renderPartialNotice}
							<span class="text-amber-700"> · {renderPartialNotice}</span>
						{/if}
					{/if}
				</div>
				<div class="flex shrink-0 gap-2">
					<Button variant="outline" size="sm" label={backLabel} onclick={navigateToBoms} />
					<Button
						variant="outline"
						size="sm"
						icon={RotateCcw}
						label="Reload"
						disabled={pageLoading}
						onclick={reset}
					/>
				</div>
			</div>

			<div class="grid min-h-0 flex-1 grid-cols-1 gap-2 overflow-hidden lg:grid-cols-[1fr_240px]">
				<div class="flex min-h-0 flex-col overflow-hidden border border-border bg-white shadow-sm">
					<div
						class="flex h-8 shrink-0 items-center justify-between border-b border-border bg-slate-50 px-3"
					>
						{#if pageLoading}
							<Skeleton class="h-3 w-28" />
						{:else}
							<p class="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
								{#if currentPdf}
									Viewer - Page {currentSamplePage}
								{:else}
									Viewer
								{/if}
							</p>
						{/if}
						<span
							class="inline-flex items-center gap-1 border border-green-200 bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 {currentPdf?.roi
								? ''
								: 'invisible'}"
							aria-hidden={!currentPdf?.roi}
						>
							<Check class="size-3" />
							Region selected
						</span>
					</div>
					<div
						bind:this={canvasContainer}
						class="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-slate-100"
					>
						{#if pageLoading}
							<Skeleton class="absolute inset-0 rounded-none" />
						{:else if currentPdf}
							{#if !imageReady}
								<Skeleton class="absolute inset-0 rounded-none" />
							{/if}
							<div class="relative shrink-0">
								<canvas
									bind:this={canvas}
									class="block {imageReady ? 'cursor-crosshair' : 'invisible pointer-events-none'}"
									onmousedown={onMouseDown}
									onmousemove={onMouseMove}
									onmouseup={onMouseUp}
								></canvas>
								{#if currentPdf.roi && imageReady}
									<div
										class="pointer-events-none absolute bg-orange-600 px-2 py-0.5 text-[10px] font-semibold text-white"
										style:left="{currentPdf.roi.x * 100}%"
										style:top="max(0px, calc({currentPdf.roi.y * 100}% - 1.25rem))"
									>
										Mark number region
									</div>
								{/if}
							</div>
						{/if}
					</div>
				</div>

				<div class="flex min-h-0 flex-col gap-2 overflow-hidden">
					{#if pdfs.length > 1}
						<div class="shrink-0">
							<p
								class="mb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase"
							>
								Files ({pdfs.length})
							</p>
							<div class="flex max-h-24 flex-col gap-1 overflow-y-auto pr-1">
								{#each pdfs as pdf, idx (pdf.pdf_id)}
									{@const status = fileStatus(idx)}
									<button
										type="button"
										onclick={() => selectFile(idx)}
										class="flex items-center justify-between gap-2 border-2 bg-white px-2 py-1.5 text-left text-xs transition-colors {status ===
										'current'
											? 'border-orange-600'
											: 'border-border hover:border-slate-300'}"
									>
										<span class="truncate font-medium text-foreground">{pdf.filename}</span>
										<span
											class="shrink-0 font-semibold uppercase {status === 'roi_set'
												? 'text-green-600'
												: status === 'current'
													? 'text-orange-600'
													: 'text-muted-foreground'}"
										>
											{#if status === 'roi_set'}
												<span class="inline-flex items-center gap-1"
													><Check class="size-3" /> ROI</span
												>
											{:else if status === 'current'}
												Current
											{:else}
												Pending
											{/if}
										</span>
									</button>
								{/each}
							</div>
						</div>
					{/if}

					<div class="flex min-h-0 flex-1 flex-col overflow-hidden">
						<p
							class="mb-1 shrink-0 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase"
						>
							Pages{currentPdf ? ` (${currentPdf.samples.length})` : ''}
						</p>
						<div
							bind:this={samplePagesList}
							class="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pr-1"
						>
							{#if pageLoading}
								{#each [0, 1, 2] as i (i)}
									<div class="flex items-center gap-2 border-2 border-border bg-white p-1.5">
										<Skeleton class="h-10 w-12 shrink-0" />
										<div class="min-w-0 flex-1 space-y-1">
											<Skeleton class="h-3 w-14" />
											<Skeleton class="h-2.5 w-10" />
										</div>
									</div>
								{/each}
							{:else if currentPdf}
								{#each currentPdf.samples as sample, idx (idx)}
									{@const status = sampleStatus(idx)}
									{@const clickable = isSampleClickable(idx)}
									<button
										type="button"
										data-sample-idx={idx}
										disabled={!clickable}
										onclick={() => loadSample(idx)}
										class="flex items-center gap-2 border-2 bg-white p-1.5 text-left transition-colors {status ===
										'current'
											? 'border-orange-600'
											: clickable
												? 'border-border hover:border-slate-300'
												: 'cursor-not-allowed border-border opacity-50'}"
									>
										<img
											src={sample.url}
											alt="Page {sample.page}"
											class="h-10 w-12 shrink-0 border border-border object-cover"
										/>
										<div class="min-w-0 flex-1">
											<div class="flex items-center gap-1">
												{#if status === 'verified' || (status === 'current' && currentPdf.roi)}
													<Check class="size-3 shrink-0 text-green-600" />
												{/if}
												<span class="text-xs font-medium text-foreground">Page {sample.page}</span>
											</div>
											<p
												class="text-[10px] font-bold tracking-wide uppercase {status === 'verified'
													? 'text-green-600'
													: status === 'current'
														? 'text-orange-600'
														: 'text-muted-foreground'}"
											>
												{status === 'verified'
													? 'Verified'
													: status === 'current'
														? 'Current'
														: 'Pending'}
											</p>
										</div>
									</button>
								{/each}
							{/if}
						</div>
					</div>

					<div class="flex shrink-0 flex-col gap-1.5">
						{#if contractorNotConfigured}
							<p
								class="border border-red-200 bg-red-50 px-2 py-1.5 text-center text-[11px] text-red-700"
							>
								Contractor not configured — assign one before extracting.
							</p>
						{/if}
						<p class="text-[11px] text-muted-foreground">
							Drag on the drawing to select the mark number field.
						</p>
						{#if isRasterizeInFlight && renderProgressLabel && !startExtractionDisabled}
							<p class="text-center text-[11px] text-muted-foreground">
								Extraction waits for rendering ({rasterizeProgress?.pagesReady} of
								{rasterizeProgress?.totalPages ?? '…'}).
							</p>
						{/if}
						<Button
							class="w-full"
							size="sm"
							variant={allPagesVerified ? 'outline' : 'primary'}
							label="Verify and Next"
							disabled={verifyAndNextDisabled}
							onclick={verifyAndNext}
						/>
						<Button
							class="w-full"
							size="sm"
							variant="primary"
							label="Start Extraction"
							disabled={startExtractionDisabled}
							onclick={startProcessing}
						/>
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>

<ConfirmationDialog
	bind:open={cancelConfirmOpen}
	title="Cancel Extraction"
	description="Are you sure you want to cancel the extraction?"
	cancelLabel="Close"
	confirmLabel="Okay"
	confirmVariant="danger"
	iconTone="danger"
	onConfirm={() => {
		cancelExtraction();
		cancelConfirmOpen = false;
	}}
/>

<ConfirmationDialog
	bind:open={backgroundConfirmOpen}
	title="Run in Background"
	description="Extraction keeps running in the background. You will be notified once done."
	cancelLabel="Cancel"
	confirmLabel="Okay"
	confirmVariant="primary"
	onConfirm={() => {
		backgroundConfirmOpen = false;
		runInBackground();
	}}
/>
