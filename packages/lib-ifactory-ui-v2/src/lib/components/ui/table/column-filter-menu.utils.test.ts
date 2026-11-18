import { describe, expect, it } from 'vitest';
import { resolveFilterMenuPlacement } from './column-filter-menu.utils';

function rect(
	partial: Partial<DOMRect> & Pick<DOMRect, 'top' | 'left' | 'width' | 'height'>
): DOMRect {
	const right = partial.left + partial.width;
	const bottom = partial.top + partial.height;
	return {
		x: partial.left,
		y: partial.top,
		top: partial.top,
		left: partial.left,
		width: partial.width,
		height: partial.height,
		right,
		bottom,
		toJSON() {
			return this;
		}
	};
}

describe('resolveFilterMenuPlacement', () => {
	it('opens to the right when there is space', () => {
		const placement = resolveFilterMenuPlacement({
			triggerRect: rect({ top: 100, left: 80, width: 24, height: 24 }),
			contentRect: rect({ top: 0, left: 0, width: 296, height: 360 }),
			gap: 4,
			viewportWidth: 1200,
			viewportHeight: 800
		});

		expect(placement.side).toBe('right');
		expect(placement.left).toBe(80 + 24 + 4);
		expect(placement.top).toBe(100);
	});

	it('flips to the left when there is no space on the right', () => {
		const placement = resolveFilterMenuPlacement({
			triggerRect: rect({ top: 100, left: 350, width: 24, height: 24 }),
			contentRect: rect({ top: 0, left: 0, width: 296, height: 360 }),
			gap: 4,
			viewportWidth: 400,
			viewportHeight: 800
		});

		expect(placement.side).toBe('left');
		expect(placement.left).toBe(350 - 296 - 4);
	});
});
