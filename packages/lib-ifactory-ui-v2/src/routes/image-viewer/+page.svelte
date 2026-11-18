<script lang="ts">
	import { ImageViewer, type ImageViewerItem } from '$lib';
	import DemoBackNav from '../_components/demo-back-nav.svelte';

	function sheet(mark: string, note: string): string {
		const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="2400" height="1600" viewBox="0 0 2400 1600">
			<rect width="2400" height="1600" fill="#f8fafc"/>
			<rect x="80" y="80" width="2240" height="1440" fill="none" stroke="#0f172a" stroke-width="8"/>
			<line x1="80" y1="280" x2="2320" y2="280" stroke="#0f172a" stroke-width="4"/>
			<text x="140" y="200" fill="#0f172a" font-family="sans-serif" font-size="96">${mark}</text>
			<text x="140" y="420" fill="#334155" font-family="sans-serif" font-size="48">${note}</text>
			<circle cx="1200" cy="980" r="280" fill="none" stroke="#ea580c" stroke-width="12"/>
			<text x="1040" y="1000" fill="#ea580c" font-family="sans-serif" font-size="64">Ø 560</text>
		</svg>`;
		return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
	}

	const sheets: ImageViewerItem[] = [
		{
			id: 'mark-2619',
			src: sheet('J57 DA 2619', 'Shop sketch — zoom and drag when larger than the pane'),
			alt: 'J57 DA 2619',
			label: 'J57 DA 2619'
		},
		{
			id: 'mark-2620',
			src: sheet('J57 DA 2620', 'Second sheet — swipe or use the arrows'),
			alt: 'J57 DA 2620',
			label: 'J57 DA 2620'
		},
		{
			id: 'mark-2621',
			src: sheet('J57 DA 2621', 'Third sheet — fit returns to the pane'),
			alt: 'J57 DA 2621',
			label: 'J57 DA 2621'
		}
	];
</script>

<DemoBackNav />

<div class="mx-auto max-w-7xl space-y-8 p-8">
	<section class="space-y-4">
		<h1 class="text-2xl font-semibold">Image Viewer</h1>
		<p class="max-w-2xl text-sm text-muted-foreground">
			Zoom, pan, and slide through a list of images. Wheel, pinch, or double-click to zoom. Drag to
			pan while zoomed, and drag sideways to change sheet when fitted. Fit and actual size are on
			the toolbar. Keys: arrows, +, −, 0, 1.
		</p>
	</section>

	<section class="flex h-[36rem]">
		<ImageViewer items={sheets} class="min-h-0 flex-1" />
	</section>
</div>
