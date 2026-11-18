<script lang="ts">
	import { onMount } from 'svelte';
	import {
		Chart as ChartJs,
		type ChartConfiguration,
		type ChartType,
		registerables
	} from 'chart.js';
	import { cn } from '$lib/utils/cn';

	ChartJs.register(...registerables);

	type Props = {
		/** Full Chart.js config (`type`, `data`, `options`, …). */
		config: ChartConfiguration<ChartType>;
		class?: string;
	};

	let { config, class: className = '' }: Props = $props();

	let canvas: HTMLCanvasElement | undefined = $state();
	let chart: ChartJs | undefined;

	onMount(() => {
		if (!canvas) return;
		// ponytail: no structuredClone — Chart.js options include functions (tooltips)
		chart = new ChartJs(canvas, config);
		return () => {
			chart?.destroy();
			chart = undefined;
		};
	});

	$effect(() => {
		if (!chart) return;
		const next = config;
		chart.data = next.data;
		chart.options = next.options ?? {};
		chart.update('none');
	});
</script>

<div class={cn('relative w-full', className)}>
	<canvas bind:this={canvas}></canvas>
</div>
