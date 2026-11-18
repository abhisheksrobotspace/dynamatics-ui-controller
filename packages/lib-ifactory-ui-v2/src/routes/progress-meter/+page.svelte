<script lang="ts">
	import DemoBackNav from '../_components/demo-back-nav.svelte';
	import { ProgressMeter } from '$lib/components/ui/progress-meter';

	let value = $state(25);
</script>

<svelte:head>
	<title>Progress Meter — iFactory UI v2</title>
</svelte:head>

<DemoBackNav />

<div class="mx-auto max-w-3xl space-y-12 p-8">
	<header class="space-y-2">
		<h1 class="text-3xl font-semibold">Progress Meter</h1>
		<p class="text-muted-foreground">
			Linear fill bar with optional title, percent, and bordered track.
		</p>
	</header>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">Label + percent</h2>
		<ProgressMeter
			label="Job Progress"
			{value}
			max={100}
			showPercent
			fillTone="primary"
			remainderTone="offline"
		/>
		<input class="w-full" type="range" min="0" max="100" bind:value />
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">HMI bordered</h2>
		<ProgressMeter
			label="Progress"
			{value}
			max={100}
			showPercent
			fillTone="primary"
			remainderTone="offline"
			borderTone="loading"
			ariaLabel="Job progress"
		/>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">Plain (no header)</h2>
		<ProgressMeter value={64} fillTone="online" remainderTone="error" valueLabel="64%" />
	</section>
</div>
