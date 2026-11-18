<script lang="ts">
	import { Minus, Plus } from '@lucide/svelte';
	import { cn } from '$lib/utils/cn';
	import {
		quantityStepperButtonClass,
		quantityStepperRootClass,
		quantityStepperValueClass
	} from './quantity-stepper.styles';

	type Props = {
		value?: number;
		min?: number;
		max?: number;
		disabled?: boolean;
		class?: string;
		buttonClass?: string;
		valueClass?: string;
		decreaseLabel?: string;
		increaseLabel?: string;
		onDecrease?: () => void;
		onIncrease?: () => void;
	};

	let {
		value = $bindable(0),
		min,
		max,
		disabled = false,
		class: className = '',
		buttonClass = '',
		valueClass = '',
		decreaseLabel = 'Decrease value',
		increaseLabel = 'Increase value',
		onDecrease,
		onIncrease
	}: Props = $props();

	const atMin = $derived(min !== undefined && value <= min);
	const atMax = $derived(max !== undefined && value >= max);

	function decrease() {
		if (disabled || atMin) return;
		if (onDecrease) {
			onDecrease();
			return;
		}
		value = min !== undefined ? Math.max(min, value - 1) : value - 1;
	}

	function increase() {
		if (disabled || atMax) return;
		if (onIncrease) {
			onIncrease();
			return;
		}
		value = max !== undefined ? Math.min(max, value + 1) : value + 1;
	}
</script>

<div class={quantityStepperRootClass(className)}>
	<button
		type="button"
		class={cn(quantityStepperButtonClass(), buttonClass)}
		onclick={decrease}
		disabled={disabled || atMin}
		aria-label={decreaseLabel}
	>
		<Minus class="size-8" aria-hidden="true" />
	</button>
	<div class={cn(quantityStepperValueClass(), valueClass)} aria-live="polite">{value}</div>
	<button
		type="button"
		class={cn(quantityStepperButtonClass(), buttonClass)}
		onclick={increase}
		disabled={disabled || atMax}
		aria-label={increaseLabel}
	>
		<Plus class="size-8" aria-hidden="true" />
	</button>
</div>
