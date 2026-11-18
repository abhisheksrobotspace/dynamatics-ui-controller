<script lang="ts">
	import { tick } from 'svelte';
	import type { HTMLInputAttributes } from 'svelte/elements';
	import { Minus, Plus } from '@lucide/svelte';
	import { cn } from '$lib/utils/cn';
	import {
		numberInputButtonClasses,
		numberInputFieldClasses,
		type NumberInputSize
	} from './number-input.styles';
	import { adjustByStep, inferStepFromText, parseNumberInput } from './number-input.utils';

	type Props = {
		id?: string;
		value?: number;
		min?: number;
		max?: number;
		size?: NumberInputSize;
		disabled?: boolean;
		class?: string;
	} & Omit<HTMLInputAttributes, 'size' | 'type' | 'min' | 'max' | 'step' | 'value'>;

	let {
		id,
		value = $bindable(0),
		min,
		max,
		size = 'md',
		disabled = false,
		class: className = '',
		autofocus,
		...rest
	}: Props = $props();

	let inputEl = $state<HTMLInputElement | null>(null);
	let inputText = $state(String(value ?? ''));

	function clamp(next: number): number {
		let result = min !== undefined ? Math.max(min, next) : next;
		if (max !== undefined) {
			result = Math.min(max, result);
		}
		return result;
	}

	function currentNumericValue(): number {
		return parseNumberInput(inputText) ?? value ?? 0;
	}

	function effectiveStep(): number {
		return inferStepFromText(inputText);
	}

	function syncInputFromValue() {
		inputText = value === undefined || Number.isNaN(value) ? '' : String(value);
	}

	function commitInput() {
		const parsed = parseNumberInput(inputText);
		if (parsed === null) {
			value = clamp(min ?? 0);
			syncInputFromValue();
			return;
		}

		value = clamp(parsed);
		syncInputFromValue();
	}

	function clearSelection() {
		window.getSelection()?.removeAllRanges();
		if (inputEl) {
			const len = inputEl.value.length;
			inputEl.setSelectionRange(len, len);
		}
	}

	function handleStepMouseDown(event: MouseEvent) {
		event.preventDefault();
	}

	function decrement() {
		if (disabled) return;
		const next = clamp(adjustByStep(currentNumericValue(), effectiveStep(), -1));
		value = next;
		syncInputFromValue();
		clearSelection();
	}

	function increment() {
		if (disabled) return;
		const next = clamp(adjustByStep(currentNumericValue(), effectiveStep(), 1));
		value = next;
		syncInputFromValue();
		clearSelection();
	}

	function handleInput(event: Event) {
		const target = event.currentTarget as HTMLInputElement;
		inputText = target.value;

		const parsed = parseNumberInput(inputText);
		if (parsed !== null) {
			value = clamp(parsed);
		}
	}

	function handleBlur() {
		commitInput();
	}

	$effect(() => {
		if (inputEl && document.activeElement === inputEl) return;
		syncInputFromValue();
	});

	$effect(() => {
		if (!autofocus || !inputEl) return;
		void tick().then(() => inputEl?.focus());
	});
</script>

<div class={cn('flex items-stretch gap-2', className)}>
	<button
		type="button"
		class={numberInputButtonClasses(size)}
		onmousedown={handleStepMouseDown}
		onclick={decrement}
		disabled={disabled || (min !== undefined && currentNumericValue() <= min)}
		aria-label="Decrease value"
	>
		<Minus class="size-4" aria-hidden="true" />
	</button>
	<input
		bind:this={inputEl}
		{id}
		type="number"
		class={numberInputFieldClasses(size)}
		{min}
		{max}
		step="any"
		value={inputText}
		oninput={handleInput}
		onblur={handleBlur}
		{disabled}
		{autofocus}
		{...rest}
	/>
	<button
		type="button"
		class={numberInputButtonClasses(size)}
		onmousedown={handleStepMouseDown}
		onclick={increment}
		disabled={disabled || (max !== undefined && currentNumericValue() >= max)}
		aria-label="Increase value"
	>
		<Plus class="size-4" aria-hidden="true" />
	</button>
</div>
