<script lang="ts">
	import { onMount } from 'svelte';
	import { Alert, Button, DataTable, Dialog, type DataTableColumn } from '@ifactory/ui-v2';
	import { AlertCircle, FileText } from '@lucide/svelte';
	import AppBusyOverlay from '../../lib/appShell/AppBusyOverlay.svelte';
	import { resolvePlantIdForAssign } from '../lib/assign-and-lock.detail';
	import { listPlanLockSummary, planLockRowsForCentralPlan } from '../lib/inv-views.api';
	import {
		assembleIndentDraft,
		saveIndentDocument,
		type IndentMatrixLine
	} from '../lib/indents.api';
	import {
		clearGenerateIndent,
		indentLineMatchesRow,
		readGenerateIndent,
		setIndentLabel
	} from '../lib/indent-routes';
	import { rmiPushToast, rmiPushBuildIndentWarnings } from '../lib/toast';
	import { formatApiErrorMessage } from '../../lib/api/types';
	import { num } from '../lib/inv.num';
	import { app } from '../app.svelte';

	type SummaryRow = {
		id: string;
		itemId: string;
		section: string;
		lengthMm: number;
		lengthLabel: string;
		requiredQty: number;
		availableQty: number;
		lockedQty: number;
		toProcure: number;
		unresolved: boolean;
	};

	let isLoading = $state(true);
	let isSaving = $state(false);
	let isUnlockableStockDialogOpen = $state(false);

	let planId = $state('');
	let projectId = $state('');
	let batchName = $state('');
	let plantId = $state('');
	let summaryRows = $state<SummaryRow[]>([]);
	let selectedRowKeys = $state<string[]>([]);

	const selectedRows = $derived(summaryRows.filter((row) => selectedRowKeys.includes(row.id)));

	const toProcureSelected = $derived(selectedRows.reduce((sum, row) => sum + row.toProcure, 0));

	function unlockableStockPcs(row: SummaryRow): number {
		if (row.availableQty <= 0 || row.lockedQty >= row.requiredQty) return 0;
		return Math.min(row.availableQty, row.requiredQty - row.lockedQty);
	}

	const rowsWithUnlockableStock = $derived(
		selectedRows.filter((row) => unlockableStockPcs(row) > 0)
	);
	const totalUnlockableStock = $derived(
		rowsWithUnlockableStock.reduce((sum, row) => sum + unlockableStockPcs(row), 0)
	);

	const reviewColumns: DataTableColumn<SummaryRow>[] = [
		{
			type: 'serial',
			key: 'sNo',
			header: 'S.No',
			sortable: true,
			filterable: true,
			dataType: 'number',
			value: (row) => {
				const index = summaryRows.indexOf(row);
				return String(index >= 0 ? index + 1 : '');
			}
		},
		{
			type: 'text',
			key: 'section',
			header: 'Section',
			sortable: true,
			filterable: true,
			dataType: 'string',
			class: 'font-medium',
			value: (row) => row.section
		},
		{
			type: 'text',
			key: 'lengthLabel',
			header: 'Length',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => row.lengthLabel
		},
		{
			type: 'text',
			key: 'requiredQty',
			header: 'Required (pcs)',
			sortable: true,
			dataType: 'number',
			value: (row) => String(row.requiredQty)
		},
		{
			type: 'text',
			key: 'availableQty',
			header: 'Available',
			sortable: true,
			dataType: 'number',
			value: (row) => String(row.availableQty)
		},
		{
			type: 'text',
			key: 'lockedQty',
			header: 'Locked',
			sortable: true,
			dataType: 'number',
			value: (row) => String(row.lockedQty)
		},
		{
			type: 'text',
			key: 'toProcure',
			header: 'To Procure',
			sortable: true,
			dataType: 'number',
			class: 'font-semibold text-primary',
			value: (row) => String(row.toProcure)
		}
	];

	async function loadReview(mfgPlanRef: string, pid: string, signal?: AbortSignal) {
		const [rows, nextPlantId] = await Promise.all([
			listPlanLockSummary({ projectId: pid, signal }),
			// ponytail: plant is optional; build_indent resolves it (explicit > locks > DS)
			resolvePlantIdForAssign({ projectId: pid, signal }).catch(() => '')
		]);

		plantId = nextPlantId;

		summaryRows = planLockRowsForCentralPlan(rows, mfgPlanRef)
			.map((row) => {
				const requiredQty = row.required_qty_base;
				const lockedQty = row.locked_qty_base;
				const availableQty = row.free_qty_base;
				return {
					id: row.row_key || `${row.item_id ?? row.section}|${row.length_mm}`,
					itemId: row.item_id ?? '',
					section: row.section || '-',
					lengthMm: row.length_mm,
					lengthLabel: row.length_mm > 0 ? `${row.length_mm.toLocaleString('en-US')} mm` : '-',
					requiredQty,
					availableQty,
					lockedQty,
					toProcure: Math.max(0, requiredQty - lockedQty),
					unresolved: row.unresolved
				};
			})
			.sort((a, b) => a.section.localeCompare(b.section) || a.lengthMm - b.lengthMm);

		selectedRowKeys = [];

		if (summaryRows.length === 0) {
			rmiPushToast({
				title: 'No section requirements',
				description:
					'No delivery-schedule lines with a completed cutting plan for this manufacturing plan / project.'
			});
		}
	}

	function requestCreateIndent() {
		if (selectedRows.length === 0) {
			rmiPushToast({
				title: 'Nothing selected',
				description: 'Select at least one section to include in the indent.'
			});
			return;
		}
		if (rowsWithUnlockableStock.length > 0) {
			isUnlockableStockDialogOpen = true;
			return;
		}
		void handleCreateIndent();
	}

	async function handleCreateIndent() {
		if (!planId || !projectId || isSaving || selectedRows.length === 0) {
			return;
		}
		isSaving = true;
		isUnlockableStockDialogOpen = false;
		try {
			const draft = await assembleIndentDraft({
				projectId,
				month: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`,
				rows: selectedRowKeys,
				centralPlanId: planId,
				plantId: plantId || undefined,
				batchName: batchName.trim() || 'Indent batch',
				excessPct: 0,
				createdBy: 'ui'
			});
			rmiPushBuildIndentWarnings(draft.warnings);

			const filteredLines: IndentMatrixLine[] = draft.lines
				.filter((line) => selectedRows.some((row) => indentLineMatchesRow(line, row)))
				.map((line) => ({
					...line,
					procure_edit: Math.max(0, num(line.procure_qty_base)),
					locked_qty_base: num(line.locked_qty_base),
					carried_shortfall_base: 0
				}));

			if (filteredLines.length === 0) {
				rmiPushToast({
					title: 'No matching lines',
					description: 'No indent matrix line found for the selected sections.'
				});
				return;
			}

			const { indent_id, indent_no, revision } = await saveIndentDocument({
				draft,
				matrixLines: filteredLines,
				createdBy: 'ui'
			});

			clearGenerateIndent();
			const label = `#${indent_no} - R${revision}`;
			setIndentLabel(indent_id, label);
			rmiPushToast({ title: 'Indent created', description: label });
			window.location.hash = `#/${app.appName}/Indents/${encodeURIComponent(indent_id)}`;
		} catch (error) {
			rmiPushToast({ title: 'Failed to create indent', description: formatApiErrorMessage(error) });
		} finally {
			isSaving = false;
		}
	}

	onMount(() => {
		const stash = readGenerateIndent();
		if (!stash) {
			window.location.hash = `#/${app.appName}/Indents`;
			return;
		}
		planId = stash.planId;
		projectId = stash.projectId;
		batchName = stash.batchName ?? '';

		const controller = new AbortController();
		void loadReview(stash.planId, stash.projectId, controller.signal)
			.catch((error) => {
				if (controller.signal.aborted) return;
				rmiPushToast({
					title: 'Failed to load sections',
					description: formatApiErrorMessage(error)
				});
			})
			.finally(() => {
				if (!controller.signal.aborted) isLoading = false;
			});
		return () => controller.abort();
	});
</script>

<div class="flex h-full min-h-0 flex-col overflow-hidden p-3 md:p-4">
	<div class="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
		<div class="flex min-h-0 flex-1 flex-col overflow-hidden">
			<DataTable
				class="min-h-0 flex-1"
				columns={reviewColumns}
				rows={summaryRows}
				loading={isLoading}
				rowKey={(row) => row.id}
				pagination={{ enabled: false }}
				selection={{ enabled: true, mode: 'multiple' }}
				bind:selectedRowKeys
				search={{ enabled: true, placeholder: 'Search sections…' }}
				export={{ enabled: false }}
				toolbarButton={{ enabled: false, label: '' }}
				emptyState={{
					icon: AlertCircle,
					title: 'No section requirements found',
					description: 'No section requirements found for this project.'
				}}
				rowClass={(r) =>
					r.unresolved
						? 'bg-muted/40 text-muted-foreground opacity-70'
						: r.availableQty < 1
							? 'bg-status-error/5'
							: ''}
			/>
		</div>

		{#if !isLoading && rowsWithUnlockableStock.length > 0}
			<Alert
				variant="warning"
				accentBorder
				title="Available bars not locked"
				description="{totalUnlockableStock} pcs of stock are available but not yet locked on the selected rows. Lock them first to reduce the indent quantity, or proceed anyway."
			/>
		{/if}

		<div
			class="flex shrink-0 items-center justify-between gap-4 rounded-lg border border-border bg-white p-4 shadow-sm"
		>
			<div class="text-sm text-muted-foreground">
				{#if isLoading}
					Loading section requirements…
				{:else if selectedRows.length === 0}
					Select sections to include in the indent.
				{:else}
					Creating indent for
					<span class="font-medium text-foreground">{toProcureSelected} pcs</span>
					to procure across {selectedRows.length} section{selectedRows.length === 1 ? '' : 's'}.
				{/if}
			</div>
			<Button
				variant="primary"
				icon={FileText}
				label={isSaving ? 'Creating…' : 'Create Indent'}
				loading={isSaving}
				disabled={isLoading || isSaving || selectedRows.length === 0}
				class="min-w-32"
				onclick={() => requestCreateIndent()}
			/>
		</div>
	</div>

	<AppBusyOverlay
		open={isSaving}
		title="Creating indent"
		description="Creating the indent document…"
	/>
</div>

<Dialog
	bind:open={isUnlockableStockDialogOpen}
	title="Available stock not locked"
	size="sm"
	cancelLabel="Cancel"
	confirmLabel={isSaving ? 'Creating…' : 'Create indent anyway'}
	onConfirm={() => void handleCreateIndent()}
>
	<div class="space-y-3">
		<p class="text-sm text-muted-foreground">
			{totalUnlockableStock} pcs of stock are available across {rowsWithUnlockableStock.length}
			selected section{rowsWithUnlockableStock.length === 1 ? '' : 's'} but not yet locked. Lock available
			bars first on Assign & Lock, or proceed to create the indent anyway.
		</p>
	</div>
</Dialog>
