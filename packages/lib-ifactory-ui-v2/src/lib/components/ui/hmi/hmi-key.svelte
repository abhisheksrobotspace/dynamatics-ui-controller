<script lang="ts">
	import type { Component, Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import {
		HMI_PRESS_MIN_MS,
		HMI_REPEAT_DELAY_MS,
		HMI_REPEAT_INTERVAL_MS,
		type HmiKeySize,
		type HmiKeyTone
	} from './hmi.constants';
	import {
		hmiKeyClass,
		hmiKeyFaceClass,
		hmiKeyLedClass,
		hmiKeyLegendClass,
		hmiKeyLegendLitClass
	} from './hmi.styles';

	type Props = {
		label?: string;
		/** Legend drawn as an icon in place of `label` (give the key an `aria-label`). */
		icon?: Component<{ class?: string; strokeWidth?: number }>;
		tone?: HmiKeyTone;
		size?: HmiKeySize;
		/** Renders the CAPS-style LED; `true` lights it. Leave unset for no LED. */
		led?: boolean;
		disabled?: boolean;
		class?: string;
		faceClass?: string;
		legendClass?: string;
		/** Holding the key fires `onpress` repeatedly (DEL). */
		repeat?: boolean;
		children?: Snippet;
		onpress?: () => void;
	} & Omit<HTMLButtonAttributes, 'children' | 'disabled'>;

	let {
		label,
		icon: Icon,
		tone = 'default',
		size = 'md',
		led,
		disabled = false,
		class: className = '',
		faceClass = '',
		legendClass = '',
		repeat = false,
		children,
		onpress,
		...rest
	}: Props = $props();

	let pressed = $state(false);
	let pressedAt = 0;
	let releaseTimer: ReturnType<typeof setTimeout> | undefined;
	let repeatDelay: ReturnType<typeof setTimeout> | undefined;
	let repeatInterval: ReturnType<typeof setInterval> | undefined;
	/** Set once auto-repeat fired, so the trailing click doesn't delete one extra char. */
	let repeated = false;

	const lit = $derived(led === true);

	function press() {
		if (disabled) return;
		clearTimeout(releaseTimer);
		pressed = true;
		pressedAt = performance.now();
		if (repeat) {
			repeated = false;
			repeatDelay = setTimeout(() => {
				repeated = true;
				onpress?.();
				repeatInterval = setInterval(() => onpress?.(), HMI_REPEAT_INTERVAL_MS);
			}, HMI_REPEAT_DELAY_MS);
		}
	}

	function stopRepeat() {
		clearTimeout(repeatDelay);
		clearInterval(repeatInterval);
	}

	function release() {
		stopRepeat();
		if (!pressed) return;
		const remaining = HMI_PRESS_MIN_MS - (performance.now() - pressedAt);
		releaseTimer = setTimeout(() => (pressed = false), Math.max(0, remaining));
	}

	/** Keep focus (and caret) in the target input while typing. */
	function keepFocus(event: MouseEvent) {
		event.preventDefault();
	}

	function handleClick() {
		if (repeated) {
			repeated = false;
			return;
		}
		onpress?.();
	}

	$effect(() => () => {
		clearTimeout(releaseTimer);
		stopRepeat();
	});
</script>

<button
	type="button"
	{...rest}
	{disabled}
	class={hmiKeyClass(tone, pressed, disabled, className)}
	onpointerdown={press}
	onpointerup={release}
	onpointerleave={release}
	onpointercancel={release}
	onmousedown={keepFocus}
	oncontextmenu={(event) => repeat && event.preventDefault()}
	onclick={handleClick}
>
	<span class={hmiKeyFaceClass(tone, pressed, faceClass)}>
		{#if led !== undefined}
			<span class={hmiKeyLedClass(lit)} aria-hidden="true"></span>
		{/if}
		{#if children}
			{@render children()}
		{:else if Icon}
			<span
				class={hmiKeyLegendClass(tone, size, pressed, `flex ${legendClass}`)}
				aria-hidden="true"
			>
				<Icon class="size-[1.6em]" strokeWidth={2.25} />
			</span>
		{:else if label}
			<span
				class={hmiKeyLegendClass(
					tone,
					size,
					pressed,
					`${lit ? hmiKeyLegendLitClass : ''} ${legendClass}`
				)}
			>
				{label}
			</span>
		{/if}
	</span>
</button>
