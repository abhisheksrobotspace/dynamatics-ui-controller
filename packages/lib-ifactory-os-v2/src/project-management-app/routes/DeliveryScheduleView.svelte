<script lang="ts">
	import { onMount, tick } from 'svelte';
	import type {
		ProjectDeliverySchedule,
		ReleaseStructureKind,
		ReleaseTowerEntry,
		StubType,
		TowerType
	} from '../lib/store.svelte.js';
	import { loadDeliverySchedulePageData } from '../lib/projects/load-delivery-schedule-page.js';
	import { loadReleaseQtyByBom } from '../lib/projects/load-qrc.js';
	import {
		saveDeliveryScheduleLines,
		updateDeliverySchedule,
		isDeliveryScheduleFrozen
	} from '../lib/projects/delivery-schedules.api.js';
	import { upsertDeliveryScheduleBreadcrumb } from '../lib/projects/breadcrumb-registry.js';
	import type { ProjDeliveryScheduleLineRow } from '../lib/projects/types.js';
	import { listPublishedCpByBomIds } from '../../cutting-plan-app/lib/cutting-plan/cp-publish.api.js';
	import { flattenTowerEntriesToLineWrites, parseReleaseQty } from '../lib/release.utils.js';
	import { formatWeightMt } from '../lib/projects/bom-set-weight.js';
	import { deliveryScheduleLabel } from '../lib/projects/delivery-schedule-label.js';
	import { formatApiErrorMessage } from '../../lib/api/types.js';
	import { pmPushErrorToast, pmPushSuccessToast, pmPushToast } from '../lib/toast.js';
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

	type ReleaseTreeData = {
		entryId?: string;
		bomId?: string;
		qrcCount?: string;
		alreadyReleased?: string;
		thisRelease?: string;
	};

	let { params } = $props();
	const projectId = $derived(params.projectId);
	const scheduleId = $derived(params.scheduleId ?? params.releaseId);

	let projectTowerTypes = $state<TowerType[]>([]);
	let projectStubTypes = $state<StubType[]>([]);
	let schedule = $state<ProjectDeliverySchedule | null>(null);
	let persistedLines = $state<ProjDeliveryScheduleLineRow[]>([]);
	let isLoading = $state(true);
	let isSaving = $state(false);

	let draftTowerEntries = $state<ReleaseTowerEntry[]>([]);
	let draftStubEntries = $state<ReleaseTowerEntry[]>([]);
	let setKgByBomId = $state.raw(new Map<string, number>());
	let releasedQtyByBom = $state<Map<string, number>>(new Map());
	let exceedConfirmOpen = $state(false);
	let pendingQtyChange = $state<{
		node: TreeTableNode<ReleaseTreeData>;
		value: string;
		kind: ReleaseStructureKind;
		previousQty: number;
		bomDescription: string;
		scheduleQty: number;
		releaseQty: number;
	} | null>(null);

	const exceedConfirmDescription = $derived.by(() => {
		if (!pendingQtyChange) return '';
		return `${pendingQtyChange.bomDescription}: this delivery schedule quantity (${pendingQtyChange.scheduleQty}) exceeds the released quantity (${pendingQtyChange.releaseQty}). Do you still want to continue?`;
	});

	const towerEntries = $derived(
		draftTowerEntries.slice().sort((a: ReleaseTowerEntry, b: ReleaseTowerEntry) => a.sNo - b.sNo)
	);
	const stubEntries = $derived(
		draftStubEntries.slice().sort((a: ReleaseTowerEntry, b: ReleaseTowerEntry) => a.sNo - b.sNo)
	);

	const hasStructures = $derived(projectTowerTypes.length > 0 || projectStubTypes.length > 0);
	const isScheduleFrozen = $derived(schedule != null && isDeliveryScheduleFrozen(schedule));

	let activeTab = $state<'towers' | 'stubs'>('towers');
	const tabItems: TabItem[] = [
		{ label: 'Towers', value: 'towers' },
		{ label: 'Stubs', value: 'stubs' }
	];

	let towerExpandedIds = $state<string[]>([]);
	let stubExpandedIds = $state<string[]>([]);

	onMount(() => {
		const controller = new AbortController();
		void (async () => {
			isLoading = true;
			try {
				const [data, qrcQty] = await Promise.all([
					loadDeliverySchedulePageData(projectId, scheduleId, controller.signal),
					loadReleaseQtyByBom(projectId, controller.signal).catch((releaseError) => {
						if (!controller.signal.aborted) {
							pmPushToast({
								title: 'Could not load release quantities',
								description: formatApiErrorMessage(releaseError)
							});
						}
						return new Map<string, number>();
					})
				]);
				schedule = data.schedule;
				projectTowerTypes = data.towers;
				projectStubTypes = data.stubs;
				persistedLines = data.persistedLines;
				draftTowerEntries = data.draftTowerEntries;
				draftStubEntries = data.draftStubEntries;
				setKgByBomId = data.setKgByBomId;
				releasedQtyByBom = qrcQty;
				initializeExpandedIds(data.draftTowerEntries, data.draftStubEntries);
			} catch (error) {
				if (!controller.signal.aborted) {
					pmPushErrorToast({
						title: 'Failed to load delivery schedule',
						description: formatApiErrorMessage(error)
					});
				}
			} finally {
				if (!controller.signal.aborted) {
					isLoading = false;
					void focusFirstReleaseInput();
				}
			}
		})();
		return () => controller.abort();
	});

	function toTreeNodes(entries: ReleaseTowerEntry[]): TreeTableNode<ReleaseTreeData>[] {
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
					qrcCount: formatReleased(releasedQtyByBom.get(lineItem.bomId ?? '') ?? 0),
					alreadyReleased: formatReleased(lineItem.alreadyReleased),
					thisRelease: String(lineItem.thisRelease)
				}
			}))
		}));
	}

	const towerTreeNodes = $derived(toTreeNodes(towerEntries));
	const stubTreeNodes = $derived(toTreeNodes(stubEntries));

	function initializeExpandedIds(
		towerEntryList: ReleaseTowerEntry[],
		stubEntryList: ReleaseTowerEntry[]
	) {
		towerExpandedIds = collectDefaultExpandedIds(toTreeNodes(towerEntryList));
		stubExpandedIds = collectDefaultExpandedIds(toTreeNodes(stubEntryList));
	}

	async function focusFirstReleaseInput() {
		await tick();
		const input = document.querySelector<HTMLInputElement>(
			'input[data-tree-table-input="thisRelease"]:not([disabled])'
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

	function getTowerTypeName(towerTypeId: string): string {
		return projectTowerTypes.find((t) => t.id === towerTypeId)?.towerTypeName ?? towerTypeId;
	}

	function getStubName(stubId: string): string {
		return projectStubTypes.find((s) => s.id === stubId)?.stubTypeName ?? stubId;
	}

	function formatReleased(value: number): string {
		return value > 0 ? String(value) : '-';
	}

	function scheduleDisplayLabel(): string {
		if (!schedule) return '';
		return deliveryScheduleLabel(schedule, schedule.date);
	}

	function thisScheduleTotalWeightMt(): string {
		let totalKg = 0;
		for (const entry of [...draftTowerEntries, ...draftStubEntries]) {
			for (const item of entry.lineItems) {
				if (item.thisRelease <= 0) continue;
				const setKg = setKgByBomId.get(item.bomId);
				if (setKg === undefined || !Number.isFinite(setKg)) continue;
				totalKg += setKg * item.thisRelease;
			}
		}
		if (totalKg <= 0) return '-';
		return (totalKg / 1000).toFixed(2);
	}

	function navigateToDeliverySchedule() {
		window.location.hash = `#/ProjectManagement/Home/${projectId}/DeliverySchedule/DeliverySchedules`;
	}

	function navigateToTowerTypes() {
		window.location.hash = `#/ProjectManagement/Home/${projectId}/Towers`;
	}

	function navigateToStubs() {
		window.location.hash = `#/ProjectManagement/Home/${projectId}/Stubs`;
	}

	async function persistLines(): Promise<ProjDeliveryScheduleLineRow[]> {
		if (!schedule) throw new Error('Delivery schedule not loaded');
		if (isDeliveryScheduleFrozen(schedule)) {
			throw new Error('Frozen delivery schedules cannot be edited.');
		}

		const allEntries = [...draftTowerEntries, ...draftStubEntries];
		const writes = flattenTowerEntriesToLineWrites(allEntries).map((line) => ({
			scheduleLineId: line.releaseLineId,
			bomId: line.bomId,
			quantity: line.quantity,
			unit: line.unit,
			description: line.description
		}));
		if (writes.some((line) => !line.bomId)) {
			throw new Error('Every delivery schedule line must reference a BOM.');
		}

		const published = await listPublishedCpByBomIds([...new Set(writes.map((line) => line.bomId))]);
		const stamped = writes.map((line) => ({
			...line,
			cpRunId: published.get(line.bomId)?.runId ?? null
		}));

		const savedLines = await saveDeliveryScheduleLines(scheduleId, stamped, persistedLines);
		persistedLines = savedLines;

		if (schedule.status !== 'Confirmed' && schedule.status !== 'Frozen') {
			const updated = await updateDeliverySchedule({
				scheduleId,
				status: 'confirmed',
				confirmedAt: new Date().toISOString(),
				sNo: schedule.sNo
			});
			schedule = { ...schedule, ...updated };
			upsertDeliveryScheduleBreadcrumb(schedule);
		}

		return savedLines;
	}

	async function handleNextFromTowers() {
		activeTab = 'stubs';
		await focusFirstReleaseInput();
	}

	async function handleSaveStubs() {
		if (!schedule) return;
		isSaving = true;
		try {
			await persistLines();
			pmPushSuccessToast({ title: 'Delivery schedule saved' });
			navigateToDeliverySchedule();
		} catch (error) {
			pmPushErrorToast({
				title: 'Failed to save delivery schedule',
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
		void handleSaveStubs();
	}

	const primaryActionLabel = $derived.by(() => {
		if (activeTab === 'towers') return 'Next';
		if (isSaving) return 'Saving...';
		return 'Save';
	});

	function handleCancel() {
		navigateToDeliverySchedule();
	}

	function isReleaseLineNode(node: TreeTableNode<ReleaseTreeData>): boolean {
		return Boolean(node.data?.bomId);
	}

	function findLineItem(
		node: TreeTableNode<ReleaseTreeData>,
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

	function applyLineItemThisRelease(
		node: TreeTableNode<ReleaseTreeData>,
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

	function updateLineItemThisRelease(
		node: TreeTableNode<ReleaseTreeData>,
		value: string,
		kind: ReleaseStructureKind
	) {
		const line = findLineItem(node, kind);
		if (!line) return;

		const previousQty = line.previousQty;
		applyLineItemThisRelease(node, value, kind);

		const qty = parseReleaseQty(value);
		const releaseQty = releasedQtyByBom.get(line.bomId) ?? 0;
		if (releaseQty > 0 && qty > releaseQty) {
			pendingQtyChange = {
				node,
				value,
				kind,
				previousQty,
				bomDescription: line.description,
				scheduleQty: qty,
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
			applyLineItemThisRelease(
				pendingQtyChange.node,
				String(pendingQtyChange.previousQty),
				pendingQtyChange.kind
			);
		}

		pendingQtyChange = null;
		exceedConfirmOpen = false;
	}

	function buildColumns(
		kind: ReleaseStructureKind,
		readOnly: boolean
	): TreeTableColumnDef<ReleaseTreeData>[] {
		void setKgByBomId;
		void draftTowerEntries;
		void draftStubEntries;
		void releasedQtyByBom;

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
								header: kind === 'stub' ? 'Stubs / BOMs' : 'Towers / BOMs',
								tree: true,
								sticky: true,
								class: 'min-w-[16rem]'
							}
						]
					}
				]
			},
			{
				key: 'this-schedule',
				header: scheduleDisplayLabel(),
				headerClass: 'text-center',
				columns: [
					{
						key: 'total-weight',
						header: thisScheduleTotalWeightMt(),
						headerClass: 'text-center',
						columns: [
							{
								key: 'qrcCount',
								header: 'QRC count',
								headerClass: 'text-center',
								class: 'text-center',
								value: (node) => node.data?.qrcCount ?? ''
							},
							{
								key: 'alreadyReleased',
								header: 'Already Released',
								headerClass: 'text-center',
								class: 'text-center',
								value: (node) => node.data?.alreadyReleased ?? ''
							},
							{
								key: 'thisRelease',
								header: 'Quantity (Set)',
								type: 'input',
								headerClass: 'text-center',
								class: 'text-center',
								align: 'center',
								inputType: 'number',
								min: 0,
								step: 1,
								autofocusFirst: !readOnly && (kind === 'tower' || kind === 'stub'),
								visible: isReleaseLineNode,
								disabled: readOnly,
								value: (node) => node.data?.thisRelease ?? '0',
								onValueChange: (node, value) => updateLineItemThisRelease(node, value, kind),
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
									const qty = parseReleaseQty(node.data?.thisRelease ?? '0');
									return formatWeightMt(setKgByBomId.get(bomId), qty);
								}
							}
						]
					}
				]
			}
		];
	}

	const towerColumns = $derived(buildColumns('tower', isScheduleFrozen));
	const stubColumns = $derived(buildColumns('stub', isScheduleFrozen));

	const towerEmptyState = $derived.by(() => {
		if (projectTowerTypes.length === 0) {
			return {
				icon: Layers,
				title: 'No towers configured',
				description: 'Create tower types before adding them to this delivery schedule.',
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
				description: 'Create stubs before adding them to this delivery schedule.',
				actionLabel: 'Go to Stubs',
				actionIcon: Plus,
				onAction: navigateToStubs
			};
		}
		return undefined;
	});
</script>

<div class="flex h-full min-h-0 flex-col gap-3 overflow-hidden p-4">
	{#if isScheduleFrozen}
		<Alert
			variant="info"
			title="Delivery schedule is frozen"
			description="Quantities cannot be changed after jobs have been published to machines."
		/>
	{/if}

	{#if isLoading || schedule}
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
						label="Back"
						variant="outline"
						size="sm"
						class="rounded-none"
						disabled={isSaving}
						onclick={handleCancel}
					/>
					{#if !isScheduleFrozen}
						<Button
							label={primaryActionLabel}
							variant="primary"
							size="sm"
							class="min-w-24 rounded-none"
							disabled={isSaving}
							onclick={handlePrimaryAction}
						/>
					{/if}
				</div>
			</div>
		{/if}

		{#if activeTab === 'towers'}
			<TreeTable
				class="min-h-0 flex-1"
				nodes={towerTreeNodes}
				columns={towerColumns}
				loading={isLoading}
				emptyState={towerEmptyState}
				bind:expandedIds={towerExpandedIds}
			/>
		{:else}
			<TreeTable
				class="min-h-0 flex-1"
				nodes={stubTreeNodes}
				columns={stubColumns}
				loading={isLoading}
				emptyState={stubEmptyState}
				bind:expandedIds={stubExpandedIds}
			/>
		{/if}
	{:else}
		<p class="text-gray-500">Delivery schedule not found.</p>
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
