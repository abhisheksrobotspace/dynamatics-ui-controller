import type { TDocumentDefinitions } from 'pdfmake/interfaces';
import type { JobCardDetail } from './job-cards.types.js';
import {
	buildJobCardDocDefinition,
	jobCardPdfFileName,
	FONT_BODY,
	FONT_HEADING
} from './job-cards.pdf.js';

/**
 * Browser-side renderer for the job card PDF.
 *
 * pdfmake plus its embedded fonts is roughly 2 MB, so everything here is loaded lazily: the
 * renderer arrives via dynamic `import()` and the font/logo assets are fetched as ordinary
 * cacheable URLs the first time somebody downloads a card. Nothing in this module runs (or is
 * bundled into the main chunk) until `downloadJobCardPdf` is called.
 *
 * Fonts are the static `.woff` faces on purpose. @fontsource also ships `.woff2`, but those are
 * variable fonts and fontkit resolves them to the wrong default instance - the text lands in the
 * PDF's text layer but renders with no visible outlines (a blank page). The static faces embed
 * correctly, so do not "upgrade" these imports to woff2.
 */

// `?url` keeps the fonts as separate cacheable assets rather than inflating the JS bundle
// with base64, which costs ~33% over the raw bytes.
import manropeRegularUrl from '@fontsource/manrope/files/manrope-latin-400-normal.woff?url';
import manropeBoldUrl from '@fontsource/manrope/files/manrope-latin-700-normal.woff?url';
import spaceGroteskRegularUrl from '@fontsource/space-grotesk/files/space-grotesk-latin-400-normal.woff?url';
import spaceGroteskBoldUrl from '@fontsource/space-grotesk/files/space-grotesk-latin-700-normal.woff?url';

const LOGO_URL = '/assets/brand/jyoti-logo.png';

type PdfMakeFontFace = {
	normal: string;
	bold: string;
	italics: string;
	bolditalics: string;
};

type CreatedPdf = {
	download: (fileName?: string) => void | Promise<void>;
	open: () => void | Promise<void>;
	getBlob: () => Promise<Blob>;
};

type PdfMakeClient = {
	addVirtualFileSystem: (vfs: Record<string, string>) => void;
	addFonts: (fonts: Record<string, PdfMakeFontFace>) => void;
	createPdf: (docDefinition: TDocumentDefinitions) => CreatedPdf;
};

/** VFS keys are arbitrary but must match the face paths handed to `addFonts`. */
const FONT_FILES = {
	'fonts/Manrope-Regular.woff': manropeRegularUrl,
	'fonts/Manrope-Bold.woff': manropeBoldUrl,
	'fonts/SpaceGrotesk-Regular.woff': spaceGroteskRegularUrl,
	'fonts/SpaceGrotesk-Bold.woff': spaceGroteskBoldUrl
} as const;

// Neither family ships an italic face, so slanted styles reuse the upright one. The job card
// template only needs italics for the masthead's "Prepared with iFactoryOS" strapline.
const FONT_FACES: Record<string, PdfMakeFontFace> = {
	[FONT_HEADING]: {
		normal: 'fonts/Manrope-Regular.woff',
		bold: 'fonts/Manrope-Bold.woff',
		italics: 'fonts/Manrope-Regular.woff',
		bolditalics: 'fonts/Manrope-Bold.woff'
	},
	[FONT_BODY]: {
		normal: 'fonts/SpaceGrotesk-Regular.woff',
		bold: 'fonts/SpaceGrotesk-Bold.woff',
		italics: 'fonts/SpaceGrotesk-Regular.woff',
		bolditalics: 'fonts/SpaceGrotesk-Bold.woff'
	}
};

function toBase64(bytes: Uint8Array): string {
	// Chunked so a large font does not blow the argument limit of String.fromCharCode.
	const CHUNK = 0x8000;
	let binary = '';
	for (let i = 0; i < bytes.length; i += CHUNK) {
		binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
	}
	return btoa(binary);
}

async function fetchBase64(url: string): Promise<string> {
	const response = await fetch(url);
	if (!response.ok) throw new Error(`Failed to load ${url} (${response.status})`);
	return toBase64(new Uint8Array(await response.arrayBuffer()));
}

function isPdfMakeClient(value: unknown): value is PdfMakeClient {
	if (typeof value !== 'object' || value === null) return false;
	const candidate = value as Partial<PdfMakeClient>;
	return (
		typeof candidate.createPdf === 'function' &&
		typeof candidate.addFonts === 'function' &&
		typeof candidate.addVirtualFileSystem === 'function'
	);
}

/** Resolved once per session; the fonts do not change between downloads. */
let clientPromise: Promise<PdfMakeClient> | null = null;

async function loadPdfMake(): Promise<PdfMakeClient> {
	const imported: unknown = await import('pdfmake/build/pdfmake.js');
	const candidate =
		typeof imported === 'object' && imported !== null && 'default' in imported
			? (imported as { default: unknown }).default
			: imported;
	if (!isPdfMakeClient(candidate)) {
		throw new Error('pdfmake loaded but did not expose the expected client API');
	}

	const entries = Object.entries(FONT_FILES);
	const encoded = await Promise.all(entries.map(([, url]) => fetchBase64(url)));
	candidate.addVirtualFileSystem(
		Object.fromEntries(entries.map(([vfsPath], index) => [vfsPath, encoded[index]]))
	);
	candidate.addFonts(FONT_FACES);
	return candidate;
}

function getPdfMake(): Promise<PdfMakeClient> {
	// Cache the successful client only; a failed load should be retryable on the next click.
	if (!clientPromise) {
		clientPromise = loadPdfMake().catch((error: unknown) => {
			clientPromise = null;
			throw error;
		});
	}
	return clientPromise;
}

/**
 * The masthead logo is optional - a missing or unreachable asset degrades to the text-only
 * masthead rather than failing the whole download.
 */
async function loadLogoDataUrl(): Promise<string | undefined> {
	try {
		return `data:image/png;base64,${await fetchBase64(LOGO_URL)}`;
	} catch {
		return undefined;
	}
}

function sniffImageMime(bytes: Uint8Array): 'image/png' | 'image/jpeg' | undefined {
	if (
		bytes.length >= 8 &&
		bytes[0] === 0x89 &&
		bytes[1] === 0x50 &&
		bytes[2] === 0x4e &&
		bytes[3] === 0x47
	) {
		return 'image/png';
	}
	if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
		return 'image/jpeg';
	}
	return undefined;
}

function mimeFromContentType(value: string | null): 'image/png' | 'image/jpeg' | undefined {
	const mime = (value ?? '').split(';')[0].trim().toLowerCase();
	if (mime === 'image/png') return 'image/png';
	if (mime === 'image/jpeg' || mime === 'image/jpg') return 'image/jpeg';
	return undefined;
}

async function loadDrawingDataUrl(url: string): Promise<string | undefined> {
	try {
		const response = await fetch(url, { credentials: 'include' });
		if (!response.ok) return undefined;
		const bytes = new Uint8Array(await response.arrayBuffer());
		const mime = mimeFromContentType(response.headers.get('content-type')) ?? sniffImageMime(bytes);
		if (!mime) return undefined;
		return `data:${mime};base64,${toBase64(bytes)}`;
	} catch {
		return undefined;
	}
}

/** Cap parallel file-service fetches so a 40-mark card does not open 40 connections. */
async function loadDrawingDataUrls(
	drawings: JobCardDetail['drawings']
): Promise<Record<string, string>> {
	const urls: Record<string, string> = {};
	const pending = [...drawings];
	const workers = Array.from({ length: Math.min(4, pending.length) }, async () => {
		while (true) {
			const drawing = pending.shift();
			if (!drawing) return;
			const dataUrl = await loadDrawingDataUrl(drawing.imageUrl);
			if (dataUrl) urls[drawing.id] = dataUrl;
		}
	});
	await Promise.all(workers);
	return urls;
}

/** Drop data-URL strings so the only remaining copies live on the pdfmake document. */
function forgetDataUrls(urls: Record<string, string>): void {
	for (const id of Object.keys(urls)) {
		urls[id] = '';
		delete urls[id];
	}
}

async function renderJobCardPdf(detail: JobCardDetail): Promise<CreatedPdf> {
	// Drawings are not cached across exports - a card can carry dozens of full-page PNGs.
	const drawingDataUrls = await loadDrawingDataUrls(detail.drawings);
	try {
		const [pdfMake, logoDataUrl] = await Promise.all([getPdfMake(), loadLogoDataUrl()]);
		return pdfMake.createPdf(buildJobCardDocDefinition(detail, { logoDataUrl, drawingDataUrls }));
	} finally {
		forgetDataUrls(drawingDataUrls);
	}
}

/** Render the job card (Job Card through Shop Sketch) and save it to disk. */
export async function downloadJobCardPdf(detail: JobCardDetail): Promise<void> {
	const pdf = await renderJobCardPdf(detail);
	await pdf.download(`${jobCardPdfFileName(detail)}.pdf`);
}

/** Render the job card (Job Card through Shop Sketch) and open it in a new tab. */
export async function openJobCardPdf(detail: JobCardDetail): Promise<void> {
	const pdf = await renderJobCardPdf(detail);
	await pdf.open();
}
