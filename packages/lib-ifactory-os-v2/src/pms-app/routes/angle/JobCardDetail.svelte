<script lang="ts">
	import { HmiFlatButton, HmiHoldButton, createHmiPress } from '@ifactory/ui-v2';
	import {
		ArrowLeft,
		ChevronDown,
		ChevronUp,
		CircleX,
		Clock,
		Eye,
		List,
		PackageX,
		SlidersHorizontal
	} from '@lucide/svelte';
	import type { Component } from 'svelte';
	import { openDrawingView } from '../../lib/drawing-view.js';
	import { cancelJob, displayMetric, endJob, pmsStore } from '../../lib/hmi-store.svelte';
	import { jobCardPanelFromCard } from '../../lib/job-card-display.js';
	import { formatThicknessMm, jobDisplayLabel } from '../../lib/jobs';
	import type { AppNavigation } from '../../lib/navigation';

	let { navigation }: { navigation: AppNavigation } = $props();

	/* Figma: HMI FROZEN DESIGN → Job Details Page · Details / Schedule / Steel req. / Cutting plan / Drawing (RAISE ALERT left out). */
	type TabId = 'details' | 'schedule' | 'steel' | 'cutting' | 'drawing';
	const TABS: {
		id: TabId;
		label: string;
		icon: Component<{ class?: string; strokeWidth?: number }>;
	}[] = [
		{ id: 'details', label: 'Details', icon: List },
		{ id: 'schedule', label: 'Schedule', icon: Clock },
		{ id: 'steel', label: 'Steel req.', icon: PackageX },
		{ id: 'cutting', label: 'Cutting plan', icon: SlidersHorizontal },
		{ id: 'drawing', label: 'Drawing', icon: Eye }
	];
	/** Rows that fit the 412 px table card. */
	const PAGE_ROWS = 5;

	let tab = $state<TabId>('details');
	let offset = $state(0);
	const tabPress = createHmiPress();
	let pressedTab = $state<TabId | null>(null);

	const job = $derived(pmsStore.activeJob);
	const card = $derived(job ? pmsStore.jobs[job.jobId] : undefined);
	const panel = $derived(jobCardPanelFromCard(card?.sourceCard));
	const cardType = $derived(job?.cardType ?? card?.cardType ?? 'angle');

	const title = $derived(
		job
			? [
					jobDisplayLabel(job),
					[job.section || card?.section, card ? formatThicknessMm(card.thicknessMm) : undefined]
						.filter(Boolean)
						.join(' ')
				]
					.filter(Boolean)
					.join(' · ')
			: ''
	);

	/** The RM's place in the cutting plan (angle). */
	const sequenceIndex = $derived(
		job ? panel.cuttingPlan.findIndex((row) => row.rmId === job.rmId) : -1
	);

	const subtitle = $derived.by(() => {
		if (!job) return '';
		// Marks on the card: plate `marks`, manual rows per marking, else the running RM's marks.
		const markCount =
			panel.marks.length ||
			card?.marks?.length ||
			new Set((card?.manualMarks ?? []).map((row) => row.marking)).size ||
			job.marks.length;
		const marks = markCount ? `${markCount} ${markCount === 1 ? 'mark' : 'marks'}` : '';
		const parts =
			cardType === 'angle'
				? [
						sequenceIndex >= 0 ? `Sequence ${sequenceIndex + 1}` : '',
						job.rmLength && job.rmLength !== '-' ? `RM length ${job.rmLength} mm` : '',
						marks
					]
				: [
						job.markNo ? `Mark ${job.markNo}` : '',
						job.bundleNo ? `Bundle ${job.bundleNo}` : '',
						marks
					];
		return parts.filter(Boolean).join(' · ');
	});

	/** A schedule row's RM as its sequence number: its place in the cutting plan. */
	function scheduleSeq(rmId: string | null | undefined): string {
		const index = rmId ? panel.cuttingPlan.findIndex((row) => row.rmId === rmId) : -1;
		return index < 0 ? '-' : String(index + 1);
	}

	function shown(value: string | number | null | undefined): string {
		return value == null || value === '' ? '-' : String(value);
	}

	function withUnit(value: string | number | null | undefined, unit: string): string {
		return value == null || value === '' ? '-' : `${value} ${unit}`;
	}

	type Cell = { text: string; strong?: boolean; accent?: boolean; small?: boolean };
	type Row = { id: string; cells: Cell[]; current?: boolean; drawingIndex?: number };
	type Column = { label: string; width: string; align?: 'end' };

	const COLUMNS: Record<TabId, Column[]> = {
		details: [
			{ label: 'Mark no', width: '300px' },
			{ label: 'Length', width: '260px', align: 'end' },
			{ label: 'Pcs / bar', width: '220px', align: 'end' },
			{ label: 'Progress', width: 'minmax(0,1fr)', align: 'end' }
		],
		schedule: [
			{ label: 'Machine', width: '140px' },
			{ label: 'Start', width: '212px' },
			{ label: 'End', width: '212px' },
			{ label: 'Seq no.', width: '130px', align: 'end' },
			{ label: 'Length mm', width: '160px', align: 'end' },
			{ label: 'Operation', width: 'minmax(0,1fr)' }
		],
		steel: [
			{ label: 'Section', width: '320px' },
			{ label: 'Length mm', width: '240px', align: 'end' },
			{ label: 'Qty (nos)', width: '220px', align: 'end' },
			{ label: 'Weight kg', width: 'minmax(0,1fr)', align: 'end' }
		],
		cutting: [
			{ label: 'Seq', width: '110px' },
			{ label: 'Length mm', width: '170px', align: 'end' },
			{ label: 'Qty', width: '100px', align: 'end' },
			{ label: 'Markings', width: 'minmax(0,1fr)' },
			{ label: 'Used mm', width: '150px', align: 'end' }
		],
		drawing: [
			{ label: 'Mark no', width: '260px' },
			{ label: 'Operation', width: '240px' },
			{ label: 'Pcs', width: '160px', align: 'end' },
			{ label: 'Drawing', width: 'minmax(0,1fr)', align: 'end' }
		]
	};

	const rows = $derived.by((): Row[] => {
		if (!job) return [];
		switch (tab) {
			case 'details':
				return job.marks.map((mark) => ({
					id: mark.id,
					cells: [
						{ text: shown(mark.id), strong: true },
						{ text: withUnit(mark.partLength, 'mm') },
						{ text: shown(mark.pcsPerBar) },
						{
							text: `${displayMetric(mark.progressCurrent ?? 0)} / ${displayMetric(mark.progressTotal)}`
						}
					]
				}));
			case 'schedule':
				return panel.schedule.map((row) => {
					const current = Boolean(job.rmId) && row.materialId === job.rmId;
					return {
						id: row.id,
						current,
						cells: [
							{ text: shown(row.machine), strong: true, accent: current },
							{ text: shown(row.plannedStart) },
							{ text: shown(row.plannedEnd) },
							{ text: scheduleSeq(row.materialId), strong: true },
							{ text: shown(row.lengthMm) },
							{ text: shown(row.operation) }
						]
					};
				});
			case 'steel':
				return panel.requisition.map((row) => ({
					id: row.id,
					cells: [
						{ text: shown(row.section), strong: true },
						{ text: shown(row.lengthMm) },
						{ text: shown(row.quantity) },
						{ text: shown(row.weightKg) }
					]
				}));
			case 'cutting':
				return panel.cuttingPlan.map((row, index) => {
					const current = index === sequenceIndex;
					return {
						id: row.id,
						current,
						cells: [
							{ text: String(index + 1), strong: true, accent: current },
							{ text: shown(row.lengthMm) },
							{ text: shown(row.quantity) },
							{ text: shown(row.markings), small: true },
							{ text: shown(row.usedMm) }
						]
					};
				});
			case 'drawing':
				return panel.marks.map((mark) => {
					const drawingIndex = panel.drawings.findIndex(
						(drawing) => drawing.markNo && drawing.markNo === mark.markNo
					);
					return {
						id: mark.id,
						drawingIndex,
						cells: [
							{ text: shown(mark.markNo), strong: true },
							{ text: shown(mark.operation) },
							{ text: withUnit(mark.totalPcs, 'pcs') }
						]
					};
				});
		}
	});

	const columns = $derived(COLUMNS[tab]);
	const gridTemplate = $derived(columns.map((column) => column.width).join(' '));
	const visibleRows = $derived(rows.slice(offset, offset + PAGE_ROWS));
	const atTop = $derived(offset <= 0);
	const atBottom = $derived(offset + PAGE_ROWS >= rows.length);
	const rangeLabel = $derived(
		rows.length
			? `${offset + 1}–${Math.min(offset + PAGE_ROWS, rows.length)} of ${rows.length}`
			: '0 of 0'
	);

	function selectTab(next: TabId) {
		tab = next;
		offset = 0;
	}

	function scrollRows(direction: 1 | -1) {
		offset = Math.max(0, Math.min(offset + direction * PAGE_ROWS, rows.length - 1));
	}

	function viewDrawing(index: number) {
		openDrawingView(index);
		navigation.navigateTo('JobCardDrawings');
	}

	function onEndJob() {
		// The 1.5 s hold is the confirmation. Manual bundles end; angle / plate jobs cancel.
		if (cardType === 'manual') endJob();
		else cancelJob();
		navigation.navigateTo('JobComplete');
	}

	const cellText = 'font-body text-[26px] leading-[33px]';
</script>

<div
	class="flex h-full min-h-0 w-full flex-col bg-white pt-2 pr-7 pl-[30px] font-body text-[#1b2028]"
>
	{#if !job}
		<div class="flex flex-1 flex-col items-center justify-center gap-6">
			<p class="m-0 font-heading text-2xl font-medium text-[#5a616c]">No job is running.</p>
			<HmiFlatButton
				label="Back to job"
				icon={ArrowLeft}
				size="md"
				class="w-[472px]"
				onclick={() => navigation.goBack()}
			/>
		</div>
	{:else}
		<h1 class="m-0 truncate text-[30px] leading-[38px] font-bold" {title}>{title}</h1>
		<p class="m-0 h-[26px] truncate font-heading text-xl leading-[26px] font-medium text-[#5a616c]">
			{subtitle}
		</p>

		<div class="mt-3 grid grid-cols-5 gap-3" role="tablist" aria-label="Job details">
			{#each TABS as item (item.id)}
				{@const selected = tab === item.id}
				{@const down = pressedTab === item.id && tabPress.pressed}
				<button
					type="button"
					role="tab"
					aria-selected={selected}
					class="flex h-[78px] cursor-pointer flex-col rounded-[10px] p-0 select-none [-webkit-tap-highlight-color:transparent] {down
						? 'pt-1.5'
						: selected
							? 'bg-[#f26b2a] pb-1.5'
							: 'bg-[#a3a9b1] pb-1.5'}"
					onpointerdown={(event) => {
						pressedTab = item.id;
						tabPress.handlers.onpointerdown(event);
					}}
					onpointerup={tabPress.handlers.onpointerup}
					onpointerleave={tabPress.handlers.onpointerleave}
					onpointercancel={tabPress.handlers.onpointercancel}
					onclick={() => selectTab(item.id)}
				>
					<span
						class="flex min-h-0 w-full flex-1 items-center justify-center gap-3 rounded-[10px] text-2xl leading-[31px] font-bold {selected
							? 'border-3 border-[#f26b2a] bg-[#fff2e8] text-[#1b2028]'
							: 'border-[1.5px] border-[#c3c8cf] bg-white text-[#40454f]'}"
					>
						<item.icon class="size-[26px]" strokeWidth={2.5} />
						{item.label}
					</span>
				</button>
			{/each}
		</div>

		<div class="mt-4 flex h-[412px] shrink-0 gap-3">
			<section
				class="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border-2 border-[#c3c8cf] bg-white px-[18px] pt-3"
				role="tabpanel"
			>
				<div
					class="grid h-12 shrink-0 items-center bg-[#f5f6f8]"
					style:grid-template-columns={gridTemplate}
				>
					{#each columns as column (column.label)}
						<span
							class="px-3.5 font-body text-[22px] leading-7 font-medium whitespace-nowrap text-[#5a616c] uppercase {column.align ===
							'end'
								? 'text-right'
								: ''}"
						>
							{column.label}
						</span>
					{/each}
				</div>
				{#each visibleRows as row (row.id)}
					<div
						class="relative grid h-[70px] shrink-0 items-center border-b border-[#dde1e5] {row.current
							? 'bg-[#fff2e8]'
							: ''}"
						style:grid-template-columns={gridTemplate}
					>
						{#if row.current}
							<span class="absolute inset-y-0 left-0 w-[5px] bg-[#f26b2a]"></span>
						{/if}
						{#each row.cells as value, index (index)}
							<span
								class="px-3.5 {cellText} {value.strong ? 'font-bold' : 'font-medium'} {value.accent
									? 'text-[#f26b2a]'
									: ''} {value.small ? 'line-clamp-2 text-xl leading-[26px]' : 'truncate'} {columns[
									index
								]?.align === 'end'
									? 'text-right'
									: ''}"
								title={value.text}
							>
								{value.text}
							</span>
						{/each}
						{#if tab === 'drawing'}
							<span class="flex items-center justify-end px-3.5">
								{#if row.drawingIndex != null && row.drawingIndex >= 0}
									<HmiFlatButton
										label="View"
										icon={Eye}
										size="xs"
										class="h-[54px] w-[132px]"
										faceClass="text-xl"
										iconClass="size-[22px]"
										onclick={() => viewDrawing(row.drawingIndex ?? 0)}
									/>
								{:else}
									<span class="font-heading text-xl font-medium text-[#7e848d]">No drawing</span>
								{/if}
							</span>
						{/if}
					</div>
				{:else}
					<p class="m-0 px-3.5 py-6 font-heading text-2xl font-medium text-[#7e848d]">
						Nothing on this job card.
					</p>
				{/each}
			</section>

			<div class="flex w-[72px] shrink-0 flex-col items-center gap-2.5">
				<HmiFlatButton
					icon={ChevronUp}
					aria-label="Scroll up"
					disabled={atTop}
					class="h-[186px] w-[72px]"
					iconClass="size-[30px]"
					onclick={() => scrollRows(-1)}
				/>
				<span class="text-[15px] leading-[19px] font-bold whitespace-nowrap text-[#5a616c]">
					{rangeLabel}
				</span>
				<HmiFlatButton
					icon={ChevronDown}
					aria-label="Scroll down"
					disabled={atBottom}
					class="h-[186px] w-[72px]"
					iconClass="size-[30px]"
					onclick={() => scrollRows(1)}
				/>
			</div>
		</div>

		<div class="mt-4 flex justify-between gap-4">
			<HmiFlatButton
				label="Back to job"
				icon={ArrowLeft}
				class="w-[472px] shrink-0"
				onclick={() => navigation.goBack()}
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
	{/if}
</div>
