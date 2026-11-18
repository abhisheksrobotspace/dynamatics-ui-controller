<script lang="ts">
	import type { ProgressBarAlign } from './progress-bar.constants';
	import type { ProgressBarStep } from './progress-bar.constants';
	import type { ProgressBarStepStatus } from './progress-bar.utils';
	import type { resolveProgressBarStepColors } from './progress-bar.colors';
	import {
		progressBarPanelsContentOffsetClass,
		progressBarPanelsIndicatorClass
	} from './progress-bar.styles';
	import ProgressBarPanelsStepIconText from './progress-bar-panels-step-icon-text.svelte';

	type Props = {
		step: ProgressBarStep;
		status: ProgressBarStepStatus;
		index: number;
		align: ProgressBarAlign;
		stepColors: ReturnType<typeof resolveProgressBarStepColors>;
		showStepIndicator: boolean;
	};

	let { step, status, index, align, stepColors, showStepIndicator }: Props = $props();
</script>

{#if showStepIndicator}
	<span aria-hidden="true" class={progressBarPanelsIndicatorClass(status, align, stepColors)}
	></span>
{/if}
<span class={progressBarPanelsContentOffsetClass(index, align)}>
	<ProgressBarPanelsStepIconText {step} {status} {index} {stepColors} />
</span>
