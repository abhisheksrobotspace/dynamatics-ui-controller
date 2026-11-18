<script lang="ts">
	import type { ProgressBarStep } from './progress-bar.constants';
	import type { ProgressBarStepStatus } from './progress-bar.utils';
	import type { resolveProgressBarStepColors } from './progress-bar.colors';
	import {
		progressBarCirclesLabeledDescriptionClass,
		progressBarCirclesLabeledTitleClass
	} from './progress-bar.styles';

	type Props = {
		step: ProgressBarStep;
		status: ProgressBarStepStatus;
		stepColors: ReturnType<typeof resolveProgressBarStepColors>;
	};

	let { step, status, stepColors }: Props = $props();
</script>

<span class={progressBarCirclesLabeledTitleClass(status, stepColors)}>{step.label}</span>
{#if step.description}
	<span class={progressBarCirclesLabeledDescriptionClass}>{step.description}</span>
{/if}
