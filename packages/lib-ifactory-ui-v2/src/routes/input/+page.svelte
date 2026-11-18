<script lang="ts">
	import DemoBackNav from '../_components/demo-back-nav.svelte';
	import { Input, Label, NumberInput, QuantityStepper } from '$lib';

	let quantity = $state(0);
	let boundedQty = $state(2);
	let smallQty = $state(5);
	let largeQty = $state(10);
	let producedQty = $state(20);
</script>

<DemoBackNav />

<div class="mx-auto max-w-7xl space-y-12 p-8">
	<section class="space-y-4">
		<h1 class="text-2xl font-semibold">Input</h1>
		<p class="max-w-2xl text-sm text-muted-foreground">
			Text inputs and number steppers with increment/decrement controls.
		</p>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">Text input</h2>
		<div class="max-w-md space-y-4 rounded-lg border border-border bg-surface px-6 py-6">
			<div class="space-y-2">
				<Label for="project-name" text="Project name" />
				<Input id="project-name" placeholder="Enter project name" />
			</div>
		</div>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">Number input</h2>
		<p class="max-w-2xl text-sm text-muted-foreground">
			Stepper control with minus/plus buttons and a centered numeric field. Used in release quantity
			editors.
		</p>
		<div class="max-w-md space-y-6 rounded-lg border border-border bg-surface px-6 py-6">
			<div class="space-y-2">
				<Label for="qty-default" text="Default" />
				<NumberInput id="qty-default" bind:value={quantity} />
				<p class="text-xs text-muted-foreground">Current value: {quantity}</p>
			</div>

			<div class="space-y-2">
				<Label for="qty-bounded" text="With min and max (0–5)" />
				<NumberInput id="qty-bounded" min={0} max={5} bind:value={boundedQty} />
			</div>

			<div class="space-y-2">
				<Label for="qty-disabled" text="Disabled" />
				<NumberInput id="qty-disabled" value={3} disabled />
			</div>
		</div>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">Sizes</h2>
		<div class="max-w-md space-y-4 rounded-lg border border-border bg-surface px-6 py-6">
			<div class="space-y-2">
				<Label for="qty-sm" text="Small" />
				<NumberInput id="qty-sm" size="sm" bind:value={smallQty} />
			</div>
			<div class="space-y-2">
				<Label for="qty-md" text="Medium" />
				<NumberInput id="qty-md" size="md" bind:value={quantity} />
			</div>
			<div class="space-y-2">
				<Label for="qty-lg" text="Large" />
				<NumberInput id="qty-lg" size="lg" bind:value={largeQty} />
			</div>
		</div>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">Quantity stepper</h2>
		<p class="max-w-2xl text-sm text-muted-foreground">
			Connected HMI-style − / value / + control with primary border (distinct from NumberInput).
		</p>
		<div class="max-w-md space-y-2 rounded-lg border border-border bg-surface px-6 py-6">
			<QuantityStepper bind:value={producedQty} min={0} />
			<p class="text-xs text-muted-foreground">Current value: {producedQty}</p>
		</div>
	</section>
</div>
