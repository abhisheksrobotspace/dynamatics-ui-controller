<script lang="ts">
	import type { Component } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import { LoaderCircle } from '@lucide/svelte';
	import { cn } from '$lib/utils/cn';
	import type { HmiTone } from './hmi.constants';
	import { createHmiPress } from './hmi-press.svelte';
	import {
		hmiFlatButtonClass,
		hmiFlatButtonFaceClass,
		hmiFlatButtonIconClass,
		type HmiFlatButtonSize
	} from './hmi.styles';

	type Props = {
		/** Omit for an icon-only button (give it an `aria-label`). */
		label?: string;
		icon?: Component<{ class?: string; strokeWidth?: number }>;
		tone?: HmiTone;
		/** lg 118 px main action, md 96 px, sm 74 px, xs 56 px toolbar. */
		size?: HmiFlatButtonSize;
		/** Selected / toggled-on look (orange edge, light orange face). */
		active?: boolean;
		loading?: boolean;
		disabled?: boolean;
		class?: string;
		faceClass?: string;
		iconClass?: string;
	} & Omit<HTMLButtonAttributes, 'disabled' | 'children' | 'class'>;

	let {
		label,
		icon: Icon,
		tone = 'neutral',
		size = 'lg',
		active = false,
		loading = false,
		disabled = false,
		class: className = '',
		faceClass = '',
		iconClass = '',
		type = 'button',
		...rest
	}: Props = $props();

	const press = createHmiPress();
	const inactive = $derived(disabled || loading);
</script>

<button
	{type}
	{...rest}
	disabled={inactive}
	aria-busy={loading || undefined}
	aria-pressed={active || undefined}
	class={hmiFlatButtonClass(tone, size, press.pressed, inactive, active, className)}
	{...press.handlers}
>
	<span class={hmiFlatButtonFaceClass(tone, size, inactive, active, faceClass, press.pressed)}>
		{#if loading}
			<LoaderCircle class="{hmiFlatButtonIconClass(size)} animate-spin" strokeWidth={2.5} />
		{:else if Icon}
			<Icon class={cn(hmiFlatButtonIconClass(size), iconClass)} strokeWidth={2.5} />
		{/if}
		{#if label}
			<span>{label}</span>
		{/if}
	</span>
</button>
