<script lang="ts">
	import { HmiDataCard, HmiFlatButton, HmiHoldButton } from '@ifactory/ui-v2';
	import {
		ChevronDown,
		ChevronUp,
		CirclePause,
		CircleX,
		ClipboardCheck,
		Play
	} from '@lucide/svelte';
	import { cancelJob, displayMetric, formatHms, pmsStore } from '../../lib/hmi-store.svelte';
	import { jobCardPanelFromCard } from '../../lib/job-card-display.js';
	import { jobDisplayLabel } from '../../lib/jobs';
	import { DEFAULT_ACTIVE_JOB } from '../../lib/display-defaults';
	import type { MarkLine } from '../../lib/job-types';
	import type { AppNavigation } from '../../lib/navigation';

	let { navigation }: { navigation: AppNavigation } = $props();

	/* Figma: HMI FROZEN DESIGN → job-running · simplified. */
	const ROW_HEIGHT = 56;
	/** Progress takes the arrow column's width when there are no arrows. */
	const columns = 'grid-cols-[330px_230px_190px_minmax(260px,1fr)]';

	const job = $derived(pmsStore.activeJob ?? DEFAULT_ACTIVE_JOB);

	const percent = $derived(
		job.completePercent == null ? null : Math.max(0, Math.min(100, job.completePercent))
	);
	/** The RM's position in the card's cutting plan; '-' when the card has no plan for it. */
	const sequence = $derived.by(() => {
		const card = pmsStore.jobs[job.jobId]?.sourceCard;
		const index = jobCardPanelFromCard(card).cuttingPlan.findIndex((row) => row.rmId === job.rmId);
		return index < 0 ? '-' : String(index + 1);
	});
	const rmLength = $derived(job.rmLength && job.rmLength !== '-' ? `${job.rmLength} mm` : '-');
	const headerFields = $derived([
		{
			label: 'Job ID | Section',
			value: [jobDisplayLabel(job), job.section].filter(Boolean).join(' | ')
		},
		{
			label: 'Sequence - RM length',
			value: sequence === '-' ? rmLength : `${sequence} - ${rmLength}`
		}
	]);
	/* No end-trim value in the job card yet. */
	const heroMetrics = $derived([
		{
			label: 'Pieces cut',
			value: displayMetric(job.piecesCut),
			of: displayMetric(job.piecesPlanned),
			tone: 'text-[#f26522]'
		},
		{
			label: 'Bars completed',
			value: displayMetric(job.barsCompleted),
			of: displayMetric(job.barsPlanned),
			tone: ''
		},
		{ label: 'End trim', value: '—', of: '', tone: '' }
	]);
	const heroLabel = 'font-heading text-xl font-bold uppercase text-[#98a0aa] tracking-[1.1px]';
	/** Neutral icon tiles (Figma data-card · Uptime / Downtime). */
	const timeTile = 'bg-[#e5e7eb] text-[#4b5563]';

	/**
	 * The mark just cut. Before the first cut seen on this screen (job start, a reload), the first mark
	 * not yet at its target.
	 */
	const currentIndex = $derived.by(() => {
		const cut = job.marks.findIndex((mark) => mark.id === job.lastCutMarkId);
		return cut >= 0 ? cut : job.marks.findIndex((mark) => !isDone(mark));
	});

	function isDone(mark: MarkLine): boolean {
		return (
			mark.progressCurrent != null &&
			mark.progressTotal != null &&
			mark.progressCurrent >= mark.progressTotal
		);
	}

	let rowsEl = $state<HTMLDivElement | null>(null);
	let atTop = $state(true);
	let atBottom = $state(true);
	/** Arrows only when the marks overflow the visible rows. */
	const canScroll = $derived(!(atTop && atBottom));

	function syncArrows() {
		if (!rowsEl) return;
		atTop = rowsEl.scrollTop <= 1;
		atBottom = rowsEl.scrollTop + rowsEl.clientHeight >= rowsEl.scrollHeight - 1;
	}

	function scrollRows(direction: 1 | -1) {
		rowsEl?.scrollBy({ top: direction * ROW_HEIGHT, behavior: 'smooth' });
	}

	$effect(() => {
		void job.marks.length;
		syncArrows();
	});

	// Keep the highlighted row in view as the cutting moves down the list.
	$effect(() => {
		const row = currentIndex >= 0 ? rowsEl?.children[currentIndex] : null;
		row?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
	});

	function endJob() {
		// Angle (bar) jobs auto-complete; End Job aborts via cancel. The 1.5 s hold is the confirmation.
		cancelJob();
		navigation.navigateTo('JobComplete');
	}
</script>

<div class="relative h-full min-h-0 w-full bg-white px-[30px] font-body text-[#1b2028]">
	<div class="flex gap-4">
		<div class="flex min-w-0 flex-1 flex-col pt-[13px] pl-[7px]">
			<dl class="m-0 grid grid-cols-[477px_minmax(0,1fr)] gap-x-4">
				{#each headerFields as field (field.label)}
					<div class="flex min-w-0 flex-col">
						<dt class="{heroLabel} leading-7 tracking-[0.5px] text-[#999999]">{field.label}</dt>
						<dd class="m-0 truncate text-[32px] leading-[41px] font-bold" title={field.value}>
							{field.value}
						</dd>
					</div>
				{/each}
			</dl>

			<div class="mt-4 grid grid-cols-[321px_268px_minmax(0,1fr)]">
				{#each heroMetrics as metric (metric.label)}
					<div class="flex min-w-0 flex-col">
						<span class={heroLabel}>{metric.label}</span>
						<span class="mt-6 flex items-baseline gap-1.5 font-bold whitespace-nowrap">
							<span class="text-[64px] leading-[82px] {metric.tone}">{metric.value}</span>
							{#if metric.of}
								<span class="text-[50px] leading-[64px] text-[#98a0aa]">/ {metric.of}</span>
							{/if}
						</span>
					</div>
				{/each}
			</div>

			<p class="m-0 mt-[-3px] {heroLabel} leading-5 tracking-[0.35px] text-[#999999]">Progress</p>
			<div
				class="mt-2 h-[25px] w-full overflow-hidden bg-[#e5e5e5]"
				role="progressbar"
				aria-label="Job progress"
				aria-valuemin={0}
				aria-valuemax={100}
				aria-valuenow={percent ?? 0}
			>
				<div class="h-full bg-[#ff6c2e]" style:width="{percent ?? 0}%"></div>
			</div>
		</div>

		<div class="flex w-[358px] shrink-0 flex-col gap-[5px] pt-[7px]">
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
		</div>
	</div>

	<section
		class="mt-3 flex h-[294px] flex-col gap-2 rounded-xl border-2 border-[#c3c8cf] bg-white px-[18px] py-3"
		aria-label="Marks"
	>
		<div class="flex gap-3">
			<div
				class="grid min-w-0 flex-1 {columns} h-12 items-center bg-[#f5f6f8] font-heading text-2xl font-bold tracking-[1px] text-[#5a616c] uppercase"
			>
				<span class="pr-2.5 pl-3.5">Mark no</span>
				<span class="pr-2.5 pl-3.5 text-right">Length</span>
				<span class="pr-2.5 pl-3.5 text-right">Pcs / bar</span>
				<span class="pr-2.5 pl-3.5 text-right">Progress</span>
			</div>
			{#if canScroll}
				<div class="w-24 shrink-0" aria-hidden="true"></div>
			{/if}
		</div>

		<div class="flex min-h-0 flex-1 gap-3">
			<div
				bind:this={rowsEl}
				class="h-[210px] min-w-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
				onscroll={syncArrows}
			>
				{#each job.marks as mark, index (mark.id + index.toString())}
					{@const current = index === currentIndex}
					<div
						class="relative grid {columns} h-14 items-center border-b border-[#dde1e5] font-heading text-2xl font-medium {current
							? 'bg-[#fff1e8]'
							: 'bg-white'}"
					>
						{#if current}
							<span class="absolute inset-y-0 left-0 w-1.5 bg-[#f26522]" aria-hidden="true"></span>
						{/if}
						<span class="truncate pr-2.5 pl-3.5 font-body text-[26px] font-bold" title={mark.id}>
							{mark.id}
						</span>
						<span class="pr-2.5 pl-3.5 text-right">{displayMetric(mark.partLength)} mm</span>
						<span class="pr-2.5 pl-3.5 text-right">{displayMetric(mark.pcsPerBar)}</span>
						<span
							class="pr-2.5 pl-3.5 text-right {current ? 'font-body font-bold text-[#f26522]' : ''}"
						>
							{displayMetric(mark.progressCurrent)} / {displayMetric(mark.progressTotal)}
						</span>
					</div>
				{/each}
			</div>

			{#if canScroll}
				<div class="flex w-24 shrink-0 flex-col gap-3">
					<HmiFlatButton
						icon={ChevronUp}
						aria-label="Scroll marks up"
						disabled={atTop}
						class="h-[99px] w-24"
						iconClass="size-10"
						onclick={() => scrollRows(-1)}
					/>
					<HmiFlatButton
						icon={ChevronDown}
						aria-label="Scroll marks down"
						disabled={atBottom}
						class="h-[99px] w-24"
						iconClass="size-10"
						onclick={() => scrollRows(1)}
					/>
				</div>
			{/if}
		</div>
	</section>

	<div class="mt-3.5 flex justify-between gap-4">
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
			iconClass={job.barInProgress ? '' : 'text-[#ff5a4f]'}
			hint={job.barInProgress
				? 'Finish the bar in progress to end the job'
				: 'Press and hold END JOB for 1.5 s'}
			disabled={job.barInProgress}
			onConfirm={endJob}
		/>
	</div>
</div>
