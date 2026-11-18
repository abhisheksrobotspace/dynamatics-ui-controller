<script lang="ts">
	import type { Component } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import { LoaderCircle } from '@lucide/svelte';
	import { createHmiPress } from './hmi-press.svelte';
	import {
		hmiButtonClass,
		hmiButtonFaceClass,
		hmiButtonIconClass,
		hmiButtonTileClass,
		type HmiButtonSize,
		type HmiButtonTone
	} from './hmi.styles';

	type Props = {
		/** Omit for an icon-only square button (give it an `aria-label`). */
		label?: string;
		icon?: Component<{ class?: string; strokeWidth?: number }>;
		tone?: HmiButtonTone;
		/** lg = 96 px main action, md = 72 px secondary. Nothing smaller on HMI. */
		size?: HmiButtonSize;
		loading?: boolean;
		disabled?: boolean;
		class?: string;
		/** Classes for the face (padding, text size): `class` styles the edge / outer box. */
		faceClass?: string;
	} & Omit<HTMLButtonAttributes, 'disabled' | 'children' | 'class'>;

	let {
		label,
		icon: Icon,
		tone = 'neutral',
		size = 'lg',
		loading = false,
		disabled = false,
		class: className = '',
		faceClass = '',
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
	class={hmiButtonClass(tone, size, press.pressed, inactive, className, !label)}
	{...press.handlers}
>
	<span class={hmiButtonFaceClass(tone, size, press.pressed, inactive, !label, faceClass)}>
		{#if Icon || loading}
			<span class={hmiButtonTileClass(tone, size, inactive)} aria-hidden="true">
				{#if loading}
					<LoaderCircle class="{hmiButtonIconClass(size)} animate-spin" strokeWidth={2.5} />
				{:else if Icon}
					<Icon class={hmiButtonIconClass(size)} strokeWidth={2.5} />
				{/if}
			</span>
		{/if}
		{#if label}
			<span>{label}</span>
		{/if}
	</span>
</button>
