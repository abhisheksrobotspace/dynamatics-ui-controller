<script lang="ts">
	import { Check } from '@lucide/svelte';
	import type { ProgressBarStep } from './progress-bar.constants';
	import type { ProgressBarStepStatus } from './progress-bar.utils';
	import type { resolveProgressBarStepColors } from './progress-bar.colors';
	import {
		progressBarCirclesCheckIconClass,
		progressBarCirclesDotClass,
		progressBarCirclesNumberTextClass,
		progressBarCirclesUpcomingDotClass
	} from './progress-bar.styles';

	type Props = {
		step: ProgressBarStep;
		status: ProgressBarStepStatus;
		stepColors: ReturnType<typeof resolveProgressBarStepColors>;
		index?: number;
		showStepIndicator?: boolean;
	};

	let { step, status, stepColors, index = 0, showStepIndicator = false }: Props = $props();
</script>

{#if showStepIndicator}
	{#if status === 'complete'}
		<Check class={progressBarCirclesCheckIconClass(stepColors)} aria-hidden="true" />
	{:else}
		<span class={progressBarCirclesNumberTextClass(status, stepColors)} aria-hidden="true">
			{index + 1}
		</span>
	{/if}
{:else if status === 'complete'}
	<Check class={progressBarCirclesCheckIconClass(stepColors)} aria-hidden="true" />
{:else if status === 'current'}
	<span aria-hidden="true" class={progressBarCirclesDotClass(stepColors)}></span>
{:else}
	<span aria-hidden="true" class={progressBarCirclesUpcomingDotClass(stepColors)}></span>
{/if}
<span class="sr-only">{step.label}</span>
