<script lang="ts">
	import { Check } from '@lucide/svelte';
	import type { ProgressBarStep } from './progress-bar.constants';
	import type { ProgressBarStepStatus } from './progress-bar.utils';
	import { formatStepNumber } from './progress-bar.utils';
	import type { resolveProgressBarStepColors } from './progress-bar.colors';
	import {
		progressBarPanelsCheckIconClass,
		progressBarPanelsDescriptionClass,
		progressBarPanelsIconCompleteClass,
		progressBarPanelsIconCurrentClass,
		progressBarPanelsIconShellClass,
		progressBarPanelsIconUpcomingClass,
		progressBarPanelsNumberCurrentClass,
		progressBarPanelsNumberUpcomingClass,
		progressBarPanelsTextClass,
		progressBarPanelsTitleClass
	} from './progress-bar.styles';

	type Props = {
		step: ProgressBarStep;
		status: ProgressBarStepStatus;
		index: number;
		stepColors: ReturnType<typeof resolveProgressBarStepColors>;
	};

	let { step, status, index, stepColors }: Props = $props();
</script>

<span class={progressBarPanelsIconShellClass}>
	{#if status === 'complete'}
		<span class={progressBarPanelsIconCompleteClass(stepColors)}>
			<Check class={progressBarPanelsCheckIconClass(stepColors)} aria-hidden="true" />
		</span>
	{:else if status === 'current'}
		<span class={progressBarPanelsIconCurrentClass(stepColors)}>
			<span class={progressBarPanelsNumberCurrentClass(stepColors)}>{formatStepNumber(index)}</span>
		</span>
	{:else}
		<span class={progressBarPanelsIconUpcomingClass(stepColors)}>
			<span class={progressBarPanelsNumberUpcomingClass(stepColors)}>{formatStepNumber(index)}</span
			>
		</span>
	{/if}
</span>
<span class={progressBarPanelsTextClass(Boolean(step.description))}>
	<span class={progressBarPanelsTitleClass(status, stepColors)}>{step.label}</span>
	{#if step.description}
		<span class={progressBarPanelsDescriptionClass}>{step.description}</span>
	{/if}
</span>
