<script lang="ts">
	import { onMount } from 'svelte';
	import { Alert, Button, DataTable, Dialog, type DataTableColumn } from '@ifactory/ui-v2';
	import { FileText } from '@lucide/svelte';
	import { rmiPushToast, rmiPushBuildIndentWarnings } from '../lib/toast';
	import { formatApiErrorMessage } from '../../lib/api/types';
	import { num } from '../lib/inv.num';
	import { resolvePlantIdForAssign } from '../lib/assign-and-lock.detail';
	import {
		formatWeightMt,
		listPlanLockSummary,
		planLockRowsForCentralPlan
	} from '../lib/inv-views.api';
	import {
		assembleIndentDraft,
		saveIndentDocument,
		type IndentMatrixLine
	} from '../lib/indents.api';
	import { resolvePlanningAppData } from '../lib/planning-capabilities';
	import {
		indentDetailUrl,
		indentLineMatchesRow,
		projectIndentDetailUrl,
		readCpRaiseIndentScope,
		readRaiseIndent,
		setIndentLabel,
		type RaiseIndentRow
	} from '../lib/indent-routes';

	let { params, data }: { params: Record<string, string>; data?: unknown } = $props();
	const projectId = $derived(params.projectId as string | undefined);
	const planId = $derived(params.planId as string | undefined);
	const section = $derived(params.section ? decodeURIComponent(params.section as string) : '');
	const lengthMm = $derived(params.lengthMm ? Number(params.lengthMm) : 0);
	const planning = $derived(resolvePlanningAppData(data));
	const canLock = $derived(planning.capabilities.canLock);

	let isLoading = $state(true);
	let isSaving = $state(false);
	let plantId = $state('');
	let selectionRows = $state<RaiseIndentRow[]>([]);
	let isUnlockableStockDialogOpen = $state(false);

	function unlockableStockPcs(row: RaiseIndentRow): number {
		if (row.availableQty <= 0 || row.lockedQty >= row.requiredQty) return 0;
		return Math.min(row.availableQty, row.requiredQty - row.lockedQty);
	}

	function procureWeightKg(row: RaiseIndentRow): number | null {
		const requiredKg = row.requiredWeightKg;
		const lockedKg = row.lockedWeightKg;
		if (requiredKg == null) return null;
		if (lockedKg == null) {
			if (row.requiredQty <= 0) return null;
			const toProcure = Math.max(0, row.requiredQty - row.lockedQty);
			return (requiredKg * toProcure) / row.requiredQty;
		}
		return Math.max(0, requiredKg - lockedKg);
	}

	const rowsWithUnlockableStock = $derived(
		selectionRows.filter((row) => unlockableStockPcs(row) > 0)
	);
	const totalUnlockableStock = $derived(
		rowsWithUnlockableStock.reduce((sum, row) => sum + unlockableStockPcs(row), 0)
	);

	const toProcure = $derived(
		selectionRows.reduce((sum, row) => sum + Math.max(0, row.requiredQty - row.lockedQty), 0)
	);

	const toProcureMtLabel = $derived.by(() => {
		let total = 0;
		let any = false;
		for (const row of selectionRows) {
			const kg = procureWeightKg(row);
			if (kg == null) continue;
			any = true;
			total += kg;
		}
		return any ? formatWeightMt(total) : '—';
	});

	type SectionRow = {
		id: string;
		section: string;
		length: string;
		required: number;
		requiredMt: string;
		available: number;
		locked: number;
		to_procure: number;
		procureMt: string;
	};

	const tableRows = $derived<SectionRow[]>(
		selectionRows.map((row) => ({
			id: `${row.itemId || row.section}|${row.lengthMm}`,
			section: row.section || '-',
			length: row.lengthMm > 0 ? `${row.lengthMm.toLocaleString('en-US')} mm` : '-',
			required: row.requiredQty,
			requiredMt: formatWeightMt(row.requiredWeightKg ?? null),
			available: row.availableQty,
			locked: row.lockedQty,
			to_procure: Math.max(0, row.requiredQty - row.lockedQty),
			procureMt: formatWeightMt(procureWeightKg(row))
		}))
	);

	const tableColumns = $derived.by((): DataTableColumn<SectionRow>[] => {
		const cols: DataTableColumn<SectionRow>[] = [
			{
				type: 'serial',
				key: 'sNo',
				header: 'S.No',
				value: (row) => {
					const index = tableRows.indexOf(row);
					return String(index >= 0 ? index + 1 : '');
				}
			},
			{ key: 'section', header: 'Section' },
			{ key: 'length', header: 'Length' },
			{ key: 'required', header: 'Required (pcs)' },
			{ key: 'requiredMt', header: 'Required (MT)' }
		];
		if (canLock) {
			cols.push(
				{ key: 'available', header: 'Available in stock' },
				{ key: 'locked', header: 'Locked (pcs)' }
			);
		}
		cols.push(
			{
				key: 'to_procure',
				header: 'To Procure (pcs)',
				value: (row) => String(row.to_procure),
				class: 'font-semibold text-primary'
			},
			{
				key: 'procureMt',
				header: 'To Procure (MT)',
				value: (row) => row.procureMt,
				class: 'font-semibold text-primary'
			}
		);
		return cols;
	});

	async function loadFromSummary(
		pid: string,
		centralPlanId: string,
		filter?: { section?: string; lengthMm?: number; itemId?: string },
		signal?: AbortSignal
	) {
		const cpScope = readCpRaiseIndentScope(pid);
		const [rows, nextPlantId] = await Promise.all([
			listPlanLockSummary({
				projectId: pid,
				month: cpScope?.month,
				signal
			}),
			// ponytail: plant is optional; build_indent resolves it (explicit > locks > DS)
			resolvePlantIdForAssign({ projectId: pid, signal }).catch(() => '')
		]);

		let mapped = planLockRowsForCentralPlan(rows, centralPlanId).map((row) => ({
			itemId: row.item_id ?? '',
			section: row.section,
			lengthMm: row.length_mm,
			requiredQty: row.required_qty_base,
			availableQty: row.free_qty_base,
			lockedQty: row.locked_qty_base,
			requiredWeightKg: row.required_weight_kg,
			lockedWeightKg: row.locked_weight_kg
		}));

		if (filter?.itemId) {
			mapped = mapped.filter((row) => row.itemId === filter.itemId);
		} else if (filter?.section && filter.lengthMm) {
			mapped = mapped.filter(
				(row) => row.section === filter.section && row.lengthMm === filter.lengthMm
			);
		} else {
			mapped = mapped.filter((row) => row.requiredQty > row.lockedQty);
		}

		selectionRows = mapped;
		plantId = nextPlantId;
	}

	function applyStash(pid: string, mfgPlanRef: string): boolean {
		const stash = readRaiseIndent(pid);
		if (!stash || stash.planId !== mfgPlanRef) return false;
		plantId = stash.plantId ?? '';
		selectionRows = stash.rows;
		isLoading = false;
		return true;
	}

	function navigateBack() {
		if (!projectId || !planId) return;
		if (!canLock) {
			window.location.hash = `#/${planning.appName}/Sheet/${encodeURIComponent(planId)}/SelectSections/${encodeURIComponent(projectId)}`;
			return;
		}
		window.location.hash = `#/${planning.appName}/ManufacturingPlan/${encodeURIComponent(planId)}/GroupedAssignAndLock/${encodeURIComponent(projectId)}`;
	}

	function requestCreateIndent() {
		if (canLock && rowsWithUnlockableStock.length > 0) {
			isUnlockableStockDialogOpen = true;
			return;
		}
		void handleCreateIndent();
	}

	async function handleCreateIndent() {
		if (!projectId || !planId || isSaving || selectionRows.length === 0) return;
		isSaving = true;
		try {
			const stash = readRaiseIndent(projectId);
			const month = stash?.month ?? readCpRaiseIndentScope(projectId)?.month;
			if (!month) {
				rmiPushToast({
					title: 'Missing month',
					description: 'Go back and raise the indent from a plan month.'
				});
				return;
			}
			const rowKeys =
				stash?.rowKeys?.filter(Boolean) ??
				selectionRows.map((row) => `${row.itemId || row.section}|${row.lengthMm}`);
			if (rowKeys.length === 0) {
				rmiPushToast({
					title: 'Nothing to indent',
					description: 'No selected section rows.'
				});
				return;
			}
			const draft = await assembleIndentDraft({
				projectId,
				month,
				rows: rowKeys,
				centralPlanId: planId,
				plantId: plantId || undefined,
				batchName: '',
				excessPct: 0,
				createdBy: 'ui'
			});
			rmiPushBuildIndentWarnings(draft.warnings);

			const filteredLines: IndentMatrixLine[] = draft.lines
				.filter((line) =>
					stash?.rowKeys?.length
						? true
						: selectionRows.some((row) => indentLineMatchesRow(line, row))
				)
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

			const label = `#${indent_no} - R${revision}`;
			setIndentLabel(indent_id, label);
			rmiPushToast({ title: 'Indent created', description: label });
			window.location.hash = canLock
				? projectIndentDetailUrl(planning.appName, planId, projectId, indent_id)
				: indentDetailUrl(indent_id, planning.appName);
		} catch (error) {
			rmiPushToast({ title: 'Failed to create indent', description: formatApiErrorMessage(error) });
		} finally {
			isSaving = false;
		}
	}

	onMount(() => {
		if (!projectId || !planId) {
			isLoading = false;
			return;
		}
		if (applyStash(projectId, planId)) return;
		if (!section || !lengthMm) {
			isLoading = false;
			return;
		}
		const controller = new AbortController();
		void loadFromSummary(projectId, planId, { section, lengthMm }, controller.signal)
			.catch((error) => {
				if (controller.signal.aborted) return;
				rmiPushToast({
					title: 'Failed to load section data',
					description: formatApiErrorMessage(error)
				});
			})
			.finally(() => {
				if (!controller.signal.aborted) isLoading = false;
			});
		return () => controller.abort();
	});
</script>

<div class="flex h-full min-h-0 flex-col overflow-hidden">
	<div class="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-3 md:p-4">
		<div class="flex min-h-0 flex-1 flex-col overflow-hidden">
			<DataTable
				class="min-h-0 flex-1"
				columns={tableColumns}
				rows={tableRows}
				loading={isLoading}
				rowKey={(row) => row.id}
				search={{ enabled: false }}
				export={{ enabled: false }}
				toolbarButton={{ enabled: false, label: '' }}
				pagination={{ enabled: false }}
				sorting={{ enabled: false }}
				filtering={{ enabled: false }}
			/>
		</div>

		{#if canLock && !isLoading && rowsWithUnlockableStock.length > 0}
			<Alert
				variant="warning"
				accentBorder
				title="Available bars not locked"
				description="{totalUnlockableStock} pcs of stock are available but not yet locked. Lock them first to reduce the indent quantity, or proceed to create the indent anyway."
			/>
		{/if}

		<div
			class="flex shrink-0 items-center justify-between gap-4 rounded-lg border border-border bg-white p-4 shadow-sm"
		>
			<div class="text-sm text-muted-foreground">
				{#if isLoading}
					Loading section requirements…
				{:else}
					Creating indent for <span class="font-medium text-foreground">{toProcure} pcs</span>
					{#if toProcureMtLabel !== '—'}
						(<span class="font-medium text-foreground">{toProcureMtLabel} MT</span>)
					{/if}
					to procure across {selectionRows.length} section{selectionRows.length === 1 ? '' : 's'}.
				{/if}
			</div>
			<div class="flex items-center gap-2">
				<Button
					variant="primary"
					icon={FileText}
					label={isSaving ? 'Creating…' : 'Create Indent'}
					loading={isSaving}
					disabled={isLoading || isSaving || toProcure === 0 || selectionRows.length === 0}
					class="min-w-32"
					onclick={() => requestCreateIndent()}
				/>
			</div>
		</div>
	</div>
</div>

<Dialog
	bind:open={isUnlockableStockDialogOpen}
	title="Available stock not locked"
	size="sm"
	cancelLabel="Lock first"
	confirmLabel={isSaving ? 'Creating…' : 'Create indent anyway'}
	onCancel={() => navigateBack()}
	onConfirm={() => void handleCreateIndent()}
>
	<div class="space-y-3">
		<p class="text-sm text-muted-foreground">
			{#if rowsWithUnlockableStock.length === 1}
				{@const row = rowsWithUnlockableStock[0]}
				There are {row.availableQty} bars available in stock for {row.section} ({row.lengthMm.toLocaleString(
					'en-US'
				)} mm) but only {row.lockedQty} are locked. Lock the remaining stock first, or proceed to create
				the indent for
				{Math.max(0, row.requiredQty - row.lockedQty)} pcs.
			{:else}
				{totalUnlockableStock} pcs of stock are available across {rowsWithUnlockableStock.length} selected
				sections but not yet locked. Lock available bars first, or proceed to create the indent anyway.
			{/if}
		</p>
	</div>
</Dialog>
