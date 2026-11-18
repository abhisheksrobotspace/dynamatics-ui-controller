<script lang="ts">
	import { onMount } from 'svelte';
	import { AccordionWithTable, Alert, Button, Input, type DataTableColumn } from '@ifactory/ui-v2';
	import type { AccordionWithTableItem } from '@ifactory/ui-v2';
	import { AlertCircle, Info, Search } from '@lucide/svelte';
	import CuttingPlanResultsPageSkeleton from '../components/CuttingPlanResultsPageSkeleton.svelte';
	import CuttingPlanKpiStrip from '../components/CuttingPlanKpiStrip.svelte';
	import { markCuttingPlanResults } from '../lib/cutting-plan/cutting-plan-results.svelte';
	import { unitWeightBySectionFromNames } from '../lib/cutting-plan/plan-section-weights';
	import { loadBomUnitWeights } from '../lib/cutting-plan/bom-sections';
	import { loadCuttingPlanDraft } from '../lib/cutting-plan/draft-cache';
	import {
		buildPlanKpiStripMetrics,
		buildPlanSummaryAccordionItems,
		buildPlanSummaryExportRows,
		formatExportWastePercent,
		formatExportWeightKg,
		formatPlanWeightKg,
		sanitizeCuttingPlanExportFilename,
		type PlanSummaryExportRow,
		type PlanSummaryMetric,
		type PlanSummaryStockLengthRow
	} from '../lib/cutting-plan/planner-results';
	import { prepareReplanAllDraft } from '../lib/cutting-plan/replan-sections';
	import {
		clearAssignLockReplanAccept,
		peekAssignLockReplanAccept,
		type AssignLockReplanAccept
	} from '../lib/cutting-plan/cutting-plan-host.js';
	import { applyToLock, releaseLock } from '../../rm-indent-app/lib/inv.jobs.js';
	import {
		cuttingPlanRunHash,
		cuttingPlanRunsHash,
		formatPlanRunTimestamp,
		formatPlanRunType,
		getLatestPlanRun,
		getPlanRun,
		type CuttingPlanRun
	} from '../lib/cutting-plan/plan-runs';
	import {
		bomSectionsHash,
		bomStructureFromParams
	} from '../../project-management-app/lib/bom-structure-routes.js';
	import { errorDescription } from '../../lib/api/types.js';
	import { cpPushErrorToast, cpPushSuccessToast } from '../lib/toast.js';
	import type { PlanResponse } from '../lib/cutting-plan/types';

	let { params } = $props();
	const projectId = $derived(params.projectId);
	const bomId = $derived(params.bomId);
	const structure = $derived(bomStructureFromParams(params));
	const runId = $derived(params.runId as string | undefined);

	let isLoading = $state(true);
	let loadError = $state('');
	let isReplanning = $state(false);
	let replanError = $state('');
	let isApplyingToLock = $state(false);
	let applyToLockError = $state('');
	let assignLockAccept = $state<AssignLockReplanAccept | null>(null);
	let planResult = $state<PlanResponse | null>(null);
	let activeRun = $state<CuttingPlanRun | null>(null);
	let exportRows = $state<PlanSummaryExportRow[]>([]);
	let allAccordionItems = $state<AccordionWithTableItem<PlanSummaryStockLengthRow>[]>([]);
	let expandedValues = $state<string[]>([]);
	let filterQuery = $state('');
	let summaryMetrics = $state<PlanSummaryMetric[]>([]);
	let bomName = $state('');

	const accordionItems = $derived.by((): AccordionWithTableItem<PlanSummaryStockLengthRow>[] => {
		const normalized = filterQuery.trim().toLowerCase();
		if (!normalized) return allAccordionItems;
		return allAccordionItems.filter(
			(item) =>
				item.label.toLowerCase().includes(normalized) ||
				(item.description?.toLowerCase().includes(normalized) ?? false)
		);
	});

	const filterSummary = $derived.by(() => {
		const visible = accordionItems.length;
		const total = allAccordionItems.length;
		if (filterQuery.trim()) {
			return `${visible} of ${total} sections`;
		}
		return `${total} sections`;
	});

	const runLabel = $derived.by(() => {
		if (!activeRun) return '';
		return `Run v${activeRun.version} · ${formatPlanRunTimestamp(activeRun.createdAt)} · ${formatPlanRunType(activeRun.type)}`;
	});

	onMount(async () => {
		loadError = '';
		const pendingAccept = peekAssignLockReplanAccept();
		assignLockAccept = pendingAccept?.bomId === bomId ? pendingAccept : null;
		try {
			let resolvedRunId = runId;
			if (!resolvedRunId) {
				const latest = await getLatestPlanRun(bomId);
				if (latest) {
					window.location.hash = cuttingPlanRunHash(
						projectId,
						structure,
						bomId,
						latest.id,
						'Summary'
					);
				}
				return;
			}

			const [run, draft, bomWeights] = await Promise.all([
				// Detail bars include markings so section export can compute per-bar waste.
				getPlanRun(bomId, resolvedRunId, { bars: 'detail' }),
				loadCuttingPlanDraft(bomId),
				loadBomUnitWeights(bomId)
			]);
			const data = run?.response ?? null;
			bomName = run?.bomName ?? '';
			const unitWeightBySection = unitWeightBySectionFromNames(bomWeights.unitWeightBySection);

			if (data) {
				planResult = data;
				activeRun = run;
				markCuttingPlanResults(bomId);
				const knownBaseNames = [
					...new Set([
						...(draft?.sections.map((section) => section.baseName ?? section.name) ?? []),
						...bomWeights.sectionNames
					])
				];
				exportRows = buildPlanSummaryExportRows(data, unitWeightBySection, knownBaseNames);
				allAccordionItems = buildPlanSummaryAccordionItems(data, unitWeightBySection);
				summaryMetrics = buildPlanKpiStripMetrics(data, unitWeightBySection);
			}
		} catch (error) {
			loadError = errorDescription(error);
		} finally {
			isLoading = false;
		}
	});

	async function handleApplyToLock() {
		if (!activeRun || !assignLockAccept || isApplyingToLock) return;
		isApplyingToLock = true;
		applyToLockError = '';
		try {
			const lineId = assignLockAccept.deliveryScheduleLineId;
			const result = await applyToLock({
				run_id: activeRun.id,
				...(lineId ? { delivery_schedule_line_ids: [lineId] } : {})
			});
			if (result.stale_locks.length > 0) {
				const qty = result.stale_locks.reduce(
					(sum, lock) => sum + Number(lock.locked_qty_base ?? 0),
					0
				);
				const shouldRelease = window.confirm(
					`${qty || result.stale_locks.length} pcs locked at lengths that are no longer required — release?`
				);
				if (shouldRelease) {
					await releaseLock({
						lock_ids: result.stale_locks.map((lock) => String(lock.lock_id)),
						reason: 'owner_superseded'
					});
				}
			}
			if (result.affected_indents.length > 0) {
				const labels = result.affected_indents
					.map((indent) => indent.indent_no ?? indent.indent_id)
					.slice(0, 5)
					.join(', ');
				cpPushSuccessToast({
					title: 'Draft indents still use the old lengths',
					description: `${result.affected_indents.length} indent(s) were not rewritten: ${labels}`
				});
			}
			if (result.warnings.length) {
				cpPushErrorToast({
					title: 'Applied with warnings',
					description: result.warnings[0] ?? ''
				});
			}
			clearAssignLockReplanAccept();
			const returnHash = assignLockAccept.returnHash;
			assignLockAccept = null;
			cpPushSuccessToast({
				title: 'Requirements updated',
				description: 'This cutting plan is now the pinned run for the schedule line.'
			});
			window.location.hash = returnHash;
		} catch (error) {
			applyToLockError = errorDescription(error, 'Could not apply this plan to Lock.');
			cpPushErrorToast({
				title: 'Could not apply to Lock',
				description: applyToLockError
			});
		} finally {
			isApplyingToLock = false;
		}
	}

	async function handleReplan() {
		isReplanning = true;
		replanError = '';
		try {
			await prepareReplanAllDraft(bomId, { sourceRunId: activeRun?.id });
			window.location.hash = bomSectionsHash(projectId, structure, bomId);
		} catch (error) {
			replanError = errorDescription(error, 'Failed to prepare replan.');
		} finally {
			isReplanning = false;
		}
	}

	function handleExport() {
		const headers = [
			'Section',
			'Section Group',
			'Length (mm)',
			'Quantity (nos)',
			'Waste (kg)',
			'Waste (%)',
			'Weight (kg)'
		];
		const lines = exportRows.map((row) =>
			[
				row.sec,
				row.secGroup,
				String(row.lengthMm),
				String(row.qty),
				formatExportWeightKg(row.wasteKg),
				formatExportWastePercent(row.wasteMm, row.lengthMm * row.qty),
				formatExportWeightKg(row.weightKg)
			]
				.map((value) => `"${String(value).replaceAll('"', '""')}"`)
				.join(',')
		);

		const label = sanitizeCuttingPlanExportFilename(bomName || 'cutting-plan');
		const versionSuffix = activeRun?.version != null ? `-v${activeRun.version}` : '';
		const blob = new Blob([[headers.join(','), ...lines].join('\n')], { type: 'text/csv' });
		const url = URL.createObjectURL(blob);
		const anchor = document.createElement('a');
		anchor.href = url;
		anchor.download = `cutting-plan-${label}${versionSuffix}.csv`;
		anchor.click();
		URL.revokeObjectURL(url);
	}

	function openBarDetails() {
		if (!activeRun) return;
		window.location.hash = cuttingPlanRunHash(projectId, structure, bomId, activeRun.id, 'Plan');
	}

	function openRuns() {
		window.location.hash = cuttingPlanRunsHash(projectId, structure, bomId);
	}

	function handleStartNewPlan() {
		window.location.hash = bomSectionsHash(projectId, structure, bomId);
	}

	function expandAll() {
		expandedValues = accordionItems.map((item) => item.value);
	}

	function collapseAll() {
		expandedValues = [];
	}

	const columns: DataTableColumn<PlanSummaryStockLengthRow>[] = [
		{
			key: 'lengthLabel',
			header: 'Stock length',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => row.lengthLabel
		},
		{
			key: 'quantity',
			header: 'Qty',
			sortable: true,
			filterable: true,
			dataType: 'number',
			value: (row) => String(row.quantity)
		},
		{
			key: 'weightKg',
			header: 'Weight',
			sortable: true,
			filterable: true,
			dataType: 'number',
			value: (row) => formatPlanWeightKg(row.weightKg)
		}
	];
</script>

<div class="flex h-full min-h-0 flex-col overflow-hidden">
	{#if isLoading}
		<CuttingPlanResultsPageSkeleton showInfoFooter />
	{:else if loadError}
		<div class="flex h-full min-h-0 flex-col overflow-hidden p-4">
			<Alert variant="error" title="Could not load cutting plan summary" description={loadError} />
		</div>
	{:else if !planResult}
		<div class="flex flex-1 flex-col items-center justify-center py-16 text-center">
			<AlertCircle class="mb-3 h-8 w-8 text-muted-foreground" />
			<h3 class="text-lg font-medium text-foreground">No cutting plan results</h3>
			<p class="mt-1 max-w-md text-muted-foreground">
				Run the planner from Stock Lengths to generate a cutting plan for this BOM.
			</p>
			<Button
				variant="outline"
				class="mt-4 rounded-none"
				onclick={handleStartNewPlan}
				label="Start plan"
			/>
		</div>
	{:else}
		<div class="shrink-0 space-y-4 border-b border-border px-4 py-4">
			<div class="flex flex-wrap items-center justify-between gap-3">
				{#if runLabel}
					<p class="text-sm text-muted-foreground">{runLabel}</p>
				{/if}
				<div class="flex flex-wrap items-center gap-2">
					{#if assignLockAccept}
						<Button
							variant="primary"
							size="sm"
							class="rounded-none"
							label={isApplyingToLock ? 'Applying…' : 'Apply to Lock'}
							onclick={() => void handleApplyToLock()}
							disabled={isApplyingToLock || isReplanning}
						/>
					{/if}
					<Button
						variant="outline"
						size="sm"
						class="rounded-none"
						label="All Plans"
						onclick={openRuns}
					/>
					<Button
						variant="outline"
						size="sm"
						class="rounded-none"
						label="View RM Required"
						onclick={openBarDetails}
					/>
					<Button
						variant="outline"
						size="sm"
						class="rounded-none"
						label="Export"
						onclick={handleExport}
					/>
					<Button
						variant={assignLockAccept ? 'outline' : 'primary'}
						size="sm"
						class="rounded-none"
						label="Replan"
						onclick={handleReplan}
						disabled={isReplanning || isApplyingToLock}
					/>
				</div>
			</div>
			{#if applyToLockError}
				<p class="text-sm font-medium text-status-error">{applyToLockError}</p>
			{/if}
			{#if replanError}
				<p class="text-sm font-medium text-status-error">{replanError}</p>
			{/if}

			<CuttingPlanKpiStrip metrics={summaryMetrics} />

			<div class="flex flex-wrap items-center gap-3">
				<div class="relative min-w-[240px] max-w-md flex-1">
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
				<p class="ml-auto text-sm text-muted-foreground">{filterSummary}</p>
			</div>
		</div>

		<div class="min-h-0 flex-1 overflow-auto px-4 py-4">
			{#if accordionItems.length === 0}
				<p class="py-8 text-center text-sm text-muted-foreground">
					No sections match “{filterQuery.trim()}”.
				</p>
			{:else}
				<AccordionWithTable
					items={accordionItems}
					{columns}
					rowKey={(row) => row.id}
					bind:value={expandedValues}
					type="multiple"
					headings={{
						section: 'Section',
						stats: ['Stock lengths', 'Bars', 'Weight', 'Waste'],
						progress: 'Utilisation'
					}}
					triggerTitleClass="font-body text-base font-bold leading-none"
					tableClass="rounded-none"
				/>
			{/if}

			<p class="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
				<Info class="size-4 shrink-0" aria-hidden="true" />
				This run feeds RM indenting and APS scheduling.
			</p>
		</div>
	{/if}
</div>
