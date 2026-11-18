<script lang="ts">
	import { onMount, tick } from 'svelte';
	import type {
		ProjectRelease,
		ReleaseStructureKind,
		ReleaseTowerEntry,
		StubType,
		TowerType
	} from '../lib/store.svelte';
	import { loadReleasePageData } from '../lib/projects/load-release.js';
	import { saveReleaseLines } from '../lib/projects/releases.api.js';
	import type { ProjReleaseLineRow } from '../lib/projects/types.js';
	import { flattenTowerEntriesToLineWrites, parseReleaseQty } from '../lib/release.utils';
	import { formatWeightMt } from '../lib/projects/bom-set-weight.js';
	import { deliveryScheduleLabel } from '../lib/projects/delivery-schedule-label.js';
	import { formatApiErrorMessage } from '../../lib/api/types.js';
	import { pmPushErrorToast, pmPushSuccessToast } from '../lib/toast';
	import {
		Button,
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
		alreadyReleased?: string;
		thisRelease?: string;
	};

	let { params } = $props();
	const projectId = $derived(params.projectId);
	const releaseId = $derived(params.releaseId);

	let projectTowerTypes = $state<TowerType[]>([]);
	let projectStubTypes = $state<StubType[]>([]);
	let release = $state<ProjectRelease | null>(null);
	let persistedLines = $state<ProjReleaseLineRow[]>([]);
	let isLoading = $state(true);
	let isSaving = $state(false);

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

	onMount(() => {
		const controller = new AbortController();
		void (async () => {
			isLoading = true;
			try {
				const data = await loadReleasePageData(projectId, releaseId, controller.signal);
				release = data.release;
				projectTowerTypes = data.towers;
				projectStubTypes = data.stubs;
				persistedLines = data.persistedLines;
				draftTowerEntries = data.draftTowerEntries;
				draftStubEntries = data.draftStubEntries;
				setKgByBomId = data.setKgByBomId;
				initializeExpandedIds(data.draftTowerEntries, data.draftStubEntries);
			} catch (error) {
				if (!controller.signal.aborted) {
					pmPushToast({
						title: 'Failed to load release',
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

	function releaseDisplayLabel(): string {
		if (!release) return '';
		return deliveryScheduleLabel(release, release.date);
	}

	function thisReleaseTotalWeightMt(): string {
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

	function navigateToReleases() {
		window.location.hash = `#/ProjectManagement/Home/${projectId}/Releases`;
	}

	function navigateToTowerTypes() {
		window.location.hash = `#/ProjectManagement/Home/${projectId}/Towers`;
	}

	function navigateToStubs() {
		window.location.hash = `#/ProjectManagement/Home/${projectId}/Stubs`;
	}

	async function persistLines(): Promise<ProjReleaseLineRow[]> {
		if (!release) throw new Error('Release not loaded');

		const allEntries = [...draftTowerEntries, ...draftStubEntries];
		const writes = flattenTowerEntriesToLineWrites(allEntries);
		if (writes.some((line) => !line.bomId)) {
			throw new Error('Every release line must reference a BOM.');
		}

		const savedLines = await saveReleaseLines(releaseId, writes, persistedLines);
		persistedLines = savedLines;
		return savedLines;
	}

	async function handleNextFromTowers() {
		activeTab = 'stubs';
		await focusFirstReleaseInput();
	}

	async function handleSaveStubs() {
		if (!release) return;
		isSaving = true;
		try {
			await persistLines();
			pmPushSuccessToast({ title: 'Release saved' });
			navigateToReleases();
		} catch (error) {
			pmPushErrorToast({
				title: 'Failed to save release',
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
		navigateToReleases();
	}

	function isReleaseLineNode(node: TreeTableNode<ReleaseTreeData>): boolean {
		return Boolean(node.data?.bomId);
	}

	function updateLineItemThisRelease(
		node: TreeTableNode<ReleaseTreeData>,
		value: string,
		kind: ReleaseStructureKind
	) {
		if (!isReleaseLineNode(node)) return;

		const entryId = node.data?.entryId;
		if (!entryId) return;

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

	function buildColumns(kind: ReleaseStructureKind): TreeTableColumnDef<ReleaseTreeData>[] {
		void setKgByBomId;
		void draftTowerEntries;
		void draftStubEntries;

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
				key: 'this-release',
				header: releaseDisplayLabel(),
				headerClass: 'text-center',
				columns: [
					{
						key: 'total-weight',
						header: thisReleaseTotalWeightMt(),
						headerClass: 'text-center',
						columns: [
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
								autofocusFirst: kind === 'tower' || kind === 'stub',
								visible: isReleaseLineNode,
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

	const towerColumns = $derived(buildColumns('tower'));
	const stubColumns = $derived(buildColumns('stub'));

	const towerEmptyState = $derived.by(() => {
		if (projectTowerTypes.length === 0) {
			return {
				icon: Layers,
				title: 'No towers configured',
				description: 'Create tower types before adding them to this release.',
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
				description: 'Create stubs before adding them to this release.',
				actionLabel: 'Go to Stubs',
				actionIcon: Plus,
				onAction: navigateToStubs
			};
		}
		return undefined;
	});
</script>

<div class="flex h-full min-h-0 flex-col gap-3 overflow-hidden p-4">
	{#if isLoading || release}
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
		<p class="text-gray-500">Release not found.</p>
	{/if}
</div>
