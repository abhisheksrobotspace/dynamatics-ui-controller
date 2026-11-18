<script lang="ts">
	import { untrack } from 'svelte';
	import { HmiFlatButton, HmiKey, HmiNumpad } from '@ifactory/ui-v2';
	import {
		ArrowRight,
		Check,
		ChevronDown,
		ChevronUp,
		CirclePause,
		Clock,
		CornerDownRight,
		List,
		LockOpen,
		Play,
		RotateCw,
		Search,
		X
	} from '@lucide/svelte';
	import { interlockStore } from '$lib/os/interlock/interlock-store.svelte';
	import { onBeforeOperatorLogout } from '$lib/os/session.js';
	import HmiConfirmDialog from '$lib/os/HmiConfirmDialog.svelte';
	import {
		clearJobSummary,
		displayMetric,
		formatHms,
		loadJobs,
		pmsStore,
		publishUnlock,
		publishUpdatePartsProduced
	} from '../../lib/hmi-store.svelte';
	import { jobCardPanelFromCard } from '../../lib/job-card-display.js';
	import { jobDisplayLabel, jobHasAvailableMarkings } from '../../lib/jobs';
	import type { MarkLine } from '../../lib/job-types';
	import type { AppNavigation } from '../../lib/navigation';

	let { navigation }: { navigation: AppNavigation } = $props();

	/* Figma: HMI FROZEN DESIGN → job-complete (D saved · D2 edit quantities · B numpad · C find mark). */
	const SUMMARY_ROW_HEIGHT = 80;
	const EDIT_ROW_HEIGHT = 62;

	const job = $derived(pmsStore.activeJob);
	const marks = $derived(job?.marks ?? []);
	const success = $derived(pmsStore.showSummarySuccess);
	const showDisableInterlock = $derived(
		interlockStore.isEnabled && (interlockStore.isActive || interlockStore.isOn)
	);

	function producedOf(mark: MarkLine): number {
		return mark.produced ?? mark.progressCurrent ?? 0;
	}

	/** Machine count per mark, kept from when the summary arrived so edits can be compared and undone. */
	let machine = $state<Record<string, number>>({});
	$effect(() => {
		const list = marks;
		untrack(() => {
			for (const mark of list) {
				if (!(mark.id in machine)) machine[mark.id] = producedOf(mark);
			}
		});
	});

	/** Header line: job ID · section · sequence - RM length (as on the running screen). */
	const jobLine = $derived.by(() => {
		if (!job) return '';
		const plan = jobCardPanelFromCard(pmsStore.jobs[job.jobId]?.sourceCard).cuttingPlan;
		const index = plan.findIndex((row) => row.rmId === job.rmId);
		const rmLength = job.rmLength && job.rmLength !== '-' ? `${job.rmLength} mm` : '';
		const sequence = [index < 0 ? '' : String(index + 1), rmLength].filter(Boolean).join(' - ');
		return [jobDisplayLabel(job), job.section, sequence].filter(Boolean).join(' · ');
	});

	const plannedTotal = $derived(marks.reduce((sum, mark) => sum + (mark.progressTotal ?? 0), 0));
	const producedTotal = $derived(marks.reduce((sum, mark) => sum + producedOf(mark), 0));

	/* ---------- Edit quantities ---------- */

	let editing = $state(false);
	let draft = $state<Record<string, number>>({});
	let activeId = $state<string | null>(null);
	let searching = $state(false);
	let query = $state('');
	const valueInputs: Record<string, HTMLInputElement | null> = $state({});
	let searchInput = $state<HTMLInputElement | null>(null);

	const draftTotal = $derived(marks.reduce((sum, mark) => sum + (draft[mark.id] ?? 0), 0));
	/** The search box stays up (and keeps filtering) while a value is typed; Clear closes it. */
	const showSearch = $derived(searching || query !== '');
	const visibleMarks = $derived(
		query.trim()
			? marks.filter((mark) => mark.id.toLowerCase().includes(query.trim().toLowerCase()))
			: marks
	);
	const activeMark = $derived(marks.find((mark) => mark.id === activeId) ?? null);
	/** Set when SAVE posts a correction: the summary then reads "Quantities saved". */
	let savedAt = $state<string | null>(null);
	const numpadTarget = $derived(
		searching ? searchInput : activeId ? (valueInputs[activeId] ?? null) : null
	);

	/** The keypad is always up while editing, so the first mark starts selected. */
	function startEditing() {
		draft = Object.fromEntries(marks.map((mark) => [mark.id, producedOf(mark)]));
		searching = false;
		query = '';
		editing = true;
		const first = marks[0];
		activeId = null;
		if (first) queueMicrotask(() => valueInputs[first.id]?.focus());
	}

	function stopEditing() {
		editing = false;
		activeId = null;
		searching = false;
		query = '';
	}

	/** Send the correction now; the controller keeps the last one and adds it to the held completion. */
	function saveEdits() {
		for (const mark of marks) mark.produced = Math.max(0, draft[mark.id] ?? producedOf(mark));
		stopEditing();
		savedAt = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
		void publishUpdatePartsProduced({ evenIfCancelled: true });
	}

	function step(markId: string, delta: number) {
		draft[markId] = Math.max(0, (draft[markId] ?? 0) + delta);
	}

	function onValueInput(markId: string, event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const digits = input.value.replace(/\D/g, '').slice(0, 5);
		if (digits !== input.value) input.value = digits;
		draft[markId] = digits ? Number(digits) : 0;
	}

	function openValue(markId: string) {
		searching = false;
		activeId = markId;
		// Select the number so the first key press replaces it.
		queueMicrotask(() => valueInputs[markId]?.select());
	}

	/** ENTER moves to the next mark's value (ENTER in the search box goes to the first match). */
	function onNumpadEnter() {
		const list = visibleMarks;
		const next = searching ? list[0] : list[list.findIndex((mark) => mark.id === activeId) + 1];
		if (!next) return;
		valueInputs[next.id]?.focus();
		queueMicrotask(() => valueInputs[next.id]?.scrollIntoView({ block: 'nearest' }));
	}

	function toggleSearch() {
		if (showSearch) {
			// Clear: drop the filter and go back to the selected mark.
			searching = false;
			query = '';
			const back = activeId ?? marks[0]?.id;
			if (back) queueMicrotask(() => valueInputs[back]?.focus());
			return;
		}
		searching = true;
		queueMicrotask(() => searchInput?.focus());
	}

	function setActive(value: number | undefined) {
		if (!activeMark || value == null) return;
		draft[activeMark.id] = value;
	}

	function deltaLabel(markId: string): string {
		const delta = (draft[markId] ?? 0) - (machine[markId] ?? 0);
		return delta > 0 ? `+${delta}` : `−${Math.abs(delta)}`;
	}

	/* List scrolling (same idea as Job Running). Only one list is mounted: the summary's or the editor's. */
	const rowHeight = $derived(editing ? EDIT_ROW_HEIGHT : SUMMARY_ROW_HEIGHT);
	const listedMarks = $derived(editing ? visibleMarks : marks);
	let rowsEl = $state<HTMLDivElement | null>(null);
	let atTop = $state(true);
	let atBottom = $state(true);
	let firstRow = $state(0);
	/** Rows in view; a row cut off by a few px still counts as shown. */
	const rowsShown = $derived(
		rowsEl ? Math.max(1, Math.floor(rowsEl.clientHeight / rowHeight + 0.25)) : listedMarks.length
	);
	const canScroll = $derived(!(atTop && atBottom));

	function syncArrows() {
		if (!rowsEl) return;
		atTop = rowsEl.scrollTop <= 1;
		atBottom = rowsEl.scrollTop + rowsEl.clientHeight >= rowsEl.scrollHeight - 1;
		firstRow = Math.round(rowsEl.scrollTop / rowHeight);
	}

	function scrollRows(direction: 1 | -1) {
		rowsEl?.scrollBy({
			top: direction * rowHeight * (editing ? 3 : 2),
			behavior: 'smooth'
		});
	}

	$effect(() => {
		void listedMarks.length;
		void editing;
		syncArrows();
	});

	/* ---------- Leaving the summary ---------- */

	let leaving = $state(false);

	/** Confirm counts (if a completion is held), then leave jobSummary so the controller can flush 8002. */
	async function leaveSummary(after: () => void | Promise<void>) {
		if (leaving) return;
		leaving = true;
		try {
			await publishUpdatePartsProduced({ evenIfCancelled: true });
			await after();
		} finally {
			leaving = false;
		}
	}

	async function nextRm() {
		await leaveSummary(async () => {
			const jobId = pmsStore.activeJob?.jobId;
			await loadJobs();
			const queued = jobId ? pmsStore.jobs[jobId] : undefined;
			pmsStore.startJobPrefillJobId =
				jobId && jobHasAvailableMarkings(queued, undefined, pmsStore.doneRmIds) ? jobId : null;
			clearJobSummary();
			navigation.navigateTo('StartJob');
		});
	}

	async function changeJob() {
		await leaveSummary(() => {
			pmsStore.startJobPrefillJobId = null;
			clearJobSummary();
			navigation.navigateTo('StartJob');
		});
	}

	// Logging out from the task bar avatar saves the summary and leaves it, like CHANGE JOB.
	$effect(() =>
		onBeforeOperatorLogout(async () => {
			if (!job) return;
			await leaveSummary(() => {
				pmsStore.startJobPrefillJobId = null;
				clearJobSummary();
				navigation.navigateTo('StartJob');
			});
		})
	);

	const timeCards = $derived([
		{ label: 'Uptime', value: formatHms(pmsStore.uptimeSeconds), icon: Play },
		{ label: 'Downtime', value: formatHms(pmsStore.downtimeSeconds), icon: CirclePause },
		{ label: 'Total time', value: formatHms(pmsStore.totalSeconds), icon: Clock }
	]);

	const headCell =
		'font-heading text-2xl leading-[33px] font-bold tracking-[1px] text-[#5a616c] uppercase';
	const compactHead = 'text-base leading-5 font-bold text-[#5a616b] uppercase';

	/** CHANGE JOB and NEXT … leave the summary, so they ask first. */
	let confirming = $state<'change' | 'next' | null>(null);

	function confirmLeave() {
		const action = confirming;
		confirming = null;
		if (action === 'change') void changeJob();
		else if (action === 'next') void nextRm();
	}
</script>

{#snippet scrollArrows()}
	<div class="flex w-[72px] shrink-0 flex-col items-center gap-2.5">
		<HmiFlatButton
			icon={ChevronUp}
			aria-label="Scroll marks up"
			disabled={atTop}
			class="h-auto min-h-0 w-full flex-1"
			onclick={() => scrollRows(-1)}
		/>
		<span class="text-[15px] leading-[19px] font-bold whitespace-nowrap text-[#5a616b]">
			{listedMarks.length ? firstRow + 1 : 0}–{Math.min(listedMarks.length, firstRow + rowsShown)} of
			{listedMarks.length}
		</span>
		<HmiFlatButton
			icon={ChevronDown}
			aria-label="Scroll marks down"
			disabled={atBottom}
			class="h-auto min-h-0 w-full flex-1"
			onclick={() => scrollRows(1)}
		/>
	</div>
{/snippet}

{#snippet stepperKey(label: string, markId: string, delta: number)}
	<div class="size-14 shrink-0">
		<HmiKey
			{label}
			tone="function"
			repeat
			legendClass="text-[30px]"
			onpress={() => step(markId, delta)}
		/>
	</div>
{/snippet}

{#snippet valueBox(mark: MarkLine)}
	{@const changed = draft[mark.id] !== machine[mark.id]}
	{@const active = activeId === mark.id}
	<label
		class="relative flex h-[52px] w-[100px] shrink-0 items-center justify-center gap-1 rounded-lg bg-white {active
			? 'border-3 border-[#f26b2a]'
			: changed
				? 'border-2 border-[#d97706]'
				: 'border-2 border-[#c9ced6]'}"
	>
		<input
			bind:this={valueInputs[mark.id]}
			value={draft[mark.id] ?? 0}
			inputmode="none"
			autocomplete="off"
			aria-label="Produced for {mark.id}"
			class="w-full min-w-0 border-0 bg-transparent p-0 text-center text-[28px] font-bold text-[#1c2129] caret-[#f26b2a] shadow-none outline-none selection:bg-[#ffd9c4] focus:border-transparent focus:ring-0 focus-visible:ring-0 focus-visible:outline-none {changed &&
			!active
				? 'pr-5'
				: ''}"
			onfocus={() => openValue(mark.id)}
			oninput={(event) => onValueInput(mark.id, event)}
		/>
		{#if changed && !active}
			<span class="absolute right-1.5 text-sm leading-[18px] font-bold text-[#d97706]">
				{deltaLabel(mark.id)}
			</span>
		{/if}
	</label>
{/snippet}

{#if job}
	{@const saved = success && savedAt !== null}
	<div class="flex h-full min-h-0 w-full flex-col bg-white font-body text-[#1b2028]">
		<!-- Header -->
		<header
			class="flex h-[88px] shrink-0 items-center gap-4 border-b-4 px-[30px] {editing
				? 'border-[#f26522]'
				: success
					? 'border-[#26ae54]'
					: 'border-[#dc2626]'}"
		>
			<div class="flex min-w-0 flex-1 flex-col">
				<p
					class="m-0 text-[32px] leading-[41px] font-bold tracking-[1.1px] uppercase {editing
						? 'text-[#1b2028]'
						: success
							? 'text-[#1e8a43]'
							: 'text-[#c62828]'}"
				>
					{editing
						? 'Edit quantities'
						: saved
							? 'Quantities saved'
							: success
								? 'Job completed'
								: 'Job cancelled'}
				</p>
				<p
					class="m-0 truncate font-heading text-2xl leading-[33px] font-medium text-[#5a616c]"
					title={jobLine}
				>
					{jobLine}
				</p>
			</div>
			<div class="flex shrink-0 items-baseline gap-3">
				<span
					class="font-heading text-2xl leading-[33px] font-bold tracking-[0.6px] text-[#5a616c] uppercase"
				>
					{editing ? 'Total' : saved ? 'Saved at' : success ? 'Completed at' : 'Ended at'}
				</span>
				<span class="text-[44px] leading-[56px] font-bold">
					{editing
						? `${draftTotal} / ${plannedTotal}`
						: saved
							? savedAt
							: displayMetric(pmsStore.jobCompleteAt)}
				</span>
			</div>
		</header>

		{#if editing}
			<div class="flex min-h-0 flex-1 gap-6 pt-3 pr-7 pb-[18px] pl-[30px]">
				<div class="flex w-[658px] shrink-0 flex-col">
					<section
						class="flex h-[501px] shrink-0 gap-3 rounded-xl border-2 border-[#c9ced6] bg-white p-3"
					>
						<div class="flex min-w-0 flex-1 flex-col">
							<div class="flex h-16 shrink-0 items-center gap-4">
								{#if showSearch}
									<label
										class="flex h-14 min-w-0 flex-1 items-center gap-2.5 rounded-lg border-3 border-[#f26b2a] bg-white px-3.5"
									>
										<Search class="size-6 shrink-0 text-[#5a616b]" strokeWidth={2.5} />
										<input
											bind:this={searchInput}
											bind:value={query}
											inputmode="none"
											autocomplete="off"
											placeholder="Mark no"
											aria-label="Find mark"
											class="min-w-0 flex-1 border-0 bg-transparent p-0 text-[30px] leading-[38px] font-bold text-[#1c2129] caret-[#f26b2a] shadow-none outline-none placeholder:text-xl placeholder:font-medium placeholder:text-[#7e848d] focus:border-transparent focus:ring-0 focus-visible:ring-0 focus-visible:outline-none"
											onfocus={() => (searching = true)}
										/>
										<span class="shrink-0 text-base leading-5 font-bold text-[#5a616b]">
											{visibleMarks.length} of {marks.length}
										</span>
									</label>
								{/if}
								<HmiFlatButton
									size="xs"
									label={showSearch ? 'Clear' : 'Find mark'}
									icon={showSearch ? X : Search}
									active={showSearch}
									class={showSearch ? 'w-36 shrink-0' : 'w-45'}
									onclick={toggleSearch}
								/>
							</div>

							<div
								class="grid h-10 shrink-0 grid-cols-[4px_196px_84px_1fr] items-center bg-[#f4f5f7]"
							>
								<span></span>
								<span class="px-3 {compactHead}">Mark no</span>
								<span class="px-2 text-right {compactHead}">Planned</span>
								<span class="text-center {compactHead}">Produced</span>
							</div>

							<div
								bind:this={rowsEl}
								class="min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
								onscroll={syncArrows}
							>
								{#each visibleMarks as mark (mark.id)}
									{@const changed = draft[mark.id] !== machine[mark.id]}
									<div
										class="grid h-[62px] grid-cols-[4px_196px_84px_1fr] items-center {activeId ===
										mark.id
											? 'bg-[#fff2e8]'
											: 'bg-white'}"
									>
										<span
											class="h-full {activeId === mark.id
												? 'bg-[#f26b2a]'
												: changed
													? 'bg-[#d97706]'
													: ''}"
										></span>
										<span class="truncate px-3 text-[22px] leading-7 font-bold text-[#1c2129]">
											{mark.id}
										</span>
										<span class="px-2 text-right text-[22px] leading-7 font-medium text-[#5a616b]">
											{displayMetric(mark.progressTotal)}
										</span>
										<span class="flex items-center justify-end gap-1.5 px-1">
											{@render stepperKey('−', mark.id, -1)}
											{@render valueBox(mark)}
											{@render stepperKey('+', mark.id, 1)}
										</span>
									</div>
								{:else}
									<p class="m-0 px-3 pt-4 font-heading text-xl font-medium text-[#5a616b]">
										No mark matches “{query}”.
									</p>
								{/each}
							</div>

							<div
								class="grid h-[60px] shrink-0 grid-cols-[4px_196px_84px_1fr] items-center border-t-2 border-[#1c2129]"
							>
								<span></span>
								<span class="px-3 text-xl leading-[26px] font-bold">
									Total · {marks.length} marks
								</span>
								<span class="px-2 text-right text-[22px] leading-7 font-bold">{plannedTotal}</span>
								<span class="text-center text-[28px] leading-9 font-bold">{draftTotal}</span>
							</div>
						</div>

						{@render scrollArrows()}
					</section>

					<div class="mt-11 flex justify-center gap-6 px-[26px]">
						<HmiFlatButton
							size="sm"
							label={activeMark
								? `Set to ${displayMetric(activeMark.progressTotal)} (planned)`
								: 'Set to planned'}
							icon={CornerDownRight}
							disabled={!activeMark}
							class="min-w-0 flex-1"
							onclick={() => setActive(activeMark?.progressTotal ?? undefined)}
						/>
						<HmiFlatButton
							size="sm"
							label={activeMark
								? `Reset to ${machine[activeMark.id] ?? 0} (count)`
								: 'Reset to count'}
							icon={CornerDownRight}
							disabled={!activeMark}
							class="min-w-0 flex-1"
							onclick={() => setActive(activeMark ? machine[activeMark.id] : undefined)}
						/>
					</div>
				</div>

				<div class="flex min-w-0 flex-1 flex-col">
					<HmiNumpad inputElement={numpadTarget} onEnter={onNumpadEnter} />
					<HmiFlatButton
						label="Save"
						icon={Check}
						tone="primary"
						size="md"
						class="mt-[18px] h-[82px]"
						onclick={saveEdits}
					/>
				</div>
			</div>
		{:else}
			<div class="flex min-h-0 flex-1 flex-col pt-3 pr-7 pb-[18px] pl-[30px]">
				<div class="flex min-h-0 flex-1 gap-6">
					<section
						class="flex w-[658px] shrink-0 gap-3 rounded-xl border-2 border-[#c3c8cf] bg-white py-2.5 pl-[18px] {canScroll
							? 'pr-2.5'
							: 'pr-[18px]'}"
					>
						<div class="flex min-w-0 flex-1 flex-col">
							<div class="grid h-12 shrink-0 grid-cols-[1fr_140px_172px] items-center bg-[#f5f6f8]">
								<span class="px-3.5 {headCell}">Mark no</span>
								<span class="px-3.5 text-right {headCell}">Planned</span>
								<span class="px-3.5 text-right {headCell}">Produced</span>
							</div>
							<div
								bind:this={rowsEl}
								class="min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
								onscroll={syncArrows}
							>
								{#each marks as mark (mark.id)}
									<div
										class="grid h-20 grid-cols-[1fr_140px_172px] items-center border-b border-[#dde1e5] last:border-b-0"
									>
										<span class="truncate px-3.5 text-[26px] leading-[33px] font-bold">
											{mark.id}
										</span>
										<span class="px-3.5 text-right font-heading text-[26px] leading-9 font-medium">
											{displayMetric(mark.progressTotal)}
										</span>
										<span class="px-3.5 text-right text-[32px] leading-[41px] font-bold">
											{producedOf(mark)}
										</span>
									</div>
								{/each}
							</div>
							<div
								class="grid h-[84px] shrink-0 grid-cols-[1fr_140px_172px] items-center border-t-2 border-[#1b2028]"
							>
								<span class="px-3.5 text-[26px] leading-[33px] font-bold">Total</span>
								<span class="px-3.5 text-right text-[26px] leading-[33px] font-bold">
									{plannedTotal}
								</span>
								<span class="px-3.5 text-right text-[32px] leading-[41px] font-bold">
									{producedTotal}
								</span>
							</div>
						</div>

						{#if canScroll}
							{@render scrollArrows()}
						{/if}
					</section>

					<div class="flex min-w-0 flex-1 flex-col">
						<dl class="m-0 flex flex-col gap-8 pt-5 pl-6">
							{#each timeCards as card (card.label)}
								{@const Icon = card.icon}
								<div class="flex items-center gap-4">
									<span
										class="flex size-12 shrink-0 items-center justify-center rounded-lg bg-[#e4e6e8] text-[#1b2028]"
									>
										<Icon class="size-7" strokeWidth={2.5} />
									</span>
									<dt
										class="w-[150px] shrink-0 font-heading text-2xl leading-[33px] font-medium tracking-[0.6px] whitespace-nowrap text-[#5a616c] uppercase"
									>
										{card.label}
									</dt>
									<dd class="m-0 text-[38px] leading-[48px] font-bold tabular-nums">
										{card.value}
									</dd>
								</div>
							{/each}
						</dl>
						{#if showDisableInterlock}
							<HmiFlatButton
								label="Disable interlock"
								icon={LockOpen}
								size="md"
								class="mt-auto"
								disabled={leaving}
								onclick={() => publishUnlock()}
							/>
						{/if}
					</div>
				</div>

				<div class="mt-5 grid grid-cols-[352px_1fr_1fr] gap-4">
					<HmiFlatButton
						label="Change job"
						icon={List}
						size="lg"
						disabled={leaving}
						onclick={() => (confirming = 'change')}
					/>
					<HmiFlatButton
						label="Next sequence"
						icon={ArrowRight}
						tone="primary"
						size="lg"
						loading={leaving}
						onclick={() => (confirming = 'next')}
					/>
					<HmiFlatButton
						label="Edit quantities"
						icon={RotateCw}
						size="lg"
						disabled={leaving}
						onclick={startEditing}
					/>
				</div>
			</div>
		{/if}
	</div>
	<HmiConfirmDialog
		open={confirming !== null}
		title={confirming === 'change' ? 'Change job?' : 'Go to the next sequence?'}
		message="This summary is saved and closed."
		confirmLabel={confirming === 'change' ? 'Change job' : 'Next sequence'}
		icon={confirming === 'change' ? List : ArrowRight}
		tone="primary"
		onConfirm={confirmLeave}
		onCancel={() => (confirming = null)}
	/>
{:else}
	<div class="flex h-full flex-col items-center justify-center gap-6 p-8 font-body">
		<p class="m-0 font-heading text-2xl font-medium text-[#5a616c]">No job summary yet.</p>
		<HmiFlatButton
			label="Start a job"
			icon={ArrowRight}
			size="md"
			class="w-[472px]"
			onclick={() => navigation.navigateTo('StartJob')}
		/>
	</div>
{/if}
