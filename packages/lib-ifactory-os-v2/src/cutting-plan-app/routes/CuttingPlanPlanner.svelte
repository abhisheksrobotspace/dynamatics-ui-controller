<script lang="ts">
	import { onMount } from 'svelte';
	import { AccordionWithTable, Alert, Button, Input, type DataTableColumn } from '@ifactory/ui-v2';
	import type { AccordionWithTableItem } from '@ifactory/ui-v2';
	import { AlertCircle, Search } from '@lucide/svelte';
	import CuttingPlanResultsPageSkeleton from '../components/CuttingPlanResultsPageSkeleton.svelte';
	import CuttingPlanKpiStrip from '../components/CuttingPlanKpiStrip.svelte';
	import { markCuttingPlanResults } from '../lib/cutting-plan/cutting-plan-results.svelte';
	import { unitWeightBySectionFromNames } from '../lib/cutting-plan/plan-section-weights';
	import { loadBomUnitWeights } from '../lib/cutting-plan/bom-sections';
	import { loadCuttingPlanDraft } from '../lib/cutting-plan/draft-cache';
	import { formatDisplayLength } from '../lib/cutting-plan/display-units';
	import {
		buildPlanAccordionItems,
		buildPlanBarDetailExportRows,
		buildPlanKpiStripMetrics,
		computeBarWasteMm,
		formatExportWastePercent,
		formatExportWeightKg,
		sanitizeCuttingPlanExportFilename,
		sumMarkingsLengthMm,
		type PlanBarDetailExportRow
	} from '../lib/cutting-plan/planner-results';
	import { prepareReplanAllDraft } from '../lib/cutting-plan/replan-sections';
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
	import type { PlanBarRow, PlanResponse } from '../lib/cutting-plan/types';

	let { params } = $props();
	const projectId = $derived(params.projectId);
	const bomId = $derived(params.bomId);
	const structure = $derived(bomStructureFromParams(params));
	const runId = $derived(params.runId as string | undefined);

	let isLoading = $state(true);
	let loadError = $state('');
	let isReplanning = $state(false);
	let replanError = $state('');
	let planResult = $state<PlanResponse | null>(null);
	let activeRun = $state<CuttingPlanRun | null>(null);
	let unitWeightBySection = $state<Record<string, number>>({});
	let exportRows = $state<PlanBarDetailExportRow[]>([]);
	let baseAccordionItems = $state<AccordionWithTableItem<PlanBarRow>[]>([]);
	let expandedValues = $state<string[]>([]);
	let filterQuery = $state('');
	let bomName = $state('');

	const summaryMetrics = $derived.by(() =>
		planResult ? buildPlanKpiStripMetrics(planResult, unitWeightBySection) : []
	);
	const runLabel = $derived.by(() => {
		if (!activeRun) return '';
		return `Run v${activeRun.version} · ${formatPlanRunTimestamp(activeRun.createdAt)} · ${formatPlanRunType(activeRun.type)}`;
	});

	const accordionItems = $derived.by((): AccordionWithTableItem<PlanBarRow>[] => {
		const normalized = filterQuery.trim().toLowerCase();
		if (!normalized) return baseAccordionItems;
		return baseAccordionItems.filter(
			(item) =>
				item.label.toLowerCase().includes(normalized) ||
				(item.description?.toLowerCase().includes(normalized) ?? false)
		);
	});

	const filterSummary = $derived.by(() => {
		const visible = accordionItems.length;
		const total = baseAccordionItems.length;
		if (filterQuery.trim()) {
			return `${visible} of ${total} sections`;
		}
		return `${total} sections`;
	});

	onMount(async () => {
		loadError = '';
		try {
			let resolvedRunId = runId;
			if (!resolvedRunId) {
				const latest = await getLatestPlanRun(bomId);
				if (latest) {
					window.location.hash = cuttingPlanRunHash(projectId, structure, bomId, latest.id, 'Plan');
				}
				return;
			}

			const [run, draft, bomWeights] = await Promise.all([
				getPlanRun(bomId, resolvedRunId),
				loadCuttingPlanDraft(bomId),
				loadBomUnitWeights(bomId)
			]);
			const data = run?.response ?? null;
			bomName = run?.bomName ?? '';
			const weights = unitWeightBySectionFromNames(bomWeights.unitWeightBySection);
			if (data) {
				planResult = data;
				activeRun = run;
				unitWeightBySection = weights;
				markCuttingPlanResults(bomId);
				baseAccordionItems = buildPlanAccordionItems(data, weights);
				const knownBaseNames = [
					...new Set([
						...(draft?.sections.map((section) => section.baseName ?? section.name) ?? []),
						...bomWeights.sectionNames
					])
				];
				exportRows = buildPlanBarDetailExportRows(data, weights, knownBaseNames);
				expandedValues = [];
			}
		} catch (error) {
			loadError = errorDescription(error);
		} finally {
			isLoading = false;
		}
	});

	function handleReplan() {
		void navigateToReplan();
	}

	async function navigateToReplan() {
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
			'Raw Material ID',
			'Length (mm)',
			'Quantity (nos)',
			'Markings x Quantity (nos)',
			'Used (mm)',
			'Waste (mm)',
			'Waste (%)',
			'Waste (kg)',
			'Weight (kg)'
		];
		const lines = exportRows.map((row) =>
			[
				row.sec,
				row.secGroup,
				row.rmId,
				String(row.lengthMm),
				String(row.qty),
				row.markings,
				String(row.usedMm),
				String(row.wasteMm),
				formatExportWastePercent(row.wasteMm, row.lengthMm),
				formatExportWeightKg(row.wasteKg),
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
		anchor.download = `cutting-plan-bars-${label}${versionSuffix}.csv`;
		anchor.click();
		URL.revokeObjectURL(url);
	}

	function openRuns() {
		window.location.hash = cuttingPlanRunsHash(projectId, structure, bomId);
	}

	function openSummary() {
		if (!activeRun) return;
		window.location.hash = cuttingPlanRunHash(projectId, structure, bomId, activeRun.id, 'Summary');
	}

	function expandAll() {
		expandedValues = accordionItems.map((item) => item.value);
	}

	function collapseAll() {
		expandedValues = [];
	}

	const columns: DataTableColumn<PlanBarRow>[] = [
		{
			key: 'rmid',
			header: 'RM ID',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => row.rmid
		},
		{
			key: 'rm_length',
			header: 'Length',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => formatDisplayLength(row.rm_length || 0, { mDecimals: 3 })
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
			type: 'multi-badge',
			key: 'markings',
			header: 'Markings',
			badges: (row) =>
				(row.markings ?? []).map((marking) => ({
					variant: 'outline' as const,
					label: `${marking.mark || 'Unmarked'} (${formatDisplayLength(marking.length)}) x${marking.quantity}`
				}))
		},
		{
			key: 'used',
			header: 'Used',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => formatDisplayLength(sumMarkingsLengthMm(row.markings), { mDecimals: 3 })
		},
		{
			key: 'waste',
			header: 'Waste',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => formatDisplayLength(computeBarWasteMm(row), { mDecimals: 3 })
		}
	];
</script>

<div class="flex h-full min-h-0 flex-col overflow-hidden">
	{#if isLoading}
		<CuttingPlanResultsPageSkeleton showInfoFooter />
	{:else if loadError}
		<div class="flex h-full min-h-0 flex-col overflow-hidden p-4">
			<Alert variant="error" title="Could not load cutting plan" description={loadError} />
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
				onclick={() => {
					window.location.hash = bomSectionsHash(projectId, structure, bomId);
				}}
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
						label="View Results"
						onclick={openSummary}
					/>
					<Button
						variant="outline"
						size="sm"
						class="rounded-none"
						label="Export"
						onclick={handleExport}
						disabled={exportRows.length === 0}
					/>
					<Button
						variant="primary"
						size="sm"
						class="rounded-none"
						label="Replan"
						onclick={handleReplan}
						disabled={isReplanning}
					/>
				</div>
			</div>
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
					rowKey={(row) => row.rmid}
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
		</div>
	{/if}
</div>
