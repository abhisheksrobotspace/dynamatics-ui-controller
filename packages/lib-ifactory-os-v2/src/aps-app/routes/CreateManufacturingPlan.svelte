<script lang="ts">
	import { onMount } from 'svelte';
	import { Alert, TreeTable, type TreeTableColumn, type TreeTableNode } from '@ifactory/ui-v2';
	import { Package } from '@lucide/svelte';
	import { loadManufacturingPlanDsTree } from '../lib/create-plan-ds.load.js';
	import {
		buildPlanDeliveryScheduleInputs,
		computeDsPlanSummary,
		filterProjectsToSavedSchedules,
		selectedLeafIdsFromSavedLinks,
		workOrdersForSelection
	} from '../lib/create-plan-ds.save.js';
	import {
		buildMfgDsTreeNodes,
		mfgDsTreeFilterMatch,
		mfgDsWeightCell
	} from '../lib/create-plan-ds.tree.js';
	import type { MfgDsProjectGroup, MfgDsTreeRowData } from '../lib/create-plan-ds.types.js';
	import {
		collectBomLeafIds,
		countSelectedBomLeaves,
		sumSelectedWeightMt
	} from '../lib/create-plan-ds.utils.js';
	import {
		getManufacturingPlan,
		finalizeManufacturingPlanForScheduling,
		listPlanDeliveryScheduleLinksForPlan,
		syncPlanDeliverySchedules,
		updateManufacturingPlanStatus,
		type ApsDeliveryScheduleLinkRow
	} from '../lib/plans.api.js';
	import { getApsPlantCapacity } from '../lib/plant-capacity.api.js';
	import { formatApiErrorMessage } from '../../lib/api/types.js';
	import {
		rememberManufacturingPlanLabel,
		formatPlanMonth,
		isManufacturingPlanBundleEditable
	} from '../lib/manufacturing-plans.js';
	import { DEFAULT_APS_PLANT_ID } from '../lib/aps-plant.constants.js';
	import { apsPushSuccessToast } from '../lib/toast.js';
	import PlanSummaryPanel from '../components/PlanSummaryPanel.svelte';

	let { params = {} }: { params?: Record<string, string> } = $props();

	let planStatus = $state<string | null>(null);
	const planId = $derived(String(params.planId ?? '').trim());
	const isEditMode = $derived(isManufacturingPlanBundleEditable(planStatus));
	const isViewMode = $derived(planStatus !== null && !isEditMode);

	let dsProjects = $state<MfgDsProjectGroup[]>([]);
	let savedLinks = $state<ApsDeliveryScheduleLinkRow[]>([]);
	let loading = $state(true);
	let isSaving = $state(false);
	let errorMessage = $state<string | null>(null);
	let viewPlanInfo = $state<{ name: string; month: string } | null>(null);
	let planMonth = $state<string | null>(null);
	let expandedIds = $state<string[]>([]);
	let knownProjectIds = $state<Set<string>>(new Set());
	let selectedIds = $state<string[]>([]);
	let maxLoadingPct = $state<number | null>(null);
	let capacityMt = $state<number | null>(null);

	const selectedIdSet = $derived(new Set(selectedIds));
	const visibleProjects = $derived(
		isViewMode ? filterProjectsToSavedSchedules(dsProjects, savedLinks) : dsProjects
	);
	const treeNodes = $derived(buildMfgDsTreeNodes(visibleProjects));
	const selectedWeightMt = $derived(sumSelectedWeightMt(dsProjects, selectedIdSet));
	const selectedBomLeafCount = $derived(countSelectedBomLeaves(dsProjects, selectedIdSet));
	const saveDisabled = $derived(
		treeNodes.length === 0 || (selectedBomLeafCount === 0 && savedLinks.length === 0)
	);

	$effect(() => {
		const projectIds = treeNodes.map((node) => node.id);
		const newProjectIds = projectIds.filter((id) => !knownProjectIds.has(id));
		if (newProjectIds.length === 0) return;
		expandedIds = [...new Set([...expandedIds, ...newProjectIds])];
		knownProjectIds = new Set([...knownProjectIds, ...newProjectIds]);
	});

	const columns = $derived.by((): TreeTableColumn<MfgDsTreeRowData>[] => [
		{
			key: 'description',
			header: 'Description',
			tree: true,
			class: 'min-w-[16rem] text-sm',
			value: (node) => node.label
		},
		{
			key: 'qty',
			header: 'Qty (SET)',
			headerClass: 'text-right',
			class: 'text-right text-sm',
			value: (node) => node.data?.qty ?? ''
		},
		{
			key: 'weight',
			header: 'Weight (MT)',
			headerClass: 'text-right',
			class: 'text-right text-sm',
			value: mfgDsWeightCell
		}
	]);

	function treeRowClass(node: TreeTableNode<MfgDsTreeRowData>): string {
		if (node.data?.level === 'bom') return 'bg-surface text-sm font-normal';
		return 'text-sm';
	}

	function navigateToPlans() {
		window.location.hash = '#/APS/Home';
	}

	async function handleSave() {
		if (!planId || !isEditMode || isSaving || saveDisabled) return;

		isSaving = true;
		errorMessage = null;
		try {
			const deliverySchedules = buildPlanDeliveryScheduleInputs(
				dsProjects,
				selectedIdSet,
				DEFAULT_APS_PLANT_ID
			);

			const summary = computeDsPlanSummary(
				dsProjects,
				selectedIdSet,
				workOrdersForSelection(dsProjects, selectedIdSet)
			);

			await syncPlanDeliverySchedules(planId, {
				initialLinks: savedLinks,
				deliverySchedules,
				summary,
				plantId: DEFAULT_APS_PLANT_ID
			});

			if (deliverySchedules.length === 0) {
				await updateManufacturingPlanStatus(planId, 'draft');
				planStatus = 'draft';
			} else {
				await finalizeManufacturingPlanForScheduling(planId);
				planStatus = 'scheduling_input';
			}

			savedLinks = await listPlanDeliveryScheduleLinksForPlan(planId);
			apsPushSuccessToast({
				title:
					deliverySchedules.length === 0 ? 'Manufacturing plan cleared' : 'Manufacturing plan saved'
			});
		} catch (error) {
			if (error instanceof DOMException && error.name === 'AbortError') return;
			errorMessage = formatApiErrorMessage(error);
		} finally {
			isSaving = false;
		}
	}

	onMount(() => {
		const controller = new AbortController();
		void (async () => {
			loading = true;
			errorMessage = null;
			try {
				if (!planId) {
					navigateToPlans();
					return;
				}

				const [plan, plant, links] = await Promise.all([
					getManufacturingPlan(planId, controller.signal),
					getApsPlantCapacity(DEFAULT_APS_PLANT_ID, controller.signal),
					listPlanDeliveryScheduleLinksForPlan(planId, controller.signal)
				]);
				if (!plan) {
					errorMessage = 'Manufacturing plan not found.';
					dsProjects = [];
					return;
				}

				planStatus = plan.status;
				planMonth = plan.month ?? null;
				capacityMt = plant?.capacityMt ?? null;
				maxLoadingPct = plant?.maxLoading ?? null;
				savedLinks = links;
				rememberManufacturingPlanLabel(plan.plan_id, plan.name?.trim() || plan.plan_id);
				viewPlanInfo = {
					name: plan.name?.trim() || plan.plan_id,
					month: formatPlanMonth(plan.month)
				};

				dsProjects = await loadManufacturingPlanDsTree(plan.month, controller.signal);
				selectedIds =
					links.length > 0
						? selectedLeafIdsFromSavedLinks(dsProjects, links)
						: collectBomLeafIds(dsProjects);
			} catch (error) {
				if (error instanceof DOMException && error.name === 'AbortError') return;
				errorMessage = formatApiErrorMessage(error);
				dsProjects = [];
			} finally {
				if (!controller.signal.aborted) loading = false;
			}
		})();
		return () => controller.abort();
	});
</script>

<div class="flex h-full min-h-0 flex-col overflow-hidden p-8">
	{#if errorMessage}
		<div class="mb-6">
			<Alert variant="error" title="Could not complete request" description={errorMessage} />
		</div>
	{/if}

	<div class="flex min-h-0 flex-1 flex-col items-start gap-6 lg:flex-row">
		<div class="flex min-h-0 min-w-0 flex-1 flex-col">
			<TreeTable
				nodes={treeNodes}
				{columns}
				{loading}
				bind:expandedIds
				bind:selectedIds
				selection={isEditMode ? { enabled: true, mode: 'multiple' } : undefined}
				filterMatch={mfgDsTreeFilterMatch}
				rowClass={treeRowClass}
				search={{
					enabled: true,
					placeholder: 'Search projects, dates, towers, BOMs...'
				}}
				emptyState={{
					icon: Package,
					title: 'No delivery schedules in this month',
					description: planMonth
						? `No delivery schedules found for ${formatPlanMonth(planMonth)}.`
						: 'This manufacturing plan has no month set.'
				}}
			/>
		</div>

		<PlanSummaryPanel
			{loading}
			readonly={isViewMode}
			saving={isSaving}
			{saveDisabled}
			planInfo={viewPlanInfo}
			currentMt={selectedWeightMt}
			{capacityMt}
			{maxLoadingPct}
			onCancel={navigateToPlans}
			onSave={handleSave}
		/>
	</div>
</div>
