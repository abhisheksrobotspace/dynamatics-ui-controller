<script lang="ts">
	import { ChevronLeft, ChevronRight, Maximize2, Square, X, ZoomIn, ZoomOut } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import HmiFlatButton from '../hmi/hmi-flat-button.svelte';
	import { EmptyState } from '$lib/components/ui/empty-state';
	import type { ImageFrameProps } from './image-viewer.types';
	import {
		PAN_STEP_PX,
		clampPan,
		clampZoom,
		isFlick,
		nextZoom,
		panAfterZoom,
		zoomFromWheel
	} from './image-viewer.utils';
	import {
		imageViewerControlsClass,
		imageViewerCounterClass,
		imageViewerHmiLabelClass,
		imageViewerHmiReadoutClass,
		imageViewerHmiStageClass,
		imageViewerImageClass,
		imageViewerLabelClass,
		imageViewerRootClass,
		imageViewerStageClass,
		imageViewerToolbarClass,
		imageViewerZoomLabelClass
	} from './image-viewer.styles';

	type Point = { x: number; y: number };

	let {
		item,
		index,
		count,
		onPrevious,
		onNext,
		onError,
		onClose,
		variant = 'default',
		class: className = ''
	}: ImageFrameProps = $props();

	let zoom = $state(1);
	let panX = $state(0);
	let panY = $state(0);
	let failed = $state(false);
	let naturalWidth = $state(0);
	let fittedWidth = $state(0);
	let fittedHeight = $state(0);
	let viewportWidth = $state(0);
	let viewportHeight = $state(0);

	const zoomLabel = $derived(`${Math.round(zoom * 100)}%`);

	let pointers: Record<number, Point> = {};
	let drag: { x: number; y: number; panX: number; panY: number } | null = null;
	let dragStartedAt = 0;
	let pinch: { distance: number; zoom: number } | null = null;

	function limitedPan(x: number, y: number, atZoom = zoom): Point {
		return {
			x: clampPan(x, fittedWidth * atZoom, viewportWidth),
			y: clampPan(y, fittedHeight * atZoom, viewportHeight)
		};
	}

	function applyZoom(next: number, offsetX = 0, offsetY = 0): void {
		const clamped = clampZoom(next);
		const nextPan = limitedPan(
			panAfterZoom(panX, offsetX, zoom, clamped),
			panAfterZoom(panY, offsetY, zoom, clamped),
			clamped
		);
		panX = nextPan.x;
		panY = nextPan.y;
		zoom = clamped;
	}

	function fit(): void {
		applyZoom(1);
	}

	function actualSize(): void {
		if (fittedWidth <= 0 || naturalWidth <= 0) return;
		applyZoom(naturalWidth / fittedWidth);
	}

	function zoomBy(direction: 1 | -1): void {
		applyZoom(nextZoom(zoom, direction));
	}

	function nudge(dx: number, dy: number): void {
		const nextPan = limitedPan(panX + dx, panY + dy);
		panX = nextPan.x;
		panY = nextPan.y;
	}

	function onImageError(): void {
		failed = true;
		onError?.(item);
	}

	function stageOffset(node: HTMLElement, clientX: number, clientY: number): Point {
		const rect = node.getBoundingClientRect();
		return {
			x: clientX - (rect.left + rect.width / 2),
			y: clientY - (rect.top + rect.height / 2)
		};
	}

	function pointerDistance(): number {
		const points = Object.values(pointers);
		const first = points[0];
		const second = points[1];
		if (!first || !second) return 0;
		return Math.hypot(first.x - second.x, first.y - second.y);
	}

	function wheelZoom(node: HTMLElement) {
		function onWheel(event: WheelEvent): void {
			event.preventDefault();
			const offset = stageOffset(node, event.clientX, event.clientY);
			applyZoom(zoomFromWheel(zoom, event.deltaY, event.deltaMode), offset.x, offset.y);
		}
		node.addEventListener('wheel', onWheel, { passive: false });
		return () => node.removeEventListener('wheel', onWheel);
	}

	function onPointerDown(event: PointerEvent): void {
		const node = event.currentTarget;
		if (node instanceof HTMLElement) node.setPointerCapture(event.pointerId);
		pointers[event.pointerId] = { x: event.clientX, y: event.clientY };
		if (Object.keys(pointers).length >= 2) {
			pinch = { distance: pointerDistance(), zoom };
			drag = null;
			return;
		}
		drag = { x: event.clientX, y: event.clientY, panX, panY };
		dragStartedAt = performance.now();
	}

	function onPointerMove(event: PointerEvent): void {
		if (!(event.pointerId in pointers)) return;
		pointers[event.pointerId] = { x: event.clientX, y: event.clientY };
		if (Object.keys(pointers).length >= 2 && pinch && pinch.distance > 0) {
			const node = event.currentTarget;
			const midpoint = pointerMidpoint();
			const offset =
				node instanceof HTMLElement && midpoint
					? stageOffset(node, midpoint.x, midpoint.y)
					: { x: 0, y: 0 };
			applyZoom(pinch.zoom * (pointerDistance() / pinch.distance), offset.x, offset.y);
			return;
		}
		if (!drag) return;
		const dx = event.clientX - drag.x;
		const dy = event.clientY - drag.y;
		if (zoom <= 1) {
			if (Math.abs(dx) > Math.abs(dy)) {
				panX = clampPan(dx, fittedWidth, viewportWidth);
				panY = 0;
			}
			return;
		}
		const nextPan = limitedPan(drag.panX + dx, drag.panY + dy);
		panX = nextPan.x;
		panY = nextPan.y;
	}

	function endPointer(event: PointerEvent, allowFlick: boolean): void {
		if (!(event.pointerId in pointers)) return;
		const start = drag;
		const startedAt = dragStartedAt;
		delete pointers[event.pointerId];
		const remaining = Object.keys(pointers).length;
		if (remaining < 2) pinch = null;
		if (remaining === 1) {
			const point = Object.values(pointers)[0];
			if (point) {
				drag = { x: point.x, y: point.y, panX, panY };
				dragStartedAt = performance.now();
			}
			return;
		}
		if (remaining === 0 && zoom <= 1) {
			const dx = start ? event.clientX - start.x : 0;
			const dy = start ? event.clientY - start.y : 0;
			panX = 0;
			panY = 0;
			if (
				allowFlick &&
				start &&
				Math.abs(dx) > Math.abs(dy) &&
				isFlick(dx, performance.now() - startedAt)
			) {
				if (dx < 0) onNext?.();
				else onPrevious?.();
			}
		}
		if (remaining === 0) drag = null;
	}

	function onPointerUp(event: PointerEvent): void {
		endPointer(event, true);
	}

	function onLostPointerCapture(event: PointerEvent): void {
		endPointer(event, false);
	}

	function pointerMidpoint(): Point | null {
		const points = Object.values(pointers);
		const first = points[0];
		const second = points[1];
		if (!first || !second) return null;
		return { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
	}

	function onDoubleClick(event: MouseEvent): void {
		const node = event.currentTarget;
		if (!(node instanceof HTMLElement) || zoom > 1) {
			fit();
			return;
		}
		const offset = stageOffset(node, event.clientX, event.clientY);
		applyZoom(2, offset.x, offset.y);
	}

	function onKeydown(event: KeyboardEvent): void {
		if (event.key === 'ArrowLeft') {
			event.preventDefault();
			if (zoom > 1) nudge(PAN_STEP_PX, 0);
			else onPrevious?.();
		} else if (event.key === 'ArrowRight') {
			event.preventDefault();
			if (zoom > 1) nudge(-PAN_STEP_PX, 0);
			else onNext?.();
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			if (zoom > 1) nudge(0, PAN_STEP_PX);
		} else if (event.key === 'ArrowDown') {
			event.preventDefault();
			if (zoom > 1) nudge(0, -PAN_STEP_PX);
		} else if (event.key === '+' || event.key === '=') {
			event.preventDefault();
			zoomBy(1);
		} else if (event.key === '-' || event.key === '_') {
			event.preventDefault();
			zoomBy(-1);
		} else if (event.key === '0') {
			event.preventDefault();
			fit();
		} else if (event.key === '1') {
			event.preventDefault();
			actualSize();
		}
	}

	const hmi = $derived(variant === 'hmi');

	type Control = {
		label: string;
		icon?: typeof ChevronLeft;
		disabled?: boolean;
		onclick?: () => void;
		/** Text between buttons (counter, zoom level). */
		readout?: string;
		readoutClass?: string;
	};

	const controls = $derived<Control[]>([
		{
			label: 'Previous image',
			icon: ChevronLeft,
			disabled: count <= 1,
			onclick: () => onPrevious?.()
		},
		{ label: 'counter', readout: `${index + 1} / ${count}`, readoutClass: imageViewerCounterClass },
		{ label: 'Next image', icon: ChevronRight, disabled: count <= 1, onclick: () => onNext?.() },
		{ label: 'Zoom out', icon: ZoomOut, disabled: zoom <= 1, onclick: () => zoomBy(-1) },
		{ label: 'zoom', readout: zoomLabel, readoutClass: imageViewerZoomLabelClass },
		{ label: 'Zoom in', icon: ZoomIn, onclick: () => zoomBy(1) },
		{ label: 'Fit', icon: Maximize2, onclick: fit },
		{ label: 'Actual size', icon: Square, onclick: actualSize }
	]);
</script>

<!-- Arrow keys, zoom keys, and pointer gestures. This is a viewer, not a button. -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
	class={imageViewerRootClass(className)}
	role="region"
	aria-label="Image viewer"
	tabindex="0"
	onkeydown={onKeydown}
>
	<div class={imageViewerToolbarClass}>
		<p class={hmi ? imageViewerHmiLabelClass : imageViewerLabelClass}>
			{item.label || item.alt || ''}
		</p>
		<div class={imageViewerControlsClass}>
			{#each controls as control (control.label)}
				{#if control.readout != null}
					<span class={hmi ? imageViewerHmiReadoutClass : control.readoutClass}
						>{control.readout}</span
					>
				{:else if hmi}
					<HmiFlatButton
						icon={control.icon}
						size="xs"
						class="w-14"
						iconClass="size-7"
						disabled={control.disabled}
						aria-label={control.label}
						onclick={control.onclick}
					/>
				{:else}
					<Button
						variant="outline"
						size="icon"
						icon={control.icon}
						disabled={control.disabled}
						aria-label={control.label}
						onclick={control.onclick}
					/>
				{/if}
			{/each}
			{#if onClose}
				{#if hmi}
					<HmiFlatButton
						icon={X}
						size="xs"
						class="ml-2 w-[72px]"
						iconClass="size-8"
						aria-label="Close"
						onclick={onClose}
					/>
				{:else}
					<Button variant="outline" size="icon" icon={X} aria-label="Close" onclick={onClose} />
				{/if}
			{/if}
		</div>
	</div>
	<div
		class={hmi ? imageViewerHmiStageClass : imageViewerStageClass}
		role="presentation"
		bind:clientWidth={viewportWidth}
		bind:clientHeight={viewportHeight}
		{@attach wheelZoom}
		onpointerdown={onPointerDown}
		onpointermove={onPointerMove}
		onpointerup={onPointerUp}
		onpointercancel={onPointerUp}
		onlostpointercapture={onLostPointerCapture}
		ondblclick={onDoubleClick}
	>
		{#if failed}
			<EmptyState title="Image not available" />
		{:else}
			<img
				src={item.src}
				alt={item.alt ?? item.label ?? ''}
				draggable="false"
				bind:naturalWidth
				bind:offsetWidth={fittedWidth}
				bind:offsetHeight={fittedHeight}
				class={imageViewerImageClass}
				style:transform={`translate(${panX}px, ${panY}px) scale(${zoom})`}
				style:transform-origin="center center"
				onerror={onImageError}
			/>
		{/if}
	</div>
</div>
