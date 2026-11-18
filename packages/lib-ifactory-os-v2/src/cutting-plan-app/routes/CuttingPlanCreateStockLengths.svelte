<script lang="ts">
	import { onMount, getContext } from 'svelte';
	import {
		AccordionWithContent,
		Alert,
		Button,
		Dialog,
		Input,
		type AccordionWithContentItem
	} from '@ifactory/ui-v2';
	import { AlertCircle, ArrowLeft, Loader2, Search, Settings } from '@lucide/svelte';
	import CuttingPlanCreateStockLengthsSkeleton from '../components/CuttingPlanCreateStockLengthsSkeleton.svelte';
	import { loadPlannerSettingsPageData } from '../lib/cutting-plan/load-planner-settings.js';
	import { loadSectionRulesPageData } from '../lib/cutting-plan/load-section-rules.js';
	import { createPlannerSettingsDraft } from '../lib/cutting-plan/planner-settings';
	import { filterSections, formatSectionDimensions } from '../lib/cutting-plan/section-display';
	import {
		formatStockLength,
		stockLengthBadgeTone,
		summarizeStockLengthsSelection
	} from '../lib/cutting-plan/stock-length-display';
	import {
		loadStockLengthsPageData,
		isNoAvailableStockLengthsMessage,
		type SectionWithLengths
	} from '../lib/cutting-plan/stock-lengths-page';
	import { hasProjectSectionRules } from '../lib/cutting-plan/section-rules';
	import type {
		PlannerSettings,
		SectionRule
	} from '../../project-management-app/lib/store.svelte.js';
	import PlannerSettingsDialog from '../components/PlannerSettingsDialog.svelte';
	import { normalizePlannerConfig } from '../lib/cutting-plan/build-plan-request';
	import {
		startCuttingPlanRun,
		type CuttingPlanRunHandle
	} from '../lib/cutting-plan/cutting-plan-background';
	import { loadCuttingPlanDraft } from '../lib/cutting-plan/draft-cache';
	import { cuttingPlanRunHash } from '../lib/cutting-plan/plan-runs';
	import {
		bomBomsListHash,
		bomSectionsHash,
		bomStructureFromParams
	} from '../../project-management-app/lib/bom-structure-routes.js';
	import { APP_INSTANCE_ID_CONTEXT, APP_NAME_CONTEXT } from '../../lib/appShell/appSharedState.js';
	import { isOsAppInstanceFocused } from '../../lib/os/app-focus.svelte.js';
	import { cpPushSuccessToast } from '../lib/toast.js';
	import { errorDescription } from '../../lib/api/types.js';

	let { params } = $props();
	const projectId = $derived(params.projectId);
	const bomId = $derived(params.bomId);
	const structure = $derived(bomStructureFromParams(params));
	const appInstanceId = getContext<string>(APP_INSTANCE_ID_CONTEXT);
	const hostAppName = getContext<string>(APP_NAME_CONTEXT);

	let sections = $state<SectionWithLengths[]>([]);
	let selectedMarks = $state<string[]>([]);
	let isLoading = $state(true);
	let loadError = $state('');
	let openValues = $state<string[]>([]);
	let filterQuery = $state('');

	let isPlanning = $state(false);
	let planningError = $state('');
	let planProgress = $state<number | null>(null);
	/** `$state.raw` so handle identity stays stable for `===` checks (not a deep proxy). */
	let activePlanRun = $state.raw<CuttingPlanRunHandle | null>(null);

	let sectionRules = $state<SectionRule[]>([]);
	let plannerSettings = $state<PlannerSettings | null>(null);

	const filteredSections = $derived(filterSections(sections, filterQuery));
	const selectionSummary = $derived(summarizeStockLengthsSelection(sections));
	const sectionsMissingStockLengths = $derived(
		sections
			.filter(
				(section) => section.generatedLengths.length > 0 && section.selectedLengths.length === 0
			)
			.map((section) => section.name)
	);
	const sectionsWithNoAvailableStock = $derived(
		sections
			.filter(
				(section) =>
					section.generatedLengths.length === 0 &&
					isNoAvailableStockLengthsMessage(section.ruleDesc)
			)
			.map((section) => section.name)
	);
	let showSettingsDialog = $state(false);
	/** `edit` = gear button (apply in-memory only); `confirmRun` = Run Planner confirm step. */
	let settingsDialogMode = $state<'edit' | 'confirmRun'>('edit');
	let currentSettings = $derived(
		plannerSettings ?? createPlannerSettingsDraft(projectId, plannerSettings)
	);
	let editSettings = $state<PlannerSettings>(createPlannerSettingsDraft(''));

	const hasSectionRules = $derived(hasProjectSectionRules(sectionRules, projectId));
	const settingsDialogConfirmLabel = $derived(
		settingsDialogMode === 'confirmRun' ? 'Confirm & Run' : 'Apply'
	);
	const settingsDialogTitle = $derived(
		settingsDialogMode === 'confirmRun' ? 'Confirm planner settings' : 'Planner settings'
	);

	const accordionItems = $derived.by((): AccordionWithContentItem[] =>
		filteredSections.map((section) => ({
			value: section.id,
			label: section.name,
			badge: `${section.selectedLengths.length} / ${section.generatedLengths.length}`,
			badgeTone: stockLengthBadgeTone(
				section.selectedLengths.length,
				section.generatedLengths.length
			),
			description: formatSectionDimensions(section.name, section.flange, section.thickness),
			summary: section.ruleDesc,
			checkboxes: section.generatedLengths.map((length) => ({
				value: length,
				label: formatStockLength(length)
			})),
			selectedCheckboxValues: [...section.selectedLengths]
		}))
	);

	function openSettings() {
		settingsDialogMode = 'edit';
		editSettings = createPlannerSettingsDraft(projectId, plannerSettings);
		showSettingsDialog = true;
	}

	/** Stock-length page never persists settings - only updates the in-memory draft used for this run. */
	function confirmSettings() {
		const applied = createPlannerSettingsDraft(projectId, editSettings);
		plannerSettings = applied;
		showSettingsDialog = false;
		if (settingsDialogMode === 'confirmRun') {
			void startPlannerRun(applied);
		}
	}

	onMount(async () => {
		loadError = '';
		try {
			const [loadedRules, loadedSettings] = await Promise.all([
				loadSectionRulesPageData(projectId),
				loadPlannerSettingsPageData(projectId)
			]);
			sectionRules = loadedRules;
			plannerSettings = loadedSettings;
			const data = await loadStockLengthsPageData(bomId, projectId, sectionRules);
			if (data) {
				selectedMarks = data.selectedMarks;
				sections = data.sections;
				openValues = [];
			}
		} catch (error) {
			loadError = errorDescription(error);
		} finally {
			isLoading = false;
		}
	});

	function handleLengthToggle(sectionId: string, length: number, checked: boolean) {
		const sectionIndex = sections.findIndex((section) => section.id === sectionId);
		if (sectionIndex === -1) return;

		planningError = '';
		const next = checked
			? [...sections[sectionIndex].selectedLengths, length]
			: sections[sectionIndex].selectedLengths.filter((value) => value !== length);
		sections[sectionIndex].selectedLengths = next;
	}

	function handleSectionCheckboxChange(sectionId: string, checked: boolean) {
		const sectionIndex = sections.findIndex((section) => section.id === sectionId);
		if (sectionIndex === -1) return;

		planningError = '';
		sections[sectionIndex].selectedLengths = checked
			? [...sections[sectionIndex].generatedLengths]
			: [];
	}

	function selectAllGlobal() {
		planningError = '';
		sections = sections.map((section) => ({
			...section,
			selectedLengths: [...section.generatedLengths]
		}));
	}

	function deselectAllGlobal() {
		planningError = '';
		sections = sections.map((section) => ({
			...section,
			selectedLengths: []
		}));
	}

	// Plain (non-reactive) counter used as a cancellation token for in-progress
	// expandAll stagger loops. Incremented by both expandAll() and collapseAll()
	// so any in-flight rAF batch stops before applying its next chunk.
	let expandAllGeneration = 0;

	function expandAll() {
		const allIds = accordionItems.map((item) => item.value);
		const BATCH_SIZE = 6; // 6 × ~241 checkboxes ≈ 1,446 Checkbox mounts per frame
		const generation = ++expandAllGeneration;
		let batchStart = 0;

		function applyNextBatch() {
			// A newer expandAll() or collapseAll() has superseded this stagger - stop.
			if (generation !== expandAllGeneration) return;

			const batch = allIds.slice(batchStart, batchStart + BATCH_SIZE);
			if (batch.length === 0) return;

			// Merge with any already-open values (e.g. user opened some manually).
			openValues = [...new Set([...openValues, ...batch])];
			batchStart += BATCH_SIZE;

			if (batchStart < allIds.length) {
				requestAnimationFrame(applyNextBatch);
			}
		}

		requestAnimationFrame(applyNextBatch);
	}

	function collapseAll() {
		// Bump generation first to cancel any in-progress expandAll stagger.
		expandAllGeneration++;
		openValues = [];
	}

	function handleBack() {
		window.location.hash = bomSectionsHash(projectId, structure, bomId);
	}

	async function goToRules() {
		const { app } = await import('../../project-management-app/app.svelte.ts');
		const { openAppAtHash } = await import('../../lib/os/index.svelte.js');
		openAppAtHash(app, `#/ProjectManagement/Home/${projectId}/CuttingPlanConfiguration`);
	}

	function handleRunPlanner() {
		if (!selectionSummary.allSectionsReadyForPlanner) {
			if (sectionsWithNoAvailableStock.length > 0) {
				planningError = 'No available stock lengths for this section.';
			} else {
				planningError = selectionSummary.allSectionsHaveMatchingRules
					? 'Select at least one stock length for every section before running the planner.'
					: 'Every selected section must match a configured rule before running the planner.';
			}
			return;
		}

		planningError = '';
		settingsDialogMode = 'confirmRun';
		editSettings = createPlannerSettingsDraft(projectId, plannerSettings);
		showSettingsDialog = true;
	}

	async function startPlannerRun(settingsForRun: PlannerSettings = currentSettings) {
		isPlanning = true;
		planningError = '';
		planProgress = null;
		let handle: CuttingPlanRunHandle | null = null;
		try {
			const draft = await loadCuttingPlanDraft(bomId);
			const runType: 'full' | 'partial' = draft?.replanSectionsOnly ? 'partial' : 'full';

			// Payload = the user's CHOICES only (design §3): selected marks + per-section stock + config.
			// The bridge resolves the facts (markings/geometry/end_trim) from core and, for a partial
			// replan, composes the manifest server-side (no client-side merge).
			const stock: Record<string, import('../lib/cutting-plan/types').StockEntry[]> = {};
			for (const section of sections) {
				if (section.selectedLengths.length === 0) continue;
				const entries: import('../lib/cutting-plan/types').StockEntry[] = [];
				for (const raw of section.selectedLengths) {
					const length = Math.max(1, Math.round(raw));
					const qty = section.stockQtyByLength?.[length];
					if (qty == null) {
						entries.push(length);
						continue;
					}
					const quantity = Math.max(0, Math.floor(qty));
					if (quantity <= 0) continue;
					entries.push({ length, quantity });
				}
				if (entries.length > 0) stock[section.name] = entries;
			}
			// Clamp to the solver's valid ranges (time_limit_per_section gt 0, max_unique_lengths_per_bar
			// ge 1). Unsaved settings fall back to defaults.
			const config = normalizePlannerConfig(settingsForRun);

			// `selectedMarks` holds MarkData.id (= proj_bom_items.bom_item_id); the bridge's mark
			// allowlist filters proj_bom_items by `mark_no`. Translate the selected ids → mark_no
			// (MarkData.markName) so the bridge keeps the right rows.
			const markNoById: Record<string, string> = {};
			for (const section of sections) {
				for (const mark of section.marks) markNoById[mark.id] = mark.markName;
			}
			const selectedMarkNos: string[] = [];
			for (const id of selectedMarks) {
				const markNo = markNoById[id];
				if (markNo && !selectedMarkNos.includes(markNo)) selectedMarkNos.push(markNo);
			}

			// Marking groups: when the user has grouped markings, split the plan so each group is solved
			// as a SEPARATE solver request (the bridge fans out and merges into one run). Emit section_map
			// for EVERY planned child (grouped AND residual), each with its OWN selected marks - a residual
			// child left out would fall back to the global allowlist and re-count its base section's grouped
			// marks. Keyed by the child identity used in `stock` (composite for grouped, base for residual).
			const selectedMarkIds = new Set(selectedMarks);
			let sectionMap:
				Record<string, { base_section: string; group?: string; marks: string[] }> | undefined;
			if (sections.some((section) => section.groupName)) {
				sectionMap = {};
				for (const section of sections) {
					if (section.selectedLengths.length === 0) continue; // not planned this run
					const marks = section.marks
						.filter((mark) => selectedMarkIds.has(mark.id))
						.map((mark) => mark.markName);
					sectionMap[section.name] = {
						base_section: section.baseName ?? section.name,
						...(section.groupName ? { group: section.groupName } : {}),
						marks
					};
				}
			}

			// Do not send baseRunId: if the id does not resolve on the bridge, composeManifest
			// treats the base as empty and the new run keeps ONLY the sections solved this pass.
			// Omitting it uses latest completed — the correct full-BOM merge for Lock replan.
			handle = startCuttingPlanRun({
				bomId,
				input: { stock, config, selectedMarks: selectedMarkNos, sectionMap, runType },
				replanSectionsOnly: Boolean(draft?.replanSectionsOnly),
				resultsNav: { projectId, structure, appName: hostAppName },
				onProgress: (progress) => (planProgress = progress)
			});
			activePlanRun = handle;

			const run = await handle.promise;
			if (handle.detached) return;

			window.location.hash = cuttingPlanRunHash(
				projectId,
				structure,
				bomId,
				run.run_id,
				'Summary',
				hostAppName
			);
		} catch (error) {
			if (handle?.detached) return;
			planningError = errorDescription(error, 'Unknown error occurred while running the planner');
		} finally {
			isPlanning = false;
			planProgress = null;
			if (activePlanRun === handle) activePlanRun = null;
		}
	}

	function handleRunInBackground() {
		activePlanRun?.detach({ sticky: true });
		isPlanning = false;
		planProgress = null;
		cpPushSuccessToast({
			title: 'Running in background',
			description: 'You will be notified with a link when the cutting plan finishes.'
		});
		window.location.hash = bomBomsListHash(projectId, structure, hostAppName);
	}

	/** Switch away → toast on complete; return while still running → in-page Summary again. */
	$effect(() => {
		const handle = activePlanRun;
		if (!handle || !appInstanceId) return;
		if (isOsAppInstanceFocused(appInstanceId)) handle.reattach();
		else handle.detach();
	});
</script>

<div class="flex h-full min-h-0 flex-col overflow-hidden">
	{#if isLoading}
		<CuttingPlanCreateStockLengthsSkeleton />
	{:else if loadError}
		<div class="p-4">
			<Alert variant="error" title="Could not load stock lengths" description={loadError} />
		</div>
	{:else if !hasSectionRules}
		<div class="flex flex-1 flex-col items-center justify-center py-16 text-center">
			<AlertCircle class="mb-3 h-8 w-8 text-muted-foreground" />
			<h3 class="text-lg font-medium text-foreground">Section rules required</h3>
			<p class="mt-1 max-w-md text-muted-foreground">
				Configure at least one section rule before running the planner.
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
					onclick={handleBack}
					label="Back to Sections"
				/>
			</div>
		</div>
	{:else if sections.length === 0}
		<div class="flex flex-1 flex-col items-center justify-center py-16 text-center">
			<AlertCircle class="mb-3 h-8 w-8 text-muted-foreground" />
			<h3 class="text-lg font-medium text-foreground">No sections selected</h3>
			<p class="mt-1 max-w-md text-muted-foreground">
				Go back and select sections to configure their stock lengths.
			</p>
			<Button
				variant="outline"
				class="mt-4 rounded-none"
				onclick={handleBack}
				label="Back to Sections"
			/>
		</div>
	{:else}
		<div class="shrink-0 space-y-4 border-b border-border px-4 py-4">
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
					onclick={selectAllGlobal}
				/>
				<Button
					variant="outline"
					size="sm"
					class="rounded-none"
					label="Exclude all"
					onclick={deselectAllGlobal}
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
					class="ml-auto rounded-none"
					icon={Settings}
					label="Planner settings"
					onclick={openSettings}
					disabled={isPlanning}
				/>
			</div>
			{#if planningError}
				<div>
					<Alert variant="error" title="Could not run planner" description={planningError} />
				</div>
			{:else if sectionsWithNoAvailableStock.length > 0}
				<div>
					<Alert
						variant="warning"
						title="No available stock lengths"
						description="Lock replan only offers free stock lengths longer than the length you left. Shorter bars on the register are not listed here."
						items={sectionsWithNoAvailableStock}
					/>
				</div>
			{:else if sectionsMissingStockLengths.length > 0}
				<div>
					<Alert
						variant="warning"
						title="Select at least one stock length per section"
						description="Every section needs at least one stock length before you can run the planner."
						items={sectionsMissingStockLengths}
					/>
				</div>
			{/if}
		</div>

		<div class="min-h-0 flex-1 overflow-auto px-4 py-4">
			{#if filteredSections.length === 0}
				<p class="py-8 text-center text-sm text-muted-foreground">
					No sections match “{filterQuery.trim()}”.
				</p>
			{:else}
				<AccordionWithContent
					items={accordionItems}
					type="multiple"
					bind:value={openValues}
					onCheckboxChange={handleLengthToggle}
					onSectionCheckboxChange={handleSectionCheckboxChange}
				/>
			{/if}
		</div>

		<div
			class="sticky bottom-0 flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border bg-surface px-4 py-3"
		>
			<p class="flex items-center gap-2 text-sm text-foreground">
				<span class="size-2 shrink-0 rounded-full bg-primary" aria-hidden="true"></span>
				{selectionSummary.sectionsWithSelection} sections · {selectionSummary.totalStockLengths} stock
				lengths selected
			</p>
			<div class="flex flex-wrap items-center gap-2">
				<Button
					variant="outline"
					size="sm"
					class="rounded-none"
					label="Back"
					icon={ArrowLeft}
					onclick={handleBack}
					disabled={isPlanning}
				/>
				<Button
					variant="primary"
					size="sm"
					class="rounded-none"
					onclick={handleRunPlanner}
					label={isPlanning
						? planProgress != null
							? `Running planner… ${planProgress}%`
							: 'Running planner…'
						: 'Run Planner'}
					disabled={isPlanning || !selectionSummary.allSectionsReadyForPlanner}
				/>
			</div>
		</div>
	{/if}
</div>

<PlannerSettingsDialog
	bind:open={showSettingsDialog}
	bind:settings={editSettings}
	title={settingsDialogTitle}
	confirmLabel={settingsDialogConfirmLabel}
	onConfirm={confirmSettings}
/>

<Dialog
	bind:open={isPlanning}
	title="Planner is running"
	size="sm"
	hideFooter
	showCloseButton={false}
	closeOnBackdrop={false}
	oncancel={(event) => event.preventDefault()}
>
	<div class="flex flex-col items-center gap-4 py-2 text-center">
		<Loader2 class="text-primary size-8 animate-spin" aria-hidden="true" />
		<p class="text-muted-foreground text-sm">
			{planProgress != null ? `${planProgress}% complete` : `0% complete`}
		</p>
		<Button
			variant="outline"
			size="sm"
			class="rounded-none"
			label="Run in background"
			onclick={handleRunInBackground}
			disabled={!activePlanRun}
		/>
	</div>
</Dialog>
