import { findResultRow } from './ocr-mark-edit';
import { OCR_MODE } from './ocr.backend';
import { datahubUpdate } from './core-api';
import { ocrFetch } from './ocr.api';
import { holeMetadataForSave, translateBoxesCropToPage } from './ocr-hole-images';
import type { HoleBox, OcrResultRow, PdfJob } from './ocr.types';

export type HoleReviewCropUpdate = {
	id: number;
	boxes: Array<HoleBox & { class_id?: string }>;
};

function cloneHoleRow(row: OcrResultRow): OcrResultRow {
	return {
		...row,
		bom_suggestions: row.bom_suggestions ? [...row.bom_suggestions] : undefined,
		hole_images: row.hole_images
			? {
					width_px: row.hole_images.width_px,
					height_px: row.hole_images.height_px,
					crops: row.hole_images.crops?.map((crop) => ({
						...crop,
						box: crop.box ? { ...crop.box } : undefined,
						hole_boxes: crop.hole_boxes?.map((box) => ({ ...box }))
					}))
				}
			: undefined
	};
}

function clonePdfs(pdfs: PdfJob[]): PdfJob[] {
	return pdfs.map((pdf) => ({
		...pdf,
		samples: pdf.samples.map((sample) => ({ ...sample })),
		roi: pdf.roi ? { ...pdf.roi } : null,
		results: (pdf.results || []).map(cloneHoleRow)
	}));
}

export function isFirstRowOnPage(row: OcrResultRow, rows: OcrResultRow[]): boolean {
	const idx = rows.findIndex((entry) => entry.id === row.id);
	if (idx <= 0) return true;
	return rows[idx - 1].page !== row.page;
}

export async function saveHoleReview(
	pdfs: PdfJob[],
	rowId: string,
	updatedCrops: HoleReviewCropUpdate[]
): Promise<PdfJob[]> {
	const next = clonePdfs(pdfs);
	const { pdf, row } = findResultRow(next, rowId);
	if (!pdf || !row) return pdfs;

	let total = 0;
	const localBoxes: Record<number, HoleBox[]> = {};

	for (const crop of updatedCrops) {
		const boxes = crop.boxes.map((box) => ({
			x1: box.x1,
			y1: box.y1,
			x2: box.x2,
			y2: box.y2
		}));
		localBoxes[crop.id] = boxes;
		total += boxes.length;
	}

	row.hole_count = total;
	row.is_hole_manual = true;

	if (row.hole_images?.crops) {
		row.hole_images.crops = row.hole_images.crops.map((crop) => {
			const edited = localBoxes[crop.part_idx] ?? crop.hole_boxes ?? [];
			// BBoxReviewer edits in crop-relative space; persist page-space.
			const boxes = crop.box ? translateBoxesCropToPage(edited, crop.box) : edited;
			return {
				...crop,
				box: crop.box ? { ...crop.box } : undefined,
				hole_boxes: boxes.map((box) => ({ ...box })),
				hole_count: boxes.length
			};
		});
	}

	if (OCR_MODE === 'core' && row.id) {
		const holeImages = holeMetadataForSave(row);
		await datahubUpdate('ocr_results', row.id, {
			corrected_hole_count: total,
			hole_count: total,
			...(holeImages ? { metadata: { hole_images: holeImages } } : {})
		});
		return next;
	}

	const payload = {
		job_id: pdf.jobId,
		page: row.page,
		mark_number: row.mark_number,
		crops: (row.hole_images?.crops ?? []).map((crop) => ({
			part_idx: crop.part_idx,
			box: crop.box,
			hole_boxes: localBoxes[crop.part_idx] ?? crop.hole_boxes ?? [],
			hole_count: (localBoxes[crop.part_idx] ?? crop.hole_boxes ?? []).length
		}))
	};

	await ocrFetch('/save_hole_review', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload)
	});

	return next;
}
