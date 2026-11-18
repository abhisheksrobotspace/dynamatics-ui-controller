<script lang="ts">
	import { onMount } from 'svelte';
	import {
		HmiDataCard,
		HmiFlatButton,
		HmiNumpad,
		HmiSearchSelect,
		type HmiSearchSelectItem
	} from '@ifactory/ui-v2';
	import { Play } from '@lucide/svelte';
	import {
		buildStartJobData,
		formatJobTimestamp,
		formatPlatePartSize,
		formatThicknessMm,
		jobDisplayLabel,
		jobHasAvailableMarkings,
		manualRowKey,
		manualTaskKey,
		unfinishedManualMarks,
		type HmiJob
	} from '../../lib/jobs';
	import { jobCardPanelFromCard } from '../../lib/job-card-display.js';
	import { loadJobs, pmsStore, startJob } from '../../lib/hmi-store.svelte';
	import type { AppNavigation } from '../../lib/navigation';
	import PlatePiecePreview from '../../components/PlatePiecePreview.svelte';

	let { navigation }: { navigation: AppNavigation } = $props();

	/* Figma: HMI FROZEN DESIGN → manual · 1 select job / 2 pick mark · ready. */
	/** START JOB: the 118 px primary keycap with Figma's 38 px label. */
	const START_FACE = 'text-[38px] tracking-[1.1px]';

	let sectionJobId = $state('');
	let marking = $state('');
	/** Bundle number as a string (the select's value). */
	let bundle = $state('');
	let jobOpen = $state(false);
	let markOpen = $state(false);
	let bundleOpen = $state(false);
	let jobInput = $state<HTMLInputElement | null>(null);
	let markInput = $state<HTMLInputElement | null>(null);
	let bundleInput = $state<HTMLInputElement | null>(null);
	type Select = { commit: () => boolean } | null;
	let jobSelect = $state<Select>(null);
	let markSelect = $state<Select>(null);
	let bundleSelect = $state<Select>(null);

	onMount(() => {
		void (async () => {
			const prefillJobId = pmsStore.startJobPrefillJobId;
			pmsStore.startJobPrefillJobId = null;
			await loadJobs();
			if (prefillJobId && available(pmsStore.jobs[prefillJobId])) {
				sectionJobId = prefillJobId;
				pickFirstOpen();
			}
		})();
	});

	function available(job: HmiJob | undefined): boolean {
		return jobHasAvailableMarkings(job, undefined, undefined, pmsStore.manualTasks);
	}

	function thicknessOf(job: HmiJob): string {
		return formatThicknessMm(job.thicknessMm) ?? job.thickness ?? '';
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
	/** Every bundle row on the card, and the ones still open. */
	const allRows = $derived(selectedJob?.manualMarks ?? []);
	const openRows = $derived(
		selectedJob ? unfinishedManualMarks(selectedJob, pmsStore.manualTasks) : []
	);

	const markItems = $derived.by<HmiSearchSelectItem[]>(() => {
		// First open bundle of each mark, in card order.
		const firstRows = openRows.filter(
			(row, index) => openRows.findIndex((other) => other.marking === row.marking) === index
		);
		return firstRows.map((row) => ({
			value: row.marking,
			label: [row.marking, formatPlatePartSize(row.itemLength, row.widthMm)]
				.filter(Boolean)
				.join(' · ')
		}));
	});

	/** All bundles of the chosen mark (for "of 4" and the total quantity). */
	const markRows = $derived(allRows.filter((row) => row.marking === marking));

	const bundleItems = $derived<HmiSearchSelectItem[]>(
		selectedJob
			? openRows
					.filter((row) => row.marking === marking)
					.map((row) => {
						const saved =
							pmsStore.manualTasks[manualTaskKey(selectedJob.jobId, row.marking, row.bundleNo)];
						return {
							value: String(row.bundleNo),
							label: `B-${row.bundleNo} of ${markRows.length} · ${row.pcs} pcs`,
							meta: (saved?.operations ?? 0) > 0 ? 'Resume' : ''
						};
					})
			: []
	);

	const selectedRow = $derived(
		openRows.find((row) => row.marking === marking && String(row.bundleNo) === bundle)
	);

	/** The card lacks fields `/iow/startJob` needs (e.g. a mark's weight per piece). */
	const cardIncomplete = $derived(Boolean(selectedJob && !buildStartJobData(selectedJob)));
	const canStart = $derived(Boolean(selectedJob && selectedRow && !cardIncomplete));

	const anyOpen = $derived(jobOpen || markOpen || bundleOpen);
	/** Keypad while picking; the piece preview once a bundle is chosen. */
	const showKeypad = $derived(!selectedRow || anyOpen);
	const keypadTarget = $derived(bundleOpen ? bundleInput : markOpen ? markInput : jobInput);

	const hint = $derived(
		pmsStore.jobsLoading && jobItems.length === 0
			? 'Loading jobs…'
			: !selectedJob
				? 'Pick a job to enable'
				: cardIncomplete
					? 'This job card is missing data the machine needs'
					: !marking
						? 'Pick a mark number to enable'
						: !selectedRow
							? 'Pick a bundle to enable'
							: ''
	);

	const previewRows = $derived.by(() => {
		if (!selectedJob || !selectedRow) return [];
		const header = jobCardPanelFromCard(selectedJob.sourceCard).header;
		const totalPcs = markRows.reduce((sum, row) => sum + row.pcs, 0);
		const bundles = markRows.length;
		return [
			{
				label: 'Quantity',
				value: `${totalPcs} pcs · ${bundles} ${bundles === 1 ? 'bundle' : 'bundles'}`
			},
			{ label: 'Ops / piece', value: String(selectedRow.operations ?? '—') },
			{ label: 'Thickness', value: thicknessOf(selectedJob) || '—' },
			{ label: 'Grade', value: header.rmGrade && header.rmGrade !== '-' ? header.rmGrade : '—' },
			{
				label: 'Wt / piece',
				value: selectedRow.weightPerPieceKg != null ? `${selectedRow.weightPerPieceKg} kg` : '—'
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

	/** Land on the first open mark and bundle, so a picked card is ready to start. */
	function pickFirstOpen() {
		const first = openRows[0];
		marking = first?.marking ?? '';
		bundle = first ? String(first.bundleNo) : '';
	}

	function onJobChange() {
		pickFirstOpen();
	}

	function onMarkChange() {
		const first = openRows.find((row) => row.marking === marking);
		bundle = first ? String(first.bundleNo) : '';
	}

	function onKeypadEnter() {
		if (bundleOpen) bundleSelect?.commit();
		else if (markOpen) markSelect?.commit();
		else jobSelect?.commit();
	}

	function onStart() {
		if (!canStart || !sectionJobId || !selectedRow) return;
		startJob(sectionJobId, manualRowKey(selectedRow.marking, selectedRow.bundleNo));
		navigation.navigateTo('JobRunning');
	}
</script>

<div class="flex h-full min-h-0 gap-6 bg-white pt-2 pr-7 pb-6 pl-[30px] font-body text-[#1b2028]">
	<div class="flex w-[658px] shrink-0 flex-col">
		<h1 class="m-0 font-body text-[32px] leading-[41px] font-bold">Start Job</h1>

		<HmiSearchSelect
			bind:this={jobSelect}
			bind:inputRef={jobInput}
			bind:value={sectionJobId}
			bind:open={jobOpen}
			items={jobItems}
			label="Job card number"
			placeholder="Select job"
			emptyText={pmsStore.jobsLoading ? 'Loading jobs…' : 'No matching jobs.'}
			class="relative z-30 mt-[11px]"
			onValueChange={onJobChange}
			onOpenChange={(open) => {
				// Opening the list (a tap, or the first numpad key) refreshes the queue.
				if (open) void loadJobs();
			}}
		/>

		<HmiSearchSelect
			bind:this={markSelect}
			bind:inputRef={markInput}
			bind:value={marking}
			bind:open={markOpen}
			items={markItems}
			label="Mark number"
			placeholder={selectedJob ? 'Select mark' : 'Pick a job first'}
			disabled={!selectedJob}
			class="relative z-20 mt-5"
			onValueChange={onMarkChange}
		/>

		<HmiSearchSelect
			bind:this={bundleSelect}
			bind:inputRef={bundleInput}
			bind:value={bundle}
			bind:open={bundleOpen}
			items={bundleItems}
			label="Bundle number"
			placeholder={marking ? 'Select bundle' : 'Pick a mark first'}
			disabled={!marking}
			class="relative z-10 mt-5"
		/>

		<HmiDataCard
			class="mt-auto h-[165px]"
			label="Pcs in bundle"
			value={selectedRow?.pcs ?? '—'}
			unit={selectedRow ? 'pcs' : undefined}
		/>
	</div>

	<div class="flex w-[472px] shrink-0 flex-col">
		{#if showKeypad}
			<HmiNumpad inputElement={keypadTarget} enterDisabled={!anyOpen} onEnter={onKeypadEnter} />
			{#if hint}
				<p class="m-0 mt-6 h-[25px] font-heading text-lg font-medium text-[#6b7280]">{hint}</p>
			{/if}
		{:else if selectedRow}
			<PlatePiecePreview
				class="mt-[46px] h-[530px]"
				title="Piece · {selectedRow.marking}"
				lengthMm={selectedRow.itemLength}
				widthMm={selectedRow.widthMm}
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
