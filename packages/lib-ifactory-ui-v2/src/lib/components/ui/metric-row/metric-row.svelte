<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import QuantityStepper from '$lib/components/ui/input/quantity-stepper.svelte';
	import { cn } from '$lib/utils/cn';
	import {
		metricRowClass,
		metricRowFieldClass,
		metricRowFieldLabelClass,
		metricRowFieldValueClass,
		metricRowFieldsClass,
		metricRowStepperClass,
		metricRowStepperLabelClass,
		metricRowTitleClass
	} from './metric-row.styles';
	import type { MetricField, MetricRowVariant } from './metric-row.types';

	type Props = {
		title: string;
		fields?: MetricField[];
		variant?: MetricRowVariant;
		class?: string;
		titleClass?: string;
		/** When set, shows a trailing quantity stepper controlled by stepperValue. */
		stepperLabel?: string;
		stepperValue?: number;
		stepperMin?: number;
		stepperMax?: number;
		stepperDisabled?: boolean;
		onStepperDecrease?: () => void;
		onStepperIncrease?: () => void;
	} & Omit<HTMLAttributes<HTMLDivElement>, 'title'>;

	let {
		title,
		fields = [],
		variant = 'default',
		class: className = '',
		titleClass = '',
		stepperLabel,
		stepperValue = $bindable(0),
		stepperMin,
		stepperMax,
		stepperDisabled = false,
		onStepperDecrease,
		onStepperIncrease,
		...rest
	}: Props = $props();

	const showStepper = $derived(stepperLabel !== undefined);
	const rootClasses = $derived(metricRowClass(variant, className));
</script>

<div class={rootClasses} {...rest}>
	<span class={cn(metricRowTitleClass, titleClass)}>{title}</span>

	{#if fields.length > 0}
		<div class={metricRowFieldsClass(showStepper)}>
			{#each fields as field, index (field.label + index)}
				{@const fieldSize = field.size ?? (field.align === 'end' ? 'lg' : 'sm')}
				{@const fieldAlign = field.align ?? 'start'}
				<div class={metricRowFieldClass(fieldAlign, fieldSize)}>
					<span class={metricRowFieldLabelClass}>{field.label}</span>
					<span class={metricRowFieldValueClass(field.tone ?? 'default', fieldSize)}>
						{field.value}
					</span>
				</div>
			{/each}
		</div>
	{/if}

	{#if showStepper}
		<div class={metricRowStepperClass}>
			<span class={metricRowStepperLabelClass}>{stepperLabel}</span>
			<QuantityStepper
				bind:value={stepperValue}
				min={stepperMin}
				max={stepperMax}
				disabled={stepperDisabled}
				onDecrease={onStepperDecrease}
				onIncrease={onStepperIncrease}
			/>
		</div>
	{/if}
</div>
