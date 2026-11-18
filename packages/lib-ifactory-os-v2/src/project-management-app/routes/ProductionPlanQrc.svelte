<script lang="ts">
	import { onMount } from 'svelte';
	import {
		Alert,
		Button,
		Combobox,
		collectDefaultExpandedIds,
		collectExpandableIds,
		Dialog,
		Label,
		Tabs,
		TreeTable,
		type ComboboxItem,
		type TabItem,
		type TreeTableColumnDef,
		type TreeTableNode
	} from '@ifactory/ui-v2';
	import { Layers } from '@lucide/svelte';
	import ApiErrorBanner from '../components/ApiErrorBanner.svelte';
	import { formatWeightMt } from '../lib/projects/bom-set-weight.js';
	import { deliveryScheduleLabel } from '../lib/projects/delivery-schedule-label.js';
	import {
		loadProductionPlanQrcPageData,
		type ProductionPlanQtyByPlanAndBom
	} from '../lib/projects/load-production-plan-page.js';
	import { showPageTopLoadErrors } from '../lib/show-page-top-load-errors.js';
	import type { BomConfig, ProjectProductionPlan, StubType, TowerType } from '../lib/store.svelte';
	import { pmPushToast } from '../lib/toast';
	import { formatApiErrorMessage } from '../../lib/api/types.js';

	type ProductionPlanTreeData = {
		planQty?: Record<string, string>;
		planWeight?: Record<string, string>;
	};

	let { params } = $props();
	const projectId = $derived(params.projectId);

	let towers = $state<TowerType[]>([]);
	let stubs = $state<StubType[]>([]);
	let towerBoms = $state<BomConfig[]>([]);
	let stubBoms = $state<BomConfig[]>([]);
	let productionPlans = $state<ProjectProductionPlan[]>([]);
	let qtyByPlanAndBom = $state<ProductionPlanQtyByPlanAndBom>(new Map());
	let setKgByBomId = $state.raw(new Map<string, number>());

	let isLoading = $state(true);
	let loadError = $state('');

	let activeTab = $state('towers');
	const tabItems: TabItem[] = [
		{ label: 'Towers', value: 'towers' },
		{ label: 'Stubs', value: 'stubs' }
	];

	let towerExpandedIds = $state<string[]>([]);
	let stubExpandedIds = $state<string[]>([]);
	let towerExpandInitialized = $state(false);
	let stubExpandInitialized = $state(false);

	let isEditDialogOpen = $state(false);
	let selectedEditPlanId = $state('');
	let editFormError = $state('');

	function navigateToProductionPlans() {
		window.location.hash = `#/ProjectManagement/Home/${projectId}/ProductionPlans`;
	}

	function errorMessage(error: unknown): string {
		if (error instanceof DOMException && error.name === 'AbortError') return '';
		return formatApiErrorMessage(error);
	}

	function formatPlanned(value: number): string {
		return value > 0 ? String(value) : '-';
	}

	function planDisplayLabel(plan: ProjectProductionPlan): string {
		return deliveryScheduleLabel(plan, plan.date);
	}

	function bomsForStructure(boms: BomConfig[], structureId: string, kind: 'tower' | 'stub') {
		return boms
			.filter((bom) =>
				kind === 'tower' ? bom.towerId === structureId : bom.stubId === structureId
			)
			.slice()
			.sort((a, b) => a.sNo - b.sNo);
	}

	function planQtyForBom(bomId: string): Record<string, string> {
		const planQty: Record<string, string> = {};
		for (const plan of productionPlans) {
			const qty = qtyByPlanAndBom.get(plan.id)?.get(bomId) ?? 0;
			planQty[plan.id] = formatPlanned(qty);
		}
		return planQty;
	}

	function planWeightForBom(bomId: string): Record<string, string> {
		const setKg = setKgByBomId.get(bomId);
		const planWeight: Record<string, string> = {};
		for (const plan of productionPlans) {
			const qty = qtyByPlanAndBom.get(plan.id)?.get(bomId) ?? 0;
			planWeight[plan.id] = formatWeightMt(setKg, qty);
		}
		return planWeight;
	}

	function planTotalWeightMt(planId: string): string {
		let totalKg = 0;
		for (const bom of [...towerBoms, ...stubBoms]) {
			const qty = qtyByPlanAndBom.get(planId)?.get(bom.id) ?? 0;
			if (qty <= 0) continue;
			const setKg = setKgByBomId.get(bom.id);
			if (setKg === undefined || !Number.isFinite(setKg)) continue;
			totalKg += setKg * qty;
		}
		if (totalKg <= 0) return '-';
		return (totalKg / 1000).toFixed(2);
	}

	function toTreeNodes(
		structures: Array<{ id: string; label: string }>,
		boms: BomConfig[],
		kind: 'tower' | 'stub'
	): TreeTableNode<ProductionPlanTreeData>[] {
		return structures.map((structure) => {
			const structureBoms = bomsForStructure(boms, structure.id, kind);
			return {
				id: structure.id,
				label: structure.label,
				defaultExpanded: true,
				children: structureBoms.map((bom) => ({
					id: `${structure.id}-${bom.id}`,
					label: bom.bomName,
					data: {
						planQty: planQtyForBom(bom.id),
						planWeight: planWeightForBom(bom.id)
					}
				}))
			};
		});
	}

	const towerTreeNodes = $derived(
		toTreeNodes(
			towers.map((tower) => ({ id: tower.id, label: tower.towerTypeName })),
			towerBoms,
			'tower'
		)
	);

	const stubTreeNodes = $derived(
		toTreeNodes(
			stubs.map((stub) => ({ id: stub.id, label: stub.stubTypeName })),
			stubBoms,
			'stub'
		)
	);

	function planMeasureColumns(
		plan: ProjectProductionPlan
	): TreeTableColumnDef<ProductionPlanTreeData>[] {
		return [
			{
				key: `qty-${plan.id}`,
				header: 'Quantity (Set)',
				headerClass: 'text-center',
				class: 'text-center',
				value: (node) => node.data?.planQty?.[plan.id] ?? ''
			},
			{
				key: `wt-${plan.id}`,
				header: 'Weight (MT)',
				headerClass: 'text-center',
				class: 'text-center',
				value: (node) => node.data?.planWeight?.[plan.id] ?? ''
			}
		];
	}

	const columns = $derived.by((): TreeTableColumnDef<ProductionPlanTreeData>[] => {
		void qtyByPlanAndBom;
		void setKgByBomId;

		const planColumns = productionPlans.map((plan): TreeTableColumnDef<ProductionPlanTreeData> => ({
			key: `plan-${plan.id}`,
			header: planDisplayLabel(plan),
			headerClass: 'text-center',
			columns: [
				{
					key: `total-weight-${plan.id}`,
					header: planTotalWeightMt(plan.id),
					headerClass: 'text-center',
					columns: planMeasureColumns(plan)
				}
			]
		}));

		return [
			{
				key: 'name-corner',
				header: 'Production Plan Name',
				headerClass: 'text-left',
				columns: [
					{
						key: 'total-tonnage-row',
						header: 'Total Tonnage (MT)',
						headerClass: 'text-left',
						columns: [
							{
								key: 'name',
								header: activeTab === 'stubs' ? 'Stubs / BOMs' : 'Towers / BOMs',
								tree: true,
								sticky: true,
								class: 'min-w-[16rem]'
							}
						]
					}
				]
			},
			...planColumns
		];
	});

	const planComboboxItems = $derived.by((): ComboboxItem[] =>
		productionPlans.map((plan) => ({
			value: plan.id,
			label: planDisplayLabel(plan)
		}))
	);

	const towerEmptyState = $derived.by(() => {
		if (towers.length === 0) {
			return {
				icon: Layers,
				title: 'No towers configured',
				description: 'Create tower types before viewing them in the production plan.'
			};
		}
		return undefined;
	});

	const stubEmptyState = $derived.by(() => {
		if (stubs.length === 0) {
			return {
				icon: Layers,
				title: 'No stubs configured',
				description: 'Create stubs before viewing them in the production plan.'
			};
		}
		return undefined;
	});

	$effect(() => {
		if (isLoading || towerExpandInitialized) return;
		towerExpandedIds = collectDefaultExpandedIds(towerTreeNodes);
		towerExpandInitialized = true;
	});

	$effect(() => {
		if (isLoading || stubExpandInitialized) return;
		stubExpandedIds = collectDefaultExpandedIds(stubTreeNodes);
		stubExpandInitialized = true;
	});

	function expandAll() {
		if (activeTab === 'towers') {
			towerExpandedIds = collectExpandableIds(towerTreeNodes);
			return;
		}
		stubExpandedIds = collectExpandableIds(stubTreeNodes);
	}

	function collapseAll() {
		if (activeTab === 'towers') {
			towerExpandedIds = [];
			return;
		}
		stubExpandedIds = [];
	}

	onMount(() => {
		const controller = new AbortController();
		void (async () => {
			isLoading = true;
			loadError = '';
			try {
				const data = await loadProductionPlanQrcPageData(projectId, controller.signal);
				towers = data.towers;
				stubs = data.stubs;
				towerBoms = data.towerBoms;
				stubBoms = data.stubBoms;
				productionPlans = data.productionPlans;
				qtyByPlanAndBom = data.qtyByPlanAndBom;
				setKgByBomId = data.setKgByBomId;
				if (data.planLoadError) loadError = data.planLoadError;
			} catch (error) {
				const message = errorMessage(error);
				if (message) loadError = message;
			} finally {
				if (!controller.signal.aborted) isLoading = false;
			}
		})();
		return () => controller.abort();
	});

	function openEditDialog() {
		if (productionPlans.length === 0) {
			pmPushToast({
				title: 'No production plans',
				description: 'Create a production plan before editing.'
			});
			return;
		}
		selectedEditPlanId = productionPlans[0]?.id ?? '';
		editFormError = '';
		isEditDialogOpen = true;
	}

	function handleEditConfirm() {
		if (!selectedEditPlanId) {
			editFormError = 'Select a production plan to edit.';
			return;
		}
		isEditDialogOpen = false;
		window.location.hash = `#/ProjectManagement/Home/${projectId}/ProductionPlans/${selectedEditPlanId}`;
	}
</script>

<div class="flex h-full min-h-0 flex-col gap-4 overflow-hidden p-4">
	{#if showPageTopLoadErrors && loadError}
		<ApiErrorBanner message={loadError} />
	{/if}

	<div class="flex shrink-0 flex-wrap items-center justify-between gap-3">
		<Tabs items={tabItems} bind:value={activeTab} variant="underline" mobileSelect={false} />
		<div class="flex shrink-0 flex-wrap items-center gap-2">
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
				label="Edit"
				onclick={openEditDialog}
			/>
			<Button
				size="sm"
				class="rounded-none bg-primary"
				label="View Production Plans"
				onclick={navigateToProductionPlans}
			/>
		</div>
	</div>

	{#if activeTab === 'towers'}
		<TreeTable
			class="min-h-0 flex-1"
			nodes={towerTreeNodes}
			{columns}
			loading={isLoading}
			emptyState={towerEmptyState}
			bind:expandedIds={towerExpandedIds}
		/>
	{:else}
		<TreeTable
			class="min-h-0 flex-1"
			nodes={stubTreeNodes}
			{columns}
			loading={isLoading}
			emptyState={stubEmptyState}
			bind:expandedIds={stubExpandedIds}
		/>
	{/if}
</div>

<Dialog
	bind:open={isEditDialogOpen}
	title="Edit Production Plan"
	confirmLabel="Continue"
	cancelLabel="Cancel"
	onConfirm={handleEditConfirm}
	onCancel={() => (isEditDialogOpen = false)}
	class="sm:max-w-lg"
>
	{#if editFormError}
		<Alert variant="error" title="Could not continue" description={editFormError} />
	{/if}
	<div class="space-y-2">
		<Label for="edit-plan" text="Production Plan" required />
		<Combobox
			id="edit-plan"
			items={planComboboxItems}
			bind:value={selectedEditPlanId}
			placeholder="Select a production plan"
		/>
	</div>
</Dialog>
