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
	import {
		buildDeliveryScheduleCsv,
		deliveryScheduleExportFilename,
		formatBatchWt,
		formatExportMonth,
		formatExportUpdatedOn,
		formatStructureSetsLabel,
		type DeliveryScheduleExportBom,
		type DeliveryScheduleExportLot
	} from '../lib/projects/delivery-schedule-export.js';
	import { deliveryScheduleLabel } from '../lib/projects/delivery-schedule-label.js';
	import { isDeliveryScheduleEditable } from '../lib/projects/delivery-schedules.api.js';
	import {
		loadDeliveryScheduleMatrixData,
		type DeliveryScheduleQtyByScheduleAndBom
	} from '../lib/projects/load-delivery-schedule.js';
	import { getProjectWorkOrderNo } from '../lib/projects/projects.api.js';
	import { showPageTopLoadErrors } from '../lib/show-page-top-load-errors.js';
	import {
		projectStore,
		type BomConfig,
		type ProjectDeliverySchedule,
		type StubType,
		type TowerType
	} from '../lib/store.svelte.js';
	import { pmPushToast } from '../lib/toast';

	type DeliveryScheduleTreeData = {
		scheduleQty?: Record<string, string>;
		scheduleWeight?: Record<string, string>;
	};

	let { params } = $props();
	const projectId = $derived(params.projectId);

	let towers = $state<TowerType[]>([]);
	let stubs = $state<StubType[]>([]);
	let towerBoms = $state<BomConfig[]>([]);
	let stubBoms = $state<BomConfig[]>([]);
	let schedules = $state<ProjectDeliverySchedule[]>([]);
	let qtyByScheduleAndBom = $state<DeliveryScheduleQtyByScheduleAndBom>(new Map());
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
	let selectedEditScheduleId = $state('');
	let editFormError = $state('');

	function navigateToDeliveryScheduleView() {
		window.location.hash = `#/ProjectManagement/Home/${projectId}/DeliverySchedule/DeliverySchedules`;
	}

	function errorMessage(error: unknown): string {
		if (error instanceof DOMException && error.name === 'AbortError') return '';
		return formatApiErrorMessage(error);
	}

	function formatReleased(value: number): string {
		return value > 0 ? String(value) : '-';
	}

	function scheduleDisplayLabel(schedule: ProjectDeliverySchedule): string {
		return deliveryScheduleLabel(schedule, schedule.date);
	}

	function bomsForStructure(boms: BomConfig[], structureId: string, kind: 'tower' | 'stub') {
		return boms
			.filter((bom) =>
				kind === 'tower' ? bom.towerId === structureId : bom.stubId === structureId
			)
			.slice()
			.sort((a, b) => a.sNo - b.sNo);
	}

	function scheduleQtyForBom(bomId: string): Record<string, string> {
		const scheduleQty: Record<string, string> = {};
		for (const schedule of schedules) {
			const qty = qtyByScheduleAndBom.get(schedule.id)?.get(bomId) ?? 0;
			scheduleQty[schedule.id] = formatReleased(qty);
		}
		return scheduleQty;
	}

	function scheduleWeightForBom(bomId: string): Record<string, string> {
		const setKg = setKgByBomId.get(bomId);
		const scheduleWeight: Record<string, string> = {};
		for (const schedule of schedules) {
			const qty = qtyByScheduleAndBom.get(schedule.id)?.get(bomId) ?? 0;
			scheduleWeight[schedule.id] = formatWeightMt(setKg, qty);
		}
		return scheduleWeight;
	}

	function scheduleTotalWeightMt(scheduleId: string): string {
		let totalKg = 0;
		for (const bom of [...towerBoms, ...stubBoms]) {
			const qty = qtyByScheduleAndBom.get(scheduleId)?.get(bom.id) ?? 0;
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
	): TreeTableNode<DeliveryScheduleTreeData>[] {
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
						scheduleQty: scheduleQtyForBom(bom.id),
						scheduleWeight: scheduleWeightForBom(bom.id)
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

	function scheduleMeasureColumns(
		schedule: ProjectDeliverySchedule
	): TreeTableColumnDef<DeliveryScheduleTreeData>[] {
		return [
			{
				key: `qty-${schedule.id}`,
				header: 'Quantity (Set)',
				headerClass: 'text-center',
				class: 'text-center',
				value: (node) => node.data?.scheduleQty?.[schedule.id] ?? ''
			},
			{
				key: `wt-${schedule.id}`,
				header: 'Weight (MT)',
				headerClass: 'text-center',
				class: 'text-center',
				value: (node) => node.data?.scheduleWeight?.[schedule.id] ?? ''
			}
		];
	}

	const columns = $derived.by((): TreeTableColumnDef<DeliveryScheduleTreeData>[] => {
		void qtyByScheduleAndBom;
		void setKgByBomId;

		const scheduleColumns = schedules.map(
			(schedule): TreeTableColumnDef<DeliveryScheduleTreeData> => ({
				key: `schedule-${schedule.id}`,
				header: scheduleDisplayLabel(schedule),
				headerClass: 'text-center',
				columns: [
					{
						key: `total-weight-${schedule.id}`,
						header: scheduleTotalWeightMt(schedule.id),
						headerClass: 'text-center',
						columns: scheduleMeasureColumns(schedule)
					}
				]
			})
		);

		return [
			{
				key: 'name-corner',
				header: 'Delivery Schedule Name',
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
			...scheduleColumns
		];
	});

	const scheduleComboboxItems = $derived.by((): ComboboxItem[] =>
		schedules
			.filter((schedule) => isDeliveryScheduleEditable(schedule))
			.map((schedule) => ({
				value: schedule.id,
				label: scheduleDisplayLabel(schedule)
			}))
	);

	const hasEditableSchedules = $derived(scheduleComboboxItems.length > 0);

	const towerEmptyState = $derived.by(() => {
		if (towers.length === 0) {
			return {
				icon: Layers,
				title: 'No towers configured',
				description: 'Create tower types before viewing them in the delivery schedule.'
			};
		}
		return undefined;
	});

	const stubEmptyState = $derived.by(() => {
		if (stubs.length === 0) {
			return {
				icon: Layers,
				title: 'No stubs configured',
				description: 'Create stubs before viewing them in the delivery schedule.'
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
				const data = await loadDeliveryScheduleMatrixData(projectId, controller.signal);
				towers = data.towers;
				stubs = data.stubs;
				towerBoms = data.towerBoms;
				stubBoms = data.stubBoms;
				schedules = data.schedules;
				qtyByScheduleAndBom = data.qtyByScheduleAndBom;
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

	function exportLotsForSchedule(
		schedule: ProjectDeliverySchedule,
		workOrder: string,
		structures: Array<{ id: string; label: string }>,
		boms: BomConfig[],
		structureKind: 'tower' | 'stub'
	): DeliveryScheduleExportLot[] {
		const lots: DeliveryScheduleExportLot[] = [];
		for (const structure of structures) {
			const exportBoms: DeliveryScheduleExportBom[] = [];
			for (const bom of bomsForStructure(boms, structure.id, structureKind)) {
				const qty = qtyByScheduleAndBom.get(schedule.id)?.get(bom.id) ?? 0;
				if (qty <= 0) continue;
				exportBoms.push({
					name: bom.bomName,
					qty,
					weightMt: formatWeightMt(setKgByBomId.get(bom.id), qty)
				});
			}
			if (exportBoms.length === 0) continue;
			const setCount = Math.max(...exportBoms.map((bom) => bom.qty));
			lots.push({
				month: formatExportMonth(schedule.date),
				workOrder,
				structureLabel: formatStructureSetsLabel(structure.label, setCount),
				boms: exportBoms,
				batchWt: formatBatchWt(exportBoms.map((bom) => bom.weightMt))
			});
		}
		return lots;
	}

	async function handleExport() {
		let workOrder = '';
		try {
			workOrder = await getProjectWorkOrderNo(projectId);
		} catch (error) {
			const message = errorMessage(error);
			if (message) {
				pmPushToast({
					title: 'Could not load work order',
					description: message
				});
			}
		}

		const lots: DeliveryScheduleExportLot[] = [];
		for (const schedule of schedules) {
			lots.push(
				...exportLotsForSchedule(
					schedule,
					workOrder,
					towers.map((tower) => ({ id: tower.id, label: tower.towerTypeName })),
					towerBoms,
					'tower'
				),
				...exportLotsForSchedule(
					schedule,
					workOrder,
					stubs.map((stub) => ({ id: stub.id, label: stub.stubTypeName })),
					stubBoms,
					'stub'
				)
			);
		}
		if (lots.length === 0) {
			pmPushToast({
				title: 'Nothing to export',
				description: 'Add quantities on a delivery date before exporting.'
			});
			return;
		}

		const project = projectStore.projects.find((item) => item.id === projectId);
		const projectName = project?.shortName || project?.projectName || 'Project';
		const updatedOn = formatExportUpdatedOn(new Date());
		const csv = buildDeliveryScheduleCsv(lots);
		const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
		const url = URL.createObjectURL(blob);
		const anchor = document.createElement('a');
		anchor.href = url;
		anchor.download = deliveryScheduleExportFilename(projectName, updatedOn);
		anchor.click();
		URL.revokeObjectURL(url);
	}

	function openEditDialog() {
		if (schedules.length === 0) {
			pmPushToast({
				title: 'No delivery dates',
				description: 'Create a delivery schedule before editing quantities.'
			});
			return;
		}
		if (!hasEditableSchedules) {
			pmPushToast({
				title: 'No editable delivery schedules',
				description: 'Frozen delivery schedules cannot be edited.'
			});
			return;
		}
		selectedEditScheduleId = scheduleComboboxItems[0]?.value ?? '';
		editFormError = '';
		isEditDialogOpen = true;
	}

	function handleEditConfirm() {
		if (!selectedEditScheduleId) {
			editFormError = 'Select a delivery date to edit.';
			return;
		}
		isEditDialogOpen = false;
		window.location.hash = `#/ProjectManagement/Home/${projectId}/DeliverySchedule/DeliverySchedules/${selectedEditScheduleId}`;
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
				label="Export"
				onclick={handleExport}
			/>
			<Button
				variant="outline"
				size="sm"
				class="rounded-none"
				label="Edit"
				disabled={!hasEditableSchedules}
				onclick={openEditDialog}
			/>
			<Button
				size="sm"
				class="rounded-none bg-primary"
				label="View Delivery Schedules"
				onclick={navigateToDeliveryScheduleView}
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
	title="Edit Delivery Schedule"
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
		<Label for="edit-schedule" text="Delivery Date" required />
		<Combobox
			id="edit-schedule"
			items={scheduleComboboxItems}
			bind:value={selectedEditScheduleId}
			placeholder="Select a delivery date"
		/>
	</div>
</Dialog>
