<script lang="ts">
	import { onMount, tick } from 'svelte';
	import {
		Button,
		Dialog,
		HmiFlatButton,
		HmiNumpad,
		HmiSearchSelect,
		type HmiSearchSelectItem
	} from '@ifactory/ui-v2';
	import { Play, Search } from '@lucide/svelte';
	import {
		formatJobTimestamp,
		jobDisplayLabel,
		jobHasAvailableMarkings,
		rmIsDone
	} from '../../lib/jobs';
	import { loadJobs, pmsStore, refreshBarsToConfirm, startJob } from '../../lib/hmi-store.svelte';
	import type { AppNavigation } from '../../lib/navigation';
	import { jobCardPanelFromCard } from '../../lib/job-card-display.js';

	let { navigation }: { navigation: AppNavigation } = $props();

	/* Figma: HMI FROZEN DESIGN → start-job · search select / start-job · 2 selected (cutting plan). */
	/** START JOB: the 118 px primary keycap with Figma's 38 px label. */
	const START_FACE = 'text-[38px] tracking-[1.1px]';

	let sectionJobId = $state('');
	let rmId = $state('');
	let jobOpen = $state(false);
	let rmOpen = $state(false);
	let searching = $state(false);
	let jobInput = $state<HTMLInputElement | null>(null);
	let rmInput = $state<HTMLInputElement | null>(null);
	let jobSelect = $state<{ commit: () => boolean } | null>(null);
	let rmSelect = $state<{ commit: () => boolean } | null>(null);

	onMount(() => {
		void (async () => {
			const prefillJobId = pmsStore.startJobPrefillJobId;
			pmsStore.startJobPrefillJobId = null;
			await loadJobs();
			if (
				prefillJobId &&
				jobHasAvailableMarkings(pmsStore.jobs[prefillJobId], undefined, pmsStore.doneRmIds)
			) {
				sectionJobId = prefillJobId;
				// Same as picking the job by hand: the RM list opens next.
				await onJobChange();
			}
		})();
	});

	const jobItems = $derived<HmiSearchSelectItem[]>(
		Object.values(pmsStore.jobs)
			.filter((job) => jobHasAvailableMarkings(job, undefined, pmsStore.doneRmIds))
			.map((job) => ({
				value: job.jobId,
				label: `${jobDisplayLabel(job)} · ${job.section}`,
				meta: scheduleLabel(job.scheduledAt)
			}))
	);

	const selectedJob = $derived(sectionJobId ? pmsStore.jobs[sectionJobId] : undefined);

	/**
	 * Sequence = the RM's position in the card's cutting plan (`display.cuttingPlan`, rev-2 cards).
	 * Bars carry no sequence of their own; an RM missing from the plan keeps its RM ID label.
	 */
	const cardPanel = $derived(jobCardPanelFromCard(selectedJob?.sourceCard));
	const sequenceByRm = $derived(
		Object.fromEntries(cardPanel.cuttingPlan.map((row, index) => [row.rmId, index + 1]))
	);
	/** The card's schedule tab: planned start per RM (`materialId`). */
	const plannedStartByRm = $derived(
		Object.fromEntries(
			cardPanel.schedule
				.filter((row) => row.materialId && row.plannedStart)
				.map((row) => [row.materialId, row.plannedStart])
		)
	);

	const rmItems = $derived<HmiSearchSelectItem[]>(
		selectedJob
			? Object.values(selectedJob.bars)
					.filter((bar) => !rmIsDone(pmsStore.doneRmIds, selectedJob.jobId, bar.rmId))
					.map((bar) => ({ bar, sequence: sequenceByRm[bar.rmId] }))
					.sort((a, b) => (a.sequence ?? Infinity) - (b.sequence ?? Infinity))
					.map(({ bar, sequence }) => ({
						value: bar.rmId,
						// `Seq 12 - 6000 mm` (sequence - RM length); the meta is the sequence's planned start.
						label: `${sequence != null ? `Seq ${sequence}` : bar.rmId} - ${bar.rmLength} mm`,
						meta: scheduleLabel(plannedStartByRm[bar.rmId]) || undefined
					}))
			: []
	);

	const selectedBar = $derived(selectedJob && rmId ? selectedJob.bars[rmId] : undefined);
	const canStart = $derived(Boolean(sectionJobId && rmId && selectedBar));

	/** Keypad replaces the cutting plan while picking; SEARCH brings it back. */
	const showKeypad = $derived(!canStart || jobOpen || rmOpen || searching);
	const keypadTarget = $derived(rmOpen ? rmInput : jobInput);

	const marks = $derived(selectedBar?.markings ?? []);
	const stats = $derived([
		{ label: 'RM length', value: selectedBar?.rmLength ?? '—', unit: selectedBar ? 'mm' : '' },
		{ label: 'Bars needed', value: selectedBar?.quantity ?? '—', unit: '' },
		// No end-trim value in the job card yet.
		{ label: 'End trim', value: '—', unit: '' }
	]);

	const hint = $derived(
		pmsStore.jobsLoading && jobItems.length === 0
			? 'Loading jobs…'
			: !sectionJobId
				? 'Pick a job to enable'
				: !rmId
					? 'Pick a sequence to enable'
					: ''
	);

	/**
	 * Figma list meta: `29 Aug · 08:30`. Takes ISO or the card schedule's `29-08 08:30`; other
	 * legacy labels pass through the shared formatter.
	 */
	function scheduleLabel(iso: string | null | undefined): string {
		const short = iso?.trim().match(/^(\d{1,2})-(\d{1,2}) (\d{1,2}:\d{2})$/);
		if (short) {
			const month = new Date(2000, Number(short[2]) - 1, 1).toLocaleDateString('en-GB', {
				month: 'short'
			});
			return `${Number(short[1])} ${month} · ${short[3]}`;
		}
		const date = iso && /^\d{4}-\d{2}-\d{2}T/.test(iso.trim()) ? new Date(iso) : null;
		if (!date || Number.isNaN(date.getTime())) return formatJobTimestamp(iso) ?? '';
		const day = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
		const time = date.toLocaleTimeString('en-GB', {
			hour: '2-digit',
			minute: '2-digit',
			hour12: false
		});
		return `${day} · ${time}`;
	}

	function onJobOpenChange(open: boolean) {
		if (open) void loadJobs();
		else searching = false;
	}

	function onRmOpenChange(open: boolean) {
		if (!open) searching = false;
	}

	async function onJobChange() {
		rmId = '';
		// Keep the keypad flow going: open the (now enabled) RM list next.
		await tick();
		rmInput?.focus();
	}

	/** A tap outside the keypad and the two dropdowns puts the keypad away again (after SEARCH). */
	function onPagePointerDown(event: PointerEvent) {
		if (!searching) return;
		const target = event.target as Element | null;
		if (target?.closest('[data-keypad-zone]')) return;
		searching = false;
	}

	/** Bring the keypad back; the operator opens whichever dropdown they want. */
	function onSearch() {
		searching = true;
	}

	function onKeypadEnter() {
		if (rmOpen) rmSelect?.commit();
		else jobSelect?.commit();
	}

	/** Parked RM waiting on the "Which bar is on the machine?" answer. */
	let barOnMachineOpen = $state(false);
	let pendingBarStart = $state<{ jobId: string; rmId: string } | null>(null);
	/** True while onStart waits on the bar list: a second tap must not start the job twice. */
	let starting = $state(false);

	function startBar(jobId: string, bar: string, opts?: { barOnMachine?: 'partial' | 'new' }) {
		startJob(jobId, bar, opts);
		navigation.navigateTo('JobRunning');
	}

	async function onStart() {
		if (starting || !sectionJobId || !rmId) return;
		const jobId = sectionJobId;
		const bar = rmId;
		starting = true;
		try {
			// The controller writes the parked progress when a summary closes, after this list may have loaded.
			await refreshBarsToConfirm();
			if (pmsStore.barsToConfirm.includes(`${jobId}::${bar}`)) {
				pendingBarStart = { jobId, rmId: bar };
				barOnMachineOpen = true;
				return;
			}
			startBar(jobId, bar);
		} finally {
			starting = false;
		}
	}

	function answerBarOnMachine(barOnMachine: 'partial' | 'new') {
		const pending = pendingBarStart;
		pendingBarStart = null;
		barOnMachineOpen = false;
		if (!pending) return;
		startBar(pending.jobId, pending.rmId, { barOnMachine });
	}

	function backFromBarOnMachine() {
		pendingBarStart = null;
		barOnMachineOpen = false;
	}
</script>

<div
	class="flex h-full min-h-0 gap-6 bg-white pt-2 pr-7 pb-[15px] pl-[30px] font-body"
	onpointerdowncapture={onPagePointerDown}
>
	<div class="flex w-[658px] shrink-0 flex-col">
		<h1 class="m-0 font-body text-[32px] leading-[41px] font-bold text-[#1b2028]">Select Job</h1>

		<div data-keypad-zone class="contents">
			<HmiSearchSelect
				bind:this={jobSelect}
				bind:inputRef={jobInput}
				bind:value={sectionJobId}
				bind:open={jobOpen}
				items={jobItems}
				label="Job ID · Section"
				placeholder="Select job"
				emptyText={pmsStore.jobsLoading ? 'Loading jobs…' : 'No matching jobs.'}
				class="relative z-20 mt-[11px]"
				onValueChange={onJobChange}
				onOpenChange={onJobOpenChange}
			/>

			<HmiSearchSelect
				bind:this={rmSelect}
				bind:inputRef={rmInput}
				bind:value={rmId}
				bind:open={rmOpen}
				items={rmItems}
				label="Sequence"
				placeholder={sectionJobId ? 'Select sequence' : 'Pick a job first'}
				disabled={!sectionJobId}
				class="relative z-10 mt-5"
				onOpenChange={onRmOpenChange}
			/>
		</div>

		<section
			class="mt-[38px] flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border-2 border-[#c3c8cf] bg-white"
			aria-label="Marks"
			role="table"
		>
			<div
				class="grid h-[54px] shrink-0 grid-cols-[minmax(0,1fr)_200px] items-center bg-[#f5f6f8] px-3 font-heading text-2xl font-medium tracking-[0.6px] text-[#5a616c] uppercase"
				role="row"
			>
				<span class="px-3.5" role="columnheader">Mark no</span>
				<span class="px-3.5 text-right" role="columnheader">Length</span>
			</div>
			<div
				class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
			>
				{#each marks as mark, index (mark.marking + index)}
					<div
						class="relative grid h-14 grid-cols-[minmax(0,1fr)_200px] items-center border-b border-[#dde1e5] last:border-b-0 {index ===
						0
							? 'bg-[#fff1e8]'
							: ''}"
						role="row"
					>
						{#if index === 0}
							<!-- The bar's first mark: the one cut first. -->
							<span class="absolute inset-y-0 left-0 w-1.5 bg-[#f26522]" aria-hidden="true"></span>
						{/if}
						<span class="truncate px-3.5 text-[26px] font-bold" title={mark.marking} role="cell">
							{mark.marking}
						</span>
						<span class="px-3.5 text-right font-heading text-2xl font-medium" role="cell">
							{mark.itemLength} mm
						</span>
					</div>
				{:else}
					<p class="m-0 px-3.5 pt-5 font-heading text-xl font-medium text-[#6b7280]">
						{sectionJobId ? 'Pick a sequence to see its marks' : 'Pick a job to see its marks'}
					</p>
				{/each}
			</div>
		</section>
	</div>

	<div class="flex w-[472px] shrink-0 flex-col">
		{#if showKeypad}
			<div data-keypad-zone>
				<HmiNumpad
					inputElement={keypadTarget}
					enterDisabled={!jobOpen && !rmOpen}
					onEnter={onKeypadEnter}
				/>
			</div>
			<p class="m-0 mt-6 h-[25px] font-heading text-lg font-medium text-[#6b7280]">{hint}</p>
		{:else}
			<section
				class="mt-[35px] flex h-[526px] flex-col rounded-xl border-2 border-[#c3c8cf] bg-white px-5 pt-5"
				aria-label="Selected bar"
			>
				<HmiFlatButton
					label="Search"
					icon={Search}
					size="md"
					class="w-full"
					faceClass="text-[26px] tracking-[1.1px]"
					iconClass="size-[30px]"
					onclick={onSearch}
				/>
				<dl class="m-0 mt-5 flex flex-col gap-3">
					{#each stats as stat (stat.label)}
						<div class="flex flex-col">
							<dt
								class="font-heading text-2xl leading-[33px] font-medium tracking-[0.6px] text-[#5a616c] uppercase"
							>
								{stat.label}
							</dt>
							<dd class="m-0 flex items-baseline gap-2 font-body font-bold text-[#1b2028]">
								<span class="text-[56px] leading-[71px]">{stat.value}</span>
								{#if stat.unit}
									<span class="text-[28px] leading-9 text-[#5a616c]">{stat.unit}</span>
								{/if}
							</dd>
						</div>
					{/each}
				</dl>
			</section>
		{/if}

		<div class={showKeypad ? 'mt-[17px]' : 'mt-[30px]'}>
			<HmiFlatButton
				label="Start job"
				icon={Play}
				tone="primary"
				disabled={!canStart}
				loading={starting}
				class="w-full"
				faceClass={START_FACE}
				iconClass="size-[42px]"
				onclick={onStart}
			/>
		</div>
	</div>
</div>

<Dialog
	bind:open={barOnMachineOpen}
	size="xl"
	title="Which bar is on the machine?"
	hideFooter
	closeOnBackdrop={false}
	showCloseButton={false}
>
	<p class="text-placeholder font-heading text-xl font-bold">
		This RM was stopped part-way through a bar.
	</p>
	<div class="mt-6 flex flex-col gap-4">
		<Button
			variant="primary"
			size="lg"
			label="Partially cut bar"
			class="min-h-20 w-full rounded-none border-0 bg-primary font-heading text-xl font-bold text-white hover:bg-primary/90"
			onclick={() => answerBarOnMachine('partial')}
		/>
		<Button
			variant="outline"
			size="lg"
			label="New full bar"
			class="min-h-20 w-full rounded-none border-2 border-primary font-heading text-xl font-bold text-primary"
			onclick={() => answerBarOnMachine('new')}
		/>
		<Button
			variant="outline"
			size="lg"
			label="Back"
			class="min-h-20 w-full rounded-none border-2 border-border font-heading text-xl font-bold text-heading"
			onclick={backFromBarOnMachine}
		/>
	</div>
</Dialog>
