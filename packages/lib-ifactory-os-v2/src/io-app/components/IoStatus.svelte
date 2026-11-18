<script lang="ts">
	import { createHmiPress } from '@ifactory/ui-v2';
	import type { IoPin } from '../lib/io-hardware.js';
	import { toggleInput } from '../lib/io-store.svelte.js';

	let {
		element = $bindable(),
		disabled = false,
		deviceId = 1
	}: { element: IoPin; disabled?: boolean; deviceId?: number } = $props();

	const press = createHmiPress();
	const high = $derived(Boolean(element.status));

	function toggle() {
		if (disabled) return;
		const next = high ? 0 : 1;
		element.status = next;
		toggleInput(deviceId, element.pin, next);
	}
</script>

<!-- Interactive input tile: displays real-time hardware status & allows manual tap testing -->
<button
	type="button"
	role="switch"
	aria-checked={high}
	aria-label="Input {element.label} {element.signal ?? ''} {high ? 'high' : 'low'}"
	{disabled}
	class="flex min-h-[148px] w-full cursor-pointer flex-col rounded-[10px] p-0 select-none [-webkit-tap-highlight-color:transparent] disabled:cursor-not-allowed {press.pressed &&
	!disabled
		? 'pt-1.5'
		: `pb-1.5 ${high ? 'bg-[#15803d]' : 'bg-[#c3c8cf]'}`} {disabled ? 'opacity-70' : ''}"
	{...press.handlers}
	onclick={toggle}
>
	<span
		class="flex w-full flex-1 flex-col items-center justify-between py-2 px-1 rounded-[10px] {high
			? 'bg-[#f0fdf4] border-2 border-[#16a34a]'
			: 'bg-[#f8fafc] border-[1.5px] border-[#c3c8cf]'} font-body font-bold transition-colors"
	>
		<div class="flex flex-col items-center leading-tight">
			<span class="text-[20px] leading-6 {high ? 'text-[#15803d]' : 'text-[#1b2028]'}">
				IN {element.label}
			</span>
			{#if element.signal}
				<span
					class="text-[11px] leading-3 font-semibold {high
						? 'text-[#16a34a]'
						: 'text-[#5a616c]'} truncate max-w-[130px] mt-0.5 text-center"
				>
					{element.signal}
				</span>
			{/if}
		</div>

		<span
			class="size-[34px] rounded-full my-1 transition-all {high
				? 'bg-[#16a34a] shadow-[0_0_12px_rgba(22,163,74,0.7)]'
				: 'border-4 border-[#aeb4bc] bg-white'}"
			aria-hidden="true"
		></span>

		<span class="text-base leading-5 font-bold {high ? 'text-[#15803d]' : 'text-[#7d848c]'}">
			{#if deviceId === 1 && element.label === '1'}
				{high ? 'SAFE (NC)' : 'E-STOP'}
			{:else}
				{high ? 'HIGH' : 'LOW'}
			{/if}
		</span>
	</span>
</button>
