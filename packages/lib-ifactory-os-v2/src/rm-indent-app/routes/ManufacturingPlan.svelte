<script lang="ts">
	import { onMount } from 'svelte';
	import { Component, FileText, Lock, Ticket, Warehouse } from '@lucide/svelte';
	import {
		Button,
		Combobox,
		Dialog,
		Label,
		TreeTable,
		collectExpandableIds,
		type ComboboxItem,
		type TreeTableColumn,
		type TreeTableNode
	} from '@ifactory/ui-v2';
	import { rmiPushToast } from '../lib/toast';
	import { formatApiErrorMessage } from '../../lib/api/types';
	import { loadProjectsForPlan, type RmiProjectRow } from '../lib/rmi-home.api';
	import { isPlanningShell, resolvePlanningAppData } from '../lib/planning-capabilities';

	let { params = {}, data }: { params?: Record<string, string>; data?: unknown } = $props();
	const planId = $derived(params.planId ? decodeURIComponent(params.planId) : '');
	const planning = $derived(resolvePlanningAppData(data));
	const showStockActions = $derived(!isPlanningShell(data));
	const projectActionLabel = $derived(
		planning.capabilities.canRaiseIndent && !planning.capabilities.canLock
			? 'Raise Indent'
			: 'Assign & Lock'
	);
	const projectActionIcon = $derived(
		planning.capabilities.canRaiseIndent && !planning.capabilities.canLock ? FileText : Lock
	);

	let isLoading = $state(true);
	let projectRows = $state<RmiProjectRow[]>([]);
	let expandedIds = $state<string[]>([]);
	let isUpdateStockOpen = $state(false);
	let selectedProjectId = $state('');

	type RowData = {
		kind: 'project' | 'schedule';
		project_id?: string;
		marking_weight_mt?: number | null;
		required_weight_mt?: number | null;
		weight_missing_label?: string | null;
		qty?: number;
		delivery_date?: string;
		status?: string;
	};

	function formatDate(iso: string | null | undefined): string {
		if (!iso) return '-';
		const d = new Date(iso);
		if (isNaN(d.getTime())) return '-';
		return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
	}

	function formatMarkingMt(rowData: RowData | undefined): string {
		if (!rowData || (rowData.kind !== 'project' && rowData.kind !== 'schedule')) return '';
		if (rowData.marking_weight_mt != null) return rowData.marking_weight_mt.toFixed(3);
		return '-';
	}

	function formatRequiredMt(rowData: RowData | undefined): string {
		if (!rowData || (rowData.kind !== 'project' && rowData.kind !== 'schedule')) return '';
		if (rowData.weight_missing_label) return rowData.weight_missing_label;
		if (rowData.required_weight_mt != null) return rowData.required_weight_mt.toFixed(3);
		return '-';
	}

	const projectComboboxItems = $derived.by((): ComboboxItem[] =>
		projectRows.map((project) => ({
			value: project.project_id,
			label: project.project_label
		}))
	);

	const nodes = $derived.by((): TreeTableNode<RowData>[] =>
		projectRows.map((project): TreeTableNode<RowData> => ({
			id: project.project_id,
			label: project.project_label,
			data: {
				kind: 'project',
				project_id: project.project_id,
				marking_weight_mt: project.marking_weight_mt,
				required_weight_mt: project.required_weight_mt,
				weight_missing_label: project.weight_missing_label,
				qty: project.delivery_schedules.reduce((sum, s) => sum + (s.qty ?? 0), 0)
			},
			children: project.delivery_schedules.map((s) => ({
				id: s.delivery_schedule_id,
				label: formatDate(s.delivery_date),
				data: {
					kind: 'schedule',
					qty: s.qty,
					marking_weight_mt: s.marking_weight_mt,
					required_weight_mt: s.required_weight_mt,
					weight_missing_label: s.weight_missing_label,
					delivery_date: s.delivery_date,
					status: s.status
				}
			}))
		}))
	);

	const columns = $derived.by((): TreeTableColumn<RowData>[] => [
		{
			key: 'label',
			header: 'Project / Delivery Schedule',
			tree: true,
			class: 'min-w-[20rem]'
		},
		{
			key: 'marking_weight_mt',
			header: 'Marking (MT)',
			value: (node) => formatMarkingMt(node.data)
		},
		{
			key: 'required_weight_mt',
			header: 'RM Required (MT)',
			value: (node) => formatRequiredMt(node.data)
		},
		{
			key: 'qty',
			header: 'Qty (sets)',
			value: (node) => {
				if (node.data?.kind === 'project') return node.data.qty ? String(node.data.qty) : '-';
				if (node.data?.kind === 'schedule') return String(node.data.qty ?? '-');
				return '';
			}
		},
		{
			key: 'status',
			header: 'Status',
			value: (node) => {
				if (node.data?.kind === 'schedule') return node.data.status ?? '-';
				return '';
			}
		},
		{
			key: 'actions',
			header: 'Actions',
			type: 'actions',
			actions: (node) => {
				if (node.data?.kind !== 'project' || !node.data.project_id) return [];
				const pid = node.data.project_id;
				const encPlan = encodeURIComponent(planId);
				const encProject = encodeURIComponent(pid);
				const actions = [
					{
						label: projectActionLabel,
						icon: projectActionIcon,
						variant: 'outline' as const,
						class: 'text-primary border-primary hover:bg-primary/10',
						size: 'sm' as const,
						onClick: () => {
							window.location.hash = `#/${planning.appName}/ManufacturingPlan/${encPlan}/GroupedAssignAndLock/${encProject}`;
						}
					}
				];
				if (planning.capabilities.canRaiseIndent) {
					actions.push({
						label: 'Indents',
						icon: Ticket,
						variant: 'outline',
						class: 'text-primary border-primary hover:bg-primary/10',
						size: 'sm',
						onClick: () => {
							window.location.hash = `#/${planning.appName}/ManufacturingPlan/${encPlan}/GroupedAssignAndLock/${encProject}/Indents`;
						}
					});
				}
				return actions;
			}
		}
	]);

	function openUpdateStockDialog() {
		selectedProjectId = projectRows[0]?.project_id ?? '';
		isUpdateStockOpen = true;
	}

	function closeUpdateStockDialog() {
		isUpdateStockOpen = false;
		selectedProjectId = '';
	}

	function handleProjectChange(value: string | string[]) {
		selectedProjectId = typeof value === 'string' ? value : (value[0] ?? '');
	}

	function confirmUpdateStock() {
		if (!selectedProjectId) {
			rmiPushToast({
				title: 'Project required',
				description: 'Select a project to open its stock register.'
			});
			return;
		}
		window.location.hash = `#/${planning.appName}/ManufacturingPlan/${encodeURIComponent(planId)}/StockRegister/${encodeURIComponent(selectedProjectId)}`;
		closeUpdateStockDialog();
	}

	onMount(() => {
		if (!planId) return;
		const controller = new AbortController();
		void (async () => {
			isLoading = true;
			try {
				projectRows = await loadProjectsForPlan(planId, controller.signal);
				expandedIds = collectExpandableIds(
					projectRows.map((p) => ({
						id: p.project_id,
						label: p.project_label,
						children: p.delivery_schedules.map((s) => ({
							id: s.delivery_schedule_id,
							label: s.delivery_schedule_id
						}))
					}))
				);
			} catch (error) {
				if (controller.signal.aborted) return;
				rmiPushToast({
					title: 'Failed to load projects',
					description: formatApiErrorMessage(error)
				});
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
			{nodes}
			{columns}
			bind:expandedIds
			loading={isLoading}
			search={{ enabled: true, placeholder: 'Search projects…' }}
			toolbarButton={showStockActions
				? {
						enabled: true,
						label: 'Update Stock',
						icon: Warehouse,
						onClick: openUpdateStockDialog
					}
				: { enabled: false, label: '' }}
			emptyState={{
				icon: Component,
				title: 'No projects',
				description: 'No projects are linked to this manufacturing plan.'
			}}
		/>
	</div>
</div>

{#if showStockActions}
	<Dialog
		bind:open={isUpdateStockOpen}
		title="Update Stock"
		hideFooter={true}
		onOpenChange={(open) => {
			if (!open) closeUpdateStockDialog();
		}}
	>
		<div class="space-y-4">
			<div class="space-y-2">
				<Label for="update-stock-project" text="Project" required />
				<Combobox
					id="update-stock-project"
					placeholder={projectComboboxItems.length === 0 ? 'No projects' : 'Select project'}
					items={projectComboboxItems}
					value={selectedProjectId}
					onValueChange={handleProjectChange}
					disabled={projectComboboxItems.length === 0}
				/>
			</div>
		</div>

		<div class="mt-8 flex w-full items-center justify-end gap-3 border-t border-border pt-6">
			<Button variant="outline" label="Cancel" onclick={closeUpdateStockDialog} />
			<Button
				variant="primary"
				label="Continue"
				disabled={!selectedProjectId}
				onclick={confirmUpdateStock}
			/>
		</div>
	</Dialog>
{/if}
