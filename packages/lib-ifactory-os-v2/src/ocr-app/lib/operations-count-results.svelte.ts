import { SvelteMap, SvelteSet } from 'svelte/reactivity';
import { apiClient } from '../../lib/api/api-client.js';
import { errorDescription, rowsFromEnvelope, type ApiEnvelope } from '../../lib/api/types.js';
import type { PdfJob } from './ocr.types';
import { pmPushErrorToast } from './toast.js';

const isCoreOcrMode = import.meta.env.VITE_OCR_MODE === 'core';

const resultsByBom = new SvelteMap<string, PdfJob[]>();
/** BOMs known to have persisted OCR results (may not have full PdfJob[] in memory yet). */
const readyByBom = new SvelteSet<string>();
let resultsVersion = $state(0);

/** Post-extract verification statuses that mean results exist for View. */
const OCR_RESULTS_READY_STATUSES = new Set(['action_needed', 'verified']);

type OcrVerificationListRow = {
	bom_id: string;
	status: string;
	found_count?: number | null;
};

function bump() {
	resultsVersion++;
}

export function setOperationsCountResults(bomId: string, pdfs: PdfJob[]) {
	resultsByBom.set(bomId, pdfs);
	readyByBom.add(bomId);
	bump();
}

export function updateOperationsCountResults(bomId: string, pdfs: PdfJob[]) {
	if (!resultsByBom.has(bomId)) return;
	resultsByBom.set(bomId, pdfs);
	bump();
}

export function getOperationsCountResults(bomId: string): PdfJob[] | undefined {
	void resultsVersion;
	return resultsByBom.get(bomId);
}

export function hasOperationsCountResults(bomId: string): boolean {
	void resultsVersion;
	return readyByBom.has(bomId) || resultsByBom.has(bomId);
}

/** Subscribe in `$derived` so BOM list View buttons refresh after async hydration. */
export function operationsCountResultsVersion(): number {
	return resultsVersion;
}

export function clearOperationsCountResults(bomId: string) {
	let changed = false;
	if (resultsByBom.delete(bomId)) changed = true;
	if (readyByBom.delete(bomId)) changed = true;
	if (changed) bump();
}

function verificationHasResults(row: OcrVerificationListRow): boolean {
	if (OCR_RESULTS_READY_STATUSES.has(row.status)) return true;
	return (row.found_count ?? 0) > 0;
}

/**
 * Sync View-button state from server `ocr_verifications` (core mode only).
 * Mirrors cutting-plan hydrate — existence only; full PdfJob[] loads on the results page.
 */
export async function hydrateOperationsCountResults(bomIds: string[]): Promise<void> {
	if (!isCoreOcrMode || bomIds.length === 0) return;

	const idList = bomIds.map((id) => encodeURIComponent(id)).join(',');
	let rows: OcrVerificationListRow[];
	try {
		const envelope = await apiClient.get<ApiEnvelope<OcrVerificationListRow[]>>(
			apiClient.datahub(
				`ocr_verifications?limit=2500&bom_id__in=${idList}&select=bom_id,status,found_count`
			)
		);
		rows = rowsFromEnvelope(envelope.data);
	} catch (error) {
		pmPushErrorToast({
			title: 'Could not refresh operations count status',
			description: errorDescription(error)
		});
		return;
	}

	const ready = new SvelteSet(rows.filter(verificationHasResults).map((row) => row.bom_id));
	let changed = false;
	for (const bomId of bomIds) {
		if (ready.has(bomId)) {
			if (!readyByBom.has(bomId)) {
				readyByBom.add(bomId);
				changed = true;
			}
		} else if (!resultsByBom.has(bomId) && readyByBom.delete(bomId)) {
			changed = true;
		}
	}
	if (changed) bump();
}
