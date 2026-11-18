<script lang="ts">
	import type { Component } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils/cn';
	import { HMI_HOLD_DEFAULT_MS, type HmiTone } from './hmi.constants';
	import {
		hmiHoldButtonClass,
		hmiHoldButtonFaceClass,
		hmiHoldButtonFillClass,
		hmiHoldButtonHintClass,
		hmiHoldButtonIconClass,
		hmiHoldButtonLabelClass
	} from './hmi.styles';

	type Props = {
		label: string;
		icon?: Component<{ class?: string; strokeWidth?: number }>;
		tone?: HmiTone;
		/** How long the operator must hold before `onConfirm` fires. */
		holdDuration?: number;
		disabled?: boolean;
		class?: string;
		faceClass?: string;
		labelClass?: string;
		iconClass?: string;
		/** Small line under the label, inside the face (e.g. "Press and hold END JOB for 1.5 s"). */
		hint?: string;
		hintClass?: string;
		onConfirm?: () => void;
		onHoldStart?: () => void;
		/** Released before the hold completed. */
		onHoldCancel?: () => void;
	} & Omit<HTMLButtonAttributes, 'disabled' | 'children'>;

	let {
		label,
		icon: Icon,
		tone = 'stop',
		holdDuration = HMI_HOLD_DEFAULT_MS,
		disabled = false,
		class: className = '',
		faceClass = '',
		labelClass = '',
		iconClass = '',
		hint,
		hintClass = '',
		onConfirm,
		onHoldStart,
		onHoldCancel,
		...rest
	}: Props = $props();

	let holding = $state(false);
	let progress = $state(0);
	let startedAt = 0;
	let frame = 0;

	function tickHold(now: number) {
		progress = Math.min(1, (now - startedAt) / holdDuration);
		if (progress >= 1) {
			finish();
			onConfirm?.();
			return;
		}
		frame = requestAnimationFrame(tickHold);
	}

	function finish() {
		cancelAnimationFrame(frame);
		holding = false;
		progress = 0;
	}

	function startHold() {
		if (disabled || holding) return;
		holding = true;
		startedAt = performance.now();
		onHoldStart?.();
		frame = requestAnimationFrame(tickHold);
	}

	function cancelHold() {
		if (!holding) return;
		finish();
		onHoldCancel?.();
	}

	function handleKeydown(event: KeyboardEvent) {
		if ((event.key === 'Enter' || event.key === ' ') && !event.repeat) {
			event.preventDefault();
			startHold();
		}
	}

	function handleKeyup(event: KeyboardEvent) {
		if (event.key === 'Enter' || event.key === ' ') cancelHold();
	}

	$effect(() => () => cancelAnimationFrame(frame));
</script>

<button
	type="button"
	{...rest}
	{disabled}
	aria-label="{label} (press and hold)"
	class={hmiHoldButtonClass(tone, holding, disabled, className)}
	onpointerdown={startHold}
	onpointerup={cancelHold}
	onpointerleave={cancelHold}
	onpointercancel={cancelHold}
	onkeydown={handleKeydown}
	onkeyup={handleKeyup}
	onblur={cancelHold}
	oncontextmenu={(event) => event.preventDefault()}
>
	<span
		class={hmiHoldButtonFaceClass(
			tone,
			disabled,
			cn(hint && 'flex-col gap-1.5', faceClass),
			holding
		)}
	>
		<span class={hmiHoldButtonFillClass} style:width="{progress * 100}%" aria-hidden="true"></span>
		{#if hint}
			<span class="relative flex items-center gap-4">
				{#if Icon}
					<Icon class={cn(hmiHoldButtonIconClass, iconClass)} strokeWidth={2.5} />
				{/if}
				<span class={cn(hmiHoldButtonLabelClass, labelClass)}>{label}</span>
			</span>
			<span class={cn(hmiHoldButtonHintClass, hintClass)}>{hint}</span>
		{:else}
			{#if Icon}
				<Icon class={cn(hmiHoldButtonIconClass, iconClass)} strokeWidth={2.5} />
			{/if}
			<span class={cn(hmiHoldButtonLabelClass, labelClass)}>{label}</span>
		{/if}
	</span>
</button>
