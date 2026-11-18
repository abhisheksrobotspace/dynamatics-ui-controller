<script lang="ts">
	import { onMount } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import {
		collectExpandableIds,
		TreeTable,
		type TreeTableColumnDef,
		type TreeTableNode,
		type TreeTableToolbarButtonConfig
	} from '@ifactory/ui-v2';
	import { Link2 } from '@lucide/svelte';
	import { formatApiErrorMessage } from '../../lib/api/types';
	import { resolveDefaultPlanningPlantId } from '../../central-planning-app/lib/planning-plant';
	import type { PlanningSheetRowData } from '../../central-planning-app/lib/planning-sheet.types';
	import { rmiPushToast } from '../lib/toast';
	import {
		collectStockAssignmentBomMetas,
		currentStockAssignmentMonthKey,
		loadStockAssignmentHomeTree,
		totalTonnageMt
	} from '../lib/stock-assignment.load';
	import {
		stashStockAssignmentScope,
		type StockAssignmentProjectScope
	} from '../lib/stock-assignment.scope';
	import { app } from '../app.svelte';

	let selectedIds = $state<string[]>([]);
	let treeNodes = $state<TreeTableNode<PlanningSheetRowData>[]>([]);
	let expandedIds = $state<string[]>([]);
	let isLoading = $state(true);
	let plantId = $state('');
	let month = $state(currentStockAssignmentMonthKey());

	const totalMt = $derived(totalTonnageMt(treeNodes));
	const totalTonnageValue = $derived(totalMt > 0 ? `${totalMt.toFixed(3)} MT` : '—');

	const columns = $derived.by((): TreeTableColumnDef<PlanningSheetRowData>[] => [
		{
			key: 'name-corner',
			header: 'Total Tonnage (MT)',
			headerClass: 'text-left',
			columns: [
				{
					key: 'label',
					header: 'Projects / DS / TT / BOM',
					tree: true,
					sticky: true,
					class: 'w-[22rem] min-w-[18rem] max-w-[28rem] overflow-hidden'
				}
			]
		},
		{
			key: 'totals',
			header: totalTonnageValue,
			headerClass: 'text-center',
			columns: [
				{
					key: 'qty',
					header: 'Quantity (Set)',
					headerClass: 'text-center',
					class: 'text-center tabular-nums',
					value: (node) => String(node.data?.qtySets ?? 0)
				},
				{
					key: 'weight',
					header: 'Weight (MT)',
					headerClass: 'text-center',
					class: 'text-center tabular-nums',
					value: (node) =>
						node.data?.qtyMt != null && Number.isFinite(node.data.qtyMt)
							? node.data.qtyMt.toFixed(3)
							: '-'
				}
			]
		}
	]);

	const toolbarButtons = $derived.by((): TreeTableToolbarButtonConfig[] => [
		{
			enabled: true,
			label: selectedIds.length > 0 ? `Assign (${selectedIds.length})` : 'Assign',
			icon: Link2,
			variant: 'primary',
			disabled: selectedIds.length === 0 || isLoading,
			onClick: () => confirmAssign()
		}
	]);

	function confirmAssign() {
		const metas = collectStockAssignmentBomMetas(selectedIds, treeNodes);
		const byProject = new SvelteMap<string, StockAssignmentProjectScope>();
		for (const meta of metas) {
			let entry = byProject.get(meta.projectId);
			if (!entry) {
				entry = {
					projectId: meta.projectId,
					projectLabel: meta.projectLabel,
					deliveryScheduleIds: [],
					bomIds: []
				};
				byProject.set(meta.projectId, entry);
			}
			if (!entry.deliveryScheduleIds.includes(meta.scheduleId)) {
				entry.deliveryScheduleIds.push(meta.scheduleId);
			}
			if (!entry.bomIds.includes(meta.bomId)) entry.bomIds.push(meta.bomId);
		}

		const projects = [...byProject.values()];
		if (projects.length === 0) {
			rmiPushToast({
				title: 'Nothing to assign',
				description: 'Select a project, schedule, tower, or subtype with quantity.'
			});
			return;
		}

		stashStockAssignmentScope({ plantId, months: [month], projects });
		window.location.hash = `#/${app.appName}/StockAssignment/Lock`;
	}

	onMount(() => {
		const controller = new AbortController();
		void (async () => {
			isLoading = true;
			try {
				month = currentStockAssignmentMonthKey();
				plantId = await resolveDefaultPlanningPlantId(controller.signal);
				const nodes = await loadStockAssignmentHomeTree(month, controller.signal);
				if (controller.signal.aborted) return;
				treeNodes = nodes;
				expandedIds = collectExpandableIds(treeNodes);
			} catch (error) {
				if (controller.signal.aborted) return;
				rmiPushToast({
					title: 'Could not load stock assignment',
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
	<div class="min-h-0 flex-1">
		<TreeTable
			{columns}
			nodes={treeNodes}
			bind:expandedIds
			bind:selectedIds
			loading={isLoading}
			stickyHeader
			selection={{ enabled: true, mode: 'multiple' }}
			search={{ enabled: true, placeholder: 'Search projects, schedules, towers, BOMs…' }}
			toolbarButton={toolbarButtons}
			emptyState={{
				title: 'No delivery schedules this month',
				description: 'Draft, confirmed, or frozen schedules dated in the current month appear here.'
			}}
		/>
	</div>
</div>
