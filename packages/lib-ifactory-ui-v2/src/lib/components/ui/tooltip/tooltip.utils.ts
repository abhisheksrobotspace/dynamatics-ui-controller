import type { TooltipAlign, TooltipSide } from './tooltip.constants';

const VIEWPORT_PADDING = 8;

type PlacementInput = {
	preferredSide: TooltipSide;
	preferredAlign: TooltipAlign;
	triggerRect: DOMRect;
	contentRect: DOMRect;
	gap: number;
};

export type TooltipPlacement = {
	top: number;
	left: number;
	side: TooltipSide;
	align: TooltipAlign;
};

function fits(size: number, space: number): boolean {
	return space >= size;
}

function oppositeSide(side: TooltipSide): TooltipSide {
	switch (side) {
		case 'top':
			return 'bottom';
		case 'bottom':
			return 'top';
		case 'left':
			return 'right';
		case 'right':
			return 'left';
	}
}

function spaceForSide(side: TooltipSide, triggerRect: DOMRect, gap: number): number {
	switch (side) {
		case 'top':
			return triggerRect.top - gap - VIEWPORT_PADDING;
		case 'bottom':
			return window.innerHeight - triggerRect.bottom - gap - VIEWPORT_PADDING;
		case 'left':
			return triggerRect.left - gap - VIEWPORT_PADDING;
		case 'right':
			return window.innerWidth - triggerRect.right - gap - VIEWPORT_PADDING;
	}
}

function sizeForSide(side: TooltipSide, contentRect: DOMRect): number {
	return side === 'top' || side === 'bottom' ? contentRect.height : contentRect.width;
}

export function resolveTooltipPlacement({
	preferredSide,
	preferredAlign,
	triggerRect,
	contentRect,
	gap
}: PlacementInput): TooltipPlacement {
	const preferredSpace = spaceForSide(preferredSide, triggerRect, gap);
	const preferredSize = sizeForSide(preferredSide, contentRect);
	const flip = oppositeSide(preferredSide);
	const flipSpace = spaceForSide(flip, triggerRect, gap);

	let side = preferredSide;
	if (
		!fits(preferredSize, preferredSpace) &&
		(fits(preferredSize, flipSpace) || flipSpace > preferredSpace)
	) {
		side = flip;
	}

	let align = preferredAlign;
	const isVertical = side === 'top' || side === 'bottom';

	if (isVertical) {
		const spaceStart = window.innerWidth - triggerRect.left - VIEWPORT_PADDING;
		const spaceEnd = triggerRect.right - VIEWPORT_PADDING;
		const spaceCenter = Math.min(
			triggerRect.left + triggerRect.width / 2,
			window.innerWidth - (triggerRect.left + triggerRect.width / 2)
		);

		if (
			align === 'start' &&
			!fits(contentRect.width, spaceStart) &&
			fits(contentRect.width, spaceEnd)
		) {
			align = 'end';
		} else if (
			align === 'end' &&
			!fits(contentRect.width, spaceEnd) &&
			fits(contentRect.width, spaceStart)
		) {
			align = 'start';
		} else if (
			align === 'center' &&
			!fits(contentRect.width / 2, spaceCenter) &&
			fits(contentRect.width, spaceStart)
		) {
			align = 'start';
		} else if (
			align === 'center' &&
			!fits(contentRect.width / 2, spaceCenter) &&
			fits(contentRect.width, spaceEnd)
		) {
			align = 'end';
		}
	} else {
		const spaceStart = window.innerHeight - triggerRect.top - VIEWPORT_PADDING;
		const spaceEnd = triggerRect.bottom - VIEWPORT_PADDING;

		if (
			align === 'start' &&
			!fits(contentRect.height, spaceStart) &&
			fits(contentRect.height, spaceEnd)
		) {
			align = 'end';
		} else if (
			align === 'end' &&
			!fits(contentRect.height, spaceEnd) &&
			fits(contentRect.height, spaceStart)
		) {
			align = 'start';
		}
	}

	let top = 0;
	let left = 0;

	if (side === 'top') {
		top = triggerRect.top - contentRect.height - gap;
	} else if (side === 'bottom') {
		top = triggerRect.bottom + gap;
	} else if (side === 'left') {
		left = triggerRect.left - contentRect.width - gap;
	} else {
		left = triggerRect.right + gap;
	}

	if (isVertical) {
		if (align === 'start') {
			left = triggerRect.left;
		} else if (align === 'end') {
			left = triggerRect.right - contentRect.width;
		} else {
			left = triggerRect.left + triggerRect.width / 2 - contentRect.width / 2;
		}
	} else if (align === 'start') {
		top = triggerRect.top;
	} else if (align === 'end') {
		top = triggerRect.bottom - contentRect.height;
	} else {
		top = triggerRect.top + triggerRect.height / 2 - contentRect.height / 2;
	}

	left = Math.max(
		VIEWPORT_PADDING,
		Math.min(left, window.innerWidth - contentRect.width - VIEWPORT_PADDING)
	);
	top = Math.max(
		VIEWPORT_PADDING,
		Math.min(top, window.innerHeight - contentRect.height - VIEWPORT_PADDING)
	);

	return { top, left, side, align };
}
