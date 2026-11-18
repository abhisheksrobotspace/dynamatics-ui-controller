import type { BreadcrumbItem } from './breadcrumb.constants';

export type BreadcrumbSegment =
	{ type: 'item'; item: BreadcrumbItem } | { type: 'ellipsis'; items: BreadcrumbItem[] };

export function buildBreadcrumbSegments(
	items: BreadcrumbItem[],
	collapseLevel: number
): BreadcrumbSegment[] {
	if (items.length <= 2 || collapseLevel <= 0) {
		return items.map((item) => ({ type: 'item', item }));
	}

	const visibleTail = Math.max(1, 3 - collapseLevel);
	const tailStart = items.length - visibleTail;

	if (tailStart <= 1) {
		return items.map((item) => ({ type: 'item', item }));
	}

	const hidden = items.slice(1, tailStart);
	return [
		{ type: 'item', item: items[0]! },
		{ type: 'ellipsis', items: hidden },
		...items.slice(tailStart).map((item) => ({ type: 'item', item }))
	];
}

export function maxBreadcrumbCollapseLevel(itemCount: number): number {
	return Math.max(0, itemCount);
}
