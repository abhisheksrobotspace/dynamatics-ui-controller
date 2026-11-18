<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils/cn';
	import {
		PROGRESS_METER_DEFAULT_BORDER_TONE,
		PROGRESS_METER_DEFAULT_FILL_TONE,
		PROGRESS_METER_DEFAULT_MAX,
		PROGRESS_METER_DEFAULT_REMAINDER_TONE,
		type ProgressMeterBorderTone,
		type ProgressMeterTone
	} from './progress-meter.constants';
	import {
		progressMeterFillClass,
		progressMeterHeaderClass,
		progressMeterLabelClass,
		progressMeterPercentClass,
		progressMeterRootClass,
		progressMeterTitleClass,
		progressMeterTrackClass
	} from './progress-meter.styles';

	type Props = {
		value: number;
		max?: number;
		/** Optional uppercase title above the track (e.g. "Progress"). */
		label?: string;
		/** Show computed percent on the right of the label row. */
		showPercent?: boolean;
		/** Optional numeric caption below the track. */
		valueLabel?: string;
		fillTone?: ProgressMeterTone;
		remainderTone?: ProgressMeterTone;
		/** Track outline tone. Use `loading` for the blue HMI border. */
		borderTone?: ProgressMeterBorderTone;
		fillClass?: string;
		remainderClass?: string;
		class?: string;
		trackClass?: string;
		labelClass?: string;
		titleClass?: string;
		percentClass?: string;
		ariaLabel?: string;
	} & HTMLAttributes<HTMLDivElement>;

	let {
		value,
		max = PROGRESS_METER_DEFAULT_MAX,
		label,
		showPercent = false,
		valueLabel,
		fillTone = PROGRESS_METER_DEFAULT_FILL_TONE,
		remainderTone = PROGRESS_METER_DEFAULT_REMAINDER_TONE,
		borderTone = PROGRESS_METER_DEFAULT_BORDER_TONE,
		fillClass = '',
		remainderClass = '',
		class: className = '',
		trackClass = '',
		labelClass = '',
		titleClass = '',
		percentClass = '',
		ariaLabel,
		...rest
	}: Props = $props();

	const percent = $derived(Math.min(100, Math.max(0, max > 0 ? (value / max) * 100 : 0)));
	const percentText = $derived(`${Math.round(percent)}%`);
	const showHeader = $derived(Boolean(label) || showPercent);
	const rootClasses = $derived(progressMeterRootClass(className));
	const headerClasses = $derived(progressMeterHeaderClass());
	const titleClasses = $derived(progressMeterTitleClass(titleClass));
	const percentClasses = $derived(progressMeterPercentClass(fillTone, percentClass));
	const trackClasses = $derived(
		cn(progressMeterTrackClass(remainderTone, borderTone, trackClass), remainderClass)
	);
	const fillClasses = $derived(progressMeterFillClass(fillTone, fillClass));
	const valueLabelClasses = $derived(progressMeterLabelClass(labelClass));
</script>

<div class={rootClasses} {...rest}>
	{#if showHeader}
		<div class={headerClasses}>
			{#if label}
				<p class={titleClasses}>{label}</p>
			{:else}
				<span></span>
			{/if}
			{#if showPercent}
				<p class={percentClasses}>{percentText}</p>
			{/if}
		</div>
	{/if}

	<div
		class={cn(trackClasses, showHeader && 'mt-2')}
		role="progressbar"
		aria-valuemin={0}
		aria-valuemax={max}
		aria-valuenow={value}
		aria-label={ariaLabel ?? label}
	>
		<div class={fillClasses} style:width="{percent}%"></div>
	</div>

	{#if valueLabel}
		<div class={valueLabelClasses}>{valueLabel}</div>
	{/if}
</div>
