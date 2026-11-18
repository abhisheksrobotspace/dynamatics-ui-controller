<script lang="ts">
	import type { StoppageReason } from '$lib/stoppage-reasons';
	import { orderReasons, reasonIcon, reasonLabel } from '../lib/reason-categories';

	/* Figma: HMI FROZEN DESIGN → stop-reason · tap-to-log (4 × 4 reason keys, 7 px skirt). */
	type Props = {
		reasons: StoppageReason[];
		/** Called after the pressed look has shown for PRESS_MS. */
		onselect: (reason: StoppageReason) => void;
		class?: string;
	};

	let { reasons, onselect, class: className = '' }: Props = $props();

	/** Pressed look must stay visible this long, so a tap that logs and leaves is still seen. */
	const PRESS_MS = 120;

	const ordered = $derived(orderReasons(reasons));
	let pressed = $state<string | null>(null);
	let logging = false;

	function select(reason: StoppageReason) {
		if (logging) return;
		logging = true;
		pressed = reason.alertCode;
		setTimeout(() => {
			onselect(reason);
			pressed = null;
			logging = false;
		}, PRESS_MS);
	}
</script>

<div
	class="grid min-h-0 grid-cols-4 content-start gap-3 overflow-x-hidden overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden {className}"
>
	{#each ordered as reason, index (reason.alertCode)}
		{@const Icon = reasonIcon(reason)}
		{@const isPressed = pressed === reason.alertCode}
		<!-- Ticket reasons (a breakdown needs a closed ticket to resume) get the red icon tile. -->
		{@const ticket = reason.requiresAck === true}
		<button
			type="button"
			class="flex h-[139px] w-full min-w-0 cursor-pointer flex-col rounded-[10px] p-0 text-left select-none touch-manipulation {isPressed
				? 'pt-[5px] pb-0.5'
				: 'bg-[#8e96a1] pb-[7px]'}"
			onpointerdown={() => (pressed = reason.alertCode)}
			onpointerleave={() => !logging && (pressed = null)}
			onpointercancel={() => !logging && (pressed = null)}
			onclick={() => select(reason)}
		>
			<span
				class="relative flex min-h-0 w-full flex-1 items-center gap-3.5 rounded-[10px] pr-3 pl-3.5 {isPressed
					? 'border-3 border-[#ff6b2c] bg-[#dde1e6]'
					: 'border-2 border-[#b4bac3] bg-[#f7f8fa]'}"
			>
				<span
					class="flex size-16 shrink-0 items-center justify-center rounded-lg text-white {ticket
						? 'bg-[#dc2626]'
						: 'bg-[#3a3e46]'}"
				>
					<Icon class="size-[38px]" strokeWidth={2.2} />
				</span>
				<span class="line-clamp-2 min-w-0 flex-1 text-[28px] leading-9 font-bold text-[#1b2028]">
					{reasonLabel(reason)}
				</span>
				<!-- Position number (1…n) in the corner, so a long one-word label keeps the full width. -->
				<span
					class="absolute top-1.5 right-1.5 flex h-6 min-w-7 items-center justify-center rounded-md bg-[#e5e7eb] px-1 text-base leading-5 font-bold text-[#4b5563]"
					aria-hidden="true"
				>
					{index + 1}
				</span>
			</span>
		</button>
	{/each}
</div>
