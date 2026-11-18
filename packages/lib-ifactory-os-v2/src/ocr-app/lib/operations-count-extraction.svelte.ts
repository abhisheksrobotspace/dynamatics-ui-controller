import { SvelteMap, SvelteSet } from 'svelte/reactivity';
import { apiClient } from '../../lib/api/api-client.js';
import { errorDescription, rowsFromEnvelope, type ApiEnvelope } from '../../lib/api/types.js';
import {
	stashOcrResultsNav,
	takeOcrResultsNav,
	withViewResultsAction,
	type BomResultsNav
} from '../../lib/background-job-toast.js';
import { ocrResultsHash } from './ocr-app-routes.js';
import { OCR_STATUS_POLL_MS } from './ocr.constants';
import { applyCompletedStatusToPdfJobs, getStatus, OCR_MODE } from './ocr.backend';
import type { PdfJob } from './ocr.types';
import { setOperationsCountResults } from './operations-count-results.svelte';
import { pmPushErrorToast, pmPushSuccessToast } from './toast';

const runningByBom = new SvelteSet<string>();
const timers = new SvelteMap<string, ReturnType<typeof setInterval>[]>();
const jobsByBom = new SvelteMap<string, PdfJob[]>();
let extractionVersion = $state(0);

function bumpExtractionVersion(): void {
	extractionVersion += 1;
}

/** Reactive tick for BOM list Operations Count column when background OCR runs. */
export function operationsCountExtractionVersion(): number {
	void runningByBom;
	return extractionVersion;
}

export function isExtractionRunning(bomId: string): boolean {
	void runningByBom;
	return runningByBom.has(bomId);
}

function clearTimers(bomId: string) {
	const bomTimers = timers.get(bomId) ?? [];
	for (const timer of bomTimers) clearInterval(timer);
	timers.delete(bomId);
}

function finishExtraction(bomId: string, pdfs: PdfJob[]) {
	clearTimers(bomId);
	runningByBom.delete(bomId);
	jobsByBom.delete(bomId);
	bumpExtractionVersion();

	const nav = takeOcrResultsNav(bomId);
	const resultsHash = nav ? ocrResultsHash(nav.projectId, nav.structure, bomId) : null;

	if (pdfs.some((pdf) => pdf.status === 'completed')) {
		setOperationsCountResults(bomId, pdfs);
		pmPushSuccessToast(
			withViewResultsAction(
				{
					title: 'Extraction complete',
					description: resultsHash
						? 'Operations count results are ready.'
						: 'Operations count results are ready to view.'
				},
				resultsHash
			)
		);
	} else {
		pmPushErrorToast({
			title: 'Extraction failed',
			description: 'All PDFs failed to process.'
		});
	}
}

function checkAllDone(bomId: string, pdfs: PdfJob[]) {
	if (!pdfs.every((pdf) => pdf.status === 'completed' || pdf.status === 'failed')) return;
	finishExtraction(bomId, pdfs);
}

function pollPdf(bomId: string, pdfs: PdfJob[], pdfIdx: number) {
	const pdf = pdfs[pdfIdx];
	const interval = setInterval(async () => {
		try {
			const data = await getStatus(bomId, pdf.jobId);
			pdf.progress = data.progress ?? pdf.progress;

			if (data.status === 'completed') {
				clearInterval(interval);
				const bomTimers = timers.get(bomId) ?? [];
				timers.set(
					bomId,
					bomTimers.filter((timer) => timer !== interval)
				);
				const shared = pdfs.filter((item) => item.jobId === pdf.jobId);
				await applyCompletedStatusToPdfJobs(bomId, shared, data);
				checkAllDone(bomId, pdfs);
			} else if (data.status === 'failed') {
				clearInterval(interval);
				const bomTimers = timers.get(bomId) ?? [];
				timers.set(
					bomId,
					bomTimers.filter((timer) => timer !== interval)
				);
				pdf.status = 'failed';
				pdf.error = data.error || 'OCR processing failed.';
				checkAllDone(bomId, pdfs);
			}
		} catch (err) {
			clearInterval(interval);
			const bomTimers = timers.get(bomId) ?? [];
			timers.set(
				bomId,
				bomTimers.filter((timer) => timer !== interval)
			);
			pdf.status = 'failed';
			pdf.error = err instanceof Error ? err.message : 'Status poll failed.';
			checkAllDone(bomId, pdfs);
		}
	}, OCR_STATUS_POLL_MS);

	const bomTimers = timers.get(bomId) ?? [];
	timers.set(bomId, [...bomTimers, interval]);
}

export function startBackgroundExtraction(
	bomId: string,
	pdfs: PdfJob[],
	resultsNav?: BomResultsNav
) {
	cancelBackgroundExtraction(bomId);

	if (resultsNav) stashOcrResultsNav(bomId, resultsNav);

	const snapshot = $state.snapshot(pdfs) as PdfJob[];
	jobsByBom.set(bomId, snapshot);
	runningByBom.add(bomId);
	bumpExtractionVersion();

	for (let i = 0; i < snapshot.length; i++) {
		pollPdf(bomId, snapshot, i);
	}
}

type OcrVerificationExtractRow = {
	bom_id: string;
	status: string;
	extract_job_id?: string | null;
};

function processingPdfJob(bomId: string, jobId: string): PdfJob {
	return {
		pdf_id: bomId,
		filename: 'drawings.pdf',
		totalPages: 0,
		samples: [],
		roi: null,
		jobId,
		progress: 0,
		results: [],
		status: 'processing',
		error: null,
		currentSampleIdx: 0
	};
}

/**
 * After BOM list load: resume polling when server `ocr_verifications.status` is still
 * `extracting` (e.g. user chose Run in background then refreshed or re-opened BOMs).
 */
export async function resumeBackgroundExtractions(bomIds: string[]): Promise<void> {
	if (OCR_MODE !== 'core' || bomIds.length === 0) return;

	const idList = bomIds.map((id) => encodeURIComponent(id)).join(',');
	try {
		const envelope = await apiClient.get<ApiEnvelope<OcrVerificationExtractRow[]>>(
			apiClient.datahub(
				`ocr_verifications?limit=2500&bom_id__in=${idList}&select=bom_id,status,extract_job_id`
			)
		);
		const rows = rowsFromEnvelope(envelope.data);
		for (const row of rows) {
			if (row.status !== 'extracting' || !row.extract_job_id) continue;
			if (runningByBom.has(row.bom_id)) continue;
			startBackgroundExtraction(row.bom_id, [processingPdfJob(row.bom_id, row.extract_job_id)]);
		}
	} catch (error) {
		pmPushErrorToast({
			title: 'Could not resume OCR extractions',
			description: errorDescription(error)
		});
	}
}

export function cancelBackgroundExtraction(bomId: string) {
	clearTimers(bomId);
	const wasRunning = runningByBom.delete(bomId);
	jobsByBom.delete(bomId);
	if (wasRunning) bumpExtractionVersion();
}
