<script lang="ts">
	import { onMount, tick } from 'svelte';
	import {
		HmiButton,
		HmiFlatButton,
		HmiNumpad,
		HmiSearchSelect,
		type HmiSearchSelectItem
	} from '@ifactory/ui-v2';
	import { Check, ChevronDown, ChevronUp, Play, Search, X } from '@lucide/svelte';
	import {
		formatJobTimestamp,
		formatPlatePartSize,
		formatThicknessMm,
		jobDisplayLabel,
		jobHasAvailableMarkings,
		plateMarkIsDone,
		type HmiJob,
		type PlateMark
	} from '../../lib/jobs';
	import { jobCardPanelFromCard } from '../../lib/job-card-display.js';
	import { loadJobs, pmsStore, startJob } from '../../lib/hmi-store.svelte';
	import type { AppNavigation } from '../../lib/navigation';
	import PlatePiecePreview from '../../components/PlatePiecePreview.svelte';

	let { navigation }: { navigation: AppNavigation } = $props();

	/* Figma: HMI FROZEN DESIGN → plate · 1 select job / 2 pick mark · ready / 2b find mark (numpad). */
	/** START JOB: the 118 px primary keycap with Figma's 38 px label. */
	const START_FACE = 'text-[38px] tracking-[1.1px]';
	/** Tile 74 px + 10 px gap; five tiles fill the list. */
	const TILE_STEP = 84;
	const TILES_SHOWN = 5;

	let sectionJobId = $state('');
	let marking = $state('');
	let jobOpen = $state(false);
	let jobInput = $state<HTMLInputElement | null>(null);
	let jobSelect = $state<{ commit: () => boolean } | null>(null);
	let finding = $state(false);
	let query = $state('');
	let searchInput = $state<HTMLInputElement | null>(null);
	let pressedMark = $state<string | null>(null);

	onMount(() => {
		void (async () => {
			const prefillJobId = pmsStore.startJobPrefillJobId;
			pmsStore.startJobPrefillJobId = null;
			await loadJobs();
			if (prefillJobId && available(pmsStore.jobs[prefillJobId])) {
				sectionJobId = prefillJobId;
				marking = firstOpenMark(pmsStore.jobs[prefillJobId]);
			}
		})();
	});

	function available(job: HmiJob | undefined): boolean {
		return jobHasAvailableMarkings(job, pmsStore.donePlateMarks);
	}

	function thicknessOf(job: HmiJob): string {
		return formatThicknessMm(job.thicknessMm) ?? job.thickness ?? '';
	}

	function isDone(jobId: string, mark: PlateMark): boolean {
		return plateMarkIsDone(pmsStore.donePlateMarks, jobId, mark.marking);
	}

	/** Pieces already made on a parked card; undefined when the mark was never started. */
	function madeOf(jobId: string, mark: PlateMark): number | undefined {
		return pmsStore.plateMarkPieces[`${jobId}::${mark.marking}`];
	}

	function firstOpenMark(job: HmiJob | undefined): string {
		if (!job?.marks) return '';
		return job.marks.find((mark) => !isDone(job.jobId, mark))?.marking ?? '';
	}

	const jobItems = $derived<HmiSearchSelectItem[]>(
		Object.values(pmsStore.jobs)
			.filter((job) => available(job))
			.map((job) => ({
				value: job.jobId,
				label: [jobDisplayLabel(job), [job.section, thicknessOf(job)].filter(Boolean).join(' ')]
					.filter(Boolean)
					.join(' · '),
				meta: scheduleLabel(job.scheduledAt)
			}))
	);

	const selectedJob = $derived(sectionJobId ? pmsStore.jobs[sectionJobId] : undefined);
	const marks = $derived(selectedJob?.marks ?? []);
	const needle = $derived(query.trim().toLowerCase());
	const shownMarks = $derived(
		finding && needle ? marks.filter((mark) => mark.marking.toLowerCase().includes(needle)) : marks
	);
	const selectedMark = $derived(marks.find((mark) => mark.marking === marking));
	const canStart = $derived(
		Boolean(selectedJob && selectedMark && !isDone(selectedJob.jobId, selectedMark)) && !finding
	);

	/** Keypad while picking a job or finding a mark; the piece preview once a mark is chosen. */
	const showKeypad = $derived(!selectedJob || jobOpen || finding);
	const keypadTarget = $derived(finding && !jobOpen ? searchInput : jobInput);
	const hint = $derived(
		!selectedJob || jobOpen
			? pmsStore.jobsLoading && jobItems.length === 0
				? 'Loading jobs…'
				: 'Pick a job to enable'
			: ''
	);

	const previewRows = $derived.by(() => {
		if (!selectedJob || !selectedMark) return [];
		const sets = jobCardPanelFromCard(selectedJob.sourceCard).header.sets;
		const grade = jobCardPanelFromCard(selectedJob.sourceCard).header.rmGrade;
		return [
			{
				label: 'Quantity',
				value: [`${selectedMark.pcs} pcs`, sets && sets !== '-' ? `${sets} sets` : '']
					.filter(Boolean)
					.join(' · ')
			},
			{ label: 'Ops / piece', value: String(selectedMark.operations ?? '—') },
			{ label: 'Thickness', value: thicknessOf(selectedJob) || '—' },
			{ label: 'Grade', value: grade && grade !== '-' ? grade : '—' },
			{
				label: 'Wt / piece',
				value: Number.isFinite(selectedMark.weightPerPieceKg)
					? `${selectedMark.weightPerPieceKg} kg`
					: '—'
			}
		];
	});

	/** Figma list meta: `29 Aug · 08:30`. Non-ISO legacy labels pass through the shared formatter. */
	function scheduleLabel(iso: string | null | undefined): string {
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
		if (open) {
			finding = false;
			void loadJobs();
		}
	}

	function onJobChange() {
		finding = false;
		query = '';
		marking = firstOpenMark(selectedJob);
	}

	/* ---------- Mark list ---------- */

	let tilesEl = $state<HTMLDivElement | null>(null);
	let atTop = $state(true);
	let atBottom = $state(true);
	let firstTile = $state(0);

	function syncArrows() {
		if (!tilesEl) return;
		atTop = tilesEl.scrollTop <= 1;
		atBottom = tilesEl.scrollTop + tilesEl.clientHeight >= tilesEl.scrollHeight - 1;
		firstTile = Math.round(tilesEl.scrollTop / TILE_STEP);
	}

	function scrollTiles(direction: 1 | -1) {
		tilesEl?.scrollBy({ top: direction * TILE_STEP * 3, behavior: 'smooth' });
	}

	$effect(() => {
		void shownMarks.length;
		syncArrows();
	});

	// Keep the chosen mark in view (prefill / job change can pick one below the fold).
	$effect(() => {
		const index = shownMarks.findIndex((mark) => mark.marking === marking);
		const tile = index >= 0 ? tilesEl?.children[index] : null;
		tile?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
	});

	function pickMark(mark: PlateMark) {
		if (!selectedJob || isDone(selectedJob.jobId, mark)) return;
		marking = mark.marking;
		finding = false;
		query = '';
	}

	/**
	 * Find mark keeps its keypad up until Clear; a tap on empty page space ends it too. Buttons,
	 * fields, mark tiles and the keypad itself do not count, so picking a mark is undisturbed.
	 */
	function onPagePointerDown(event: PointerEvent) {
		if (!finding) return;
		const target = event.target as Element | null;
		if (
			target?.closest(
				'button, input, label, [role="combobox"], [role="listbox"], [data-keypad-zone]'
			)
		) {
			return;
		}
		finding = false;
		query = '';
	}

	async function toggleFind() {
		if (finding) {
			// CLEAR empties the search first; a second tap leaves find mode.
			if (query) {
				query = '';
				searchInput?.focus();
			} else {
				finding = false;
			}
			return;
		}
		finding = true;
		query = '';
		await tick();
		tilesEl?.scrollTo({ top: 0 });
		searchInput?.focus();
	}

	function onKeypadEnter() {
		if (jobOpen) {
			jobSelect?.commit();
			return;
		}
		if (!selectedJob) return;
		const match = shownMarks.find((mark) => !isDone(selectedJob.jobId, mark));
		if (match) pickMark(match);
	}

	function onStart() {
		if (!canStart || !sectionJobId || !marking) return;
		startJob(sectionJobId, marking);
		navigation.navigateTo('JobRunning');
	}

	function tileClass(selected: boolean, done: boolean, pressed: boolean): string {
		const base =
			'flex h-[74px] w-full shrink-0 cursor-pointer items-center justify-between gap-3 rounded-[10px] pr-[18px] pl-5 text-left select-none [-webkit-tap-highlight-color:transparent]';
		if (done) return `${base} cursor-default border-[1.5px] border-[#aeb4bc] bg-[#f1f2f4]`;
		const ring = pressed ? 'translate-y-1 shadow-[inset_0_3px_6px_rgba(0,0,0,0.12)]' : '';
		return selected
			? `${base} border-3 border-b-[6px] border-[#f26b2a] bg-[#fff2e8] ${ring}`
			: `${base} border-[1.5px] border-b-[5px] border-[#aeb4bc] bg-white ${ring}`;
	}
</script>

<div
	class="flex h-full min-h-0 gap-6 bg-white pt-2 pr-7 pb-6 pl-[30px] font-body text-[#1b2028]"
	onpointerdowncapture={onPagePointerDown}
>
	<div class="flex w-[658px] shrink-0 flex-col">
		<h1 class="m-0 font-body text-[32px] leading-[41px] font-bold">Start Job</h1>

		<HmiSearchSelect
			bind:this={jobSelect}
			bind:inputRef={jobInput}
			bind:value={sectionJobId}
			bind:open={jobOpen}
			items={jobItems}
			label="Job ID · Thickness"
			placeholder="Select job"
			emptyText={pmsStore.jobsLoading ? 'Loading jobs…' : 'No matching jobs.'}
			class="relative z-20 mt-[11px]"
			onValueChange={onJobChange}
			onOpenChange={onJobOpenChange}
		/>

		{#if selectedJob}
			<div class="mt-[13px] flex h-[72px] shrink-0 items-center justify-between gap-3">
				{#if finding}
					<label
						class="flex h-16 w-[404px] min-w-0 items-center gap-2.5 rounded-lg border-3 border-[#f26b2a] bg-white px-4"
					>
						<Search class="size-6 shrink-0 text-[#5a616c]" strokeWidth={2.5} />
						<input
							bind:this={searchInput}
							bind:value={query}
							inputmode="none"
							autocomplete="off"
							placeholder="Mark number"
							aria-label="Find mark"
							class="min-w-0 flex-1 border-0 bg-transparent p-0 text-[32px] leading-[41px] font-bold text-[#1b2028] caret-[#f26b2a] shadow-none outline-none placeholder:text-2xl placeholder:font-medium placeholder:text-[#7e848d] focus:border-transparent focus:ring-0 focus-visible:ring-0 focus-visible:outline-none"
						/>
						<span class="shrink-0 text-lg leading-[23px] font-bold text-[#5a616c]">
							{shownMarks.length} of {marks.length}
						</span>
					</label>
				{:else}
					<p
						class="m-0 font-heading text-2xl leading-[31px] font-bold tracking-[0.6px] text-[#4a505a] uppercase"
					>
						Mark number · {marks.length}
					</p>
				{/if}
				<HmiButton
					size="md"
					label={finding ? 'Clear' : 'Find mark'}
					icon={finding ? X : Search}
					class="w-60"
					onclick={() => void toggleFind()}
				/>
			</div>

			<div class="mt-3 flex h-[410px] shrink-0 gap-3">
				<div
					bind:this={tilesEl}
					class="flex w-[574px] shrink-0 flex-col gap-2.5 overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
					onscroll={syncArrows}
				>
					{#each shownMarks as mark (mark.marking)}
						{@const done = isDone(selectedJob.jobId, mark)}
						{@const selected = !done && mark.marking === marking}
						{@const made = madeOf(selectedJob.jobId, mark)}
						<button
							type="button"
							class={tileClass(selected, done, pressedMark === mark.marking)}
							aria-pressed={selected}
							aria-disabled={done}
							onpointerdown={() => (pressedMark = done ? null : mark.marking)}
							onpointerup={() => (pressedMark = null)}
							onpointerleave={() => (pressedMark = null)}
							onpointercancel={() => (pressedMark = null)}
							onclick={() => pickMark(mark)}
						>
							<span class="flex min-w-0 items-baseline gap-[18px]">
								<span
									class="truncate text-[28px] leading-9 font-bold {done
										? 'text-[#8a9199]'
										: finding && needle
											? 'text-[#f26b2a]'
											: 'text-[#1b2028]'}"
								>
									{mark.marking}
								</span>
								<span
									class="shrink-0 text-xl leading-[26px] font-medium {done
										? 'text-[#8a9199]'
										: 'text-[#5a616c]'}"
								>
									{formatPlatePartSize(mark.itemLength, mark.widthMm) ?? ''}
								</span>
							</span>
							<span class="flex shrink-0 items-center gap-3.5">
								{#if done}
									<span
										class="flex items-center gap-1.5 rounded-md bg-[#e5e7eb] px-2.5 py-1 text-base leading-5 font-bold text-[#5a616c]"
									>
										<Check class="size-4" strokeWidth={2.5} />
										Done {made ?? mark.pcs}/{mark.pcs}
									</span>
								{:else}
									<span class="text-[22px] leading-7 font-bold">
										{made ? `${made} / ${mark.pcs}` : mark.pcs} pcs
									</span>
								{/if}
								{#if selected}
									<span
										class="flex size-8 items-center justify-center rounded-full bg-[#f26b2a] text-white"
									>
										<Check class="size-5" strokeWidth={2.5} />
									</span>
								{:else}
									<span
										class="size-8 rounded-full {done ? '' : 'border-3 border-[#aeb4bc]'}"
										aria-hidden="true"
									></span>
								{/if}
							</span>
						</button>
					{:else}
						<p class="m-0 py-6 text-center font-heading text-2xl font-medium text-[#5a616c]">
							No mark matches {query}
						</p>
					{/each}
				</div>

				<div class="flex w-[72px] shrink-0 flex-col items-center gap-2.5">
					<HmiFlatButton
						icon={ChevronUp}
						aria-label="Scroll marks up"
						disabled={atTop}
						class="h-auto min-h-0 w-full flex-1"
						onclick={() => scrollTiles(-1)}
					/>
					<span class="text-[15px] leading-[19px] font-bold whitespace-nowrap text-[#5a616c]">
						{shownMarks.length ? firstTile + 1 : 0}–{Math.min(
							shownMarks.length,
							firstTile + TILES_SHOWN
						)} of {shownMarks.length}
					</span>
					<HmiFlatButton
						icon={ChevronDown}
						aria-label="Scroll marks down"
						disabled={atBottom}
						class="h-auto min-h-0 w-full flex-1"
						onclick={() => scrollTiles(1)}
					/>
				</div>
			</div>
		{:else}
			<HmiSearchSelect
				items={[]}
				label="Mark number"
				placeholder="Pick a job first"
				disabled
				class="relative z-10 mt-5"
			/>
		{/if}
	</div>

	<div class="flex w-[472px] shrink-0 flex-col">
		{#if showKeypad}
			<div data-keypad-zone class={selectedJob && !jobOpen ? 'mt-[46px]' : ''}>
				<HmiNumpad
					inputElement={keypadTarget}
					enterDisabled={!jobOpen && !finding}
					onEnter={onKeypadEnter}
				/>
			</div>
			{#if hint}
				<p class="m-0 mt-6 h-[25px] font-heading text-lg font-medium text-[#6b7280]">{hint}</p>
			{/if}
		{:else if selectedJob && selectedMark}
			<PlatePiecePreview
				class="mt-[46px] h-[530px]"
				title="Piece · {selectedMark.marking}"
				lengthMm={selectedMark.itemLength}
				widthMm={selectedMark.widthMm}
				rows={previewRows}
			/>
		{/if}

		<div class="mt-auto">
			<HmiFlatButton
				label="Start job"
				icon={Play}
				tone="primary"
				disabled={!canStart}
				class="w-full"
				faceClass={START_FACE}
				iconClass="size-[42px]"
				onclick={onStart}
			/>
		</div>
	</div>
</div>
