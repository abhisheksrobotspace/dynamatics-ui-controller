<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import type {
		BomConfig,
		Project,
		ProjectProductionPlan,
		ReleaseStructureKind,
		ReleaseTowerEntry,
		StubType,
		TowerType
	} from '../lib/store.svelte';
	import { upsertProductionPlanBreadcrumb } from '../lib/projects/breadcrumb-registry.js';
	import { fetchProjectForPage } from '../lib/projects/load-project.js';
	import { listBoms, getPublishedCpRunIdFromBom } from '../lib/projects/boms.api.js';
	import {
		collectProductionPlanLineBlockAlerts,
		findProductionPlanConfirmBlockers,
		bomProductionPlanLineBlockReason
	} from '../lib/production-plan-bom-readiness.js';
	import { listStubs, listTowers } from '../lib/projects/structures.api.js';
	import { loadReleaseQtyByBom } from '../lib/projects/load-qrc.js';
	import {
		getProductionPlanById,
		getProductionPlanRow,
		listConfirmedPlanLinesForProject,
		listPlanLines,
		metadataWithProductionPlanSummary,
		planLinesAsReleaseLines,
		savePlanLines,
		updateProductionPlan
	} from '../lib/projects/production-plans.api.js';
	import type { ProjProductionPlanLineRow } from '../lib/projects/types.js';
	import {
		alreadyReleasedByBomId,
		buildAllStructureEntries,
		flattenTowerEntriesToLineWrites,
		parseReleaseQty,
		summarizeTowerEntries
	} from '../lib/release.utils';
	import { formatWeightMt, listBomSetWeightKgByBomIds } from '../lib/projects/bom-set-weight.js';
	import { formatApiErrorMessage } from '../../lib/api/types.js';
	import { pmPushErrorToast, pmPushSuccessToast, pmPushToast } from '../lib/toast';
	import {
		Alert,
		Button,
		ConfirmationDialog,
		Tabs,
		TreeTable,
		collectDefaultExpandedIds,
		collectExpandableIds,
		type TabItem,
		type TreeTableColumnDef,
		type TreeTableNode
	} from '@ifactory/ui-v2';
	import { Layers, Plus } from '@lucide/svelte';

	type PlanTreeData = {
		entryId?: string;
		bomId?: string;
		qrcCount?: string;
		alreadyPlanned?: string;
		thisPlan?: string;
	};

	let { params } = $props();
	const projectId = $derived(params.projectId);
	const planId = $derived(params.planId);

	let project = $state<Project | null>(null);
	let projectTowerTypes = $state<TowerType[]>([]);
	let projectStubTypes = $state<StubType[]>([]);
	let towerBoms = $state<BomConfig[]>([]);
	let stubBoms = $state<BomConfig[]>([]);
	let plan = $state<ProjectProductionPlan | null>(null);
	let persistedLines = $state<ProjProductionPlanLineRow[]>([]);
	let alreadyPlannedByBom = $state<Map<string, number>>(new Map());
	let releasedQtyByBom = $state<Map<string, number>>(new Map());
	let isLoading = $state(true);
	let isSaving = $state(false);
	let exceedConfirmOpen = $state(false);
	let pendingQtyChange = $state<{
		node: TreeTableNode<PlanTreeData>;
		value: string;
		kind: ReleaseStructureKind;
		previousQty: number;
		bomDescription: string;
		planQty: number;
		releaseQty: number;
	} | null>(null);

	let draftTowerEntries = $state<ReleaseTowerEntry[]>([]);
	let draftStubEntries = $state<ReleaseTowerEntry[]>([]);
	let setKgByBomId = $state.raw(new Map<string, number>());

	const towerEntries = $derived(
		draftTowerEntries.slice().sort((a: ReleaseTowerEntry, b: ReleaseTowerEntry) => a.sNo - b.sNo)
	);
	const stubEntries = $derived(
		draftStubEntries.slice().sort((a: ReleaseTowerEntry, b: ReleaseTowerEntry) => a.sNo - b.sNo)
	);

	const hasStructures = $derived(projectTowerTypes.length > 0 || projectStubTypes.length > 0);

	let activeTab = $state<'towers' | 'stubs'>('towers');
	const tabItems: TabItem[] = [
		{ label: 'Towers', value: 'towers' },
		{ label: 'Stubs', value: 'stubs' }
	];

	let towerExpandedIds = $state<string[]>([]);
	let stubExpandedIds = $state<string[]>([]);

	const exceedConfirmDescription = $derived.by(() => {
		if (!pendingQtyChange) return '';
		return `${pendingQtyChange.bomDescription}: this plan quantity (${pendingQtyChange.planQty}) exceeds the released quantity (${pendingQtyChange.releaseQty}). Do you still want to continue?`;
	});

	onMount(() => {
		const controller = new AbortController();
		void (async () => {
			isLoading = true;
			try {
				const loadedProject = await fetchProjectForPage(projectId, controller.signal);
				project = loadedProject;

				const [towers, stubs, loadedPlan, confirmedBundles] = await Promise.all([
					listTowers(projectId, controller.signal),
					listStubs(projectId, controller.signal),
					getProductionPlanById(planId, projectId, controller.signal),
					listConfirmedPlanLinesForProject(projectId, controller.signal)
				]);
				projectTowerTypes = towers;
				projectStubTypes = stubs;
				plan = loadedPlan;

				if (loadedPlan) {
					upsertProductionPlanBreadcrumb(loadedPlan);
				}

				const [towerBomLists, stubBomLists] = await Promise.all([
					Promise.all(towers.map((tower) => listBoms(projectId, tower.id, controller.signal))),
					Promise.all(stubs.map((stub) => listBoms(projectId, stub.id, controller.signal)))
				]);
				towerBoms = towerBomLists.flat();
				stubBoms = stubBomLists.flat().map((bom) => ({
					...bom,
					towerId: undefined,
					stubId: bom.towerId ?? bom.stubId
				}));

				setKgByBomId = await listBomSetWeightKgByBomIds(
					[...towerBoms, ...stubBoms].map((bom) => bom.id),
					controller.signal
				);

				alreadyPlannedByBom = alreadyReleasedByBomId(
					confirmedBundles.map((bundle) => ({
						releaseId: bundle.plan.production_plan_id,
						lines: planLinesAsReleaseLines(bundle.lines)
					})),
					planId
				);

				try {
					releasedQtyByBom = await loadReleaseQtyByBom(projectId, controller.signal);
				} catch (releaseError) {
					pmPushToast({
						title: 'Could not load release quantities',
						description: formatApiErrorMessage(releaseError)
					});
					releasedQtyByBom = new Map();
				}

				if (loadedPlan) {
					persistedLines = await listPlanLines(planId, controller.signal);
					const releaseLines = planLinesAsReleaseLines(persistedLines);
					draftTowerEntries = buildAllStructureEntries(
						planId,
						releaseLines,
						towerBoms,
						towers,
						alreadyPlannedByBom,
						'tower'
					);
					draftStubEntries = buildAllStructureEntries(
						planId,
						releaseLines,
						stubBoms,
						stubs,
						alreadyPlannedByBom,
						'stub'
					);
					initializeExpandedIds(draftTowerEntries, draftStubEntries);
				}
			} catch (error) {
				if (!controller.signal.aborted) {
					pmPushToast({
						title: 'Failed to load production plan',
						description: formatApiErrorMessage(error)
					});
				}
			} finally {
				if (!controller.signal.aborted) {
					isLoading = false;
					void focusFirstPlanInput();
				}
			}
		})();
		return () => controller.abort();
	});

	function toTreeNodes(entries: ReleaseTowerEntry[]): TreeTableNode<PlanTreeData>[] {
		return entries.map((entry) => ({
			id: entry.id,
			label:
				entry.kind === 'stub'
					? getStubName(entry.towerTypeId)
					: getTowerTypeName(entry.towerTypeId),
			defaultExpanded: true,
			data: { entryId: entry.id },
			children: entry.lineItems.map((lineItem) => ({
				id: `${entry.id}-${lineItem.id}`,
				label: lineItem.description,
				data: {
					entryId: entry.id,
					bomId: lineItem.bomId,
					qrcCount: formatPlanned(releasedQtyByBom.get(lineItem.bomId ?? '') ?? 0),
					alreadyPlanned: formatPlanned(lineItem.alreadyReleased),
					thisPlan: String(lineItem.thisRelease)
				}
			}))
		}));
	}

	const towerTreeNodes = $derived(toTreeNodes(towerEntries));
	const stubTreeNodes = $derived(toTreeNodes(stubEntries));

	const bomById = $derived.by(() => {
		const map = new SvelteMap<string, BomConfig>();
		for (const bom of [...towerBoms, ...stubBoms]) {
			map.set(bom.id, bom);
		}
		return map;
	});

	const planLineBlockers = $derived.by(() =>
		collectProductionPlanLineBlockAlerts(
			[...towerEntries, ...stubEntries],
			bomById,
			getStructureName
		)
	);

	function lineBlockReasonForNode(
		node: TreeTableNode<PlanTreeData>,
		kind: ReleaseStructureKind
	): string | null {
		const line = findLineItem(node, kind);
		if (!line) return null;
		const bom = bomById.get(line.bomId);
		if (!bom) return null;
		return bomProductionPlanLineBlockReason(bom);
	}

	function initializeExpandedIds(
		towerEntryList: ReleaseTowerEntry[],
		stubEntryList: ReleaseTowerEntry[]
	) {
		towerExpandedIds = collectDefaultExpandedIds(toTreeNodes(towerEntryList));
		stubExpandedIds = collectDefaultExpandedIds(toTreeNodes(stubEntryList));
	}

	async function focusFirstPlanInput() {
		await tick();
		const input = document.querySelector<HTMLInputElement>(
			'input[data-tree-table-input="thisPlan"]:not([disabled])'
		);
		if (!input) return;
		input.focus();
		input.select();
	}

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

	function isPlanLineNode(node: TreeTableNode<PlanTreeData>): boolean {
		return Boolean(node.data?.bomId);
	}

	function getTowerTypeName(towerTypeId: string): string {
		return projectTowerTypes.find((t) => t.id === towerTypeId)?.towerTypeName ?? towerTypeId;
	}

	function getStubName(stubId: string): string {
		return projectStubTypes.find((s) => s.id === stubId)?.stubTypeName ?? stubId;
	}

	function getStructureName(structureId: string, kind: ReleaseStructureKind): string {
		return kind === 'stub' ? getStubName(structureId) : getTowerTypeName(structureId);
	}

	function formatPlanned(value: number): string {
		return value > 0 ? String(value) : '-';
	}

	function navigateToProductionPlans() {
		window.location.hash = `#/ProjectManagement/Home/${projectId}/ProductionPlans`;
	}

	function navigateToTowerTypes() {
		window.location.hash = `#/ProjectManagement/Home/${projectId}/Towers`;
	}

	function navigateToStubs() {
		window.location.hash = `#/ProjectManagement/Home/${projectId}/Stubs`;
	}

	async function persistLinesAndSummary(): Promise<ProjProductionPlanLineRow[]> {
		if (!plan) throw new Error('Production plan not loaded');

		const allEntries = [...draftTowerEntries, ...draftStubEntries];
		const writes = flattenTowerEntriesToLineWrites(allEntries).map((line) => {
			const bom = bomById.get(line.bomId);
			return {
				planLineId: line.releaseLineId,
				bomId: line.bomId,
				quantity: line.quantity,
				unit: line.unit,
				description: line.description,
				tentativeOrderQty: line.tentativeOrderQty,
				cpRunId: bom ? getPublishedCpRunIdFromBom(bom) : null
			};
		});
		if (writes.some((line) => !line.bomId)) {
			throw new Error('Every plan line must reference a BOM.');
		}

		const activeBoms = writes
			.filter((line) => line.quantity > 0)
			.map((line) => bomById.get(line.bomId))
			.filter((bom): bom is BomConfig => Boolean(bom));
		const blockers = findProductionPlanConfirmBlockers(activeBoms);
		if (blockers.length > 0) {
			throw new Error(blockers.join(' '));
		}

		const savedLines = await savePlanLines(planId, writes, persistedLines);
		persistedLines = savedLines;

		const summary = summarizeTowerEntries(allEntries, (id) => {
			const entry = allEntries.find((e) => e.towerTypeId === id);
			return getStructureName(id, entry?.kind ?? 'tower');
		});
		const row = await getProductionPlanRow(planId);
		const updated = await updateProductionPlan({
			planId,
			status: 'confirmed',
			confirmedAt: new Date().toISOString(),
			metadata: metadataWithProductionPlanSummary(row?.metadata, {
				releases: summary.towerTypes,
				total_qty: summary.totalQty
			}),
			sNo: plan.sNo
		});
		plan = updated;
		upsertProductionPlanBreadcrumb(plan);
		return savedLines;
	}

	async function handleNextFromTowers() {
		activeTab = 'stubs';
		await focusFirstPlanInput();
	}

	async function handleSavePlan() {
		if (!plan) return;
		isSaving = true;
		try {
			await persistLinesAndSummary();
			pmPushSuccessToast({ title: 'Production plan saved' });
			navigateToProductionPlans();
		} catch (error) {
			pmPushErrorToast({
				title: 'Failed to save production plan',
				description: formatApiErrorMessage(error)
			});
		} finally {
			isSaving = false;
		}
	}

	function handlePrimaryAction() {
		if (activeTab === 'towers') {
			void handleNextFromTowers();
			return;
		}
		void handleSavePlan();
	}

	const primaryActionLabel = $derived.by(() => {
		if (activeTab === 'towers') return 'Next';
		if (isSaving) return 'Saving...';
		return 'Save';
	});

	function handleCancel() {
		navigateToProductionPlans();
	}

	function findLineItem(
		node: TreeTableNode<PlanTreeData>,
		kind: ReleaseStructureKind
	): { entryId: string; bomId: string; description: string; previousQty: number } | null {
		const entryId = node.data?.entryId;
		if (!entryId || node.children?.length) return null;

		const entries = kind === 'tower' ? draftTowerEntries : draftStubEntries;
		const entry = entries.find((candidate) => candidate.id === entryId);
		if (!entry) return null;

		const lineItem = entry.lineItems.find((item) => node.id === `${entry.id}-${item.id}`);
		if (!lineItem?.bomId) return null;

		return {
			entryId,
			bomId: lineItem.bomId,
			description: lineItem.description,
			previousQty: lineItem.thisRelease
		};
	}

	function applyLineItemThisPlan(
		node: TreeTableNode<PlanTreeData>,
		value: string,
		kind: ReleaseStructureKind
	) {
		const entryId = node.data?.entryId;
		if (!entryId || node.children?.length) return;

		const qty = parseReleaseQty(value);
		const patchEntry = (entry: ReleaseTowerEntry): ReleaseTowerEntry => {
			if (entry.id !== entryId) return entry;
			const lineItems = entry.lineItems.map((item) => {
				if (node.id !== `${entry.id}-${item.id}`) return item;
				return { ...item, thisRelease: qty };
			});
			return { ...entry, thisRelease: lineItems[0]?.thisRelease ?? 0, lineItems };
		};

		if (kind === 'tower') {
			draftTowerEntries = draftTowerEntries.map(patchEntry);
		} else {
			draftStubEntries = draftStubEntries.map(patchEntry);
		}
	}

	function updateLineItemThisPlan(
		node: TreeTableNode<PlanTreeData>,
		value: string,
		kind: ReleaseStructureKind
	) {
		const line = findLineItem(node, kind);
		if (!line) return;

		const bom = bomById.get(line.bomId);
		if (bom && bomProductionPlanLineBlockReason(bom)) return;

		const previousQty = line.previousQty;
		applyLineItemThisPlan(node, value, kind);

		const qty = parseReleaseQty(value);
		const releaseQty = releasedQtyByBom.get(line.bomId) ?? 0;
		if (releaseQty > 0 && qty > releaseQty) {
			pendingQtyChange = {
				node,
				value,
				kind,
				previousQty,
				bomDescription: line.description,
				planQty: qty,
				releaseQty
			};
			exceedConfirmOpen = true;
		}
	}

	function handleExceedConfirm() {
		pendingQtyChange = null;
		exceedConfirmOpen = false;
	}

	function handleExceedCancel() {
		if (pendingQtyChange) {
			applyLineItemThisPlan(
				pendingQtyChange.node,
				String(pendingQtyChange.previousQty),
				pendingQtyChange.kind
			);
		}

		pendingQtyChange = null;
		exceedConfirmOpen = false;
	}

	function buildColumns(kind: ReleaseStructureKind): TreeTableColumnDef<PlanTreeData>[] {
		return [
			{
				key: 'name',
				header: kind === 'stub' ? 'Stubs / BOMs' : 'Towers / BOMs',
				tree: true,
				class: 'min-w-[16rem]'
			},
			{
				key: 'qrcCount',
				header: 'QRC count',
				headerClass: 'text-center',
				class: 'text-center',
				value: (node) => node.data?.qrcCount ?? ''
			},
			{
				key: 'alreadyPlanned',
				header: 'Already Planned',
				headerClass: 'text-center',
				class: 'text-center',
				value: (node) => node.data?.alreadyPlanned ?? ''
			},
			{
				key: 'thisPlanGroup',
				header: 'This Plan',
				headerClass: 'text-center',
				columns: [
					{
						key: 'thisPlan',
						header: 'Quantity (Set)',
						type: 'input',
						headerClass: 'text-center',
						class: 'text-center',
						align: 'center',
						inputType: 'number',
						min: 0,
						step: 1,
						autofocusFirst: kind === 'tower' || kind === 'stub',
						visible: isPlanLineNode,
						disabled: (node) => Boolean(lineBlockReasonForNode(node, kind)),
						value: (node) => node.data?.thisPlan ?? '0',
						onValueChange: (node, value) => updateLineItemThisPlan(node, value, kind),
						inputClass: 'w-20 text-center'
					},
					{
						key: 'weightMt',
						header: 'Weight (MT)',
						headerClass: 'text-center',
						class: 'text-center',
						value: (node) => {
							const bomId = node.data?.bomId;
							if (!bomId) return '';
							const qty = parseReleaseQty(node.data?.thisPlan ?? '0');
							return formatWeightMt(setKgByBomId.get(bomId), qty);
						}
					}
				]
			}
		];
	}

	const towerColumns = $derived(buildColumns('tower'));
	const stubColumns = $derived(buildColumns('stub'));

	const towerEmptyState = $derived.by(() => {
		if (projectTowerTypes.length === 0) {
			return {
				icon: Layers,
				title: 'No towers configured',
				description: 'Create tower types before adding them to this production plan.',
				actionLabel: 'Go to Tower Types',
				actionIcon: Plus,
				onAction: navigateToTowerTypes
			};
		}
		return undefined;
	});

	const stubEmptyState = $derived.by(() => {
		if (projectStubTypes.length === 0) {
			return {
				icon: Layers,
				title: 'No stubs configured',
				description: 'Create stubs before adding them to this production plan.',
				actionLabel: 'Go to Stubs',
				actionIcon: Plus,
				onAction: navigateToStubs
			};
		}
		return undefined;
	});
</script>

<div class="flex h-full min-h-0 flex-col gap-3 overflow-hidden p-4">
	{#if isLoading || (project && plan)}
		{#if isLoading || hasStructures}
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
						label="Cancel"
						variant="outline"
						size="sm"
						class="rounded-none"
						disabled={isSaving}
						onclick={handleCancel}
					/>
					<Button
						label={primaryActionLabel}
						variant="primary"
						size="sm"
						class="min-w-24 rounded-none"
						disabled={isSaving}
						onclick={handlePrimaryAction}
					/>
				</div>
			</div>
		{/if}

		{#if planLineBlockers.length > 0}
			<Alert variant="warning" title="Some quantities cannot be edited" items={planLineBlockers} />
		{/if}

		{#if activeTab === 'towers'}
			<TreeTable
				nodes={towerTreeNodes}
				columns={towerColumns}
				loading={isLoading}
				emptyState={towerEmptyState}
				bind:expandedIds={towerExpandedIds}
			/>
		{:else}
			<TreeTable
				nodes={stubTreeNodes}
				columns={stubColumns}
				loading={isLoading}
				emptyState={stubEmptyState}
				bind:expandedIds={stubExpandedIds}
			/>
		{/if}
	{:else}
		<p class="text-gray-500">Production plan not found.</p>
	{/if}
</div>

<ConfirmationDialog
	bind:open={exceedConfirmOpen}
	title="Quantity exceeds released quantity"
	description={exceedConfirmDescription}
	cancelLabel="Cancel"
	confirmLabel="Continue"
	confirmVariant="primary"
	iconTone="warning"
	onConfirm={handleExceedConfirm}
	onCancel={handleExceedCancel}
/>
