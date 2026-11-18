<script lang="ts">
	import type { ProgressBarStep } from './progress-bar.constants';
	import type { ProgressBarStepStatus } from './progress-bar.utils';
	import type { resolveProgressBarStepColors } from './progress-bar.colors';
	import {
		progressBarCirclesInlineStepClass,
		progressBarCirclesLabeledTitleClass
	} from './progress-bar.styles';
	import ProgressBarCirclesHorizontalIcon from './progress-bar-circles-horizontal-icon.svelte';

	type Props = {
		step: ProgressBarStep;
		status: ProgressBarStepStatus;
		index: number;
		stepColors: ReturnType<typeof resolveProgressBarStepColors>;
		circleClass: string;
		showStepIndicator: boolean;
		ariaCurrent?: 'step' | true | undefined;
	};

	let { step, status, index, stepColors, circleClass, showStepIndicator, ariaCurrent }: Props =
		$props();
</script>

<div class={progressBarCirclesInlineStepClass} aria-current={ariaCurrent}>
	<div class={circleClass}>
		<ProgressBarCirclesHorizontalIcon {step} {status} {stepColors} {index} {showStepIndicator} />
	</div>
	<span class={progressBarCirclesLabeledTitleClass(status, stepColors)}>{step.label}</span>
</div>
