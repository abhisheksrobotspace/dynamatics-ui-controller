<script lang="ts">
	import type { Component } from 'svelte';
	import { HmiFlatButton } from '@ifactory/ui-v2';
	import { Check, Glasses, Hand, HardHat, Headphones, ShieldCheck } from '@lucide/svelte';
	import SafetyShoeIcon from '$lib/assets/icons/SafetyShoeIcon.svelte';

	export type SafetyCheckItemKey =
		'helmet' | 'goggles' | 'earProtection' | 'gloves' | 'safetyShoes';

	export type SafetyCheckResult = {
		items: Record<SafetyCheckItemKey, boolean>;
		confirmedAt: string;
	};

	type Props = {
		loading?: boolean;
		onstart: (result: SafetyCheckResult) => void;
	};

	let { loading = false, onstart }: Props = $props();

	const ITEMS: { key: SafetyCheckItemKey; label: string; icon: Component<{ class?: string }> }[] = [
		{ key: 'helmet', label: 'Helmet', icon: HardHat },
		{ key: 'goggles', label: 'Goggles', icon: Glasses },
		{ key: 'earProtection', label: 'Ear protection', icon: Headphones },
		{ key: 'gloves', label: 'Gloves', icon: Hand },
		{ key: 'safetyShoes', label: 'Safety shoes', icon: SafetyShoeIcon }
	];

	let checked = $state<Record<SafetyCheckItemKey, boolean>>({
		helmet: false,
		goggles: false,
		earProtection: false,
		gloves: false,
		safetyShoes: false
	});

	const confirmedCount = $derived(ITEMS.filter((item) => checked[item.key]).length);

	/* Figma: HMI FROZEN DESIGN → hmi-login · safety check (hmi-check-tile, hmi-button lg).
	   Keycap tiles with no press motion; a ticked tile takes the flat button's selected look
	   (orange edge, light orange face). */
	function tileClass(isChecked: boolean): string {
		return `flex h-20 w-full shrink-0 cursor-pointer flex-col rounded-[10px] p-0 pb-1.5 text-left select-none touch-manipulation [-webkit-tap-highlight-color:transparent] ${
			isChecked ? 'bg-[#f26b2a]' : 'bg-[#9aa1aa]'
		}`;
	}

	function tileFaceClass(isChecked: boolean): string {
		const base =
			'flex min-h-0 w-full flex-1 items-center gap-5 rounded-[10px] border-2 pr-5 pl-3.5';
		return isChecked
			? `${base} border-[#f26b2a] bg-[#fff2e8]`
			: `${base} border-[#c3c8cf] bg-gradient-to-b from-[#f7f8f9] to-[#e4e7eb] shadow-[inset_0_1px_0_rgba(255,255,255,0.28)]`;
	}

	function toggle(key: SafetyCheckItemKey) {
		checked[key] = !checked[key];
	}

	function start() {
		// The checklist is recorded as ticked; it does not block the shift.
		if (loading) return;
		onstart({ items: { ...checked }, confirmedAt: new Date().toISOString() });
	}
</script>

<div class="flex w-[544px] max-w-full flex-col">
	<h1 class="m-0 font-body text-[40px] leading-[51px] font-bold text-[#1a1c20]">Safety check</h1>
	<div class="mt-[42px] flex flex-col gap-3" role="group" aria-label="Safety gear">
		{#each ITEMS as item (item.key)}
			{@const Icon = item.icon}
			<button
				type="button"
				role="checkbox"
				aria-checked={checked[item.key]}
				class={tileClass(checked[item.key])}
				onclick={() => toggle(item.key)}
			>
				<span class={tileFaceClass(checked[item.key])}>
					<span
						class="flex size-14 shrink-0 items-center justify-center rounded-full bg-[#ff6c2e] text-white"
					>
						<Icon class="size-8 [stroke-width:2.5]" />
					</span>
					<span
						class="min-w-0 flex-1 truncate font-body text-2xl leading-[31px] font-bold tracking-[0.03em] text-[#1a1c20] uppercase"
					>
						{item.label}
					</span>
					{#if checked[item.key]}
						<span
							class="flex size-11 shrink-0 items-center justify-center rounded-lg bg-[#f26b2a] text-white"
						>
							<Check class="size-[26px] [stroke-width:2.5]" />
						</span>
					{:else}
						<span class="size-11 shrink-0 rounded-lg border-3 border-[#9aa1ab] bg-white"></span>
					{/if}
				</span>
			</button>
		{/each}
	</div>

	<p class="m-0 mt-[18px] font-heading text-xl leading-[27px] font-bold text-[#4a505a]">
		{confirmedCount} of {ITEMS.length} confirmed
	</p>

	<HmiFlatButton
		label="Start shift"
		icon={ShieldCheck}
		tone="primary"
		size="md"
		{loading}
		class="mt-[11px] w-full"
		onclick={start}
	/>
</div>
