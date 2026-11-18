<script lang="ts">
	import Chart from './chart.svelte';
	import { buildBarConfig } from './chart.config';
	import type { BarChartBaseProps } from './chart.types';

	type Props = BarChartBaseProps;

	let {
		labels,
		series,
		orientation = 'vertical',
		showLegend = true,
		showGrid = false,
		showAxes = true,
		barThickness,
		showCategoryAxisTitle = false,
		categoryAxisTitle = '',
		showValueAxisTitle = false,
		valueAxisTitle = '',
		class: className = ''
	}: Props = $props();

	const config = $derived(
		buildBarConfig({
			labels,
			series,
			orientation,
			showLegend,
			showGrid,
			showAxes,
			barThickness,
			stacked: true,
			showCategoryAxisTitle,
			categoryAxisTitle,
			showValueAxisTitle,
			valueAxisTitle
		})
	);
</script>

<Chart {config} class={className} />
