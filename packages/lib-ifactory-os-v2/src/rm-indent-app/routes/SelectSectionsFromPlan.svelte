<script lang="ts">
	import { onMount } from 'svelte';
	import {
		collectExpandableIds,
		TreeTable,
		type TreeTableColumn,
		type TreeTableNode
	} from '@ifactory/ui-v2';
	import { FileText } from '@lucide/svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import { formatApiErrorMessage } from '../../lib/api/types';
	import {
		loadPlanMonthAssignTree,
		type PlanMonthAssignTree
	} from '../../central-planning-app/lib/cp-create-indent-from-plan';
	import { formatMonthLabel } from '../../central-planning-app/lib/planning-sheet.load';
	import { getPlanningSheetPlan } from '../../central-planning-app/lib/planning-sheet.store';
	import type { AssignLockTreeData } from '../lib/assign-and-lock.tree';
	import { formatWeightMt } from '../lib/inv-views.api';
	import { readCreateIndentFromPlan, stashCreateIndentSelection } from '../lib/indent-routes';
	import { rmiPushToast } from '../lib/toast';
	import { app } from '../app.svelte';

	type TreeData = AssignLockTreeData & { projectId?: string; projectLabel?: string };

	let isLoading = $state(true);
	let planLabel = $state('-');
	let monthLabel = $state('-');
	let planId = $state('');
	let month = $state('');
	let projectIdFilter = $state('');
	let treeNodes = $state<TreeTableNode<TreeData>[]>([]);
	let expandedIds = $state<string[]>([]);
	let selectedIds = $state<string[]>([]);
	let leafIndex = $state<PlanMonthAssignTree['leafIndex']>(new Map());

	function procureQty(nodeId: string): number {
		return leafIndex.get(nodeId)?.group.procureQty ?? 0;
	}

	const selectedCount = $derived(selectedIds.filter((id) => procureQty(id) > 0).length);

	const rowActionClass = 'text-primary border-primary hover:bg-primary/10';

	function continueToCreate(nodeIds?: string[]) {
		const ids = nodeIds?.length ? nodeIds : selectedIds;
		const byProject = new SvelteMap<
			string,
			{ projectId: string; projectLabel: string; rowKeys: string[] }
		>();
		for (const id of ids) {
			const entry = leafIndex.get(id);
			if (!entry || entry.group.procureQty <= 0) continue;
			let bucket = byProject.get(entry.projectId);
			if (!bucket) {
				bucket = {
					projectId: entry.projectId,
					projectLabel: entry.projectLabel,
					rowKeys: []
				};
				byProject.set(entry.projectId, bucket);
			}
			bucket.rowKeys.push(entry.group.groupKey);
		}
		const selections = [...byProject.values()].filter((entry) => entry.rowKeys.length > 0);
		if (selections.length === 0) {
			rmiPushToast({
				title: 'Nothing selected',
				description: 'Select sections with remaining quantity to procure.'
			});
			return;
		}
		stashCreateIndentSelection({
			planId,
			month,
			byProject: selections
		});
		window.location.hash = `#/${app.appName}/Indents/Create`;
	}

	const columns = $derived.by((): TreeTableColumn<TreeData>[] => [
		{
			key: 'label',
			header: 'Project / DS / Tower / BOM / Section',
			tree: true,
			sticky: true,
			class: '!w-[16rem] min-w-[12rem] max-w-[16rem] overflow-hidden font-medium',
			headerClass: 'truncate'
		},
		{
			key: 'lengthLabel',
			header: 'Length',
			headerClass: 'text-center',
			class: 'text-center tabular-nums',
			value: (node) => node.data?.group?.lengthLabel ?? ''
		},
		{
			key: 'requiredQty',
			header: 'Required (pcs)',
			headerClass: 'text-center',
			class: 'text-center tabular-nums',
			value: (node) =>
				node.data?.requiredQty != null && node.data.requiredQty > 0
					? String(node.data.requiredQty)
					: ''
		},
		{
			key: 'requiredWeightKg',
			header: 'Required (MT)',
			headerClass: 'text-center',
			class: 'text-center tabular-nums',
			value: (node) =>
				node.data?.requiredWeightKg != null ? formatWeightMt(node.data.requiredWeightKg) : ''
		},
		{
			key: 'remaining',
			header: 'Remaining (pcs)',
			headerClass: 'text-center',
			class: 'text-center tabular-nums',
			value: (node) => {
				if (node.data?.kind !== 'section-length') return '';
				return String(node.data.group?.remainingQty ?? 0);
			}
		},
		{
			key: 'toProcure',
			header: 'To Procure (pcs)',
			headerClass: 'text-center',
			class: 'text-center tabular-nums font-semibold text-primary',
			value: (node) => {
				if (node.data?.kind !== 'section-length') return '';
				return String(node.data.group?.procureQty ?? 0);
			}
		},
		{
			key: 'toProcureMt',
			header: 'To Procure (MT)',
			headerClass: 'text-center',
			class: 'text-center tabular-nums font-semibold text-primary',
			value: (node) => {
				if (node.data?.kind !== 'section-length') return '';
				const kg = node.data.group?.procureWeightKg;
				return kg != null ? formatWeightMt(kg) : '';
			}
		},
		{
			type: 'actions',
			key: 'actions',
			header: '',
			actions: (node) => {
				if (node.data?.kind !== 'section-length' || !node.data.group) return [];
				if ((node.data.group?.procureQty ?? 0) <= 0) return [];
				return [
					{
						label: 'Raise Indent',
						icon: FileText,
						variant: 'outline',
						size: 'sm',
						class: rowActionClass,
						onClick: () => continueToCreate([node.id])
					}
				];
			}
		}
	]);

	onMount(() => {
		const controller = new AbortController();
		void (async () => {
			isLoading = true;
			try {
				const scope = readCreateIndentFromPlan();
				if (!scope) {
					rmiPushToast({
						title: 'Nothing to create',
						description: 'Choose a project and month from a published plan first.'
					});
					window.location.hash = `#/${app.appName}/Plans`;
					return;
				}
				planId = scope.planId;
				month = scope.month;
				projectIdFilter = scope.projectId ?? '';
				planLabel = getPlanningSheetPlan(planId)?.label ?? planId;
				monthLabel = formatMonthLabel(month);
				const loaded = await loadPlanMonthAssignTree(
					planId,
					month,
					controller.signal,
					projectIdFilter || undefined
				);
				if (controller.signal.aborted) return;

				treeNodes = loaded.nodes;
				leafIndex = loaded.leafIndex;
				expandedIds = collectExpandableIds(loaded.nodes);
				if (loaded.nodes.length === 0) {
					rmiPushToast({
						title: 'Nothing to indent',
						description: `No allocated BOMs for ${monthLabel} in this plan.`
					});
				}
			} catch (error) {
				if (controller.signal.aborted) return;
				rmiPushToast({
					title: 'Failed to load sections',
					description: formatApiErrorMessage(error)
				});
				treeNodes = [];
			} finally {
				if (!controller.signal.aborted) isLoading = false;
			}
		})();
		return () => controller.abort();
	});
</script>

<div class="flex h-full min-h-0 flex-col overflow-hidden p-3 md:p-4">
	<div class="mb-3 shrink-0 text-sm text-muted-foreground">
		{planLabel} · {monthLabel}{#if projectIdFilter}
			· project scoped{/if}
	</div>
	<div class="min-h-0 flex-1">
		<TreeTable
			{columns}
			nodes={treeNodes}
			bind:expandedIds
			bind:selectedIds
			loading={isLoading}
			stickyHeader
			search={{ enabled: true, placeholder: 'Search projects, schedules, towers, BOMs, sections…' }}
			selection={{ enabled: true, mode: 'multiple' }}
			toolbarButton={{
				enabled: true,
				label: selectedCount > 0 ? `Raise Indent (${selectedCount})` : 'Raise Indent',
				icon: FileText,
				disabled: isLoading || selectedCount === 0,
				onClick: () => continueToCreate()
			}}
			emptyState={{
				title: 'No sections for this month',
				description: 'Allocate BOMs in the plan month and publish a cutting plan for those BOMs.'
			}}
		/>
	</div>
</div>
