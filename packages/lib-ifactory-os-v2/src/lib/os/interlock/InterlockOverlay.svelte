<script lang="ts">
	import { HmiFlatButton } from '@ifactory/ui-v2';
	import { Check, Lock, X } from '@lucide/svelte';
	import { dismissInterlockOverlay, interlockOverlay } from './interlock-store.svelte';
</script>

<!-- HMI: full screen like Machine Idle; hero card + flat keys. -->
{#if interlockOverlay.isOpen}
	<div
		class="fixed inset-0 z-[120] flex flex-col items-center justify-center bg-white font-body text-[#1b2028]"
		role="dialog"
		aria-modal="true"
		aria-label="Machine Interlocked"
	>
		<HmiFlatButton
			size="xs"
			icon={X}
			iconClass="size-8"
			aria-label="Close interlock overlay"
			title="Close · status stays on the dock IL"
			class="absolute top-6 right-7 size-[72px]"
			onclick={() => dismissInterlockOverlay()}
		/>

		<section
			class="flex h-[440px] w-[800px] max-w-[calc(100%-60px)] flex-col items-center justify-center gap-4 rounded-xl border-2 border-[#f4c7c3] bg-[#fdf1f0] px-8"
		>
			<span class="flex size-[72px] items-center justify-center rounded-xl bg-[#dc2626] text-white">
				<Lock class="size-10" strokeWidth={2.5} />
			</span>
			<h1 class="m-0 text-[44px] leading-[56px] font-bold tracking-[1.1px] uppercase">
				Machine interlocked
			</h1>
			<p class="m-0 text-[32px] leading-[41px] font-bold text-[#dc2626]">Select a job to start</p>
			<p class="m-0 text-center font-heading text-2xl leading-[33px] font-medium text-[#5a616c]">
				The machine stays locked until a job is started on this panel.
			</p>
		</section>

		<HmiFlatButton
			label="Okay"
			icon={Check}
			tone="primary"
			size="lg"
			class="mt-8 w-[472px]"
			faceClass="text-[34px] leading-[43px]"
			iconClass="size-[42px]"
			onclick={() => dismissInterlockOverlay()}
		/>
	</div>
{/if}
