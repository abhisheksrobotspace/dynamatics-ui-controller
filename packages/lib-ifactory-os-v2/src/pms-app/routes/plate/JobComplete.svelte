<script lang="ts">
	import { tick } from 'svelte';
	import { HmiButton, HmiFlatButton, HmiKey, HmiNumpad } from '@ifactory/ui-v2';
	import {
		ArrowRight,
		Check,
		CirclePause,
		Clock,
		Cog,
		List,
		LockOpen,
		Play,
		RotateCw,
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
	import { jobDisplayLabel, jobHasAvailableMarkings } from '../../lib/jobs';
	import type { AppNavigation } from '../../lib/navigation';

	let { navigation }: { navigation: AppNavigation } = $props();

	/* Figma: HMI FROZEN DESIGN → job-complete (angle summary) + OPTION 2 plate · 4 edit quantity (single mark). */
	const job = $derived(pmsStore.activeJob);
	const success = $derived(pmsStore.showSummarySuccess);
	const markNo = $derived(job?.markNo ?? job?.marks[0]?.id ?? '-');
	const planned = $derived(job?.piecesPlanned ?? job?.plannedPlates ?? 0);
	/** What the machine counted for this mark. */
	const machineCount = $derived(job?.piecesCut ?? 0);
	const subtitle = $derived(
		[job?.partSize, [job?.section, job?.thickness].filter(Boolean).join(' ')]
			.filter(Boolean)
			.join(' · ')
	);
	const showDisableInterlock = $derived(
		interlockStore.isEnabled && (interlockStore.isActive || interlockStore.isOn)
	);

	let producedCount = $state(0);
	let seededJobId = $state<string | null>(null);

	$effect(() => {
		const id = job?.jobId ?? null;
		if (!id) {
			seededJobId = null;
			producedCount = 0;
			return;
		}
		if (seededJobId === id) return;
		seededJobId = id;
		// Ops profile reports totalParts: 0 (holes only) → piecesCut is 0, not "unknown".
		// Prefill planned plates so the operator adjusts scrap/discrepancy from the card qty.
		// A cancelled summary prefills what was made, never the plan (Save would send the plan as made).
		producedCount = !pmsStore.showSummarySuccess
			? (job?.piecesCut ?? 0)
			: job?.piecesCut != null && job.piecesCut > 0
				? job.piecesCut
				: (job?.plannedPlates ?? job?.piecesPlanned ?? 0);
	});

	/** Put the one plate count on the mark so publishUpdatePartsProduced matches angle. */
	function applyProduced() {
		for (const mark of pmsStore.activeJob?.marks ?? []) mark.produced = producedCount;
	}

	/* ---------- Edit quantity ---------- */

	let editing = $state(false);
	let draft = $state(0);
	let valueInput = $state<HTMLInputElement | null>(null);

	const delta = $derived(draft - planned);
	const deltaLabel = $derived(
		delta === 0
			? 'Same as planned'
			: `${Math.abs(delta)} ${delta < 0 ? 'less' : 'more'} than planned`
	);

	async function startEditing() {
		draft = producedCount;
		editing = true;
		await tick();
		selectValue();
	}

	/** Select the number so the first key press replaces it. */
	function selectValue() {
		valueInput?.focus();
		valueInput?.select();
	}

	/** Send the correction now; the controller keeps the last one and adds it to the held completion. */
	function saveEdits() {
		producedCount = Math.max(0, draft);
		applyProduced();
		editing = false;
		void publishUpdatePartsProduced({ evenIfCancelled: true });
	}

	function step(by: number) {
		draft = Math.max(0, draft + by);
	}

	function onValueInput(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const digits = input.value.replace(/\D/g, '').slice(0, 5);
		if (digits !== input.value) input.value = digits;
		draft = digits ? Number(digits) : 0;
	}

	/* ---------- Leaving the summary ---------- */

	let leaving = $state(false);

	/** Confirm counts (if a completion is held), then leave jobSummary so the controller can flush 8002. */
	async function leaveSummary(after: () => void | Promise<void>) {
		if (leaving) return;
		leaving = true;
		try {
			applyProduced();
			await publishUpdatePartsProduced({ evenIfCancelled: true });
			await after();
		} finally {
			leaving = false;
		}
	}

	async function nextMark() {
		await leaveSummary(async () => {
			const jobId = pmsStore.activeJob?.jobId;
			await loadJobs();
			const queued = jobId ? pmsStore.jobs[jobId] : undefined;
			pmsStore.startJobPrefillJobId =
				jobId && jobHasAvailableMarkings(queued, pmsStore.donePlateMarks) ? jobId : null;
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

	const statBox = 'flex flex-col justify-center rounded-lg bg-[#f5f6f8] pl-[18px]';
	const statLabel = 'font-heading text-xl leading-[26px] font-medium text-[#5a616c]';

	/** CHANGE JOB and NEXT … leave the summary, so they ask first. */
	let confirming = $state<'change' | 'next' | null>(null);

	function confirmLeave() {
		const action = confirming;
		confirming = null;
		if (action === 'change') void changeJob();
		else if (action === 'next') void nextMark();
	}
</script>

{#snippet stepperKey(label: string, by: number)}
	<div class="h-[120px] w-[130px] shrink-0">
		<HmiKey {label} tone="function" repeat legendClass="text-[34px]" onpress={() => step(by)} />
	</div>
{/snippet}

{#if job}
	<div class="flex h-full min-h-0 w-full flex-col bg-white font-body text-[#1b2028]">
		<header
			class="flex h-[88px] shrink-0 items-center gap-4 border-b-4 px-[30px] {editing
				? 'border-[#f26522]'
				: success
					? 'border-[#26ae54]'
					: 'border-[#dc2626]'}"
		>
			<span
				class="flex size-[60px] shrink-0 items-center justify-center rounded-[10px] text-white {editing
					? 'bg-[#f26522]'
					: success
						? 'bg-[#26ae54]'
						: 'bg-[#dc2626]'}"
			>
				{#if editing}
					<RotateCw class="size-[33px]" strokeWidth={2.5} />
				{:else if success}
					<Check class="size-[33px]" strokeWidth={2.5} />
				{:else}
					<X class="size-[33px]" strokeWidth={2.5} />
				{/if}
			</span>
			<div class="flex min-w-0 flex-1 flex-col">
				<p
					class="m-0 text-[32px] leading-[41px] font-bold tracking-[1.1px] uppercase {editing
						? 'text-[#1b2028]'
						: success
							? 'text-[#1e8a43]'
							: 'text-[#c62828]'}"
				>
					{editing ? 'Edit quantities' : success ? 'Job complete' : 'Job cancelled'}
				</p>
				<p class="m-0 truncate font-heading text-2xl leading-[33px] font-medium text-[#5a616c]">
					{editing
						? 'Change only if your physical count is different'
						: `${producedCount} of ${planned} pieces · ${jobDisplayLabel(job)} · ${markNo}`}
				</p>
			</div>
			<div class="flex shrink-0 items-baseline gap-3">
				<span
					class="font-heading text-2xl leading-[33px] font-bold tracking-[0.6px] text-[#5a616c] uppercase"
				>
					{editing ? 'Total' : success ? 'Completed at' : 'Ended at'}
				</span>
				<span class="text-[44px] leading-[56px] font-bold">
					{editing ? `${draft} / ${planned}` : displayMetric(pmsStore.jobCompleteAt)}
				</span>
			</div>
		</header>

		<div class="flex min-h-0 flex-1 gap-6 pt-3 pr-7 pb-[18px] pl-[30px]">
			{#if editing}
				<div class="flex w-[658px] shrink-0 flex-col">
					<section
						class="flex h-[491px] flex-col gap-3.5 rounded-xl border-2 border-[#c3c8cf] bg-white px-[26px] py-[18px]"
					>
						<div class="flex flex-col">
							<p class="m-0 truncate text-[32px] leading-[41px] font-bold">{markNo}</p>
							<p class="m-0 truncate text-xl leading-[26px] font-medium text-[#5a616c] uppercase">
								{subtitle}
							</p>
						</div>
						<div class="grid grid-cols-2 gap-4">
							<div class="h-[92px] {statBox}">
								<span class={statLabel}>Planned</span>
								<span class="text-[36px] leading-[46px] font-bold">{planned}</span>
							</div>
							<div class="h-[92px] {statBox}">
								<span class={statLabel}>Machine count</span>
								<span class="text-[36px] leading-[46px] font-bold">{machineCount}</span>
							</div>
						</div>
						<p class="m-0 font-heading text-2xl leading-[31px] font-medium text-[#5a616c]">
							Produced
						</p>
						<div class="flex items-center gap-4">
							{@render stepperKey('−', -1)}
							<label
								class="flex h-28 min-w-0 flex-1 items-center justify-center rounded-[10px] border-3 border-[#f26b2a] bg-white"
							>
								<input
									bind:this={valueInput}
									value={draft}
									inputmode="none"
									autocomplete="off"
									aria-label="Produced for {markNo}"
									class="w-full min-w-0 border-0 bg-transparent p-0 text-center text-[72px] leading-[92px] font-bold text-[#1b2028] caret-[#f26b2a] shadow-none outline-none selection:bg-[#ffd9c4] focus:border-transparent focus:ring-0 focus-visible:ring-0 focus-visible:outline-none"
									onfocus={selectValue}
									oninput={onValueInput}
								/>
							</label>
							{@render stepperKey('+', 1)}
						</div>
						<div class="mt-auto flex items-center justify-between gap-4">
							<span
								class="text-[22px] leading-7 font-bold {delta === 0
									? 'text-[#5a616c]'
									: 'text-[#b45309]'}"
							>
								{deltaLabel}
							</span>
							<HmiButton
								size="md"
								label="Use machine count"
								icon={Cog}
								class="w-[330px] min-w-0"
								faceClass="pr-5 text-xl tracking-normal"
								disabled={draft === machineCount}
								onclick={() => (draft = machineCount)}
							/>
						</div>
					</section>
					<HmiButton
						label="Save"
						icon={Check}
						tone="primary"
						class="mt-auto w-full"
						onclick={saveEdits}
					/>
				</div>

				<div class="flex min-w-0 flex-1 flex-col">
					<HmiNumpad inputElement={valueInput} onEnter={saveEdits} />
					<HmiButton
						size="md"
						label="Cancel"
						icon={X}
						class="mt-auto w-full"
						onclick={() => (editing = false)}
					/>
				</div>
			{:else}
				<div class="flex min-w-0 flex-1 flex-col">
					<div class="flex min-h-0 flex-1 gap-6">
						<section
							class="flex w-[658px] shrink-0 flex-col gap-3.5 rounded-xl border-2 border-[#c3c8cf] bg-white px-[26px] py-[18px]"
						>
							<div class="flex flex-col">
								<p class="m-0 truncate text-[32px] leading-[41px] font-bold">{markNo}</p>
								<p class="m-0 truncate text-xl leading-[26px] font-medium text-[#5a616c] uppercase">
									{subtitle}
								</p>
							</div>
							<div class="grid min-h-0 flex-1 grid-cols-2 gap-4">
								<div class={statBox}>
									<span class={statLabel}>Planned</span>
									<span class="text-[64px] leading-[82px] font-bold">{planned}</span>
									<span class="text-lg leading-[23px] font-medium text-[#5a616c]">pcs</span>
								</div>
								<div class={statBox}>
									<span class={statLabel}>Produced</span>
									<span
										class="text-[64px] leading-[82px] font-bold {producedCount === planned
											? 'text-[#1b2028]'
											: 'text-[#b45309]'}"
									>
										{producedCount}
									</span>
									<span class="text-lg leading-[23px] font-medium text-[#5a616c]">
										{producedCount === machineCount
											? 'pcs'
											: `pcs · machine counted ${machineCount}`}
									</span>
								</div>
							</div>
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
							label="Next mark"
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
							onclick={() => void startEditing()}
						/>
					</div>
				</div>
			{/if}
		</div>
	</div>
	<HmiConfirmDialog
		open={confirming !== null}
		title={confirming === 'change' ? 'Change job?' : 'Go to the next mark?'}
		message="This summary is saved and closed."
		confirmLabel={confirming === 'change' ? 'Change job' : 'Next mark'}
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
