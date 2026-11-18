<script lang="ts">
	import { HmiFlatButton, HmiHoldButton } from '@ifactory/ui-v2';
	import { CircleCheck, CircleX, RotateCw, TriangleAlert } from '@lucide/svelte';
	import { getSelectableCatalogReasons } from '$lib/os/reasons-catalog.svelte.js';
	import type { StoppageReason } from '$lib/stoppage-reasons';
	import { formatHms } from '../lib/hmi-store.svelte';
	import { reasonIcon, reasonLabel, reasonNumber } from '../lib/reason-categories';

	/* Figma: HMI FROZEN DESIGN → stopped · reason logged. Shared by the angle, plate and manual lines;
	   each passes its own summary rows. */
	type Row = { label: string; value: string; tone?: string };

	let {
		reason,
		stoppedSeconds,
		rows,
		percent,
		onChangeReason,
		onCloseTicket,
		onEndJob
	}: {
		reason: StoppageReason;
		stoppedSeconds: number;
		rows: Row[];
		/** Job progress 0–100. */
		percent: number;
		onChangeReason: () => void;
		onCloseTicket: () => void;
		onEndJob: () => void;
	} = $props();

	const ReasonIcon = $derived(reasonIcon(reason));
	/** A ticket reason (breakdown) cannot be changed or ended until its ticket is closed. */
	const canCloseTicket = $derived(reason.requiresAck === true);
	const pct = $derived(Math.max(0, Math.min(100, Math.round(percent))));
</script>

<div
	class="flex h-full min-h-0 w-full gap-6 bg-white pt-1.5 pr-7 pb-[18px] pl-[30px] font-body text-[#1b2028]"
>
	<div class="flex w-[658px] shrink-0 flex-col gap-5">
		<section
			class="flex h-[580px] shrink-0 flex-col items-center justify-center gap-3.5 rounded-xl border-2 border-[#f4c7c3] bg-[#fdf1f0] px-5 py-4"
		>
			<div class="flex items-center gap-3">
				<span
					class="flex size-[52px] shrink-0 items-center justify-center rounded-[9px] bg-[#dc2626] text-white"
				>
					<TriangleAlert class="size-[29px]" strokeWidth={2.5} />
				</span>
				<h1 class="m-0 text-[34px] leading-[43px] font-bold tracking-[1.1px] uppercase">
					Machine stopped
				</h1>
			</div>
			<p
				class="m-0 text-[128px] leading-[163px] font-bold text-[#dc2626] tabular-nums"
				aria-label="Stopped for {formatHms(stoppedSeconds)}"
			>
				{formatHms(stoppedSeconds)}
			</p>
			<div
				class="flex h-[84px] max-w-full items-center gap-3.5 rounded-[10px] border-2 border-[#c3c8cf] bg-white px-[18px]"
			>
				<span
					class="flex size-14 shrink-0 items-center justify-center rounded-[9px] bg-[#3a3e46] text-white"
				>
					<ReasonIcon class="size-[31px]" strokeWidth={2.2} />
				</span>
				<span class="truncate text-[32px] leading-[41px] font-bold">{reasonLabel(reason)}</span>
				<span
					class="flex h-8 w-10 shrink-0 items-center justify-center rounded-md bg-[#e5e7eb] text-lg leading-[23px] font-bold text-[#4b5563]"
				>
					{reasonNumber(reason, getSelectableCatalogReasons()) ?? reason.id}
				</span>
			</div>
		</section>

		<HmiFlatButton
			label={canCloseTicket ? 'Close ticket' : 'Change reason'}
			icon={canCloseTicket ? CircleCheck : RotateCw}
			tone={canCloseTicket ? 'stop' : 'neutral'}
			class="w-full"
			faceClass="text-[34px] leading-[43px]"
			iconClass="size-[42px]"
			onclick={() => (canCloseTicket ? onCloseTicket() : onChangeReason())}
		/>
	</div>

	<div class="flex w-[472px] shrink-0 flex-col">
		<section class="flex flex-col rounded-xl border-2 border-[#c3c8cf] bg-white px-5 pt-2 pb-[5px]">
			{#each rows as row, index (row.label)}
				<div
					class="flex h-[55px] items-center gap-3 {index < rows.length - 1
						? 'border-b border-[#dde1e5]'
						: ''}"
				>
					<span
						class="shrink-0 font-heading text-2xl leading-[33px] font-bold tracking-[0.6px] whitespace-nowrap text-[#5a616c] uppercase"
					>
						{row.label}
					</span>
					<span
						class="min-w-0 flex-1 truncate text-right text-[26px] leading-[33px] font-bold {row.tone ??
							''}"
						title={row.value}
					>
						{row.value}
					</span>
				</div>
			{/each}
		</section>

		<section
			class="mt-4 flex h-[110px] flex-col justify-center gap-2 rounded-xl border-2 border-[#c3c8cf] bg-white px-5"
		>
			<div class="flex items-center">
				<span
					class="flex-1 font-heading text-2xl leading-[33px] font-bold tracking-[0.6px] text-[#5a616c] uppercase"
				>
					Job progress
				</span>
				<span class="text-[26px] leading-[33px] font-bold text-[#f26522]">{pct}%</span>
			</div>
			<div
				class="h-[22px] w-full overflow-hidden rounded-md bg-[#e4e6e8]"
				role="progressbar"
				aria-label="Job progress"
				aria-valuenow={pct}
				aria-valuemin={0}
				aria-valuemax={100}
			>
				<div class="h-full rounded-md bg-[#f26522]" style:width="{pct}%"></div>
			</div>
		</section>

		<HmiHoldButton
			class="mt-auto shrink-0"
			label="End job"
			icon={CircleX}
			tone="end"
			iconClass={canCloseTicket ? '' : 'text-[#ff5a4f]'}
			hint={canCloseTicket ? 'Close the ticket to end the job' : 'Press and hold END JOB for 1.5 s'}
			disabled={canCloseTicket}
			onConfirm={onEndJob}
		/>
	</div>
</div>
