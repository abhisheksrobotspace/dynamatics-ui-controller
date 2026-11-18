<script lang="ts">
	import { onMount } from 'svelte';
	import { DataTable, type DataTableColumn } from '@ifactory/ui-v2';
	import { FileText, Ticket } from '@lucide/svelte';
	import { formatMonthLabel } from '../../central-planning-app/lib/planning-sheet.load';
	import { getPlanningSheetPlan } from '../../central-planning-app/lib/planning-sheet.store';
	import { formatApiErrorMessage } from '../../lib/api/types';
	import { formatWeightMt } from '../lib/inv-views.api';
	import { num, numOrNull } from '../lib/inv.num';
	import {
		clearCreateIndentFromPlan,
		clearCreateIndentSelection,
		indentDetailUrl,
		readCreateIndentSelection,
		setIndentLabel
	} from '../lib/indent-routes';
	import { assembleIndentDraft, saveIndentDocument, toMatrixLines } from '../lib/indents.api';
	import { rmiPushBuildIndentWarnings, rmiPushToast } from '../lib/toast';
	import { app } from '../app.svelte';

	type TableRow = {
		id: string;
		project: string;
		section: string;
		length: string;
		required: string;
		requiredMt: string;
		locked: string;
		toProcure: string;
		procureMt: string;
	};

	let isLoading = $state(true);
	let isSaving = $state(false);
	let planLabel = $state('-');
	let monthLabel = $state('-');
	let planId = $state('');
	let month = $state('');
	let warnings = $state<string[]>([]);
	let drafts = $state<
		Array<{
			projectId: string;
			projectLabel: string;
			draft: Awaited<ReturnType<typeof assembleIndentDraft>>;
		}>
	>([]);

	const tableRows = $derived.by((): TableRow[] => {
		const out: TableRow[] = [];
		for (const entry of drafts) {
			for (const line of entry.draft.lines) {
				const recommended = num(line.cp_recommended_length_mm ?? line.length_mm);
				out.push({
					id: `${entry.projectId}|${line.item_id}|${line.variant_key}|${out.length}`,
					project: entry.projectLabel,
					section: String(line.section ?? line.item_code ?? '-'),
					length: recommended > 0 ? `${recommended.toLocaleString('en-US')} mm` : '-',
					required: String(num(line.required_qty_base)),
					requiredMt: formatWeightMt(numOrNull(line.required_weight_kg)),
					locked: String(num(line.locked_qty_base)),
					toProcure: String(num(line.procure_qty_base)),
					procureMt: formatWeightMt(numOrNull(line.procure_weight_kg))
				});
			}
		}
		return out;
	});

	const columns = $derived.by((): DataTableColumn<TableRow>[] => [
		{
			type: 'serial',
			key: 'sNo',
			header: 'S.No',
			sortable: true,
			filterable: true,
			dataType: 'number',
			value: (row) => String(tableRows.indexOf(row) + 1)
		},
		{
			key: 'project',
			header: 'Project',
			class: 'font-medium',
			sortable: true,
			filterable: true,
			dataType: 'string'
		},
		{
			key: 'section',
			header: 'Section',
			sortable: true,
			filterable: true,
			dataType: 'string'
		},
		{
			key: 'length',
			header: 'Length',
			sortable: true,
			filterable: true,
			dataType: 'string'
		},
		{
			key: 'required',
			header: 'Required (pcs)',
			sortable: true,
			filterable: true,
			dataType: 'number'
		},
		{
			key: 'requiredMt',
			header: 'Required (MT)',
			sortable: true,
			filterable: true,
			dataType: 'number'
		},
		{
			key: 'locked',
			header: 'Locked (pcs)',
			sortable: true,
			filterable: true,
			dataType: 'number'
		},
		{
			key: 'toProcure',
			header: 'To Procure (pcs)',
			class: 'font-semibold text-primary',
			sortable: true,
			filterable: true,
			dataType: 'number'
		},
		{
			key: 'procureMt',
			header: 'To Procure (MT)',
			class: 'font-semibold text-primary',
			sortable: true,
			filterable: true,
			dataType: 'number'
		}
	]);

	async function createIndents() {
		if (isSaving || drafts.length === 0) return;
		isSaving = true;
		try {
			let created = 0;
			let lastIndentId = '';
			for (const entry of drafts) {
				if (entry.draft.lines.length === 0) continue;
				const saved = await saveIndentDocument({
					draft: entry.draft,
					matrixLines: toMatrixLines(entry.draft),
					createdBy: 'ui'
				});
				setIndentLabel(saved.indent_id, `#${saved.indent_no} - R${saved.revision}`);
				lastIndentId = saved.indent_id;
				created += 1;
			}
			if (created === 0) {
				rmiPushToast({
					title: 'No indents created',
					description: 'No lines with To Procure quantity.'
				});
				return;
			}
			rmiPushToast({
				title: created === 1 ? 'Indent created' : 'Indents created',
				description: `${created} from ${planLabel} · ${monthLabel}`
			});
			clearCreateIndentFromPlan();
			clearCreateIndentSelection();
			window.location.hash = lastIndentId
				? indentDetailUrl(lastIndentId, app.appName)
				: `#/${app.appName}/Indents`;
		} catch (error) {
			rmiPushToast({
				title: 'Failed to create indent',
				description: formatApiErrorMessage(error)
			});
		} finally {
			isSaving = false;
		}
	}

	onMount(() => {
		const controller = new AbortController();
		void (async () => {
			isLoading = true;
			try {
				const selection = readCreateIndentSelection();
				if (!selection) {
					rmiPushToast({
						title: 'Nothing to create',
						description: 'Select sections from the plan tree first.'
					});
					window.location.hash = `#/${app.appName}/Indents/Select`;
					return;
				}
				planId = selection.planId;
				month = selection.month;
				const plan = getPlanningSheetPlan(planId);
				planLabel = plan?.label ?? planId;
				monthLabel = formatMonthLabel(month);
				const plantId = plan?.plantId?.trim() ?? '';
				const nextDrafts: typeof drafts = [];
				const nextWarnings: string[] = [];
				for (const project of selection.byProject) {
					if (controller.signal.aborted) return;
					if (project.rowKeys.length === 0) continue;
					const draft = await assembleIndentDraft({
						projectId: project.projectId,
						month,
						rows: project.rowKeys,
						centralPlanId: planId,
						...(plantId ? { plantId } : {}),
						batchName: '',
						excessPct: 0,
						createdBy: 'ui',
						signal: controller.signal
					});
					nextWarnings.push(...(draft.warnings ?? []));
					nextDrafts.push({
						projectId: project.projectId,
						projectLabel: project.projectLabel,
						draft
					});
				}
				drafts = nextDrafts;
				warnings = nextWarnings;
				rmiPushBuildIndentWarnings(nextWarnings);
			} catch (error) {
				if (controller.signal.aborted) return;
				rmiPushToast({
					title: 'Failed to build indent',
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
	<div class="mb-3 shrink-0 text-sm text-muted-foreground">
		{planLabel} · {monthLabel}
	</div>
	{#if warnings.length > 0}
		<ul class="mb-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
			{#each warnings as warning (warning)}
				<li>{warning}</li>
			{/each}
		</ul>
	{/if}
	<div class="min-h-0 flex-1">
		<DataTable
			{columns}
			rows={tableRows}
			loading={isLoading}
			rowKey={(row) => row.id}
			search={{ enabled: true }}
			toolbarButton={{
				enabled: true,
				label: isSaving ? 'Creating…' : 'Create Indent',
				icon: FileText,
				disabled: isLoading || isSaving || tableRows.length === 0,
				loading: isSaving,
				onClick: () => void createIndents()
			}}
			pagination={{ enabled: false }}
			emptyState={{
				icon: Ticket,
				title: 'No sections selected',
				description: 'Go back and select section lengths from the plan tree.'
			}}
		/>
	</div>
</div>
