<script lang="ts">
	import DemoBackNav from '../_components/demo-back-nav.svelte';
	import { Breadcrumb } from '$lib';
	import type { BreadcrumbItem } from '$lib/components/ui/breadcrumb/breadcrumb.constants';

	const items: BreadcrumbItem[] = [
		{ label: 'PMS', href: '/' },
		{ label: 'Dashboard', current: true }
	];

	const longItems: BreadcrumbItem[] = [
		{ label: 'Home', href: '/' },
		{ label: 'Products', href: '/products' },
		{ label: 'Category', href: '/products/category' },
		{ label: 'Components', href: '/components' },
		{ label: 'Breadcrumb', current: true }
	];

	const appTrail: BreadcrumbItem[] = [
		{ label: 'PM', href: '#' },
		{ label: 'Projects', href: '#/ProjectManagement/Home' },
		{ label: 'Acme Tower Project', href: '#/ProjectManagement/Releases/project-1' },
		{ label: 'Releases', href: '#/ProjectManagement/Releases/project-1' },
		{ label: 'Release 1', current: true }
	];

	let containerWidth = $state(720);
</script>

<DemoBackNav />

<div class="mx-auto max-w-7xl space-y-12 p-8">
	<section class="space-y-4">
		<h1 class="text-2xl font-semibold">Breadcrumb</h1>
		<p class="max-w-2xl text-sm text-muted-foreground">
			Hierarchical navigation trail with slash or chevron separators. Long trails collapse into an
			ellipsis only when they run out of horizontal space.
		</p>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">Slash separator</h2>
		<div class="rounded-lg border border-border bg-surface px-6 py-4">
			<Breadcrumb {items} separator="slash" />
		</div>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">Chevron separator</h2>
		<div class="rounded-lg border border-border bg-surface px-6 py-4">
			<Breadcrumb {items} separator="chevron" />
		</div>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">Overflow collapse</h2>
		<p class="max-w-2xl text-sm text-muted-foreground">
			Drag the slider to change the available width. The breadcrumb keeps the full trail while it
			fits, then progressively hides middle segments behind an ellipsis dropdown.
		</p>

		<div class="space-y-4 rounded-lg border border-border bg-surface p-6">
			<div class="flex flex-wrap items-center justify-between gap-3">
				<label class="text-sm font-medium text-foreground" for="breadcrumb-width">
					Container width
				</label>
				<span class="text-sm text-muted-foreground">{containerWidth}px</span>
			</div>
			<input
				id="breadcrumb-width"
				type="range"
				min="180"
				max="960"
				step="10"
				bind:value={containerWidth}
				class="w-full accent-primary"
			/>

			<div
				class="overflow-hidden rounded-md border border-dashed border-border bg-gray-50 px-4 py-3"
				style:width="{containerWidth}px"
				style:max-width="100%"
			>
				<Breadcrumb class="w-full" items={appTrail} separator="slash" />
			</div>
		</div>

		<div class="grid gap-4 md:grid-cols-2">
			<div class="space-y-2">
				<h3 class="text-sm font-medium text-muted-foreground">Wide container</h3>
				<div class="rounded-lg border border-border bg-surface px-6 py-4">
					<Breadcrumb class="w-full" items={appTrail} separator="slash" />
				</div>
			</div>
			<div class="space-y-2">
				<h3 class="text-sm font-medium text-muted-foreground">Narrow container</h3>
				<div class="max-w-[280px] rounded-lg border border-border bg-surface px-6 py-4">
					<Breadcrumb class="w-full" items={appTrail} separator="slash" />
				</div>
			</div>
		</div>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">Generic long trail</h2>
		<div class="max-w-sm rounded-lg border border-border bg-surface px-6 py-4">
			<Breadcrumb class="w-full" items={longItems} separator="chevron" />
		</div>
	</section>
</div>
