import { describe, expect, it } from 'vitest';
import { isOutOfFlowPosition, remainingScrollportHeight } from './table-sticky-scroll';

describe('remainingScrollportHeight', () => {
	it('fills from wrap top to scrollport bottom', () => {
		expect(remainingScrollportHeight(200, 800, 0)).toBe(600);
	});

	it('subtracts bottom reserve (footer)', () => {
		expect(remainingScrollportHeight(200, 800, 48)).toBe(552);
	});

	it('never goes below 120px', () => {
		expect(remainingScrollportHeight(750, 800, 40)).toBe(120);
	});
});

describe('isOutOfFlowPosition', () => {
	it('treats fixed and absolute as out of flow (busy overlays / dialogs)', () => {
		expect(isOutOfFlowPosition('fixed')).toBe(true);
		expect(isOutOfFlowPosition('absolute')).toBe(true);
		expect(isOutOfFlowPosition('static')).toBe(false);
		expect(isOutOfFlowPosition('relative')).toBe(false);
	});
});
