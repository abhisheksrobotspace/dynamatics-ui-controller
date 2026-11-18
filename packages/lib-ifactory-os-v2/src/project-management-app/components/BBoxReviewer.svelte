<script lang="ts">
	import { EmptyState, Tabs } from '@ifactory/ui-v2';
	import { Loader2 } from '@lucide/svelte';
	import { SvelteMap } from 'svelte/reactivity';

	type ReviewBox = {
		x1: number;
		y1: number;
		x2: number;
		y2: number;
		class_id?: string;
	};

	type ReviewCrop = {
		id: number;
		title: string;
		image: string;
		boxes: ReviewBox[];
	};

	type ReviewClass = {
		id: string;
		label: string;
		color: string;
		activeColor: string;
	};

	type CropViewControls = {
		bumpZoom: (delta: number) => void;
		fit: () => void;
		getZoom: () => number;
	};

	type Props = {
		fullPageImageUrl?: string;
		crops?: ReviewCrop[];
		classes?: ReviewClass[];
		imageBaseUrl?: string;
		/** Page/crop fetch in progress — loader in the canvas panel only. */
		isLoading?: boolean;
		onSave: (updatedCrops: ReviewCrop[]) => void;
	};

	let {
		fullPageImageUrl = '',
		crops = [],
		classes = [],
		imageBaseUrl = '',
		isLoading = false,
		onSave
	}: Props = $props();

	let viewMode = $state('crops');
	let activeClassId = $state('');
	let localBoxes = $state<Record<number, ReviewBox[]>>({});
	let editImageLoaded = $state<Record<number, boolean>>({});

	let fullImageZoom = $state(1);
	let panX = $state(0);
	let panY = $state(0);
	let isPanning = $state(false);
	let panAnchorX = 0;
	let panAnchorY = 0;
	let panStartX = 0;
	let panStartY = 0;

	const MIN_FULL_ZOOM = 0.75;
	const MAX_FULL_ZOOM = 3;

	const cropViewControls = new SvelteMap<number, CropViewControls>();
	let cropToolbarZoom = $state(1);
	let cropControlsVersion = $state(0);

	const viewTabs = $derived(
		fullPageImageUrl
			? [
					{ value: 'crops', label: 'Individual Parts' },
					{ value: 'full', label: 'Full Page Reference' }
				]
			: []
	);

	$effect(() => {
		const nextBoxes: Record<number, ReviewBox[]> = {};
		for (const crop of crops) {
			nextBoxes[crop.id] = crop.boxes.map((box) => ({ ...box }));
		}
		localBoxes = nextBoxes;
	});

	$effect(() => {
		if (!classes.some((cls) => cls.id === activeClassId)) {
			activeClassId = classes[0]?.id ?? '';
		}
	});

	const detectedHoleCount = $derived(crops.reduce((sum, crop) => sum + crop.boxes.length, 0));

	const totalHoleCount = $derived(
		Object.values(localBoxes).reduce((sum, boxes) => sum + boxes.length, 0)
	);

	const addedHoleCount = $derived(Math.max(0, totalHoleCount - detectedHoleCount));

	const toolbarZoom = $derived(viewMode === 'full' ? fullImageZoom : cropToolbarZoom);
	const toolbarZoomAtMin = $derived(toolbarZoom <= MIN_FULL_ZOOM);
	const toolbarZoomAtMax = $derived(toolbarZoom >= MAX_FULL_ZOOM);

	function syncCropToolbarZoom() {
		const firstId = crops[0]?.id;
		cropToolbarZoom = firstId != null ? (cropViewControls.get(firstId)?.getZoom() ?? 1) : 1;
	}

	function registerCropControls(cropId: number, controls: CropViewControls) {
		cropViewControls.set(cropId, controls);
		cropControlsVersion += 1;
	}

	function unregisterCropControls(cropId: number) {
		cropViewControls.delete(cropId);
		cropControlsVersion += 1;
	}

	function resetFullImageView() {
		fullImageZoom = 1;
		panX = 0;
		panY = 0;
		isPanning = false;
	}

	function clampFullZoom(zoom: number): number {
		return Math.min(MAX_FULL_ZOOM, Math.max(MIN_FULL_ZOOM, Math.round(zoom * 4) / 4));
	}

	function bumpFullImageZoom(delta: number) {
		void cropControlsVersion;
		if (viewMode === 'full') {
			fullImageZoom = clampFullZoom(fullImageZoom + delta);
			return;
		}
		for (const crop of crops) {
			cropViewControls.get(crop.id)?.bumpZoom(delta);
		}
	}

	function fitFullImageView() {
		void cropControlsVersion;
		if (viewMode === 'full') {
			resetFullImageView();
			return;
		}
		for (const crop of crops) {
			cropViewControls.get(crop.id)?.fit();
		}
	}

	function startFullPagePan(event: PointerEvent) {
		if (viewMode !== 'full' || !fullPageImageUrl) return;
		event.preventDefault();
		isPanning = true;
		panAnchorX = event.clientX;
		panAnchorY = event.clientY;
		panStartX = panX;
		panStartY = panY;
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
	}

	function moveFullPagePan(event: PointerEvent) {
		if (!isPanning) return;
		panX = panStartX + (event.clientX - panAnchorX);
		panY = panStartY + (event.clientY - panAnchorY);
	}

	function endFullPagePan(event: PointerEvent) {
		if (!isPanning) return;
		isPanning = false;
		try {
			(event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
		} catch {
			// pointer may already be released
		}
	}

	$effect(() => {
		void viewMode;
		resetFullImageView();
		syncCropToolbarZoom();
	});

	$effect(() => {
		void cropControlsVersion;
		syncCropToolbarZoom();
	});

	export function save() {
		const updatedCrops = crops.map((crop) => ({
			...crop,
			boxes: localBoxes[crop.id] ?? []
		}));
		onSave(updatedCrops);
	}

	function setupCropCanvas(node: HTMLCanvasElement, params: { cropId: number }) {
		const { cropId } = params;
		const ctx = node.getContext('2d');
		if (!ctx) return;

		const crop = crops.find((entry) => entry.id === cropId);
		if (!crop) return;

		const img = new Image();
		img.src = imageBaseUrl ? `${imageBaseUrl}/${crop.image}` : crop.image;

		let imgWidth = 0;
		let imgHeight = 0;
		let activeBoxIdx = -1;
		let hoverBoxIdx = -1;
		let interactionMode: string | null = null;
		let startX = 0;
		let startY = 0;
		let origBox: ReviewBox | { panX: number; panY: number } | null = null;

		let zoomScale = 1;
		let panX = 0;
		let panY = 0;
		let isPanning = false;
		let spaceHeld = false;
		let pointerOverCanvas = false;

		const clampCropZoom = (zoom: number) =>
			Math.min(MAX_FULL_ZOOM, Math.max(MIN_FULL_ZOOM, Math.round(zoom * 4) / 4));

		const getContainerSize = () => {
			const container = node.parentElement;
			if (container) {
				const rect = container.getBoundingClientRect();
				return {
					width: Math.max(1, Math.floor(rect.width)),
					height: Math.max(1, Math.floor(rect.height))
				};
			}
			return {
				width: Math.max(1, node.clientWidth),
				height: Math.max(1, node.clientHeight)
			};
		};

		const getTransform = () => {
			const { width: containerW, height: containerH } = getContainerSize();
			const fitScale = Math.min(containerW / imgWidth, containerH / imgHeight);
			const scale = fitScale * zoomScale;
			const drawW = imgWidth * scale;
			const drawH = imgHeight * scale;
			const offsetX = (containerW - drawW) / 2 + panX;
			const offsetY = (containerH - drawH) / 2 + panY;
			return { containerW, containerH, scale, offsetX, offsetY };
		};

		const shouldPan = (e: MouseEvent) =>
			e.button === 1 || e.button === 2 || e.shiftKey || spaceHeld;

		const updateHoverCursor = (pos?: { x: number; y: number }) => {
			if (isPanning) {
				node.style.cursor = 'grabbing';
				return;
			}
			if (pos && !spaceHeld) {
				const hit = getHit(pos.x, pos.y);
				hoverBoxIdx = hit ? hit.idx : -1;
				if (hit) {
					node.style.cursor = hit.type.startsWith('resize')
						? ['resize-tl', 'resize-br'].includes(hit.type)
							? 'nwse-resize'
							: 'nesw-resize'
						: 'move';
					return;
				}
			}
			node.style.cursor = spaceHeld && pointerOverCanvas ? 'grab' : 'crosshair';
		};

		const startPan = (e: MouseEvent) => {
			if (e.button === 2) e.preventDefault();
			isPanning = true;
			startX = e.clientX;
			startY = e.clientY;
			origBox = { panX, panY };
			node.style.cursor = 'grabbing';
		};

		const clampPan = () => {
			const { containerW, containerH, scale } = getTransform();
			const drawW = imgWidth * scale;
			const drawH = imgHeight * scale;
			if (drawW <= containerW) {
				panX = 0;
			} else {
				const minPanX = (containerW - drawW) / 2;
				const maxPanX = (drawW - containerW) / 2;
				panX = Math.min(maxPanX, Math.max(minPanX, panX));
			}
			if (drawH <= containerH) {
				panY = 0;
			} else {
				const minPanY = (containerH - drawH) / 2;
				const maxPanY = (drawH - containerH) / 2;
				panY = Math.min(maxPanY, Math.max(minPanY, panY));
			}
		};

		const controls: CropViewControls = {
			bumpZoom(delta: number) {
				zoomScale = clampCropZoom(zoomScale + delta);
				if (zoomScale === 1) {
					panX = 0;
					panY = 0;
				} else {
					clampPan();
				}
				draw();
				syncCropToolbarZoom();
			},
			fit() {
				zoomScale = 1;
				panX = 0;
				panY = 0;
				draw();
				syncCropToolbarZoom();
			},
			getZoom: () => zoomScale
		};
		registerCropControls(cropId, controls);

		const draw = () => {
			if (!imgWidth) return;
			const { containerW, containerH, scale, offsetX, offsetY } = getTransform();

			node.width = Math.max(1, Math.floor(containerW));
			node.height = Math.max(1, Math.floor(containerH));
			ctx.clearRect(0, 0, node.width, node.height);

			ctx.filter = 'contrast(1.3) brightness(1.05) sharpen(1)';
			ctx.drawImage(
				img,
				0,
				0,
				imgWidth,
				imgHeight,
				offsetX,
				offsetY,
				imgWidth * scale,
				imgHeight * scale
			);
			ctx.filter = 'none';

			const boxes = localBoxes[cropId] ?? [];
			const fitScale = scale / zoomScale;
			const strokeBase = (active: boolean) => (active ? 5 : 3) * fitScale;
			const shadowBase = (active: boolean) => (active ? 4 : 2) * fitScale;
			const handleSize = 18 * fitScale;

			boxes.forEach((box, i) => {
				const isActive = i === activeBoxIdx;
				const cls = classes.find((entry) => entry.id === box.class_id) ?? classes[0];
				const x1 = offsetX + box.x1 * scale;
				const y1 = offsetY + box.y1 * scale;
				const w = (box.x2 - box.x1) * scale;
				const h = (box.y2 - box.y1) * scale;

				ctx.strokeStyle = isActive ? cls.activeColor : cls.color;
				ctx.lineWidth = strokeBase(isActive);
				ctx.shadowColor = isActive ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.4)';
				ctx.shadowBlur = shadowBase(isActive);
				ctx.strokeRect(x1, y1, w, h);
				ctx.shadowColor = 'transparent';
				ctx.shadowBlur = 0;

				if (i === hoverBoxIdx || isActive) {
					ctx.fillStyle = isActive ? 'rgba(59, 130, 246, 0.25)' : 'rgba(34, 197, 94, 0.2)';
					ctx.fillRect(x1, y1, w, h);
				}

				if (isActive) {
					ctx.fillStyle = cls.activeColor;
					const handles = [
						{ x: x1, y: y1 },
						{ x: x1 + w, y: y1 },
						{ x: x1, y: y1 + h },
						{ x: x1 + w, y: y1 + h }
					];
					for (const handle of handles) {
						ctx.strokeStyle = 'white';
						ctx.lineWidth = 1.5 * fitScale;
						ctx.fillRect(
							handle.x - handleSize / 2,
							handle.y - handleSize / 2,
							handleSize,
							handleSize
						);
						ctx.strokeRect(
							handle.x - handleSize / 2,
							handle.y - handleSize / 2,
							handleSize,
							handleSize
						);
					}
				}
			});
		};

		img.onload = () => {
			imgWidth = img.naturalWidth;
			imgHeight = img.naturalHeight;
			editImageLoaded[cropId] = true;
			draw();
			syncCropToolbarZoom();
		};

		const getMousePos = (e: MouseEvent) => {
			const rect = node.getBoundingClientRect();
			const { scale, offsetX, offsetY } = getTransform();
			return {
				x: (e.clientX - rect.left - offsetX) / scale,
				y: (e.clientY - rect.top - offsetY) / scale
			};
		};

		const getHit = (x: number, y: number) => {
			const boxes = localBoxes[cropId] ?? [];
			const { scale } = getTransform();
			const hitSize = 20 / scale;
			if (activeBoxIdx !== -1 && activeBoxIdx < boxes.length) {
				const box = boxes[activeBoxIdx];
				if (Math.abs(x - box.x1) < hitSize && Math.abs(y - box.y1) < hitSize) {
					return { idx: activeBoxIdx, type: 'resize-tl' };
				}
				if (Math.abs(x - box.x2) < hitSize && Math.abs(y - box.y1) < hitSize) {
					return { idx: activeBoxIdx, type: 'resize-tr' };
				}
				if (Math.abs(x - box.x1) < hitSize && Math.abs(y - box.y2) < hitSize) {
					return { idx: activeBoxIdx, type: 'resize-bl' };
				}
				if (Math.abs(x - box.x2) < hitSize && Math.abs(y - box.y2) < hitSize) {
					return { idx: activeBoxIdx, type: 'resize-br' };
				}
			}

			for (let i = boxes.length - 1; i >= 0; i--) {
				const box = boxes[i];
				if (x >= box.x1 && x <= box.x2 && y >= box.y1 && y <= box.y2) {
					return { idx: i, type: 'move' };
				}
			}
			return null;
		};

		const onWheel = (e: WheelEvent) => {
			e.preventDefault();
			const rect = node.getBoundingClientRect();
			const { scale, offsetX, offsetY } = getTransform();
			const pointerX = e.clientX - rect.left;
			const pointerY = e.clientY - rect.top;
			const imageX = (pointerX - offsetX) / scale;
			const imageY = (pointerY - offsetY) / scale;

			const zoomFactor = 1.1;
			if (e.deltaY < 0) zoomScale = clampCropZoom(zoomScale * zoomFactor);
			else zoomScale = clampCropZoom(zoomScale / zoomFactor);

			if (zoomScale === 1) {
				panX = 0;
				panY = 0;
			} else {
				const next = getTransform();
				const nextScale = next.scale;
				panX =
					pointerX - imageX * nextScale - (getContainerSize().width - imgWidth * nextScale) / 2;
				panY =
					pointerY - imageY * nextScale - (getContainerSize().height - imgHeight * nextScale) / 2;
				clampPan();
			}
			draw();
			syncCropToolbarZoom();
		};

		const onMouseDown = (e: MouseEvent) => {
			const pos = getMousePos(e);

			if (shouldPan(e)) {
				startPan(e);
				return;
			}

			const hit = getHit(pos.x, pos.y);
			const boxes = localBoxes[cropId] ?? [];
			if (hit) {
				activeBoxIdx = hit.idx;
				interactionMode = hit.type;
				startX = pos.x;
				startY = pos.y;
				origBox = { ...boxes[activeBoxIdx] };
			} else {
				activeBoxIdx = -1;
				interactionMode = 'create';
				startX = pos.x;
				startY = pos.y;

				const newBox: ReviewBox = {
					x1: pos.x,
					y1: pos.y,
					x2: pos.x,
					y2: pos.y,
					class_id: activeClassId
				};
				localBoxes[cropId] = [...boxes, newBox];
				activeBoxIdx = localBoxes[cropId].length - 1;
				origBox = { ...newBox };
			}
			draw();
		};

		const onMouseMove = (e: MouseEvent) => {
			if (isPanning && origBox && 'panX' in origBox) {
				panX = origBox.panX + (e.clientX - startX);
				panY = origBox.panY + (e.clientY - startY);
				clampPan();
				draw();
				return;
			}

			const pos = getMousePos(e);
			const boxes = localBoxes[cropId] ?? [];
			if (
				interactionMode &&
				activeBoxIdx !== -1 &&
				activeBoxIdx < boxes.length &&
				origBox &&
				'x1' in origBox
			) {
				const dx = pos.x - startX;
				const dy = pos.y - startY;
				const box = boxes[activeBoxIdx];

				if (interactionMode === 'move') {
					box.x1 = origBox.x1 + dx;
					box.y1 = origBox.y1 + dy;
					box.x2 = origBox.x2 + dx;
					box.y2 = origBox.y2 + dy;
				} else if (interactionMode === 'resize-tl') {
					box.x1 = origBox.x1 + dx;
					box.y1 = origBox.y1 + dy;
				} else if (interactionMode === 'resize-tr') {
					box.x2 = origBox.x2 + dx;
					box.y1 = origBox.y1 + dy;
				} else if (interactionMode === 'resize-bl') {
					box.x1 = origBox.x1 + dx;
					box.y2 = origBox.y2 + dy;
				} else if (interactionMode === 'resize-br' || interactionMode === 'create') {
					box.x2 = pos.x;
					box.y2 = pos.y;
				}
				draw();
			} else {
				updateHoverCursor(pos);
				draw();
			}
		};

		const onMouseUp = (e: MouseEvent) => {
			if (isPanning) {
				isPanning = false;
				updateHoverCursor(getMousePos(e));
				return;
			}
			const boxes = localBoxes[cropId] ?? [];
			if (interactionMode && activeBoxIdx !== -1 && activeBoxIdx < boxes.length) {
				const box = boxes[activeBoxIdx];
				if (box.x1 > box.x2) {
					const tmp = box.x1;
					box.x1 = box.x2;
					box.x2 = tmp;
				}
				if (box.y1 > box.y2) {
					const tmp = box.y1;
					box.y1 = box.y2;
					box.y2 = tmp;
				}

				if (interactionMode === 'create' && (box.x2 - box.x1 < 5 || box.y2 - box.y1 < 5)) {
					localBoxes[cropId] = boxes.filter((_, idx) => idx !== activeBoxIdx);
					activeBoxIdx = -1;
				} else {
					localBoxes[cropId] = [...boxes];
				}
			}
			interactionMode = null;
			draw();
		};

		const onKeyDown = (e: KeyboardEvent) => {
			const boxes = localBoxes[cropId] ?? [];
			if (
				(e.key === 'Delete' || e.key === 'Backspace') &&
				activeBoxIdx !== -1 &&
				activeBoxIdx < boxes.length
			) {
				localBoxes[cropId] = boxes.filter((_, idx) => idx !== activeBoxIdx);
				activeBoxIdx = -1;
				draw();
			}
		};

		const onWindowKeyDown = (e: KeyboardEvent) => {
			if (e.code !== 'Space' || e.repeat || !pointerOverCanvas) return;
			const target = e.target as HTMLElement;
			if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
				return;
			}
			e.preventDefault();
			spaceHeld = true;
			updateHoverCursor();
		};

		const onWindowKeyUp = (e: KeyboardEvent) => {
			if (e.code !== 'Space') return;
			spaceHeld = false;
			updateHoverCursor();
		};

		const onMouseEnter = () => {
			pointerOverCanvas = true;
		};

		const onMouseLeave = () => {
			pointerOverCanvas = false;
			if (!spaceHeld) updateHoverCursor();
		};

		const onContextMenu = (e: MouseEvent) => {
			e.preventDefault();
		};

		const resizeObserver = new ResizeObserver(() => {
			if (!imgWidth) return;
			clampPan();
			draw();
		});
		if (node.parentElement) resizeObserver.observe(node.parentElement);

		node.addEventListener('wheel', onWheel, { passive: false });
		node.addEventListener('mousedown', onMouseDown);
		node.addEventListener('mouseenter', onMouseEnter);
		node.addEventListener('mouseleave', onMouseLeave);
		node.addEventListener('contextmenu', onContextMenu);
		window.addEventListener('mousemove', onMouseMove);
		window.addEventListener('mouseup', onMouseUp);
		window.addEventListener('keydown', onWindowKeyDown);
		window.addEventListener('keyup', onWindowKeyUp);
		node.addEventListener('keydown', onKeyDown);

		return {
			destroy() {
				unregisterCropControls(cropId);
				resizeObserver.disconnect();
				node.removeEventListener('wheel', onWheel);
				node.removeEventListener('mousedown', onMouseDown);
				node.removeEventListener('mouseenter', onMouseEnter);
				node.removeEventListener('mouseleave', onMouseLeave);
				node.removeEventListener('contextmenu', onContextMenu);
				window.removeEventListener('mousemove', onMouseMove);
				window.removeEventListener('mouseup', onMouseUp);
				window.removeEventListener('keydown', onWindowKeyDown);
				window.removeEventListener('keyup', onWindowKeyUp);
				node.removeEventListener('keydown', onKeyDown);
			}
		};
	}
</script>

<div class="flex h-[68vh] min-h-[68vh] flex-col overflow-hidden lg:flex-row">
	<div
		class="flex min-h-0 flex-1 flex-col overflow-hidden border-border bg-slate-50 p-4 lg:border-r"
	>
		{#if viewTabs.length > 0 || crops.length > 0}
			<div class="mb-4 flex shrink-0 items-center justify-between gap-3">
				<div class="min-w-0 flex-1">
					{#if viewTabs.length > 0}
						<Tabs
							items={viewTabs}
							bind:value={viewMode}
							mobileSelect={false}
							ariaLabel="Operations review view"
						/>
					{:else}
						<p class="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
							Individual Parts
						</p>
					{/if}
				</div>
				{#if (viewMode === 'full' && fullPageImageUrl) || (viewMode === 'crops' && crops.length > 0)}
					<div class="flex shrink-0 items-center gap-1">
						<button
							type="button"
							class="border border-border bg-white px-2 py-0.5 text-xs font-medium text-foreground hover:bg-slate-50 disabled:opacity-40"
							disabled={toolbarZoomAtMin}
							onclick={() => bumpFullImageZoom(-0.25)}
						>
							−
						</button>
						<span class="min-w-12 text-center text-xs text-muted-foreground">
							{Math.round(toolbarZoom * 100)}%
						</span>
						<button
							type="button"
							class="border border-border bg-white px-2 py-0.5 text-xs font-medium text-foreground hover:bg-slate-50 disabled:opacity-40"
							disabled={toolbarZoomAtMax}
							onclick={() => bumpFullImageZoom(0.25)}
						>
							+
						</button>
						<button
							type="button"
							class="border border-border bg-white px-2 py-0.5 text-xs font-medium text-foreground hover:bg-slate-50 disabled:opacity-40"
							onclick={fitFullImageView}
						>
							Fit
						</button>
					</div>
				{/if}
			</div>
		{/if}

		<div
			class="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden border border-border bg-white"
		>
			{#if isLoading}
				<div class="flex flex-col items-center gap-3">
					<Loader2 class="size-8 animate-spin text-blue-500" />
					<p class="text-sm font-medium text-muted-foreground">Loading operations…</p>
				</div>
			{:else if viewMode === 'full' && fullPageImageUrl}
				<div
					class="relative flex h-full w-full items-center justify-center overflow-hidden {isPanning
						? 'cursor-grabbing'
						: 'cursor-grab'}"
					onpointerdown={startFullPagePan}
					onpointermove={moveFullPagePan}
					onpointerup={endFullPagePan}
					onpointercancel={endFullPagePan}
				>
					<img
						src={fullPageImageUrl}
						alt="Full page reference"
						class="max-h-full max-w-full select-none object-contain"
						style="transform: translate({panX}px, {panY}px) scale({fullImageZoom});"
						draggable="false"
					/>
				</div>
			{:else if crops.length > 0}
				<div class="flex h-full min-h-0 w-full flex-col gap-4 overflow-hidden p-4">
					{#each crops as crop (crop.id)}
						<div class="flex min-h-0 flex-1 flex-col gap-3 border border-border bg-slate-50 p-4">
							<div class="flex shrink-0 items-center justify-between gap-3 px-1">
								<p class="text-[11px] font-semibold tracking-wide text-foreground uppercase">
									Detected Part {crop.id}
								</p>
								<span
									class="inline-flex items-center border border-green-200 bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700"
								>
									{(localBoxes[crop.id] ?? []).length} operations
								</span>
							</div>
							<div class="relative min-h-0 flex-1 overflow-hidden border border-border bg-white">
								{#if crop.image}
									<canvas
										tabindex="0"
										class="block h-full w-full focus:outline-none"
										use:setupCropCanvas={{ cropId: crop.id }}
									></canvas>
								{:else}
									<p class="text-sm text-muted-foreground">No image</p>
								{/if}
								{#if !editImageLoaded[crop.id]}
									<div
										class="absolute inset-0 z-10 flex items-center justify-center bg-white/80 backdrop-blur-sm"
									>
										<div class="flex flex-col items-center gap-3">
											<Loader2 class="size-8 animate-spin text-blue-500" />
											<p class="text-sm font-medium text-muted-foreground">Loading crop…</p>
										</div>
									</div>
								{/if}
							</div>
							<p class="text-[11px] text-muted-foreground">
								Drag to add a missed operation · click a box to select · Space or right-click drag
								to pan when zoomed · Delete to remove.
							</p>
						</div>
					{/each}
				</div>
			{:else}
				<EmptyState
					title="No crops available"
					description="Operation detection images are not available for this page."
					class="py-8"
				/>
			{/if}
		</div>
	</div>

	<aside
		class="flex h-full w-full shrink-0 flex-col self-stretch border-t border-border bg-white lg:w-72 lg:border-t-0 lg:border-l"
	>
		<div class="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
			<div>
				<p class="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
					Model Info
				</p>
				<div class="mt-3 border-t border-border pt-3">
					<p class="text-sm text-foreground">
						<span class="mr-1.5 inline-block size-2 rounded-full bg-green-600"></span>
						<span class="font-medium">Operation</span>
						detected {detectedHoleCount} · added {addedHoleCount} ·
						<span class="font-semibold">total {totalHoleCount}</span>
					</p>
				</div>
				<div class="mt-4 border border-green-200 bg-green-50 p-3">
					<p class="text-sm font-semibold text-green-800">
						Corrected operation count: {totalHoleCount}
					</p>
					<p class="mt-1 text-xs text-green-700">
						Updates the Operations column automatically - no separate save to project
					</p>
				</div>
			</div>
		</div>
	</aside>
</div>
