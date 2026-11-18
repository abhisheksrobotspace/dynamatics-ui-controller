<script lang="ts">
	import type { ProgressBarStep } from './progress-bar.constants';
	import type { ProgressBarStepStatus } from './progress-bar.utils';
	import type { resolveProgressBarStepColors } from './progress-bar.colors';
	import {
		progressBarCirclesHorizontalCircleTrackClass,
		progressBarCirclesHorizontalLabelClass,
		progressBarCirclesHorizontalLabeledStepClass,
		progressBarCirclesLabeledDescriptionClass,
		progressBarCirclesLabeledTitleClass
	} from './progress-bar.styles';
	import ProgressBarCirclesHorizontalIcon from './progress-bar-circles-horizontal-icon.svelte';

	type Props = {
		step: ProgressBarStep;
		status: ProgressBarStepStatus;
		stepColors: ReturnType<typeof resolveProgressBarStepColors>;
		circleClass: string;
		ariaCurrent?: 'step' | true | undefined;
	};

	let { step, status, stepColors, circleClass, ariaCurrent }: Props = $props();
</script>

<div class={progressBarCirclesHorizontalLabeledStepClass} aria-current={ariaCurrent}>
	<div class={progressBarCirclesHorizontalCircleTrackClass}>
		<div class={circleClass}>
			<ProgressBarCirclesHorizontalIcon {step} {status} {stepColors} />
		</div>
	</div>
	<div class={progressBarCirclesHorizontalLabelClass}>
		<span class={progressBarCirclesLabeledTitleClass(status, stepColors)}>{step.label}</span>
		{#if step.description}
			<span class={progressBarCirclesLabeledDescriptionClass}>{step.description}</span>
		{/if}
	</div>
</div>
