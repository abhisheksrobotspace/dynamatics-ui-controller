<script lang="ts">
	import { onMount } from 'svelte';
	import { Alert, Button, EmptyState } from '@ifactory/ui-v2';
	import { Building2, ChevronLeft, ChevronRight, FileImage, ZoomIn, ZoomOut } from '@lucide/svelte';
	import PageSkeleton from '../components/PageSkeleton.svelte';
	import { formatApiErrorMessage } from '../../lib/api/types.js';
	import { fileDownloadUrl } from '../lib/core-api.js';
	import { getContractorById } from '../lib/projects/contractors.api.js';
	import { upsertContractorBreadcrumb } from '../lib/projects/load-contractor.js';
	import type { Contractor } from '../lib/projects/types.js';

	const MIN_ZOOM = 1;
	const MAX_ZOOM = 4;
	const ZOOM_STEP = 0.5;
	const CLICK_MOVE_THRESHOLD_PX = 6;

	let { params } = $props();
	const contractorId = $derived(params.contractorId);

	let contractor = $state<Contractor | null>(null);
	let isLoading = $state(true);
	let loadError = $state('');
	let activeIndex = $state(0);
	let zoom = $state(MIN_ZOOM);
	let panX = $state(0);
	let panY = $state(0);
	let isPanning = $state(false);
	let pointerActive = false;
	let didDrag = $state(false);
	let panOriginX = 0;
	let panOriginY = 0;
	let panStartX = 0;
	let panStartY = 0;
	let viewerEl = $state<HTMLDivElement | null>(null);

	const sampleIds = $derived(contractor?.sampleMarkingsFileIds ?? []);
	const sampleCount = $derived(sampleIds.length);
	const activeFileId = $derived(sampleIds[activeIndex] ?? null);
	const hasMultiple = $derived(sampleCount > 1);
	const zoomPercent = $derived(Math.round(zoom * 100));
	const canZoomIn = $derived(zoom < MAX_ZOOM);
	const canZoomOut = $derived(zoom > MIN_ZOOM);

	function errorMessage(error: unknown): string {
		if (error instanceof DOMException && error.name === 'AbortError') return '';
		return formatApiErrorMessage(error);
	}

	function clampZoom(value: number): number {
		const stepped = Math.round(value / ZOOM_STEP) * ZOOM_STEP;
		return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number(stepped.toFixed(2))));
	}

	function resetView() {
		zoom = MIN_ZOOM;
		panX = 0;
		panY = 0;
		isPanning = false;
		pointerActive = false;
		didDrag = false;
	}

	function setZoomAtPoint(next: number, clientX?: number, clientY?: number) {
		const previous = zoom;
		const clamped = clampZoom(next);
		if (clamped === previous) {
			if (clamped === MIN_ZOOM) {
				panX = 0;
				panY = 0;
			}
			return;
		}

		if (clamped === MIN_ZOOM || !viewerEl || clientX === undefined || clientY === undefined) {
			zoom = clamped;
			if (clamped === MIN_ZOOM) {
				panX = 0;
				panY = 0;
			}
			return;
		}

		const rect = viewerEl.getBoundingClientRect();
		const offsetX = clientX - rect.left - rect.width / 2;
		const offsetY = clientY - rect.top - rect.height / 2;
		const ratio = clamped / previous;
		panX = offsetX - (offsetX - panX) * ratio;
		panY = offsetY - (offsetY - panY) * ratio;
		zoom = clamped;
	}

	function zoomIn(clientX?: number, clientY?: number) {
		setZoomAtPoint(zoom + ZOOM_STEP, clientX, clientY);
	}

	function zoomOut(clientX?: number, clientY?: number) {
		setZoomAtPoint(zoom - ZOOM_STEP, clientX, clientY);
	}

	function selectSample(index: number) {
		if (index < 0 || index >= sampleCount) return;
		activeIndex = index;
		resetView();
	}

	function showPrevious() {
		if (!hasMultiple) return;
		activeIndex = (activeIndex - 1 + sampleCount) % sampleCount;
		resetView();
	}

	function showNext() {
		if (!hasMultiple) return;
		activeIndex = (activeIndex + 1) % sampleCount;
		resetView();
	}

	function handleKeydown(event: KeyboardEvent) {
		if (isLoading || !contractor || sampleCount === 0) return;
		if (event.key === 'ArrowLeft') {
			event.preventDefault();
			showPrevious();
		} else if (event.key === 'ArrowRight') {
			event.preventDefault();
			showNext();
		} else if (event.key === '+' || event.key === '=') {
			event.preventDefault();
			zoomIn();
		} else if (event.key === '-') {
			event.preventDefault();
			zoomOut();
		} else if (event.key === '0') {
			event.preventDefault();
			resetView();
		}
	}

	function handleViewerWheel(event: WheelEvent) {
		event.preventDefault();
		const direction = event.deltaY < 0 ? 1 : -1;
		setZoomAtPoint(zoom + direction * ZOOM_STEP, event.clientX, event.clientY);
	}

	function handlePointerDown(event: PointerEvent) {
		if (event.button !== 0) return;
		pointerActive = true;
		didDrag = false;
		isPanning = zoom > MIN_ZOOM;
		panOriginX = event.clientX;
		panOriginY = event.clientY;
		panStartX = panX;
		panStartY = panY;
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
	}

	function handlePointerMove(event: PointerEvent) {
		if (!pointerActive) return;
		const dx = event.clientX - panOriginX;
		const dy = event.clientY - panOriginY;
		if (!didDrag && Math.hypot(dx, dy) >= CLICK_MOVE_THRESHOLD_PX) {
			didDrag = true;
		}
		if (!isPanning || !didDrag) return;
		panX = panStartX + dx;
		panY = panStartY + dy;
	}

	function handlePointerUp(event: PointerEvent) {
		if (!pointerActive) return;
		pointerActive = false;
		isPanning = false;
		try {
			(event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
		} catch {
			// Pointer may already be released.
		}

		if (didDrag) return;

		if (zoom >= MAX_ZOOM) {
			resetView();
			return;
		}
		zoomIn(event.clientX, event.clientY);
	}

	onMount(() => {
		const controller = new AbortController();

		void (async () => {
			isLoading = true;
			loadError = '';
			activeIndex = 0;
			resetView();
			try {
				const loaded = await getContractorById(contractorId, controller.signal);
				contractor = loaded;
				if (loaded) upsertContractorBreadcrumb(loaded);
			} catch (error) {
				const message = errorMessage(error);
				if (message) loadError = message;
			} finally {
				isLoading = false;
			}
		})();

		return () => {
			controller.abort();
		};
	});
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="flex h-full min-h-0 flex-col gap-4 overflow-auto p-3 md:p-4">
	{#if isLoading}
		<PageSkeleton variant="form" fieldCount={1} />
	{:else if loadError}
		<Alert variant="error" title="Could not load contractor" description={loadError} />
	{:else if !contractor}
		<p class="text-gray-500">Contractor not found.</p>
	{:else}
		<div
			class="flex flex-wrap items-center justify-between gap-3 border border-border bg-white px-4 py-3"
		>
			<div class="min-w-0">
				<div class="flex items-center gap-2 text-xs text-muted-foreground">
					<Building2 class="size-3.5 shrink-0" aria-hidden="true" />
					<span>Contractor</span>
				</div>
				<p class="mt-1 truncate font-heading text-base font-semibold text-foreground">
					{contractor.name}
				</p>
			</div>
			{#if sampleCount > 0}
				<p class="text-sm text-muted-foreground">
					{sampleCount}
					{sampleCount === 1 ? 'sample' : 'samples'}
				</p>
			{/if}
		</div>

		{#if sampleCount === 0}
			<EmptyState
				icon={FileImage}
				title="No sample markings yet"
				class="border border-border bg-white py-8"
			/>
		{:else if activeFileId}
			<div class="flex min-h-0 flex-1 flex-col gap-3 border border-border bg-white p-4 md:p-6">
				<div class="flex flex-wrap items-center justify-between gap-2">
					<p class="text-sm font-medium text-foreground">Sample markings</p>
					<div class="flex flex-wrap items-center gap-2">
						<div class="flex items-center gap-1">
							<Button
								variant="outline"
								size="icon"
								icon={ZoomOut}
								class="size-8"
								disabled={!canZoomOut}
								aria-label="Zoom out"
								onclick={() => zoomOut()}
							/>
							<button
								type="button"
								class="min-w-12 px-1 text-center text-xs text-muted-foreground hover:text-foreground"
								aria-label="Reset zoom"
								onclick={resetView}
							>
								{zoomPercent}%
							</button>
							<Button
								variant="outline"
								size="icon"
								icon={ZoomIn}
								class="size-8"
								disabled={!canZoomIn}
								aria-label="Zoom in"
								onclick={() => zoomIn()}
							/>
						</div>
						{#if hasMultiple}
							<div class="flex items-center gap-2">
								<Button
									variant="outline"
									size="icon"
									icon={ChevronLeft}
									class="size-8"
									aria-label="Previous sample marking"
									onclick={showPrevious}
								/>
								<span class="min-w-14 text-center text-xs text-muted-foreground">
									{activeIndex + 1} / {sampleCount}
								</span>
								<Button
									variant="outline"
									size="icon"
									icon={ChevronRight}
									class="size-8"
									aria-label="Next sample marking"
									onclick={showNext}
								/>
							</div>
						{/if}
					</div>
				</div>

				<div
					bind:this={viewerEl}
					class={[
						'relative min-h-[min(60vh,32rem)] w-full overflow-hidden border border-border bg-slate-50',
						zoom >= MAX_ZOOM
							? isPanning && didDrag
								? 'cursor-grabbing'
								: 'cursor-zoom-out'
							: zoom > MIN_ZOOM
								? isPanning && didDrag
									? 'cursor-grabbing'
									: 'cursor-grab'
								: 'cursor-zoom-in'
					]}
					role="region"
					aria-label="Sample marking viewer"
					onwheel={handleViewerWheel}
					onpointerdown={handlePointerDown}
					onpointermove={handlePointerMove}
					onpointerup={handlePointerUp}
					onpointercancel={handlePointerUp}
				>
					<img
						src={fileDownloadUrl(activeFileId)}
						alt="Sample marking {activeIndex + 1} of {sampleCount} for {contractor.name}"
						class="pointer-events-none absolute top-1/2 left-1/2 max-h-[min(60vh,32rem)] max-w-full object-contain select-none"
						draggable="false"
						style:transform="translate(calc(-50% + {panX}px), calc(-50% + {panY}px)) scale({zoom})"
						style:transform-origin="center center"
					/>
				</div>

				{#if hasMultiple}
					<div class="flex flex-wrap justify-center gap-2">
						{#each sampleIds as fileId, index (fileId)}
							<button
								type="button"
								class={[
									'border bg-slate-50 p-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
									index === activeIndex
										? 'border-foreground'
										: 'border-border hover:border-foreground/40'
								]}
								aria-label="Show sample marking {index + 1}"
								aria-current={index === activeIndex ? 'true' : undefined}
								onclick={() => selectSample(index)}
							>
								<img src={fileDownloadUrl(fileId)} alt="" class="h-14 w-20 object-contain" />
							</button>
						{/each}
					</div>
				{/if}

				<!-- <p class="text-center text-xs text-muted-foreground">
					Click or scroll to zoom · drag to pan when zoomed · click again at max to reset{#if hasMultiple}
						· arrow keys to switch samples{/if}
				</p> -->
			</div>
		{/if}
	{/if}
</div>
