const VIEWPORT_PADDING = 8;

function fits(size: number, space: number): boolean {
	return space >= size;
}

export type FilterMenuPlacement = {
	top: number;
	left: number;
	side: 'left' | 'right';
};

/**
 * Prefer opening the filter panel to the right of the trigger.
 * Flip to the left when there isn't enough horizontal space (e.g. last column).
 */
export function resolveFilterMenuPlacement({
	triggerRect,
	contentRect,
	gap = 4,
	viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 0,
	viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 0
}: {
	triggerRect: DOMRect;
	contentRect: DOMRect;
	gap?: number;
	viewportWidth?: number;
	viewportHeight?: number;
}): FilterMenuPlacement {
	const menuWidth = contentRect.width;
	const menuHeight = contentRect.height;

	const spaceRight = viewportWidth - triggerRect.right - gap - VIEWPORT_PADDING;
	const spaceLeft = triggerRect.left - gap - VIEWPORT_PADDING;

	let side: 'left' | 'right' = 'right';
	if (!fits(menuWidth, spaceRight) && (fits(menuWidth, spaceLeft) || spaceLeft > spaceRight)) {
		side = 'left';
	}

	let left = side === 'right' ? triggerRect.right + gap : triggerRect.left - menuWidth - gap;
	let top = triggerRect.top;

	left = Math.max(VIEWPORT_PADDING, Math.min(left, viewportWidth - menuWidth - VIEWPORT_PADDING));
	top = Math.max(VIEWPORT_PADDING, Math.min(top, viewportHeight - menuHeight - VIEWPORT_PADDING));

	return { top, left, side };
}
