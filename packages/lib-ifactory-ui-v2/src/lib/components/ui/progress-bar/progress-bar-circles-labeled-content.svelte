<script lang="ts">
	import { Check } from '@lucide/svelte';
	import type { ProgressBarStep } from './progress-bar.constants';
	import type { ProgressBarStepStatus } from './progress-bar.utils';
	import type { resolveProgressBarStepColors } from './progress-bar.colors';
	import {
		progressBarCirclesCheckIconClass,
		progressBarCirclesDotClass,
		progressBarCirclesLabeledDescriptionClass,
		progressBarCirclesLabeledIconCompleteClass,
		progressBarCirclesLabeledIconCurrentClass,
		progressBarCirclesLabeledIconRowClass,
		progressBarCirclesLabeledIconUpcomingClass,
		progressBarCirclesLabeledTextClass,
		progressBarCirclesLabeledTitleClass,
		progressBarCirclesUpcomingDotClass
	} from './progress-bar.styles';

	type Props = {
		step: ProgressBarStep;
		status: ProgressBarStepStatus;
		stepColors: ReturnType<typeof resolveProgressBarStepColors>;
		interactive: boolean;
	};

	let { step, status, stepColors, interactive }: Props = $props();
</script>

<span aria-hidden="true" class={progressBarCirclesLabeledIconRowClass}>
	{#if status === 'complete'}
		<span class={progressBarCirclesLabeledIconCompleteClass(stepColors, interactive)}>
			<Check class={progressBarCirclesCheckIconClass(stepColors)} aria-hidden="true" />
		</span>
	{:else if status === 'current'}
		<span class={progressBarCirclesLabeledIconCurrentClass(stepColors)}>
			<span class={progressBarCirclesDotClass(stepColors)}></span>
		</span>
	{:else}
		<span class={progressBarCirclesLabeledIconUpcomingClass(stepColors, interactive)}>
			<span class={progressBarCirclesUpcomingDotClass(stepColors)}></span>
		</span>
	{/if}
</span>
<span class={progressBarCirclesLabeledTextClass}>
	<span class={progressBarCirclesLabeledTitleClass(status, stepColors)}>{step.label}</span>
	{#if step.description}
		<span class={progressBarCirclesLabeledDescriptionClass}>{step.description}</span>
	{/if}
</span>
