<script lang="ts">
	import { onMount } from 'svelte';
	import {
		AccordionWithTable,
		Alert,
		Button,
		Input,
		Skeleton,
		type DataTableColumn
	} from '@ifactory/ui-v2';
	import type { AccordionWithTableItem } from '@ifactory/ui-v2';
	import { AlertCircle, ArrowRight, EllipsisVertical, Search } from '@lucide/svelte';
	import ApplyLengthGroupDialog from '../components/ApplyLengthGroupDialog.svelte';
	import CuttingPlanCreatePageSkeleton from '../components/CuttingPlanCreatePageSkeleton.svelte';
	import {
		clearCuttingPlanDraft,
		loadCuttingPlanDraft,
		saveCuttingPlanDraft
	} from '../lib/cutting-plan/draft-cache';
	import {
		applyGroupsToAllSections,
		setGroupSectionMembership
	} from '../lib/cutting-plan/length-groups';
	import { loadLengthGroupsPageData } from '../lib/cutting-plan/length-groups.repository';
	import { bomHasPriorCompletedPlanRun } from '../lib/cutting-plan/plan-runs';
	import {
		filterSections,
		formatMarkWeightKg,
		formatSectionDimensions,
		formatSectionWeightLabel,
		isSectionIncluded,
		summarizeSectionsSelection
	} from '../lib/cutting-plan/section-display';
	import {
		applyDefaultLengthGroupsIfNeeded,
		loadSectionsPageData
	} from '../lib/cutting-plan/sections-page';
	import { buildSectionsStepDraft } from '../lib/cutting-plan/replan-sections';
	import { hasProjectSectionRules } from '../lib/cutting-plan/section-rules';
	import { loadSectionRulesPageData } from '../lib/cutting-plan/load-section-rules.js';
	import {
		bomBomsListHash,
		bomStockLengthsHash,
		bomStructureFromParams
	} from '../../project-management-app/lib/bom-structure-routes.js';
	import { clearAssignLockReplanAccept } from '../lib/cutting-plan/cutting-plan-host.js';
	import type { MarkData, SectionData } from '../lib/cutting-plan/types';
	import type { LengthGroup, SectionRule } from '../../project-management-app/lib/store.svelte.js';
	import { cpPushErrorToast } from '../lib/toast.js';
	import { errorDescription } from '../../lib/api/types.js';

	type MarkTableRow = MarkData & { weightLabel: string };

	let { params } = $props();
	const projectId = $derived(params.projectId);
	const bomId = $derived(params.bomId);
	const structure = $derived(bomStructureFromParams(params));

	let sections = $state<SectionData[]>([]);
	/** Ungrouped BOM snapshot used by Remove groups. */
	let baseSections = $state<SectionData[]>([]);
	let sectionRules = $state<SectionRule[]>([]);
	let lengthGroups = $state<LengthGroup[]>([]);
	let isLoading = $state(true);
	let loadError = $state('');
	let filterQuery = $state('');
	let groupActionBusy = $state(false);
	let showApplyGroupDialog = $state(false);
	/**
	 * First plan for this BOM version: all sections required, checkboxes locked.
	 * Unlocks after a completed/published run (replan / new plan from 2nd run on).
	 */
	let sectionSelectionLocked = $state(true);

	const filteredSections = $derived(filterSections(sections, filterQuery));

	const allMarkIds = $derived(sections.flatMap((section) => section.marks).map((mark) => mark.id));
	let selectedRowKeys = $state<string[]>([]);
	let openValues = $state<string[]>([]);

	const hasLengthGroups = $derived(lengthGroups.length > 0);
	const groupsApplied = $derived(sections.some((section) => Boolean(section.groupName)));

	const accordionItems = $derived.by((): AccordionWithTableItem<MarkTableRow>[] =>
		filteredSections.map((section) => {
			const included = isSectionIncluded(section.marks, selectedRowKeys);
			return {
				value: section.id,
				label: section.name,
				description: formatSectionDimensions(section.name, section.flange, section.thickness),
				statusLabel: included || sectionSelectionLocked ? undefined : '(excluded)',
				inactive: !included && !sectionSelectionLocked,
				stats: [
					{ label: 'Mark No', value: String(section.marks.length) },
					{ label: 'Weight', value: formatSectionWeightLabel(section, selectedRowKeys) }
				],
				rows: section.marks.map((mark) => ({
					...mark,
					weightLabel: formatMarkWeightKg(mark, section.unitWeightKgPerM)
				})),
				rowLabel: 'Mark Nos'
			};
		})
	);

	const columns: DataTableColumn<MarkTableRow>[] = [
		{
			key: 'markName',
			header: 'Mark No',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => row.markName
		},
		{
			key: 'length',
			header: 'Length (mm)',
			sortable: true,
			filterable: true,
			dataType: 'number',
			value: (row) => String(row.length)
		},
		{
			key: 'qty',
			header: 'Qty',
			sortable: true,
			filterable: true,
			dataType: 'number',
			value: (row) => String(row.qty)
		},
		{
			key: 'weightLabel',
			header: 'Wt',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => row.weightLabel
		}
	];

	const selectionSummary = $derived(summarizeSectionsSelection(sections, selectedRowKeys));
	const hasSectionRules = $derived(hasProjectSectionRules(sectionRules, projectId));

	function cloneSections(source: SectionData[]): SectionData[] {
		return JSON.parse(JSON.stringify(source)) as SectionData[];
	}

	function allMarkIdsFrom(source: SectionData[]): string[] {
		return source.flatMap((section) => section.marks).map((mark) => mark.id);
	}

	function includeAll() {
		if (sectionSelectionLocked) return;
		selectedRowKeys = [...allMarkIds];
	}

	function excludeAll() {
		if (sectionSelectionLocked) return;
		selectedRowKeys = [];
	}

	function expandAll() {
		openValues = accordionItems.map((item) => item.value);
	}

	function collapseAll() {
		openValues = [];
	}

	function applyGroupedSections(next: SectionData[]) {
		sections = next;
		openValues = [];
		const nextMarkIds = allMarkIdsFrom(next);
		if (sectionSelectionLocked) {
			selectedRowKeys = nextMarkIds;
			return;
		}
		const valid = new Set(nextMarkIds);
		selectedRowKeys = selectedRowKeys.filter((id) => valid.has(id));
		if (selectedRowKeys.length === 0) {
			selectedRowKeys = nextMarkIds;
		}
	}

	function handleApplyGroupsToAll() {
		if (!hasLengthGroups || groupActionBusy) return;
		groupActionBusy = true;
		try {
			applyGroupedSections(applyGroupsToAllSections(baseSections, lengthGroups));
		} finally {
			groupActionBusy = false;
		}
	}

	function handleRemoveGroups() {
		if (groupActionBusy) return;
		groupActionBusy = true;
		try {
			applyGroupedSections(cloneSections(baseSections));
		} finally {
			groupActionBusy = false;
		}
	}

	function openApplyGroupDialog() {
		if (!hasLengthGroups || groupActionBusy) return;
		showApplyGroupDialog = true;
	}

	function handleSelectiveApply(updates: Array<{ groupId: string; baseNames: string[] }>) {
		if (updates.length === 0) return;
		groupActionBusy = true;
		try {
			let next = sections;
			for (const { groupId, baseNames } of updates) {
				const group = lengthGroups.find((entry) => entry.id === groupId);
				if (!group) continue;
				next = setGroupSectionMembership(next, group, baseNames);
			}
			applyGroupedSections(next);
		} finally {
			groupActionBusy = false;
		}
	}

	onMount(async () => {
		try {
			const [pageData, loadedRules, loadedGroups, hasPriorRun] = await Promise.all([
				loadSectionsPageData(bomId),
				loadSectionRulesPageData(projectId),
				loadLengthGroupsPageData(projectId),
				bomHasPriorCompletedPlanRun(bomId)
			]);
			const {
				sections: loadedSections,
				baseSections: loadedBaseSections,
				selectedMarkIds,
				loadError: error,
				restoredFromDraft
			} = pageData;
			// Flat BOM for Remove / Apply-all; `loadedSections` may restore draft length groups.
			baseSections = cloneSections(
				loadedBaseSections.length > 0 ? loadedBaseSections : loadedSections
			);
			sections = applyDefaultLengthGroupsIfNeeded(
				loadedSections,
				baseSections,
				loadedGroups,
				restoredFromDraft
			);
			sectionSelectionLocked = !hasPriorRun;
			selectedRowKeys = sectionSelectionLocked ? allMarkIdsFrom(sections) : selectedMarkIds;
			loadError = error;
			sectionRules = loadedRules;
			lengthGroups = loadedGroups;
			openValues = [];
		} catch (error) {
			loadError = errorDescription(error, 'Failed to load BOM sections.');
		} finally {
			isLoading = false;
		}
	});

	async function handleNext() {
		try {
			const existingDraft = await loadCuttingPlanDraft(bomId);
			const markIds = sectionSelectionLocked ? allMarkIdsFrom(sections) : selectedRowKeys;
			const payload = buildSectionsStepDraft({
				existingDraft,
				sections,
				baseSections,
				selectedMarkIds: markIds
			});
			await saveCuttingPlanDraft(bomId, payload);
			window.location.hash = bomStockLengthsHash(projectId, structure, bomId);
		} catch (error) {
			cpPushErrorToast({
				title: 'Could not save cutting plan draft',
				description: errorDescription(error)
			});
		}
	}

	async function handleCancel() {
		try {
			await clearCuttingPlanDraft(bomId);
			clearAssignLockReplanAccept();
			window.location.hash = bomBomsListHash(projectId, structure);
		} catch (error) {
			cpPushErrorToast({
				title: 'Could not cancel cutting plan',
				description: errorDescription(error)
			});
		}
	}

	async function goToRules() {
		const { app } = await import('../../project-management-app/app.svelte.ts');
		const { openAppAtHash } = await import('../../lib/os/index.svelte.js');
		openAppAtHash(app, `#/ProjectManagement/Home/${projectId}/CuttingPlanConfiguration`);
	}
</script>

<div class="flex h-full min-h-0 flex-col overflow-hidden">
	{#if isLoading}
		<div class="flex h-full min-h-0 flex-col overflow-hidden" aria-busy="true" role="status">
			<span class="sr-only">Loading cutting plan sections</span>
			<CuttingPlanCreatePageSkeleton />
			<div class="min-h-0 flex-1 overflow-auto px-4 py-4">
				<AccordionWithTable
					items={[]}
					{columns}
					rowKey={(row) => row.id}
					loading
					skeletonItemCount={6}
					skeletonStatCount={2}
					triggerTitleClass="font-body text-base font-bold leading-none"
				/>
			</div>
			<div
				class="sticky bottom-0 flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border bg-surface px-4 py-3"
			>
				<div class="flex items-center gap-2">
					<Skeleton class="size-2 shrink-0 rounded-full" />
					<Skeleton class="h-4 w-56" />
				</div>
				<div class="flex flex-wrap items-center gap-2">
					<Skeleton class="h-8 w-20" />
					<Skeleton class="h-8 w-36" />
				</div>
			</div>
		</div>
	{:else if !hasSectionRules}
		<div class="flex flex-1 flex-col items-center justify-center py-16 text-center">
			<AlertCircle class="mb-3 h-8 w-8 text-muted-foreground" />
			<h3 class="text-lg font-medium text-foreground">Section rules required</h3>
			<p class="mt-1 max-w-md text-muted-foreground">
				Configure at least one section rule before starting a cutting plan.
			</p>
			<div class="mt-4 flex flex-wrap items-center justify-center gap-2">
				<Button
					variant="primary"
					class="rounded-none"
					onclick={goToRules}
					label="Configure Rules"
				/>
				<Button
					variant="outline"
					class="rounded-none"
					onclick={handleCancel}
					label="Back to BOMs"
				/>
			</div>
		</div>
	{:else if sections.length === 0}
		<div class="flex flex-1 flex-col items-center justify-center py-16 text-center">
			<AlertCircle class="mb-3 h-8 w-8 text-muted-foreground" />
			<h3 class="text-lg font-medium text-foreground">No sections available</h3>
			<p class="mt-1 max-w-md text-muted-foreground">
				{loadError || 'Upload a BOM CSV for this tower and try again.'}
			</p>
			<Button
				variant="outline"
				class="mt-4 rounded-none"
				onclick={handleCancel}
				label="Back to BOMs"
			/>
		</div>
	{:else}
		<div class="shrink-0 space-y-4 border-b border-border px-4 py-4">
			{#if sectionSelectionLocked}
				<Alert
					variant="info"
					title="First plan includes all sections"
					description="Section checkboxes stay off until this BOM version has a completed cutting plan. After that, you can include or exclude sections on replan or a new plan."
				/>
			{/if}
			<div class="flex flex-wrap items-center gap-3">
				<div class="relative min-w-[240px] flex-1 max-w-md">
					<Search
						class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
						aria-hidden="true"
					/>
					<Input
						bind:value={filterQuery}
						placeholder="Filter sections..."
						class="rounded-none pl-9"
						aria-label="Filter sections"
					/>
				</div>
				<Button
					variant="outline"
					size="sm"
					class="rounded-none"
					label="Include all"
					disabled={sectionSelectionLocked}
					onclick={includeAll}
				/>
				<Button
					variant="outline"
					size="sm"
					class="rounded-none"
					label="Exclude all"
					disabled={sectionSelectionLocked}
					onclick={excludeAll}
				/>
				<Button
					variant="outline"
					size="sm"
					class="rounded-none"
					label="Expand All"
					onclick={expandAll}
				/>
				<Button
					variant="outline"
					size="sm"
					class="rounded-none"
					label="Collapse All"
					onclick={collapseAll}
				/>
				<Button
					variant="outline"
					size="sm"
					class="rounded-none"
					label="Apply groups to all"
					disabled={!hasLengthGroups || groupActionBusy}
					onclick={handleApplyGroupsToAll}
				/>
				<Button
					variant="outline"
					size="sm"
					class="rounded-none"
					label="Remove groups"
					disabled={!groupsApplied || groupActionBusy}
					onclick={handleRemoveGroups}
				/>
				<Button
					variant="outline"
					size="icon"
					class="rounded-none"
					icon={EllipsisVertical}
					aria-label="Apply group to selected sections"
					disabled={!hasLengthGroups || groupActionBusy}
					onclick={openApplyGroupDialog}
				/>
				<p class="ml-auto text-sm text-muted-foreground">
					{selectionSummary.includedSections} of {selectionSummary.totalSections} sections included ·
					{selectionSummary.selectedMarks} Mark Nos
				</p>
			</div>
		</div>

		<div class="min-h-0 flex-1 overflow-auto px-4 py-4">
			{#if filteredSections.length === 0}
				<p class="py-8 text-center text-sm text-muted-foreground">
					No sections match “{filterQuery.trim()}”.
				</p>
			{:else}
				<AccordionWithTable
					items={accordionItems}
					{columns}
					rowKey={(row) => row.id}
					selection={{ enabled: true, disabled: sectionSelectionLocked }}
					selectionPlacement="start"
					triggerTitleClass="font-body text-base font-bold leading-none"
					bind:selectedRowKeys
					bind:value={openValues}
				/>
			{/if}
		</div>

		<div
			class="sticky bottom-0 flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border bg-surface px-4 py-3"
		>
			<p class="flex items-center gap-2 text-sm text-foreground">
				<span class="size-2 shrink-0 rounded-full bg-primary" aria-hidden="true"></span>
				{selectionSummary.includedSections} sections · {selectionSummary.selectedMarks} Mark Nos ·
				{selectionSummary.weightLabel} selected
			</p>
			<div class="flex flex-wrap items-center gap-2">
				<Button
					variant="outline"
					size="sm"
					class="rounded-none"
					label="Cancel"
					onclick={handleCancel}
				/>
				<Button
					variant="primary"
					size="sm"
					class="rounded-none"
					disabled={selectedRowKeys.length === 0}
					onclick={handleNext}
					label="Next: Stock Lengths"
					icon={ArrowRight}
					iconPosition="right"
				/>
			</div>
		</div>
	{/if}
</div>

<ApplyLengthGroupDialog
	bind:open={showApplyGroupDialog}
	groups={lengthGroups}
	{sections}
	onApply={handleSelectiveApply}
/>
