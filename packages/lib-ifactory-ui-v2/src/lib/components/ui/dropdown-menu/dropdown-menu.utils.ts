import type { DropdownMenuAlign, DropdownMenuSide } from './dropdown-menu.constants';

const VIEWPORT_PADDING = 8;

type PlacementInput = {
	preferredSide: DropdownMenuSide;
	preferredAlign: DropdownMenuAlign;
	triggerRect: DOMRect;
	contentRect: DOMRect;
	gap: number;
};

export type DropdownMenuPlacement = {
	top: number;
	left: number;
	side: DropdownMenuSide;
	align: DropdownMenuAlign;
};

function fits(size: number, space: number): boolean {
	return space >= size;
}

export function resolveDropdownPlacement({
	preferredSide,
	preferredAlign,
	triggerRect,
	contentRect,
	gap
}: PlacementInput): DropdownMenuPlacement {
	const menuHeight = contentRect.height;
	const menuWidth = contentRect.width;

	const spaceBelow = window.innerHeight - triggerRect.bottom - gap - VIEWPORT_PADDING;
	const spaceAbove = triggerRect.top - gap - VIEWPORT_PADDING;
	const spaceRight = window.innerWidth - triggerRect.left - VIEWPORT_PADDING;
	const spaceLeft = triggerRect.right - VIEWPORT_PADDING;

	let side = preferredSide;
	if (preferredSide === 'bottom') {
		if (
			!fits(menuHeight, spaceBelow) &&
			(fits(menuHeight, spaceAbove) || spaceAbove > spaceBelow)
		) {
			side = 'top';
		}
	} else if (
		!fits(menuHeight, spaceAbove) &&
		(fits(menuHeight, spaceBelow) || spaceBelow > spaceAbove)
	) {
		side = 'bottom';
	}

	let align = preferredAlign;
	if (preferredAlign === 'start') {
		if (!fits(menuWidth, spaceRight) && (fits(menuWidth, spaceLeft) || spaceLeft > spaceRight)) {
			align = 'end';
		}
	} else if (
		!fits(menuWidth, spaceLeft) &&
		(fits(menuWidth, spaceRight) || spaceRight > spaceLeft)
	) {
		align = 'start';
	}

	let top = side === 'top' ? triggerRect.top - menuHeight - gap : triggerRect.bottom + gap;
	let left = align === 'start' ? triggerRect.left : triggerRect.right - menuWidth;

	left = Math.max(
		VIEWPORT_PADDING,
		Math.min(left, window.innerWidth - menuWidth - VIEWPORT_PADDING)
	);
	top = Math.max(
		VIEWPORT_PADDING,
		Math.min(top, window.innerHeight - menuHeight - VIEWPORT_PADDING)
	);

	return { top, left, side, align };
}
