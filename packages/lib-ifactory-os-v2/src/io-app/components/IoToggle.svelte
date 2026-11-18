<script lang="ts">
	import { createHmiPress } from '@ifactory/ui-v2';
	import type { IoPin } from '../lib/io-hardware.js';
	import { toggleOutput } from '../lib/io-store.svelte.js';

	let {
		element = $bindable(),
		disabled = false,
		locked = false,
		deviceId = 1,
		onLockedClick
	}: {
		element: IoPin;
		disabled?: boolean;
		locked?: boolean;
		deviceId?: number;
		onLockedClick?: () => void;
	} = $props();

	const press = createHmiPress();
	const on = $derived(Boolean(element.status));

	function toggle() {
		if (locked) {
			onLockedClick?.();
			return;
		}
		if (disabled) return;
		const nextStatus = on ? 0 : 1;
		element.status = nextStatus;
		toggleOutput(deviceId, element.pin, nextStatus);
	}
</script>

<!-- Figma: io · GPIO monitor → output tile with industrial rocker switch -->
<button
	type="button"
	role="switch"
	aria-checked={on}
	aria-label="Output {element.label} {element.signal ?? ''}"
	disabled={disabled && !locked}
	class="flex min-h-[206px] w-full cursor-pointer flex-col rounded-[10px] p-0 select-none [-webkit-tap-highlight-color:transparent] disabled:cursor-not-allowed {press.pressed &&
	!disabled && !locked
		? 'pt-1.5'
		: `pb-1.5 ${on ? 'bg-[#1b2028]' : 'bg-[#a3a9b1]'}`} {disabled || locked ? 'opacity-75' : ''}"
	{...press.handlers}
	onclick={toggle}
>
	<span
		class="flex w-full flex-1 flex-col items-center justify-between py-2 px-1 rounded-[10px] bg-white font-body font-bold {on
			? 'border-3 border-[#1b2028]'
			: 'border-[1.5px] border-[#c3c8cf]'}"
	>
		<div class="flex flex-col items-center leading-tight">
			<span class="text-[20px] leading-6 text-[#1b2028]">OUT {element.label}</span>
			{#if element.signal}
				<span class="text-[12px] leading-4 font-semibold text-[#f26b2a] truncate max-w-[130px] mt-0.5">
					{element.signal}
				</span>
			{/if}
			{#if element.relay}
				<span class="text-[11px] leading-3 font-medium text-[#7d848c]">
					{element.relay}
				</span>
			{/if}
		</div>

		<span
			class="relative h-[92px] w-[70px] shrink-0 rounded-xl border-[1.5px] border-[#c3c8cf] bg-gradient-to-b from-white to-[#eceef1] shadow-[0_2px_4px_rgba(0,0,0,0.12)] my-1"
			aria-hidden="true"
		>
			{#if on}
				<span class="absolute top-[2px] left-[27px] h-1 w-3.5 rounded-sm bg-[#1b2028]"></span>
			{/if}
			<span
				class="absolute top-[7px] left-[7px] h-[74px] w-[54px] rounded-lg bg-[#c9ced5] shadow-[inset_0_2px_4px_rgba(0,0,0,0.35)]"
			></span>
			<span
				class="absolute top-[9px] left-[9px] h-[70px] w-[50px] rounded-[7px] transition-[background,box-shadow] duration-100 {on
					? 'bg-gradient-to-b from-white to-[#9aa1aa] shadow-[0_-3px_5px_rgba(0,0,0,0.3),inset_0_-6px_6px_rgba(0,0,0,0.3)]'
					: 'bg-gradient-to-b from-[#b4bac2] to-white shadow-[0_4px_5px_rgba(0,0,0,0.3),inset_0_6px_6px_rgba(0,0,0,0.25)]'}"
			></span>
			<span class="absolute top-[43px] left-[13px] h-[1.5px] w-[42px] bg-[#8f969f]/50"></span>
			<span
				class="absolute top-[18px] left-[27px] size-3 rounded-full border-[2.5px] {on
					? 'border-[#aeb4bc]'
					: 'border-[#5a616c]'}"
			></span>
			<span
				class="absolute top-[55px] left-[32px] h-3.5 w-[3px] rounded-[1.5px] {on
					? 'bg-[#1b2028]'
					: 'border-0 bg-[#aeb4bc]'}"
			></span>
		</span>

		<span class="text-lg leading-[22px] {on ? 'text-[#1b2028]' : 'text-[#7d848c]'}">
			{on ? 'ON' : 'OFF'}
		</span>
	</span>
</button>
