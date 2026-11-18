<script lang="ts">
	import { CircleCheck } from '@lucide/svelte';
	import type { ProgressBarStep } from './progress-bar.constants';
	import type { ProgressBarStepStatus } from './progress-bar.utils';
	import type { resolveProgressBarStepColors } from './progress-bar.colors';
	import {
		progressBarBulletsCompleteIconClass,
		progressBarBulletsCompleteIconShellClass,
		progressBarBulletsCurrentIconShellClass,
		progressBarBulletsCurrentInnerDotClass,
		progressBarBulletsCurrentOuterDotClass,
		progressBarBulletsLabelClass,
		progressBarBulletsRowClass,
		progressBarBulletsUpcomingDotClass,
		progressBarBulletsUpcomingIconShellClass
	} from './progress-bar.styles';

	type Props = {
		step: ProgressBarStep;
		status: ProgressBarStepStatus;
		stepColors: ReturnType<typeof resolveProgressBarStepColors>;
		interactive: boolean;
	};

	let { step, status, stepColors, interactive }: Props = $props();
</script>

<span class={progressBarBulletsRowClass}>
	{#if status === 'complete'}
		<span class={progressBarBulletsCompleteIconShellClass}>
			<CircleCheck
				class={progressBarBulletsCompleteIconClass(stepColors, interactive)}
				aria-hidden="true"
			/>
		</span>
	{:else if status === 'current'}
		<span aria-hidden="true" class={progressBarBulletsCurrentIconShellClass}>
			<span class={progressBarBulletsCurrentOuterDotClass(stepColors)}></span>
			<span class={progressBarBulletsCurrentInnerDotClass(stepColors)}></span>
		</span>
	{:else}
		<span aria-hidden="true" class={progressBarBulletsUpcomingIconShellClass}>
			<span class={progressBarBulletsUpcomingDotClass(stepColors, interactive)}></span>
		</span>
	{/if}
	<span class={progressBarBulletsLabelClass(status, stepColors)}>{step.label}</span>
</span>
