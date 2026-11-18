/**
 * Optional sticky table headers: the scrollport is the inner table wrap so
 * toolbar/search (siblings above the wrap) stay fixed while tbody scrolls.
 */

export function findVerticalScrollParent(el: HTMLElement): HTMLElement {
	let node: HTMLElement | null = el.parentElement;
	while (node && node !== document.body) {
		const overflowY = getComputedStyle(node).overflowY;
		if (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') {
			return node;
		}
		node = node.parentElement;
	}
	return (document.scrollingElement as HTMLElement | null) ?? document.documentElement;
}

/** AppShell content pane — visible bottom edge for fill-remaining height. */
function findAppContent(el: HTMLElement): HTMLElement | null {
	return el.closest('[id$="-content"]') as HTMLElement | null;
}

export function remainingScrollportHeight(
	wrapTop: number,
	scrollPortBottom: number,
	bottomReserve: number
): number {
	return Math.max(120, Math.floor(scrollPortBottom - wrapTop - bottomReserve));
}

/** Fixed/absolute overlays report viewport height but take no document flow space. */
export function isOutOfFlowPosition(position: string): boolean {
	return position === 'fixed' || position === 'absolute';
}

/**
 * Height that actually occupies layout below the table. Fixed/absolute overlays
 * (AppBusyOverlay, dialogs) report a full viewport `getBoundingClientRect().height`
 * but take no flow space — counting them collapses fill-remaining maxHeight to the
 * 120px floor and it stays stuck after the overlay closes (no resize event).
 */
export function inFlowSiblingHeight(sibling: HTMLElement): number {
	if (isOutOfFlowPosition(getComputedStyle(sibling).position)) return 0;
	return sibling.getBoundingClientRect().height;
}

/**
 * Space below the scroll wrap that must stay visible (DataTable pagination,
 * page footers / alerts that sit under the table in the flex column, etc.).
 */
function belowReserve(wrap: HTMLElement): number {
	let reserve = 0;
	let node: HTMLElement | null = wrap;

	while (node && node !== document.body) {
		let sibling = node.nextElementSibling as HTMLElement | null;
		while (sibling) {
			reserve += inFlowSiblingHeight(sibling);
			sibling = sibling.nextElementSibling as HTMLElement | null;
		}

		const parent = node.parentElement;
		if (!parent || parent.id?.endsWith('-content')) break;

		const parentStyle = getComputedStyle(parent);
		if (parentStyle.display.includes('flex') || parentStyle.display.includes('grid')) {
			const gap = Number.parseFloat(parentStyle.rowGap || parentStyle.gap || '0') || 0;
			let trailing = 0;
			let s = node.nextElementSibling as HTMLElement | null;
			while (s) {
				if (inFlowSiblingHeight(s) > 0) trailing += 1;
				s = s.nextElementSibling as HTMLElement | null;
			}
			if (trailing > 0) reserve += gap * trailing;
		}

		node = parent;
	}

	return reserve;
}

function scrollportBottom(wrap: HTMLElement): number {
	const appContent = findAppContent(wrap);
	if (appContent) {
		return appContent.getBoundingClientRect().bottom;
	}
	return findVerticalScrollParent(wrap).getBoundingClientRect().bottom;
}

/** Size the scroll wrap to fill the remaining viewport below the toolbar. */
export function bindFillRemainingHeight(wrap: HTMLElement): () => void {
	const appContent = findAppContent(wrap);
	const scrollListenTarget = appContent ?? findVerticalScrollParent(wrap);
	let raf = 0;
	let last = '';

	const update = () => {
		raf = 0;
		const wrapTop = wrap.getBoundingClientRect().top;
		const reserve = belowReserve(wrap);
		const next = `${remainingScrollportHeight(wrapTop, scrollportBottom(wrap), reserve)}px`;
		if (next === last) return;
		last = next;
		wrap.style.maxHeight = next;
	};

	const schedule = () => {
		if (raf) return;
		raf = requestAnimationFrame(update);
	};

	scrollListenTarget.addEventListener('scroll', schedule, { passive: true });
	window.addEventListener('resize', schedule);
	const observer = new ResizeObserver(schedule);
	observer.observe(scrollListenTarget);
	if (wrap.parentElement) observer.observe(wrap.parentElement);

	update();

	return () => {
		scrollListenTarget.removeEventListener('scroll', schedule);
		window.removeEventListener('resize', schedule);
		observer.disconnect();
		if (raf) cancelAnimationFrame(raf);
		wrap.style.maxHeight = '';
	};
}

/** Cumulative `top` offsets for each thead row (multi-row grouped headers). */
export function measureTheadRowOffsets(thead: HTMLElement): number[] {
	const rows = Array.from(thead.querySelectorAll('tr'));
	const offsets: number[] = [];
	let cumulative = 0;
	for (const row of rows) {
		offsets.push(cumulative);
		cumulative += row.getBoundingClientRect().height;
	}
	return offsets;
}

/** Keep multi-row sticky header `top` values in sync when thead height changes. */
export function bindTheadRowStickyOffsets(
	thead: HTMLElement,
	onChange: (offsets: number[]) => void
): () => void {
	let raf = 0;
	const update = () => {
		raf = 0;
		onChange(measureTheadRowOffsets(thead));
	};
	const schedule = () => {
		if (raf) return;
		raf = requestAnimationFrame(update);
	};

	const observer = new ResizeObserver(schedule);
	observer.observe(thead);
	for (const row of thead.querySelectorAll('tr')) {
		observer.observe(row);
	}
	update();

	return () => {
		observer.disconnect();
		if (raf) cancelAnimationFrame(raf);
	};
}
