<script lang="ts">
	import type { Snippet } from 'svelte';
	import { onDestroy } from 'svelte';
	import { flip } from 'svelte/animate';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import {
		type KanbanColumn,
		type KanbanItem,
		type KanbanItemMoveDetail
	} from './kanban.constants';
	import {
		kanbanBoardClass,
		kanbanCardBadgesClass,
		kanbanCardClass,
		kanbanCardFieldClass,
		kanbanCardFieldLabelClass,
		kanbanCardFieldsClass,
		kanbanCardSubtitleClass,
		kanbanCardTitleClass,
		kanbanCardTitleRowClass,
		kanbanColumnBodyClass,
		kanbanColumnClass,
		kanbanColumnEmptyClass,
		kanbanColumnHeaderActionsClass,
		kanbanColumnHeaderClass,
		kanbanColumnTitleClass
	} from './kanban.styles';

	type Props = {
		columns: KanbanColumn[];
		items?: KanbanItem[];
		disabled?: boolean;
		onItemsChange?: (items: KanbanItem[]) => void;
		onItemMove?: (detail: KanbanItemMoveDetail) => void;
		onCardClick?: (item: KanbanItem) => void;
		onColumnAction?: (column: KanbanColumn) => void;
		/** Optional custom card body. */
		card?: Snippet<[KanbanItem]>;
		class?: string;
		columnClass?: string;
		cardClass?: string;
	};

	let {
		columns,
		items = $bindable([] as KanbanItem[]),
		disabled = false,
		onItemsChange,
		onItemMove,
		onCardClick,
		onColumnAction,
		card,
		class: className = '',
		columnClass = '',
		cardClass = ''
	}: Props = $props();

	const POINTER_DRAG_THRESHOLD_PX = 6;
	const AUTO_SCROLL_EDGE_PX = 72;
	const AUTO_SCROLL_MAX_SPEED_PX = 28;

	let boardEl: HTMLElement | null = $state(null);
	let draggingItemId = $state<string | null>(null);
	let dropColumnId = $state<string | null>(null);
	let dropIndex = $state<number | null>(null);
	let didDrag = $state(false);

	type PointerDragSession = {
		pointerId: number;
		itemId: string;
		startX: number;
		startY: number;
		active: boolean;
		target: HTMLElement;
	};

	let pointerSession: PointerDragSession | null = null;
	let lastPointerX = 0;
	let lastPointerY = 0;
	let autoScrollRaf: number | null = null;

	const itemsByColumn = $derived.by(() => {
		const map: Record<string, KanbanItem[]> = {};
		for (const column of columns) {
			map[column.id] = [];
		}
		for (const item of items) {
			if (map[item.columnId]) {
				map[item.columnId].push(item);
			}
		}
		return map;
	});

	function canDrag(item: KanbanItem): boolean {
		return !disabled && !item.disabled;
	}

	function clearDragState() {
		draggingItemId = null;
		dropColumnId = null;
		dropIndex = null;
	}

	function edgeScrollSpeed(distanceFromEdge: number): number {
		// Negative = pointer is past the edge — keep scrolling at full speed.
		if (distanceFromEdge >= AUTO_SCROLL_EDGE_PX) return 0;
		if (distanceFromEdge <= 0) return AUTO_SCROLL_MAX_SPEED_PX;
		const t = 1 - distanceFromEdge / AUTO_SCROLL_EDGE_PX;
		return Math.max(1, Math.ceil(t * t * AUTO_SCROLL_MAX_SPEED_PX));
	}

	function canScrollAxis(el: HTMLElement, axis: 'x' | 'y'): boolean {
		if (axis === 'x') return el.scrollWidth > el.clientWidth + 1;
		return el.scrollHeight > el.clientHeight + 1;
	}

	function visibleEdgeRect(el: HTMLElement): {
		left: number;
		right: number;
		top: number;
		bottom: number;
	} {
		const rect = el.getBoundingClientRect();
		return {
			left: Math.max(rect.left, 0),
			right: Math.min(rect.right, window.innerWidth),
			top: Math.max(rect.top, 0),
			bottom: Math.min(rect.bottom, window.innerHeight)
		};
	}

	function scrollElByEdges(
		el: HTMLElement,
		clientX: number,
		clientY: number,
		axes: { x?: boolean; y?: boolean }
	): boolean {
		const box = visibleEdgeRect(el);
		let scrolled = false;

		if (axes.x && canScrollAxis(el, 'x')) {
			const left = edgeScrollSpeed(clientX - box.left);
			const right = edgeScrollSpeed(box.right - clientX);
			if (left > 0) {
				el.scrollLeft -= left;
				scrolled = true;
			} else if (right > 0) {
				el.scrollLeft += right;
				scrolled = true;
			}
		}

		if (axes.y && canScrollAxis(el, 'y')) {
			const top = edgeScrollSpeed(clientY - box.top);
			const bottom = edgeScrollSpeed(box.bottom - clientY);
			if (top > 0) {
				el.scrollTop -= top;
				scrolled = true;
			} else if (bottom > 0) {
				el.scrollTop += bottom;
				scrolled = true;
			}
		}

		return scrolled;
	}

	function resolveColumnBody(clientX: number, clientY: number): HTMLElement | null {
		if (dropColumnId && boardEl) {
			const byId = boardEl.querySelector(`[data-kanban-column-id="${CSS.escape(dropColumnId)}"]`);
			if (byId instanceof HTMLElement) return byId;
		}

		const under = document.elementFromPoint(clientX, clientY);
		if (under instanceof Element) {
			const closest = under.closest('[data-kanban-column-id]');
			if (closest instanceof HTMLElement) return closest;
		}

		return null;
	}

	function findAncestorScrollers(from: HTMLElement | null): HTMLElement[] {
		const found: HTMLElement[] = [];
		let node: HTMLElement | null = from;
		while (node && node !== document.documentElement) {
			if (node !== boardEl) {
				const style = getComputedStyle(node);
				const ox = style.overflowX;
				const oy = style.overflowY;
				const scrollsX = /(auto|scroll|overlay)/.test(ox) && canScrollAxis(node, 'x');
				const scrollsY = /(auto|scroll|overlay)/.test(oy) && canScrollAxis(node, 'y');
				if ((scrollsX || scrollsY) && !found.includes(node)) {
					found.push(node);
				}
			}
			node = node.parentElement;
		}
		return found;
	}

	function setBoardSnapEnabled(enabled: boolean) {
		if (!boardEl) return;
		boardEl.style.scrollSnapType = enabled ? '' : 'none';
	}

	function autoScrollContainers(clientX: number, clientY: number): void {
		const columnBody = resolveColumnBody(clientX, clientY);

		// Board: horizontal (mobile columns off-screen).
		if (boardEl) {
			scrollElByEdges(boardEl, clientX, clientY, { x: true });
		}

		// Active column body: vertical card list.
		if (columnBody) {
			scrollElByEdges(columnBody, clientX, clientY, { y: true });
		}

		// App shell / page scrollers around the board.
		for (const el of findAncestorScrollers(boardEl)) {
			const style = getComputedStyle(el);
			scrollElByEdges(el, clientX, clientY, {
				x: /(auto|scroll|overlay)/.test(style.overflowX),
				y: /(auto|scroll|overlay)/.test(style.overflowY)
			});
		}
	}

	function stopAutoScroll() {
		if (autoScrollRaf == null) return;
		cancelAnimationFrame(autoScrollRaf);
		autoScrollRaf = null;
	}

	function tickAutoScroll() {
		autoScrollRaf = null;
		if (!pointerSession?.active) return;

		autoScrollContainers(lastPointerX, lastPointerY);
		updatePointerDropTarget(lastPointerX, lastPointerY);
		autoScrollRaf = requestAnimationFrame(tickAutoScroll);
	}

	function startAutoScroll() {
		if (autoScrollRaf != null) return;
		setBoardSnapEnabled(false);
		autoScrollRaf = requestAnimationFrame(tickAutoScroll);
	}

	function updateDropTarget(columnId: string, index: number) {
		dropColumnId = columnId;
		dropIndex = index;
	}

	function insertIndexFromClientY(
		clientY: number,
		columnId: string,
		overItemId: string,
		overElement: Element
	): number {
		const columnItems = itemsByColumn[columnId] ?? [];
		const overIndex = columnItems.findIndex((item) => item.id === overItemId);
		if (overIndex < 0) {
			return columnItems.length;
		}

		const rect = overElement.getBoundingClientRect();
		const midY = rect.top + rect.height / 2;
		return clientY < midY ? overIndex : overIndex + 1;
	}

	function moveItem(itemId: string, toColumnId: string, rawToIndex: number) {
		const moving = items.find((item) => item.id === itemId);
		if (!moving) return;

		const fromColumnId = moving.columnId;
		const fromColumnItems = items.filter((item) => item.columnId === fromColumnId);
		const fromIndexInColumn = fromColumnItems.findIndex((item) => item.id === itemId);

		const byColumn: Record<string, KanbanItem[]> = {};
		for (const column of columns) {
			byColumn[column.id] = [];
		}

		const orphans: KanbanItem[] = [];
		for (const item of items) {
			if (item.id === itemId) continue;
			if (byColumn[item.columnId]) {
				byColumn[item.columnId].push(item);
			} else {
				orphans.push(item);
			}
		}

		let insertAt = Math.max(0, rawToIndex);
		if (fromColumnId === toColumnId && fromIndexInColumn >= 0 && fromIndexInColumn < insertAt) {
			insertAt -= 1;
		}

		const targetList = byColumn[toColumnId] ?? [];
		insertAt = Math.max(0, Math.min(insertAt, targetList.length));

		if (fromColumnId === toColumnId && fromIndexInColumn === insertAt) {
			clearDragState();
			return;
		}

		targetList.splice(insertAt, 0, { ...moving, columnId: toColumnId });
		byColumn[toColumnId] = targetList;

		const next: KanbanItem[] = [];
		for (const column of columns) {
			next.push(...(byColumn[column.id] ?? []));
		}
		next.push(...orphans);

		items = next;
		onItemsChange?.(next);
		onItemMove?.({
			itemId,
			fromColumnId,
			toColumnId,
			toIndex: insertAt
		});
		clearDragState();
	}

	function handleCardClick(item: KanbanItem) {
		if (didDrag) return;
		onCardClick?.(item);
	}

	function handleCardKeydown(event: KeyboardEvent, item: KanbanItem) {
		if (event.key !== 'Enter' && event.key !== ' ') return;
		event.preventDefault();
		handleCardClick(item);
	}

	function updatePointerDropTarget(clientX: number, clientY: number) {
		const under = document.elementFromPoint(clientX, clientY);
		if (!(under instanceof Element)) return;

		const columnEl = under.closest('[data-kanban-column-id]');
		if (!(columnEl instanceof HTMLElement)) return;

		const columnId = columnEl.dataset.kanbanColumnId;
		if (!columnId) return;

		const cardEl = under.closest('[data-kanban-item-id]');
		if (cardEl instanceof HTMLElement) {
			const overItemId = cardEl.dataset.kanbanItemId;
			if (overItemId && overItemId !== draggingItemId) {
				updateDropTarget(columnId, insertIndexFromClientY(clientY, columnId, overItemId, cardEl));
				return;
			}
		}

		updateDropTarget(columnId, (itemsByColumn[columnId] ?? []).length);
	}

	function detachWindowListeners() {
		window.removeEventListener('pointermove', handleWindowPointerMove);
		window.removeEventListener('pointerup', handleWindowPointerUp);
		window.removeEventListener('pointercancel', handleWindowPointerCancel);
	}

	function attachWindowListeners() {
		window.addEventListener('pointermove', handleWindowPointerMove, { passive: false });
		window.addEventListener('pointerup', handleWindowPointerUp);
		window.addEventListener('pointercancel', handleWindowPointerCancel);
	}

	function clearTextSelection() {
		window.getSelection()?.removeAllRanges();
	}

	function handlePointerDown(event: PointerEvent, item: KanbanItem) {
		if (!canDrag(item)) return;
		if (event.button !== 0 && event.pointerType === 'mouse') return;
		if (!(event.currentTarget instanceof HTMLElement)) return;

		clearTextSelection();
		lastPointerX = event.clientX;
		lastPointerY = event.clientY;
		pointerSession = {
			pointerId: event.pointerId,
			itemId: item.id,
			startX: event.clientX,
			startY: event.clientY,
			active: false,
			target: event.currentTarget
		};
		attachWindowListeners();
	}

	function handleWindowPointerMove(event: PointerEvent) {
		if (!pointerSession || event.pointerId !== pointerSession.pointerId) return;

		lastPointerX = event.clientX;
		lastPointerY = event.clientY;

		const dx = event.clientX - pointerSession.startX;
		const dy = event.clientY - pointerSession.startY;

		if (!pointerSession.active) {
			if (Math.hypot(dx, dy) < POINTER_DRAG_THRESHOLD_PX) return;
			pointerSession.active = true;
			didDrag = true;
			draggingItemId = pointerSession.itemId;
			dropColumnId = items.find((entry) => entry.id === pointerSession!.itemId)?.columnId ?? null;
			dropIndex = null;
			clearTextSelection();
			try {
				pointerSession.target.setPointerCapture(event.pointerId);
			} catch {
				/* capture may fail if the element is gone */
			}
			startAutoScroll();
		}

		event.preventDefault();
		updatePointerDropTarget(event.clientX, event.clientY);
	}

	function endPointerDrag(event: PointerEvent, commit: boolean) {
		if (!pointerSession || event.pointerId !== pointerSession.pointerId) return;

		const session = pointerSession;
		pointerSession = null;
		detachWindowListeners();
		stopAutoScroll();
		setBoardSnapEnabled(true);

		if (session.target.hasPointerCapture(event.pointerId)) {
			try {
				session.target.releasePointerCapture(event.pointerId);
			} catch {
				/* ignore */
			}
		}

		if (commit && session.active && dropColumnId !== null) {
			const targetIndex =
				dropIndex !== null ? dropIndex : (itemsByColumn[dropColumnId] ?? []).length;
			moveItem(session.itemId, dropColumnId, targetIndex);
		} else {
			clearDragState();
		}

		queueMicrotask(() => {
			didDrag = false;
		});
	}

	function handleWindowPointerUp(event: PointerEvent) {
		endPointerDrag(event, true);
	}

	function handleWindowPointerCancel(event: PointerEvent) {
		endPointerDrag(event, false);
	}

	onDestroy(() => {
		detachWindowListeners();
		stopAutoScroll();
		setBoardSnapEnabled(true);
	});
</script>

<div
	bind:this={boardEl}
	class={kanbanBoardClass(className, draggingItemId !== null)}
	role="region"
	aria-label="Kanban board"
	data-kanban-board
>
	{#each columns as column (column.id)}
		{@const columnItems = itemsByColumn[column.id] ?? []}
		{@const isColumnDropTarget = dropColumnId === column.id && draggingItemId !== null}

		<section class={kanbanColumnClass(columnClass)} aria-labelledby={`kanban-col-${column.id}`}>
			<header class={kanbanColumnHeaderClass()}>
				<div class="flex min-w-0 items-center gap-2">
					<h3 id={`kanban-col-${column.id}`} class={kanbanColumnTitleClass}>
						{column.title}
					</h3>
					<Badge variant="secondary" label={String(columnItems.length)} />
				</div>

				{#if column.actionLabel}
					<div class={kanbanColumnHeaderActionsClass}>
						<Button
							variant="outline"
							size="sm"
							label={column.actionLabel}
							onclick={() => onColumnAction?.(column)}
						/>
					</div>
				{/if}
			</header>

			<div
				class={kanbanColumnBodyClass(isColumnDropTarget)}
				role="list"
				aria-label={`${column.title} cards`}
				data-kanban-column-id={column.id}
			>
				{#if columnItems.length === 0}
					<div class={kanbanColumnEmptyClass}>No items</div>
				{:else}
					{#each columnItems as item, index (item.id)}
						<div role="listitem" animate:flip={{ duration: 120 }}>
							<div
								role="button"
								tabindex="0"
								class={kanbanCardClass({
									isDragging: draggingItemId === item.id,
									isDropIndicator:
										dropColumnId === column.id && dropIndex === index && draggingItemId !== item.id,
									disabled: !canDrag(item),
									className: cardClass
								})}
								style:touch-action={canDrag(item) ? 'none' : undefined}
								style:pointer-events={draggingItemId === item.id ? 'none' : undefined}
								data-kanban-item-id={item.id}
								aria-roledescription="draggable card"
								aria-grabbed={draggingItemId === item.id ? 'true' : 'false'}
								aria-disabled={!canDrag(item) ? 'true' : undefined}
								onpointerdown={(event) => handlePointerDown(event, item)}
								onclick={() => handleCardClick(item)}
								onkeydown={(event) => handleCardKeydown(event, item)}
							>
								{#if card}
									{@render card(item)}
								{:else}
									<div class={kanbanCardTitleRowClass}>
										<div class="min-w-0 flex-1">
											<p class={kanbanCardTitleClass}>{item.title}</p>
											{#if item.subtitle}
												<p class={kanbanCardSubtitleClass}>{item.subtitle}</p>
											{/if}
										</div>
										{#if item.badge || item.metaBadge}
											<div class={kanbanCardBadgesClass}>
												{#if item.badge}
													<Badge variant="secondary" label={item.badge} />
												{/if}
												{#if item.metaBadge}
													<Badge variant="outline" label={item.metaBadge} />
												{/if}
											</div>
										{/if}
									</div>

									{#if item.fields?.length}
										<div class={kanbanCardFieldsClass}>
											{#each item.fields as field (`${field.label}:${field.value}`)}
												<p class={kanbanCardFieldClass}>
													<span class={kanbanCardFieldLabelClass}>{field.label}</span> : {field.value}
												</p>
											{/each}
										</div>
									{/if}
								{/if}
							</div>
						</div>
					{/each}
				{/if}
			</div>
		</section>
	{/each}
</div>
