import type { HoleBox } from './ocr.types';

/** Fetch as blob so the canvas is never CORS-tainted (same-origin cookie auth works). */
async function loadImage(url: string): Promise<{ img: HTMLImageElement; revoke?: () => void }> {
	const res = await fetch(url, { credentials: 'include' });
	if (!res.ok) throw new Error(`Failed to fetch image (${res.status}): ${url}`);
	const blob = await res.blob();
	const objectUrl = URL.createObjectURL(blob);
	try {
		const img = await new Promise<HTMLImageElement>((resolve, reject) => {
			const el = new Image();
			el.onload = () => resolve(el);
			el.onerror = () => reject(new Error(`Failed to decode image: ${url}`));
			el.src = objectUrl;
		});
		return {
			img,
			revoke: () => URL.revokeObjectURL(objectUrl)
		};
	} catch (err) {
		URL.revokeObjectURL(objectUrl);
		throw err;
	}
}

/** Canvas-crop a page raster to a page-pixel box; returns a blob object URL. Caller should revoke. */
export async function cropPageRegionToObjectUrl(
	pageImageUrl: string,
	box: HoleBox
): Promise<string> {
	const { img, revoke } = await loadImage(pageImageUrl);
	try {
		const x1 = Math.max(0, Math.floor(box.x1));
		const y1 = Math.max(0, Math.floor(box.y1));
		const x2 = Math.min(img.naturalWidth, Math.ceil(box.x2));
		const y2 = Math.min(img.naturalHeight, Math.ceil(box.y2));
		const w = Math.max(1, x2 - x1);
		const h = Math.max(1, y2 - y1);

		if (![x1, y1, w, h, img.naturalWidth, img.naturalHeight].every(Number.isFinite)) {
			throw new Error(
				`Invalid crop box ${JSON.stringify(box)} for image ${img.naturalWidth}×${img.naturalHeight}`
			);
		}

		const canvas = document.createElement('canvas');
		canvas.width = w;
		canvas.height = h;
		const ctx = canvas.getContext('2d');
		if (!ctx) throw new Error('Could not create canvas context');
		ctx.drawImage(img, x1, y1, w, h, 0, 0, w, h);

		const out = await new Promise<Blob>((resolve, reject) => {
			canvas.toBlob(
				(b) => (b ? resolve(b) : reject(new Error('canvas.toBlob failed'))),
				'image/png'
			);
		});
		return URL.createObjectURL(out);
	} finally {
		revoke?.();
	}
}
