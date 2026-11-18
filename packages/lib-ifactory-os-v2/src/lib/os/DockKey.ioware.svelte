<script lang="ts">
	import type { Component } from 'svelte';
	import { createHmiPress } from '@ifactory/ui-v2';

	/* Figma: HMI FROZEN DESIGN → hmi-rail dock-item (56 px key over a 4 px edge, 13 px label). */
	let {
		label,
		icon: Icon,
		selected = false,
		size = 'md',
		onclick
	}: {
		label: string;
		icon: Component<{ class?: string; strokeWidth?: number }>;
		selected?: boolean;
		/** md = 56 px dock key; lg = 120 px launcher key. */
		size?: 'md' | 'lg';
		onclick: () => void;
	} = $props();

	const lg = $derived(size === 'lg');

	const press = createHmiPress();
</script>

<button
	type="button"
	class="flex cursor-pointer flex-col items-center border-0 {lg
		? 'w-[140px] gap-2.5'
		: 'w-[68px] gap-1'} bg-transparent p-0 select-none [-webkit-tap-highlight-color:transparent]"
	aria-current={selected ? 'true' : undefined}
	aria-label={label}
	{onclick}
	{...press.handlers}
>
	<span
		class="flex flex-col {lg ? 'size-[120px] rounded-2xl' : 'size-14 rounded-[10px]'} {press.pressed
			? lg
				? 'pt-1.5'
				: 'pt-1'
			: selected
				? lg
					? 'bg-[#a13a0f] pb-1.5'
					: 'bg-[#a13a0f] pb-1'
				: lg
					? 'bg-[#101215] pb-1.5'
					: 'bg-[#101215] pb-1'}"
	>
		<span
			class="flex min-h-0 w-full flex-1 items-center justify-center {lg
				? 'rounded-2xl'
				: 'rounded-[10px]'} {selected ? 'bg-[#f26b2a] text-white' : 'bg-[#343a40] text-[#e6e8eb]'}"
		>
			<Icon class={lg ? 'size-[56px]' : 'size-[30px]'} strokeWidth={2.5} />
		</span>
	</span>
	<span
		class="font-['Space_Grotesk',sans-serif] font-bold {lg
			? 'text-[22px] leading-7'
			: 'text-[13px] leading-[17px]'} {selected ? 'text-white' : 'text-[#a9b0b7]'}"
	>
		{label}
	</span>
</button>
