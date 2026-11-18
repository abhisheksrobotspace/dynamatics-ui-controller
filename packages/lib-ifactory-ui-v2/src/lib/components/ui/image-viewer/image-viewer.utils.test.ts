import { describe, expect, it } from 'vitest';
import {
	actualSizeZoom,
	clampPan,
	clampZoom,
	containScale,
	isFlick,
	nextZoom,
	panAfterZoom,
	wrapIndex,
	zoomFromWheel
} from './image-viewer.utils';

describe('image viewer zoom', () => {
	it('fits a large sheet inside the viewport and leaves a small one at 1', () => {
		expect(containScale(800, 600, 4000, 3000)).toBeCloseTo(0.2);
		expect(containScale(800, 600, 200, 100)).toBe(1);
		expect(containScale(0, 600, 200, 100)).toBe(1);
	});

	it('steps zoom from fit and clamps the range', () => {
		expect(nextZoom(1, 1)).toBeCloseTo(1.25);
		expect(nextZoom(1, -1)).toBe(1);
		expect(clampZoom(100)).toBe(8);
		expect(clampZoom(Number.NaN)).toBe(1);
	});

	it('maps fit scale to a natural-size zoom', () => {
		expect(actualSizeZoom(0.2)).toBe(5);
		expect(actualSizeZoom(1)).toBe(1);
		expect(actualSizeZoom(0.05)).toBe(8);
	});

	it('wraps the sheet index', () => {
		expect(wrapIndex(0, 3, -1)).toBe(2);
		expect(wrapIndex(2, 3, 1)).toBe(0);
		expect(wrapIndex(0, 1, 1)).toBe(0);
		expect(wrapIndex(0, 0, 1)).toBe(0);
	});

	it('keeps the point under the cursor fixed while zooming', () => {
		expect(panAfterZoom(0, 0, 1, 2)).toBe(0);
		expect(panAfterZoom(40, 0, 2, 4)).toBe(80);
		expect(panAfterZoom(40, 0, 2, 1)).toBe(0);
		expect(zoomFromWheel(1, -100)).toBeGreaterThan(1);
		expect(zoomFromWheel(1, 100)).toBe(1);
	});

	it('keeps a pan inside the scaled image and ignores a slow drag', () => {
		expect(clampPan(5000, 400, 800)).toBe(48);
		expect(clampPan(-5000, 1600, 800)).toBe(-448);
		expect(isFlick(80, 200)).toBe(true);
		expect(isFlick(80, 2000)).toBe(false);
		expect(isFlick(20, 40)).toBe(false);
	});
});
