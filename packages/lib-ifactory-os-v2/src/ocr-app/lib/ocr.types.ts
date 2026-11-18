export type RoiRect = {
	x: number;
	y: number;
	w: number;
	h: number;
};

export type PdfSample = {
	page: number;
	url: string;
};

export type HoleBox = {
	x1: number;
	y1: number;
	x2: number;
	y2: number;
};

export type HoleCrop = {
	part_idx: number;
	hole_count?: number;
	/** Page-pixel part box. */
	box?: HoleBox;
	/** Hole boxes in page pixels (translated to crop-relative for BBoxReviewer). */
	hole_boxes?: HoleBox[];
};

export type HoleImages = {
	width_px?: number;
	height_px?: number;
	crops?: HoleCrop[];
};

export type OcrResultRow = {
	id?: string;
	/** Global page number within the verification (lookup key for ocr_pages). */
	page: number;
	/** 1-based page within the source PDF when known — prefer this for display. */
	source_page?: number | null;
	mark_number: string;
	/** OCR-extracted mark from the shop sketch (from job-complete /status results). */
	sketch_mark?: string | null;
	/** User-corrected sketch mark (persisted as ocr_results.corrected_mark). */
	corrected_mark?: string | null;
	extracted_number?: string | null;
	ocr_suffix?: string | null;
	raw_text?: string;
	bom_match_status?: string;
	bom_mark_number?: string;
	bom_suggestions?: string[];
	hole_count?: number;
	hole_images?: HoleImages;
	is_hole_manual?: boolean;
	/** Source PDF (`proj_bom_drawings.file_id`); null on BOM-wide `not_in_pdf` rows. */
	drawing_file_id?: string | null;
};

export type PdfJob = {
	pdf_id: string;
	filename: string;
	totalPages: number;
	samples: PdfSample[];
	roi: RoiRect | null;
	jobId: string;
	progress: number;
	results: OcrResultRow[];
	status: string;
	error: string | null;
	currentSampleIdx: number;
};

export type UploadPdfResponse = {
	pdfs?: Array<{
		pdf_id: string;
		filename: string;
		total_pages: number;
		samples: PdfSample[];
	}>;
	/** Core mode: rasterize observation snapshot after the filmstrip is ready. */
	rasterize?: RasterizeProgress;
	/** Core mode: sample pages came from persisted ocr_pages (no re-upload or re-rasterize). */
	reusedExistingFilmstrip?: boolean;
	error?: string;
};

export type RasterizeStatus = 'pending' | 'rendering' | 'complete' | 'partial' | 'failed';

/** Core mode: independent machine-side render progress from `ocr_verifications`. */
export type RasterizeProgress = {
	verificationId: string;
	workflowStatus: string;
	rasterizeStatus: RasterizeStatus | null;
	pagesReady: number;
	totalPages: number | null;
};

export type UploadBomResponse = {
	bom_id?: string;
	mark_count?: number;
	marks?: Array<{ numeric: string; suffix: string; full: string }>;
	bom_suffix_map?: Record<string, string>;
	error?: string;
};
