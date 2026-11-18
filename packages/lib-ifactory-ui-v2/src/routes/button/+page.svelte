<script lang="ts">
	import DemoBackNav from '../_components/demo-back-nav.svelte';
	import { Button } from '$lib';
	import { ArrowRight, Plus, Settings, Trash2 } from '@lucide/svelte';

	let loading = $state(false);

	function handleSave() {
		loading = true;
		setTimeout(() => {
			loading = false;
		}, 1500);
	}
</script>

<DemoBackNav />

<div class="mx-auto max-w-7xl space-y-12 p-8">
	<section class="space-y-4">
		<h1 class="text-2xl font-semibold">Button</h1>
		<p class="max-w-2xl text-sm text-muted-foreground">
			Action buttons with variants, sizes, icons, loading state, and optional link rendering.
		</p>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">Variants</h2>
		<div class="flex flex-wrap gap-3 rounded-lg border border-border bg-surface px-6 py-6">
			<Button label="Primary" />
			<Button variant="secondary" label="Secondary" />
			<Button variant="outline" label="Outline" />
			<Button variant="ghost" label="Ghost" />
		</div>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">Sizes</h2>
		<div
			class="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface px-6 py-6"
		>
			<Button size="sm" label="Small" />
			<Button size="md" label="Medium" />
			<Button size="lg" label="Large" />
		</div>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">With icons</h2>
		<div class="flex flex-wrap gap-3 rounded-lg border border-border bg-surface px-6 py-6">
			<Button label="Add item" icon={Plus} />
			<Button label="Continue" icon={ArrowRight} iconPosition="right" />
			<Button variant="outline" label="Settings" icon={Settings} />
			<Button variant="ghost" size="icon" icon={Trash2} aria-label="Delete" />
			<Button
				variant="outline"
				label="Custom icon"
				icon={Settings}
				iconClass="size-5 text-primary"
			/>
		</div>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">States</h2>
		<div class="flex flex-wrap gap-3 rounded-lg border border-border bg-surface px-6 py-6">
			<Button label="Disabled" disabled />
			<Button label="Saving..." loading />
			<Button label={loading ? 'Saving...' : 'Save changes'} {loading} onclick={handleSave} />
		</div>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">As link</h2>
		<div class="flex flex-wrap gap-3 rounded-lg border border-border bg-surface px-6 py-6">
			<Button href="/" variant="outline" label="Go home" />
			<Button href="/components" label="View components" icon={ArrowRight} iconPosition="right" />
		</div>
	</section>
</div>
