export const MIN_ZOOM = 1;
export const MAX_ZOOM = 8;
export const ZOOM_STEP = 1.25;
export const SWIPE_PX = 72;
/** Pixels per millisecond. A slow drag must not change sheets. */
export const SWIPE_VELOCITY = 0.3;
export const PAN_STEP_PX = 48;
/** How far a fitted sheet may follow a finger before a flick commits. */
export const PAN_PADDING_PX = 48;

export function clampZoom(value: number): number {
	if (!Number.isFinite(value)) return MIN_ZOOM;
	return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}

/** `direction` 1 zooms in. Zoom is a multiple of the fitted image, so 1 is fit. */
export function nextZoom(current: number, direction: 1 | -1): number {
	const factor = direction > 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
	return clampZoom(current * factor);
}

/**
 * Scale that fits the image inside the viewport without enlarging it.
 * 1 means the image is already smaller than the viewport.
 */
export function containScale(
	viewportWidth: number,
	viewportHeight: number,
	imageWidth: number,
	imageHeight: number
): number {
	if (viewportWidth <= 0 || viewportHeight <= 0 || imageWidth <= 0 || imageHeight <= 0) {
		return 1;
	}
	return Math.min(1, viewportWidth / imageWidth, viewportHeight / imageHeight);
}

/** Zoom multiple that shows the image at its natural pixel size. */
export function actualSizeZoom(contained: number): number {
	if (contained <= 0 || contained >= 1) return MIN_ZOOM;
	return clampZoom(1 / contained);
}

export function wrapIndex(index: number, count: number, delta: number): number {
	if (count <= 0) return 0;
	const base = Math.min(Math.max(index, 0), count - 1);
	return (base + delta + count) % count;
}

/**
 * Pan after a zoom that keeps the point under `cursorOffset` (viewport center is 0) still.
 */
export function panAfterZoom(
	pan: number,
	cursorOffset: number,
	previousZoom: number,
	nextZoom: number
): number {
	if (previousZoom <= 0 || nextZoom <= MIN_ZOOM) return 0;
	const imagePoint = (cursorOffset - pan) / previousZoom;
	return cursorOffset - imagePoint * nextZoom;
}

/** Keep `pan` inside the overflow of a scaled image, plus a small edge padding. */
export function clampPan(
	pan: number,
	rendered: number,
	viewport: number,
	padding = PAN_PADDING_PX
): number {
	if (!Number.isFinite(pan)) return 0;
	const limit = Math.max(0, (rendered - viewport) / 2) + padding;
	return Math.min(limit, Math.max(-limit, pan));
}

/** A sideways flick. Distance is pixels, elapsed time is milliseconds. */
export function isFlick(
	distance: number,
	elapsedMs: number,
	minDistance = SWIPE_PX,
	minVelocity = SWIPE_VELOCITY
): boolean {
	if (elapsedMs <= 0) return false;
	return Math.abs(distance) >= minDistance && Math.abs(distance) / elapsedMs >= minVelocity;
}

/** Continuous wheel zoom. `deltaY` is in pixels; line-mode ticks are scaled first. */
export function zoomFromWheel(current: number, deltaY: number, deltaMode = 0): number {
	const pixels = deltaMode === 1 ? deltaY * 16 : deltaY;
	return clampZoom(current * Math.exp(-pixels * 0.0015));
}
