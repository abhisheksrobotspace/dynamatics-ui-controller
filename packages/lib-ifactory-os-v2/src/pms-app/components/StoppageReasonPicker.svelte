<script lang="ts">
	import { TriangleAlert, X } from '@lucide/svelte';
	import {
		formatHms,
		pmsStore,
		publishReasonSelected,
		selectStoppageReason
	} from '../lib/hmi-store.svelte';
	import type { StoppageReason } from '$lib/stoppage-reasons';
	import type { AppNavigation } from '../lib/navigation';
	import ReasonGrid from './ReasonGrid.svelte';

	/* Figma: HMI FROZEN DESIGN → stop-reason · Most used · tap-to-log (no confirm). Shared by the
	   angle, plate and manual lines. */
	let { navigation, reasons }: { navigation: AppNavigation; reasons: StoppageReason[] } = $props();

	const canCancelReasonChange = $derived(pmsStore.selectedReason !== null);

	/** Tap-to-log: no confirm step (the grid holds the pressed look briefly first). */
	function onSelectReason(reason: StoppageReason) {
		selectStoppageReason(reason);
		publishReasonSelected(reason);
		navigation.navigateTo('StoppedDetail');
	}
</script>

<div class="flex h-full min-h-0 w-full flex-col bg-white font-body text-[#1b2028]">
	<header class="flex h-[78px] shrink-0 items-center gap-5 bg-[#e23b2e] px-[30px]">
		<span
			class="flex size-16 shrink-0 items-center justify-center rounded-[10px] bg-[#8e1f17] text-white"
		>
			<TriangleAlert class="size-9" strokeWidth={2.5} />
		</span>
		<p
			class="m-0 min-w-0 flex-1 truncate text-[40px] leading-[51px] font-bold tracking-[1.1px] text-white uppercase"
		>
			Machine stopped
		</p>
		<p
			class="m-0 shrink-0 font-heading text-2xl leading-[33px] font-bold tracking-[0.6px] text-[#ffe4e1] uppercase"
		>
			Stopped for
		</p>
		<p class="m-0 shrink-0 text-[52px] leading-[66px] font-bold text-white tabular-nums">
			{formatHms(pmsStore.stoppedSeconds)}
		</p>
		{#if canCancelReasonChange}
			<button
				type="button"
				class="flex size-14 shrink-0 cursor-pointer items-center justify-center rounded-[10px] border-2 border-white/60 bg-[#8e1f17] text-white"
				aria-label="Keep the current reason"
				title="Keep the current reason"
				onclick={() => navigation.navigateTo('StoppedDetail')}
			>
				<X class="size-8" strokeWidth={2.5} />
			</button>
		{/if}
	</header>

	<ReasonGrid {reasons} onselect={onSelectReason} class="flex-1 pt-[34px] pr-[30px] pb-4 pl-7" />
</div>
