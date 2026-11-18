<script lang="ts">
	import DemoBackNav from '../_components/demo-back-nav.svelte';
	import { Checkbox, Label } from '$lib';
	import { Button } from '$lib/components/ui/button';

	const items = [
		{ id: 'design', label: 'Design' },
		{ id: 'engineering', label: 'Engineering' },
		{ id: 'marketing', label: 'Marketing' }
	];

	let acceptTerms = $state(false);
	let newsletter = $state(true);
	let boundChecked = $state(false);
	let checkboxRef = $state<HTMLInputElement | null>(null);
	let selected = $state<string[]>(['engineering']);

	const allSelected = $derived(selected.length === items.length);
	const noneSelected = $derived(selected.length === 0);
	const indeterminate = $derived(!noneSelected && !allSelected);

	function toggleAll() {
		selected = allSelected ? [] : items.map((item) => item.id);
	}

	function toggleItem(id: string) {
		selected = selected.includes(id) ? selected.filter((entry) => entry !== id) : [...selected, id];
	}
</script>

<DemoBackNav />

<div class="mx-auto max-w-7xl space-y-12 p-8">
	<section class="space-y-4">
		<h1 class="text-2xl font-semibold">Checkbox</h1>
		<p class="max-w-2xl text-sm text-muted-foreground">
			Native checkbox with custom styling, indeterminate state, and two-way binding.
		</p>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">Default</h2>
		<div class="flex items-center gap-8 rounded-lg border border-border bg-surface px-6 py-8">
			<Checkbox aria-label="Unchecked" />
			<Checkbox checked aria-label="Checked" />
		</div>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">With label</h2>
		<div
			class="flex flex-col gap-4 rounded-lg border border-border bg-surface px-6 py-6 sm:flex-row sm:gap-8"
		>
			<div class="flex items-center gap-3">
				<Checkbox id="accept-terms" bind:checked={acceptTerms} />
				<Label for="accept-terms" text="Accept terms and conditions" />
			</div>
			<div class="flex items-center gap-3">
				<Checkbox id="newsletter" bind:checked={newsletter} />
				<Label for="newsletter" text="Subscribe to newsletter" />
			</div>
		</div>
		<p class="text-sm text-muted-foreground">
			Terms: {acceptTerms ? 'accepted' : 'not accepted'}, Newsletter: {newsletter ? 'on' : 'off'}
		</p>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">Indeterminate</h2>
		<div class="max-w-sm space-y-3 rounded-lg border border-border bg-surface px-6 py-6">
			<div class="flex items-center gap-3 border-b border-border pb-3">
				<Checkbox id="select-all" checked={allSelected} {indeterminate} onchange={toggleAll} />
				<Label for="select-all" text="Select all departments" />
			</div>
			{#each items as item (item.id)}
				<div class="flex items-center gap-3 pl-6">
					<Checkbox
						id={item.id}
						checked={selected.includes(item.id)}
						onchange={() => toggleItem(item.id)}
					/>
					<Label for={item.id} text={item.label} />
				</div>
			{/each}
		</div>
		<p class="text-sm text-muted-foreground">Selected: {selected.join(', ') || 'none'}</p>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">Sizes</h2>
		<div class="flex items-center gap-8 rounded-lg border border-border bg-surface px-6 py-8">
			<Checkbox size="sm" checked aria-label="Small checkbox" />
			<Checkbox size="md" checked aria-label="Medium checkbox" />
		</div>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">States</h2>
		<div class="flex items-center gap-8 rounded-lg border border-border bg-surface px-6 py-8">
			<Checkbox disabled aria-label="Disabled unchecked" />
			<Checkbox checked disabled aria-label="Disabled checked" />
			<Checkbox indeterminate disabled aria-label="Disabled indeterminate" />
		</div>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">Two-way binding</h2>
		<div class="flex items-center gap-4 rounded-lg border border-border bg-surface px-6 py-6">
			<Checkbox bind:checked={boundChecked} aria-label="Bound checkbox" />
			<p class="text-sm text-muted-foreground">
				Bound value: {boundChecked ? 'checked' : 'unchecked'}
			</p>
		</div>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">Element ref</h2>
		<div class="flex items-center gap-4 rounded-lg border border-border bg-surface px-6 py-6">
			<Checkbox bind:ref={checkboxRef} aria-label="Focusable checkbox" />
			<Button label="Focus" onclick={() => checkboxRef?.focus()} />
		</div>
	</section>
</div>
