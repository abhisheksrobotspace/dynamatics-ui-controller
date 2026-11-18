<script lang="ts">
	import { HmiDataCard, HmiFlatButton, HmiHoldButton } from '@ifactory/ui-v2';
	import { CirclePause, CircleX, ClipboardCheck, Play } from '@lucide/svelte';
	import { displayMetric, endJob, formatHms, pmsStore } from '../../lib/hmi-store.svelte';
	import { formatThicknessMm, jobDisplayLabel, manualPiecesFromHoles } from '../../lib/jobs';
	import { DEFAULT_ACTIVE_JOB } from '../../lib/display-defaults';
	import type { AppNavigation } from '../../lib/navigation';
	import PlatePiecePreview from '../../components/PlatePiecePreview.svelte';

	let { navigation }: { navigation: AppNavigation } = $props();

	/* Figma: HMI FROZEN DESIGN → manual · 3 job running (RAISE ALERT left out, as on angle / plate). */
	const job = $derived(pmsStore.activeJob ?? DEFAULT_ACTIVE_JOB);
	const card = $derived(pmsStore.jobs[job.jobId]);
	const markNo = $derived(job.markNo ?? job.marks[0]?.id ?? '');
	/** This mark's rows on the card: one per bundle. */
	const markRows = $derived((card?.manualMarks ?? []).filter((row) => row.marking === markNo));
	const row = $derived(markRows.find((entry) => String(entry.bundleNo) === job.bundleNo));
	const operations = $derived(job.marks[0]?.operations ?? null);

	const planned = $derived(job.piecesPlanned ?? null);
	/** The machine counts holes; whole pieces are holes ÷ ops per piece. */
	const cut = $derived(manualPiecesFromHoles(job.operationsCount, operations));
	const percent = $derived(
		cut != null && planned ? Math.min(100, Math.round((cut / planned) * 100)) : null
	);
	const toGo = $derived(cut != null && planned != null ? Math.max(0, planned - cut) : null);

	const jobLabel = $derived(
		[
			jobDisplayLabel(job),
			[card?.section, card ? formatThicknessMm(card.thicknessMm) : undefined]
				.filter(Boolean)
				.join(' ')
		]
			.filter(Boolean)
			.join(' · ')
	);
	const headerFields = $derived([
		{ label: 'Job ID', value: jobLabel },
		{ label: 'Mark number', value: markNo || '-' },
		{
			label: 'Bundle number',
			value: job.bundleNo
				? markRows.length
					? `${job.bundleNo}/${markRows.length}`
					: job.bundleNo
				: '-'
		}
	]);
	/** Neutral icon tiles (Figma data-card · Uptime / Downtime). */
	const timeTile = 'bg-[#e5e7eb] text-[#4b5563]';

	function onEndJob() {
		// The 1.5 s hold is the confirmation; the controller then sends the summary.
		endJob();
		navigation.navigateTo('JobComplete');
	}
</script>

<div class="flex h-full min-h-0 w-full flex-col bg-white pr-7 pl-[30px] font-body text-[#1b2028]">
	<div class="flex gap-6">
		<div class="flex w-[658px] shrink-0 flex-col">
			<!-- Figma sets the job line 15 px left of the card edge. -->
			<dl class="m-0 -ml-[15px] grid h-20 grid-cols-[minmax(0,1fr)_auto_auto] gap-x-6 pt-4">
				{#each headerFields as field, index (field.label)}
					<div class="flex min-w-0 flex-col">
						<dt
							class="order-last font-heading text-[15px] leading-5 font-bold tracking-[0.6px] text-[#ff6c2e] uppercase"
						>
							{field.label}
						</dt>
						<dd
							class="m-0 truncate font-body leading-[41px] font-bold uppercase {index === 0
								? 'text-[30px]'
								: 'text-[32px]'}"
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
					{cut == null ? 'Holes done' : 'Pieces cut'}
				</p>
				<p class="m-0 flex items-baseline gap-3.5 font-bold whitespace-nowrap">
					<span class="text-[180px] leading-[230px] text-[#f26b2a]">
						{displayMetric(cut ?? job.operationsCount ?? null)}
					</span>
					<span class="text-[48px] leading-[61px] text-[#5a616c]">
						{cut == null ? 'holes' : `/ ${displayMetric(planned)} pcs`}
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
				lengthMm={row?.itemLength ?? job.marks[0]?.partLength}
				widthMm={row?.widthMm}
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
			onConfirm={onEndJob}
		/>
	</div>
</div>
