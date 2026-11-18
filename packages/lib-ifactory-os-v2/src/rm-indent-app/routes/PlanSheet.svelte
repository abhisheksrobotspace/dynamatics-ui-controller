<script lang="ts">
	import {
		Button,
		Combobox,
		Dialog,
		Label,
		type ComboboxItem,
		type TreeTableToolbarButtonConfig
	} from '@ifactory/ui-v2';
	import { FileText } from '@lucide/svelte';
	import PlanningSheet from '../../central-planning-app/routes/PlanningSheet.svelte';
	import {
		formatMonthLabel,
		loadFuturePlanningSheetTree
	} from '../../central-planning-app/lib/planning-sheet.load';
	import {
		getPlanningSheetPlan,
		loadPlanningSheetPlan
	} from '../../central-planning-app/lib/planning-sheet.store';
	import { collectCpRaiseIndentSelection } from '../../central-planning-app/lib/cp-raise-indent';
	import { stashCreateIndentFromPlan } from '../lib/indent-routes';
	import { rmiPushToast } from '../lib/toast';
	import { app } from '../app.svelte';

	let { params = {}, data }: { params?: Record<string, string>; data?: unknown } = $props();

	const planId = $derived(params.planId ? decodeURIComponent(params.planId) : '');
	const plan = $derived(planId ? getPlanningSheetPlan(planId) : undefined);

	let isRaiseOpen = $state(false);
	let isRaiseLoading = $state(false);
	let selectedProjectId = $state('');
	let selectedMonth = $state('');
	let projectItems = $state<ComboboxItem[]>([]);

	const monthItems = $derived.by((): ComboboxItem[] =>
		(plan?.draft.months ?? []).map((month) => ({
			value: month,
			label: formatMonthLabel(month)
		}))
	);

	const canContinue = $derived(Boolean(selectedProjectId && selectedMonth));

	const raiseToolbarButtons = $derived.by((): TreeTableToolbarButtonConfig[] => [
		{
			enabled: true,
			label: 'Raise Indent',
			icon: FileText,
			variant: 'primary',
			disabled: !planId || isRaiseLoading,
			onClick: () => void openRaiseDialog()
		}
	]);

	async function openRaiseDialog() {
		if (!planId) {
			rmiPushToast({
				title: 'Plan not available',
				description: 'Select a Central Planning plan.'
			});
			return;
		}

		isRaiseLoading = true;
		try {
			// Prefer cache filled by nested PlanningSheet; fetch only if still cold.
			const current = getPlanningSheetPlan(planId) ?? (await loadPlanningSheetPlan(planId));
			if (!current) {
				rmiPushToast({
					title: 'Plan not available',
					description: 'Select a Central Planning plan.'
				});
				return;
			}

			const loaded = await loadFuturePlanningSheetTree(current.plantId);
			const labels: Record<string, string> = {};
			const walk = (nodes: typeof loaded.nodes) => {
				for (const node of nodes) {
					if (node.data?.kind === 'project') {
						labels[node.data.projectId] = node.label;
					}
					if (node.children?.length) walk(node.children);
				}
			};
			walk(loaded.nodes);

			const allProjects: Record<string, true> = {};
			for (const month of current.draft.months) {
				const scoped = collectCpRaiseIndentSelection(loaded.nodes, current.draft, month);
				for (const id of scoped.projectIds) allProjects[id] = true;
			}
			projectItems = Object.keys(allProjects).map((id) => ({
				value: id,
				label: labels[id] ?? id
			}));
			selectedMonth = current.draft.months[0] ?? '';
			selectedProjectId = projectItems[0]?.value ?? '';
			isRaiseOpen = true;
		} catch {
			projectItems = [];
			rmiPushToast({
				title: 'Could not prepare Raise Indent',
				description: 'Failed to load projects for this plan.'
			});
		} finally {
			isRaiseLoading = false;
		}
	}

	function confirmRaise() {
		if (!planId || !selectedProjectId || !selectedMonth) return;
		stashCreateIndentFromPlan({
			planId,
			month: selectedMonth,
			projectId: selectedProjectId
		});
		isRaiseOpen = false;
		window.location.hash = `#/${app.appName}/Indents/Select`;
	}
</script>

<div class="flex h-full min-h-0 flex-col overflow-hidden">
	<div class="min-h-0 flex-1">
		<PlanningSheet {params} {data} readOnly={true} extraToolbarButtons={raiseToolbarButtons} />
	</div>
</div>

<Dialog
	bind:open={isRaiseOpen}
	title="Raise Indent"
	hideFooter={true}
	onOpenChange={(open) => {
		if (!open) isRaiseOpen = false;
	}}
>
	<div class="space-y-4">
		<div class="space-y-2">
			<Label text="Project" required />
			<Combobox
				items={projectItems}
				value={selectedProjectId}
				onValueChange={(value) => {
					selectedProjectId = typeof value === 'string' ? value : (value[0] ?? '');
				}}
				placeholder={projectItems.length === 0 ? 'No projects in plan' : 'Select project'}
				disabled={projectItems.length === 0}
			/>
		</div>
		<div class="space-y-2">
			<Label text="Month" required />
			<Combobox
				items={monthItems}
				value={selectedMonth}
				onValueChange={(value) => {
					selectedMonth = typeof value === 'string' ? value : (value[0] ?? '');
				}}
				placeholder="Select month"
				disabled={monthItems.length === 0}
			/>
		</div>
	</div>
	<div class="mt-8 flex w-full items-center justify-end gap-3 border-t border-border pt-6">
		<Button variant="outline" label="Cancel" onclick={() => (isRaiseOpen = false)} />
		<Button variant="primary" label="Continue" disabled={!canContinue} onclick={confirmRaise} />
	</div>
</Dialog>
