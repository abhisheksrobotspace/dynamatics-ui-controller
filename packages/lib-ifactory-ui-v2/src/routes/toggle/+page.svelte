<script lang="ts">
	import DemoBackNav from '../_components/demo-back-nav.svelte';
	import { Label, Toggle } from '$lib';

	let notifications = $state(true);
	let marketing = $state(false);
	let boundToggle = $state(false);
	let toggleRef = $state<HTMLInputElement | null>(null);
</script>

<DemoBackNav />

<div class="mx-auto max-w-7xl space-y-12 p-8">
	<section class="space-y-4">
		<h1 class="text-2xl font-semibold">Toggle</h1>
		<p class="max-w-2xl text-sm text-muted-foreground">
			Simple on/off switch built on a native checkbox with animated thumb, focus ring, and two-way
			binding.
		</p>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">Default</h2>
		<div class="flex items-center gap-8 rounded-lg border border-border bg-surface px-6 py-8">
			<Toggle aria-label="Off by default" />
			<Toggle checked aria-label="On by default" />
		</div>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">With label</h2>
		<div
			class="flex flex-wrap items-center gap-6 rounded-lg border border-border bg-surface px-6 py-6"
		>
			<div class="flex items-center gap-3">
				<Toggle id="notifications" bind:checked={notifications} aria-label="Notifications" />
				<Label for="notifications" text="Notifications" />
			</div>
			<div class="flex items-center gap-3">
				<Toggle id="marketing" bind:checked={marketing} aria-label="Marketing emails" />
				<Label for="marketing" text="Marketing emails" />
			</div>
		</div>
		<p class="text-sm text-muted-foreground">
			Notifications: {notifications ? 'on' : 'off'}, Marketing: {marketing ? 'on' : 'off'}
		</p>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">Sizes</h2>
		<div class="flex items-center gap-8 rounded-lg border border-border bg-surface px-6 py-8">
			<Toggle size="sm" checked aria-label="Small toggle" />
			<Toggle size="md" checked aria-label="Medium toggle" />
			<Toggle size="lg" checked aria-label="Large toggle" />
		</div>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">States</h2>
		<div class="flex items-center gap-8 rounded-lg border border-border bg-surface px-6 py-8">
			<Toggle disabled aria-label="Disabled off" />
			<Toggle checked disabled aria-label="Disabled on" />
		</div>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">Two-way binding</h2>
		<div class="flex items-center gap-4 rounded-lg border border-border bg-surface px-6 py-6">
			<Toggle bind:checked={boundToggle} aria-label="Bound toggle" />
			<p class="text-sm text-muted-foreground">Bound value: {boundToggle ? 'on' : 'off'}</p>
		</div>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">Element ref</h2>
		<div class="flex items-center gap-4 rounded-lg border border-border bg-surface px-6 py-6">
			<Toggle bind:ref={toggleRef} aria-label="Focusable toggle" />
			<button
				type="button"
				class="rounded-md border border-border px-3 py-1.5 text-sm"
				onclick={() => toggleRef?.focus()}
			>
				Focus
			</button>
		</div>
	</section>
</div>
