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
	import { formatApiErrorMessage } from '../../lib/api/types.js';
	import ApiErrorBanner from '../components/ApiErrorBanner.svelte';
	import { formatWeightMt } from '../lib/projects/bom-set-weight.js';
	import { deliveryScheduleLabel } from '../lib/projects/delivery-schedule-label.js';
	import { loadQrcPageData, type QrcQtyByReleaseAndBom } from '../lib/projects/load-qrc.js';
	import { showPageTopLoadErrors } from '../lib/show-page-top-load-errors.js';
	import type { BomConfig, ProjectRelease, StubType, TowerType } from '../lib/store.svelte';
	import { pmPushToast } from '../lib/toast';

	type QrcTreeData = {
		releaseQty?: Record<string, string>;
		releaseWeight?: Record<string, string>;
	};

	let { params } = $props();
	const projectId = $derived(params.projectId);

	let towers = $state<TowerType[]>([]);
	let stubs = $state<StubType[]>([]);
	let towerBoms = $state<BomConfig[]>([]);
	let stubBoms = $state<BomConfig[]>([]);
	let releases = $state<ProjectRelease[]>([]);
	let qtyByReleaseAndBom = $state<QrcQtyByReleaseAndBom>(new Map());
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
	let selectedEditReleaseId = $state('');
	let editFormError = $state('');

	function navigateToReleases() {
		window.location.hash = `#/ProjectManagement/Home/${projectId}/Releases`;
	}

	function errorMessage(error: unknown): string {
		if (error instanceof DOMException && error.name === 'AbortError') return '';
		return formatApiErrorMessage(error);
	}

	function formatReleased(value: number): string {
		return value > 0 ? String(value) : '-';
	}

	function releaseDisplayLabel(release: ProjectRelease): string {
		return deliveryScheduleLabel(release, release.date);
	}

	function bomsForStructure(boms: BomConfig[], structureId: string, kind: 'tower' | 'stub') {
		return boms
			.filter((bom) =>
				kind === 'tower' ? bom.towerId === structureId : bom.stubId === structureId
			)
			.slice()
			.sort((a, b) => a.sNo - b.sNo);
	}

	function releaseQtyForBom(bomId: string): Record<string, string> {
		const releaseQty: Record<string, string> = {};
		for (const release of releases) {
			const qty = qtyByReleaseAndBom.get(release.id)?.get(bomId) ?? 0;
			releaseQty[release.id] = formatReleased(qty);
		}
		return releaseQty;
	}

	function releaseWeightForBom(bomId: string): Record<string, string> {
		const setKg = setKgByBomId.get(bomId);
		const releaseWeight: Record<string, string> = {};
		for (const release of releases) {
			const qty = qtyByReleaseAndBom.get(release.id)?.get(bomId) ?? 0;
			releaseWeight[release.id] = formatWeightMt(setKg, qty);
		}
		return releaseWeight;
	}

	function releaseTotalWeightMt(releaseId: string): string {
		let totalKg = 0;
		for (const bom of [...towerBoms, ...stubBoms]) {
			const qty = qtyByReleaseAndBom.get(releaseId)?.get(bom.id) ?? 0;
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
	): TreeTableNode<QrcTreeData>[] {
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
						releaseQty: releaseQtyForBom(bom.id),
						releaseWeight: releaseWeightForBom(bom.id)
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

	function releaseMeasureColumns(release: ProjectRelease): TreeTableColumnDef<QrcTreeData>[] {
		return [
			{
				key: `qty-${release.id}`,
				header: 'Quantity (Set)',
				headerClass: 'text-center',
				class: 'text-center',
				value: (node) => node.data?.releaseQty?.[release.id] ?? ''
			},
			{
				key: `wt-${release.id}`,
				header: 'Weight (MT)',
				headerClass: 'text-center',
				class: 'text-center',
				value: (node) => node.data?.releaseWeight?.[release.id] ?? ''
			}
		];
	}

	const columns = $derived.by((): TreeTableColumnDef<QrcTreeData>[] => {
		void qtyByReleaseAndBom;
		void setKgByBomId;

		const releaseColumns = releases.map((release): TreeTableColumnDef<QrcTreeData> => ({
			key: `release-${release.id}`,
			header: releaseDisplayLabel(release),
			headerClass: 'text-center',
			columns: [
				{
					key: `total-weight-${release.id}`,
					header: releaseTotalWeightMt(release.id),
					headerClass: 'text-center',
					columns: releaseMeasureColumns(release)
				}
			]
		}));

		return [
			{
				key: 'name-corner',
				header: 'Release Name',
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
			...releaseColumns
		];
	});

	const releaseComboboxItems = $derived.by((): ComboboxItem[] =>
		releases.map((release) => ({
			value: release.id,
			label: releaseDisplayLabel(release)
		}))
	);

	const towerEmptyState = $derived.by(() => {
		if (towers.length === 0) {
			return {
				icon: Layers,
				title: 'No towers configured',
				description: 'Create tower types before viewing them in QRC.'
			};
		}
		return undefined;
	});

	const stubEmptyState = $derived.by(() => {
		if (stubs.length === 0) {
			return {
				icon: Layers,
				title: 'No stubs configured',
				description: 'Create stubs before viewing them in QRC.'
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
				const data = await loadQrcPageData(projectId, controller.signal);
				towers = data.towers;
				stubs = data.stubs;
				towerBoms = data.towerBoms;
				stubBoms = data.stubBoms;
				releases = data.releases;
				qtyByReleaseAndBom = data.qtyByReleaseAndBom;
				setKgByBomId = data.setKgByBomId;
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
		if (releases.length === 0) {
			pmPushToast({
				title: 'No releases',
				description: 'Create a release before editing QRC.'
			});
			return;
		}
		selectedEditReleaseId = releases[0]?.id ?? '';
		editFormError = '';
		isEditDialogOpen = true;
	}

	function handleEditConfirm() {
		if (!selectedEditReleaseId) {
			editFormError = 'Select a release to edit.';
			return;
		}
		isEditDialogOpen = false;
		window.location.hash = `#/ProjectManagement/Home/${projectId}/Releases/${selectedEditReleaseId}`;
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
				label="View Releases"
				onclick={navigateToReleases}
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
	title="Edit QRC"
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
		<Label for="edit-release" text="Release" required />
		<Combobox
			id="edit-release"
			items={releaseComboboxItems}
			bind:value={selectedEditReleaseId}
			placeholder="Select a release"
		/>
	</div>
</Dialog>
