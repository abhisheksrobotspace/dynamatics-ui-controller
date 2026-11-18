<script lang="ts">
	import { onMount } from 'svelte';
	import {
		Button,
		ConfirmationDialog,
		DataTable,
		Tabs,
		type DataTableColumn,
		type TabItem
	} from '@ifactory/ui-v2';
	import { Edit2, Plus, Settings, Trash2 } from '@lucide/svelte';
	import type { LengthGroup, PlannerSettings, SectionRule } from '../lib/store.svelte.js';
	import { createPlannerSettingsDraft } from '../../cutting-plan-app/lib/cutting-plan/planner-settings';
	import {
		createSectionRule,
		deleteSectionRule,
		savePlannerSettings,
		updateSectionRule
	} from '../../cutting-plan-app/lib/cutting-plan/cp.api.js';
	import {
		createLengthGroup,
		deleteLengthGroup,
		loadLengthGroupsPageData,
		removeLengthGroupFromList,
		updateLengthGroup,
		upsertLengthGroupInList
	} from '../../cutting-plan-app/lib/cutting-plan/length-groups.repository.js';
	import {
		emptyLengthGroupDraft,
		formatLengthRange,
		type LengthGroupDraft
	} from '../../cutting-plan-app/lib/cutting-plan/length-groups.js';
	import { loadPlannerSettingsPageData } from '../../cutting-plan-app/lib/cutting-plan/load-planner-settings.js';
	import {
		loadSectionRulesPageData,
		removeSectionRuleFromList,
		upsertSectionRuleInList
	} from '../../cutting-plan-app/lib/cutting-plan/load-section-rules.js';
	import { emptyRuleDraft, type RuleDraft } from '../lib/section-rules/rule-draft';
	import {
		formatRuleCoversSections,
		formatRuleRange,
		formatRuleStockLengths,
		getProjectRuleIndex
	} from '../lib/section-rules/section-rule-display';
	import { formatApiErrorMessage } from '../../lib/api/types.js';
	import ApiErrorBanner from '../components/ApiErrorBanner.svelte';
	import LengthGroupDialog from '../../cutting-plan-app/components/LengthGroupDialog.svelte';
	import PlannerSettingsDialog from '../../cutting-plan-app/components/PlannerSettingsDialog.svelte';
	import SectionRuleDialog from '../components/SectionRuleDialog.svelte';
	import { showPageTopLoadErrors } from '../lib/show-page-top-load-errors.js';
	import { pmPushSuccessToast } from '../lib/toast.js';

	let { params } = $props();
	const projectId = $derived(params.projectId);
	let plannerSettings = $state<PlannerSettings | null>(null);
	let rules = $state<SectionRule[]>([]);
	let lengthGroups = $state<LengthGroup[]>([]);

	let isLoading = $state(true);
	let loadError = $state('');
	let saveError = $state('');

	let activeTab = $state('rules');
	const tabItems: TabItem[] = [
		{ label: 'Section rules', value: 'rules' },
		{ label: 'Length groups', value: 'groups' }
	];

	let isDialogOpen = $state(false);
	let isDeleteDialogOpen = $state(false);
	let editingId = $state<string | null>(null);
	let ruleToDelete = $state<string | null>(null);
	let draftRule = $state<RuleDraft>(emptyRuleDraft());

	let isGroupDialogOpen = $state(false);
	let isGroupDeleteDialogOpen = $state(false);
	let editingGroupId = $state<string | null>(null);
	let groupToDelete = $state<string | null>(null);
	let draftGroup = $state<LengthGroupDraft>(emptyLengthGroupDraft());

	let showSettingsDialog = $state(false);
	let editSettings = $state<PlannerSettings>(createPlannerSettingsDraft(''));

	function errorMessage(error: unknown): string {
		if (error instanceof DOMException && error.name === 'AbortError') return '';
		return formatApiErrorMessage(error);
	}

	onMount(() => {
		const controller = new AbortController();
		void (async () => {
			isLoading = true;
			loadError = '';
			try {
				const [loadedSettings, loadedRules, loadedGroups] = await Promise.all([
					loadPlannerSettingsPageData(projectId, controller.signal),
					loadSectionRulesPageData(projectId, controller.signal),
					loadLengthGroupsPageData(projectId, controller.signal)
				]);
				plannerSettings = loadedSettings;
				rules = loadedRules;
				lengthGroups = loadedGroups;
			} catch (error) {
				const message = errorMessage(error);
				if (message) loadError = message;
			} finally {
				isLoading = false;
			}
		})();
		return () => controller.abort();
	});

	function openSettings() {
		editSettings = createPlannerSettingsDraft(projectId, plannerSettings);
		showSettingsDialog = true;
	}

	async function confirmSettings() {
		saveError = '';
		try {
			const saved = await savePlannerSettings({ ...editSettings });
			plannerSettings = saved;
			showSettingsDialog = false;
			pmPushSuccessToast({ title: 'Planner settings saved' });
		} catch (error) {
			const message = errorMessage(error);
			if (message) saveError = message;
		}
	}

	function draftFromRule(rule: SectionRule): RuleDraft {
		return {
			fromFlg: rule.fromFlg ?? 0,
			toFlg: rule.toFlg ?? 0,
			fromThk: rule.fromThk ?? 0,
			toThk: rule.toThk ?? 0,
			minLength: rule.minLength ?? 0,
			maxLength: rule.maxLength ?? 0,
			endTrim: rule.endTrim ?? 0,
			pitch: rule.pitch ?? 0
		};
	}

	function openAddDialog() {
		editingId = null;
		draftRule = emptyRuleDraft();
		isDialogOpen = true;
	}

	function openEditDialog(rule: SectionRule) {
		editingId = rule.id;
		draftRule = draftFromRule(rule);
		isDialogOpen = true;
	}

	function openDeleteDialog(ruleId: string) {
		ruleToDelete = ruleId;
		isDeleteDialogOpen = true;
	}

	async function handleDeleteConfirm() {
		if (!ruleToDelete) return;
		const id = ruleToDelete;
		saveError = '';
		try {
			await deleteSectionRule(id);
			rules = removeSectionRuleFromList(rules, id);
			ruleToDelete = null;
			isDeleteDialogOpen = false;
			pmPushSuccessToast({ title: 'Section rule deleted' });
		} catch (error) {
			const message = errorMessage(error);
			if (message) saveError = message;
		}
	}

	async function handleSaveDialog() {
		const input: Omit<SectionRule, 'id' | 'projectId'> = { ...draftRule };
		const targetId = editingId;
		saveError = '';
		try {
			const saved = targetId
				? await updateSectionRule(targetId, input)
				: await createSectionRule(projectId, input, rules.length);
			rules = upsertSectionRuleInList(rules, saved);
			isDialogOpen = false;
			pmPushSuccessToast({
				title: targetId ? 'Section rule updated' : 'Section rule created'
			});
		} catch (error) {
			const message = errorMessage(error);
			if (message) saveError = message;
		}
	}

	function draftFromGroup(group: LengthGroup): LengthGroupDraft {
		return {
			name: group.name,
			minLength: group.minLength,
			maxLength: group.maxLength
		};
	}

	function openAddGroupDialog() {
		editingGroupId = null;
		draftGroup = emptyLengthGroupDraft();
		isGroupDialogOpen = true;
	}

	function openEditGroupDialog(group: LengthGroup) {
		editingGroupId = group.id;
		draftGroup = draftFromGroup(group);
		isGroupDialogOpen = true;
	}

	function openDeleteGroupDialog(groupId: string) {
		groupToDelete = groupId;
		isGroupDeleteDialogOpen = true;
	}

	async function handleDeleteGroupConfirm() {
		if (!groupToDelete) return;
		const id = groupToDelete;
		saveError = '';
		try {
			await deleteLengthGroup(id);
			lengthGroups = removeLengthGroupFromList(lengthGroups, id);
			groupToDelete = null;
			isGroupDeleteDialogOpen = false;
			pmPushSuccessToast({ title: 'Length group deleted' });
		} catch (error) {
			const message = errorMessage(error);
			if (message) saveError = message;
		}
	}

	async function handleSaveGroupDialog() {
		const input = {
			name: draftGroup.name.trim(),
			minLength: draftGroup.minLength,
			maxLength: draftGroup.maxLength
		};
		const targetId = editingGroupId;
		saveError = '';
		try {
			const saved = targetId
				? await updateLengthGroup(targetId, input)
				: await createLengthGroup(projectId, input, lengthGroups.length);
			lengthGroups = upsertLengthGroupInList(lengthGroups, saved).sort(
				(a, b) => a.sortOrder - b.sortOrder
			);
			isGroupDialogOpen = false;
			pmPushSuccessToast({
				title: targetId ? 'Length group updated' : 'Length group created'
			});
		} catch (error) {
			const message = errorMessage(error);
			if (message) saveError = message;
		}
	}

	const columns: DataTableColumn<SectionRule>[] = [
		{
			type: 'serial',
			key: 'index',
			header: 'S.No',
			sortable: true,
			filterable: true,
			dataType: 'number',
			value: (row) => String(getProjectRuleIndex(rules, projectId, row.id))
		},
		{
			key: 'flange',
			header: 'Flange (mm)',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => formatRuleRange(row.fromFlg, row.toFlg)
		},
		{
			key: 'thickness',
			header: 'Thickness (mm)',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => formatRuleRange(row.fromThk, row.toThk)
		},
		{
			key: 'coversSections',
			header: 'Covers sections',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => formatRuleCoversSections(row)
		},
		{
			key: 'stockLengths',
			header: 'Stock lengths (mm)',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => formatRuleStockLengths(row)
		},
		{
			key: 'endTrim',
			header: 'End trim',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => String(row.endTrim ?? '-')
		},
		{
			key: 'pitch',
			header: 'Pitch',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => String(row.pitch ?? '-')
		},
		{
			type: 'actions',
			key: 'actions',
			header: '',
			align: 'end',
			actions: (row) => [
				{
					type: 'button',
					icon: Edit2,
					variant: 'ghost',
					size: 'icon',
					onClick: () => openEditDialog(row)
				},
				{
					type: 'button',
					icon: Trash2,
					variant: 'ghost',
					size: 'icon',
					class: 'text-red-600 hover:text-red-700 hover:bg-red-50',
					onClick: () => openDeleteDialog(row.id)
				}
			]
		}
	];

	const groupColumns: DataTableColumn<LengthGroup>[] = [
		{
			type: 'serial',
			key: 'index',
			header: 'S.No',
			sortable: true,
			filterable: true,
			dataType: 'number',
			value: (row) => String(lengthGroups.findIndex((group) => group.id === row.id) + 1)
		},
		{
			key: 'name',
			header: 'Name',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => row.name
		},
		{
			key: 'minLength',
			header: 'Min length (mm)',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => String(row.minLength)
		},
		{
			key: 'maxLength',
			header: 'Max length (mm)',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => String(row.maxLength)
		},
		{
			key: 'range',
			header: 'Range',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => formatLengthRange(row.minLength, row.maxLength)
		},
		{
			type: 'actions',
			key: 'actions',
			header: '',
			align: 'end',
			actions: (row) => [
				{
					type: 'button',
					icon: Edit2,
					variant: 'ghost',
					size: 'icon',
					onClick: () => openEditGroupDialog(row)
				},
				{
					type: 'button',
					icon: Trash2,
					variant: 'ghost',
					size: 'icon',
					class: 'text-red-600 hover:text-red-700 hover:bg-red-50',
					onClick: () => openDeleteGroupDialog(row.id)
				}
			]
		}
	];
</script>

<div class="flex h-full min-h-0 flex-col gap-4 overflow-hidden p-4">
	{#if showPageTopLoadErrors && loadError}
		<ApiErrorBanner message={loadError} />
	{/if}
	{#if saveError}
		<ApiErrorBanner message={saveError} />
	{/if}

	<div class="flex shrink-0 flex-wrap items-center justify-between gap-3">
		<Tabs items={tabItems} bind:value={activeTab} variant="underline" mobileSelect={false} />
		<Button
			variant="outline"
			size="sm"
			class="rounded-none"
			icon={Settings}
			label="Planner Settings"
			onclick={openSettings}
		/>
	</div>

	{#if activeTab === 'rules'}
		<DataTable
			{columns}
			rows={rules}
			loading={isLoading}
			rowKey={(row) => row.id}
			export={{ enabled: false }}
			pagination={{ enabled: true }}
			sorting={{ enabled: false }}
			toolbarButton={{
				enabled: isLoading || rules.length > 0,
				label: 'Add Rule',
				icon: Plus,
				onClick: openAddDialog
			}}
			emptyState={{
				title: 'No rules yet',
				description: "Stock lengths can't be generated until at least one rule exists.",
				actionLabel: 'Add Rule',
				actionIcon: Plus,
				onAction: openAddDialog
			}}
		/>
	{:else}
		<DataTable
			columns={groupColumns}
			rows={lengthGroups}
			loading={isLoading}
			rowKey={(row) => row.id}
			export={{ enabled: false }}
			pagination={{ enabled: true }}
			sorting={{ enabled: false }}
			toolbarButton={{
				enabled: isLoading || lengthGroups.length > 0,
				label: 'Add Group',
				icon: Plus,
				onClick: openAddGroupDialog
			}}
			emptyState={{
				title: 'No length groups yet',
				description:
					'Define part-length ranges to split sections (e.g. Short / Long) before planning.',
				actionLabel: 'Add Group',
				actionIcon: Plus,
				onAction: openAddGroupDialog
			}}
		/>
	{/if}
</div>

<PlannerSettingsDialog
	bind:open={showSettingsDialog}
	bind:settings={editSettings}
	onConfirm={confirmSettings}
/>

<SectionRuleDialog
	bind:open={isDialogOpen}
	bind:draft={draftRule}
	editingRuleId={editingId}
	{rules}
	{projectId}
	onSave={handleSaveDialog}
/>

<LengthGroupDialog
	bind:open={isGroupDialogOpen}
	bind:draft={draftGroup}
	{editingGroupId}
	groups={lengthGroups}
	onSave={handleSaveGroupDialog}
/>

<ConfirmationDialog
	bind:open={isDeleteDialogOpen}
	title="Delete Rule"
	description="Are you sure you want to delete this rule? This action cannot be undone."
	confirmLabel="Delete"
	confirmVariant="danger"
	iconTone="danger"
	onConfirm={handleDeleteConfirm}
/>

<ConfirmationDialog
	bind:open={isGroupDeleteDialogOpen}
	title="Delete Length Group"
	description="Are you sure you want to delete this length group? This action cannot be undone."
	confirmLabel="Delete"
	confirmVariant="danger"
	iconTone="danger"
	onConfirm={handleDeleteGroupConfirm}
/>
