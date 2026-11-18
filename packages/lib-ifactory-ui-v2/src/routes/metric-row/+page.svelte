<script lang="ts">
	import { MetricRow, type MetricField } from '$lib/components/ui/metric-row';
	import DemoBackNav from '../_components/demo-back-nav.svelte';

	const markFields: MetricField[] = [
		{ label: 'PCS/BAR', value: '5' },
		{ label: 'Operations', value: '4' },
		{ label: 'PCS', value: '4' },
		{ label: 'Part Length', value: '1767' },
		{ label: 'Progress', value: '5 / 20', tone: 'primary', align: 'end', size: 'lg' }
	];

	const producedFields: MetricField[] = [
		{ label: 'Part Length', value: '1767' },
		{ label: 'PCS/BAR', value: '5' },
		{ label: 'Planned', value: '20' }
	];

	let produced = $state(20);
</script>

<svelte:head>
	<title>Metric Row — iFactory UI v2</title>
</svelte:head>

<DemoBackNav />

<div class="mx-auto max-w-5xl space-y-12 p-8">
	<header class="space-y-2">
		<h1 class="text-3xl font-semibold">Metric Row</h1>
		<p class="text-muted-foreground">
			Reusable title + field columns row. Field labels/values are data-driven; optional stepper via
			props (no snippets).
		</p>
	</header>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">Read-only metrics</h2>
		<p class="text-sm text-muted-foreground">
			Fields with <code>align: 'end'</code> pin to the trailing edge (progress). Use
			<code>tone: 'primary'</code> / <code>'muted'</code> for highlight state.
		</p>
		<div class="flex flex-col gap-3">
			<MetricRow title="TA4195DA1007" fields={markFields} />
			<MetricRow
				title="TA4195DA1008"
				fields={[
					{ label: 'PCS/BAR', value: '4' },
					{ label: 'Operations', value: '3' },
					{ label: 'PCS', value: '5' },
					{ label: 'Part Length', value: '1450' },
					{ label: 'Progress', value: '4 / 16', tone: 'muted', align: 'end', size: 'lg' }
				]}
			/>
			<MetricRow
				title="TA4195DA1009"
				fields={[
					{ label: 'PCS/BAR', value: '6' },
					{ label: 'Operations', value: '4' },
					{ label: 'PCS', value: '3' },
					{ label: 'Part Length', value: '2140' },
					{ label: 'Progress', value: '6 / 24', tone: 'muted', align: 'end', size: 'lg' }
				]}
			/>
		</div>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">With quantity stepper</h2>
		<MetricRow
			title="TA4195DA1007"
			variant="emphasis"
			fields={producedFields}
			stepperLabel="Produced"
			bind:stepperValue={produced}
			stepperMin={0}
		/>
		<p class="text-sm text-muted-foreground">Produced value: {produced}</p>
	</section>
</div>
