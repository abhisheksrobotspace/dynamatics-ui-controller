<script lang="ts">
	import { HmiDataCard, HmiFlatButton, HmiHoldButton } from '@ifactory/ui-v2';
	import { CirclePause, CircleX, ClipboardCheck, Play } from '@lucide/svelte';
	import { cancelJob, displayMetric, formatHms, pmsStore } from '../../lib/hmi-store.svelte';
	import { findPlateMark, jobDisplayLabel } from '../../lib/jobs';
	import { DEFAULT_ACTIVE_JOB } from '../../lib/display-defaults';
	import type { AppNavigation } from '../../lib/navigation';
	import PlatePiecePreview from '../../components/PlatePiecePreview.svelte';

	let { navigation }: { navigation: AppNavigation } = $props();

	/* Figma: HMI FROZEN DESIGN → plate · 3 job running (RAISE ALERT left out). */
	const job = $derived(pmsStore.activeJob ?? DEFAULT_ACTIVE_JOB);
	const markNo = $derived(job.markNo ?? job.marks[0]?.id ?? '');
	const mark = $derived.by(() => {
		const card = pmsStore.jobs[job.jobId];
		return card && markNo ? findPlateMark(card, markNo) : undefined;
	});
	const operations = $derived(mark?.operations ?? job.marks[0]?.operations ?? null);

	const planned = $derived(job.piecesPlanned ?? job.plannedPlates ?? null);
	const cut = $derived(job.piecesCut ?? 0);
	const percent = $derived(
		job.completePercent != null
			? Math.max(0, Math.min(100, job.completePercent))
			: planned
				? Math.min(100, Math.round((cut / planned) * 100))
				: null
	);
	const toGo = $derived(planned != null ? Math.max(0, planned - cut) : null);

	const headerFields = $derived([
		{ label: 'Job ID', value: jobDisplayLabel(job) },
		{ label: 'Mark', value: markNo || '-' },
		{ label: 'Thickness', value: job.thickness ?? '-' }
	]);
	/** Neutral icon tiles (Figma data-card · Uptime / Downtime). */
	const timeTile = 'bg-[#e5e7eb] text-[#4b5563]';

	function endJob() {
		// The 1.5 s hold is the confirmation; the controller then sends the summary.
		cancelJob();
		navigation.navigateTo('JobComplete');
	}
</script>

<div class="flex h-full min-h-0 w-full flex-col bg-white pr-7 pl-[30px] font-body text-[#1b2028]">
	<div class="flex gap-6">
		<div class="flex w-[658px] shrink-0 flex-col">
			<!-- Figma sets the job line 15 px left of the card edge. -->
			<dl class="m-0 -ml-[15px] grid h-20 grid-cols-[300px_200px_minmax(0,1fr)] pt-4">
				{#each headerFields as field (field.label)}
					<div class="flex min-w-0 flex-col">
						<dt
							class="order-last font-heading text-[15px] leading-5 font-bold tracking-[0.6px] text-[#ff6c2e] uppercase"
						>
							{field.label}
						</dt>
						<dd
							class="m-0 truncate font-body text-[32px] leading-[41px] font-bold"
							title={field.value}
						>
							{field.value}
						</dd>
					</div>
				{/each}
			</dl>

			<section
				class="mt-2.5 flex h-[500px] flex-col gap-[18px] rounded-xl border-2 border-[#c3c8cf] bg-white px-[26px] pt-7"
				aria-label="Pieces cut"
			>
				<p class="m-0 font-heading text-2xl leading-[31px] font-medium text-[#5a616c] uppercase">
					Pieces cut
				</p>
				<p class="m-0 flex items-baseline gap-3.5 font-bold whitespace-nowrap">
					<span class="text-[180px] leading-[230px] text-[#f26b2a]">{displayMetric(cut)}</span>
					<span class="text-[48px] leading-[61px] text-[#5a616c]">
						/ {displayMetric(planned)} pcs
					</span>
				</p>
				<div
					class="h-7 overflow-hidden rounded-[14px] bg-[#e5e7eb]"
					role="progressbar"
					aria-label="Job progress"
					aria-valuemin={0}
					aria-valuemax={100}
					aria-valuenow={percent ?? 0}
				>
					<div class="h-full rounded-[14px] bg-[#f26b2a]" style:width="{percent ?? 0}%"></div>
				</div>
				<div class="flex h-10 items-center justify-between text-[26px] leading-[33px]">
					<span class="font-heading font-medium text-[#5a616c]">
						{toGo == null ? '-' : toGo === 0 ? 'All pieces cut' : `${toGo} pcs to go`}
					</span>
					<span class="font-bold">{percent == null ? '-' : `${percent}%`} complete</span>
				</div>
			</section>
		</div>

		<div class="flex w-[472px] shrink-0 flex-col gap-3.5">
			<HmiDataCard
				class="h-[137px]"
				label="Uptime"
				value={formatHms(pmsStore.uptimeSeconds)}
				icon={Play}
				iconTileClass={timeTile}
			/>
			<HmiDataCard
				class="h-[137px]"
				label="Downtime"
				value={formatHms(pmsStore.downtimeSeconds)}
				icon={CirclePause}
				iconTileClass={timeTile}
			/>
			<PlatePiecePreview
				class="h-[288px]"
				drawingClass="h-[190px]"
				title={['Piece', markNo, operations != null ? `${operations} ops` : '']
					.filter(Boolean)
					.join(' · ')}
				lengthMm={mark?.itemLength ?? job.marks[0]?.partLength}
				widthMm={mark?.widthMm}
			/>
		</div>
	</div>

	<div class="mt-4 flex justify-between gap-4">
		<HmiFlatButton
			label="Job details"
			icon={ClipboardCheck}
			tone="primary"
			size="lg"
			class="w-[472px] shrink-0"
			onclick={() => navigation.navigateTo('JobCard')}
		/>
		<HmiHoldButton
			class="w-[472px] shrink-0"
			label="End job"
			icon={CircleX}
			tone="end"
			iconClass="text-[#ff5a4f]"
			hint="Press and hold END JOB for 1.5 s"
			onConfirm={endJob}
		/>
	</div>
</div>
