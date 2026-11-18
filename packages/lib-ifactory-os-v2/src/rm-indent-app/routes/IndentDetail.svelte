<script lang="ts">
	import {
		DataTable,
		KpiCardStrip,
		Skeleton,
		type DataTableColumn,
		type KpiCardItem
	} from '@ifactory/ui-v2';
	import {
		ArrowLeft,
		ClipboardList,
		FolderOpen,
		Pencil,
		Save,
		Tag,
		Ticket,
		X
	} from '@lucide/svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import { formatApiErrorMessage } from '../../lib/api/types';
	import {
		procureLengthMmFromIndentLine,
		procureQtyForEdit,
		recommendedLengthMmFromIndentLine,
		resolveIndentEditNumberOnBlur,
		unitWeightKgMFromIndentLine,
		weightKgForPcs,
		type IndentLineEditDraft
	} from '../lib/indent-line-edit';
	import {
		getIndentDetailLive,
		saveIndentLineEdits,
		type IndentDetailRecord
	} from '../lib/indents.api';
	import { num } from '../lib/inv.num';
	import { formatWeightMt } from '../lib/inv-views.api';
	import { rmiPushToast } from '../lib/toast';

	/** One indent line in the length / edit table. */
	type LineRow = IndentLineEditDraft & { key: string };

	/** Merged (item + to-procure length) row on the main list. */
	type SectionRow = {
		id: string;
		section: string;
		requiredLengthLabel: string;
		requiredQty: number;
		requiredMtLabel: string;
		procureLengthMm: number;
		procureLengthLabel: string;
		procureQty: number;
		procureMtLabel: string;
		mtDifferenceLabel: string;
		lineCount: number;
		procureLengthEdited: boolean;
		procureQtyEdited: boolean;
	};

	let { params } = $props();
	const indentId = $derived(String(params.indentId ?? ''));

	let isLoading = $state(true);
	let isEditing = $state(false);
	let isSaving = $state(false);
	let detail = $state<IndentDetailRecord | null>(null);
	let planLabel = $state('-');
	/** Full line list (source of truth when not editing). */
	let lines = $state<LineRow[]>([]);
	/** Working copies while editing — scoped to the visible length table. */
	let editDrafts = $state<LineRow[]>([]);
	/** Rollup key = item_id + toProcureLength; null = main merged list. */
	let selectedGroupKey = $state<string | null>(null);

	function formatQty(value: unknown): string {
		const n = num(value);
		return Number.isInteger(n) ? String(n) : n.toFixed(3).replace(/\.?0+$/, '');
	}

	function formatLengthMm(lengthMm: number): string {
		return lengthMm > 0 ? `${lengthMm.toLocaleString('en-US')} mm` : '-';
	}

	function groupKey(line: Pick<IndentLineEditDraft, 'item_id' | 'procure_length_mm'>): string {
		return `${line.item_id}|${Math.round(line.procure_length_mm)}`;
	}

	function isProcureLengthEdited(row: IndentLineEditDraft): boolean {
		return Math.round(row.procure_length_mm) !== Math.round(row.cp_recommended_length_mm);
	}

	function isProcureQtyEdited(row: IndentLineEditDraft): boolean {
		return procureQtyForEdit(row) !== row.required_qty_base;
	}

	function procureEditedClass(edited: boolean): string {
		return edited ? 'text-primary' : '';
	}

	function displayValue(value: string | undefined | null): { value: string; valueTitle?: string } {
		const full = value?.trim() || '-';
		if (full === '-') return { value: full };
		return {
			value: full,
			valueTitle: full.length > 15 ? full : undefined
		};
	}

	function draftsFromDetail(record: IndentDetailRecord): LineRow[] {
		return record.lines.map((line, index) => {
			const recommended = recommendedLengthMmFromIndentLine(line);
			const procureLength = procureLengthMmFromIndentLine(line);
			const requiredQty = num(line.required_qty_base);
			const procureQty = num(line.procure_qty_base);
			const overridden = line.overridden_length_mm;
			const indentLineId = String(line.indent_line_id ?? '');
			return {
				indent_line_id: indentLineId,
				item_id: String(line.item_id ?? ''),
				section: String(line.section ?? line.item_code ?? '-'),
				item_code: String(line.item_code ?? ''),
				cp_recommended_length_mm: recommended,
				procure_length_mm: procureLength,
				required_qty_base: requiredQty,
				locked_qty_base: num(line.locked_qty_base),
				stock_qty_base: num(line.stock_qty_base),
				procure_qty_base: procureQty,
				unit_weight_kg_m: unitWeightKgMFromIndentLine(line),
				variant_key: String(line.variant_key ?? ''),
				had_override: overridden != null && overridden !== '',
				original_procure_qty_base: procureQty,
				key: indentLineId || `row-${index}`
			};
		});
	}

	function sumWeightsKg(values: (number | null)[]): number | null {
		let sum = 0;
		for (const kg of values) {
			if (kg == null) return null;
			sum += kg;
		}
		return sum;
	}

	function requiredKg(row: IndentLineEditDraft): number | null {
		return weightKgForPcs(
			row.required_qty_base,
			row.cp_recommended_length_mm,
			row.unit_weight_kg_m
		);
	}

	function procureKg(row: IndentLineEditDraft): number | null {
		return weightKgForPcs(procureQtyForEdit(row), row.procure_length_mm, row.unit_weight_kg_m);
	}

	function updateDraft(lineId: string, patch: Partial<IndentLineEditDraft>) {
		editDrafts = editDrafts.map((row) => {
			if (row.indent_line_id !== lineId) return row;
			return { ...row, ...patch };
		});
	}

	function commitProcureLengthOnBlur(lineId: string, raw: string) {
		const row = editDrafts.find((r) => r.indent_line_id === lineId);
		if (!row) return;
		const { value, clamped } = resolveIndentEditNumberOnBlur(raw, 1);
		updateDraft(lineId, { procure_length_mm: value });
		if (clamped) {
			rmiPushToast({
				title: 'Length adjusted',
				description: 'To Procure Length must be greater than 0.'
			});
		}
	}

	function commitProcureQtyOnBlur(lineId: string, raw: string) {
		const row = editDrafts.find((r) => r.indent_line_id === lineId);
		if (!row) return;
		const { value, clamped } = resolveIndentEditNumberOnBlur(raw, 0, { integer: false });
		updateDraft(lineId, { procure_qty_base: value });
		if (clamped) {
			rmiPushToast({
				title: 'Quantity adjusted',
				description: 'To Procure (pcs) cannot be negative.'
			});
		}
	}

	const canEdit = $derived(detail?.indent.status === 'draft');

	const splitLines = $derived(
		selectedGroupKey == null ? [] : lines.filter((line) => groupKey(line) === selectedGroupKey)
	);

	/** Lines shown in length/edit table (all lines from main Edit, or split group). */
	const lengthScope = $derived(selectedGroupKey == null ? lines : splitLines);
	const displayLengthRows = $derived(isEditing ? editDrafts : lengthScope);

	/** Main list uses rollup; edit or split uses length rows. */
	const showLengthTable = $derived(isEditing || selectedGroupKey != null);

	const sectionRows = $derived.by((): SectionRow[] => {
		const groups = new SvelteMap<string, LineRow[]>();
		for (const line of lines) {
			const key = groupKey(line);
			const bucket = groups.get(key);
			if (bucket) bucket.push(line);
			else groups.set(key, [line]);
		}
		const out: SectionRow[] = [];
		for (const [key, group] of groups) {
			const requiredLengths = new Set(group.map((l) => Math.round(l.cp_recommended_length_mm)));
			const procureLength = Math.round(group[0]!.procure_length_mm);
			const requiredQty = group.reduce((sum, l) => sum + l.required_qty_base, 0);
			const procureQty = group.reduce((sum, l) => sum + procureQtyForEdit(l), 0);
			const requiredTotalKg = sumWeightsKg(group.map(requiredKg));
			const procureTotalKg = sumWeightsKg(group.map(procureKg));
			out.push({
				id: key,
				section: group[0]?.section || group[0]?.item_code || '-',
				requiredLengthLabel:
					requiredLengths.size === 1 ? formatLengthMm([...requiredLengths][0]!) : '–',
				requiredQty,
				requiredMtLabel: formatWeightMt(requiredTotalKg),
				procureLengthMm: procureLength,
				procureLengthLabel: formatLengthMm(procureLength),
				procureQty,
				procureMtLabel: formatWeightMt(procureTotalKg),
				mtDifferenceLabel:
					requiredTotalKg == null || procureTotalKg == null
						? '-'
						: formatWeightMt(requiredTotalKg - procureTotalKg),
				lineCount: group.length,
				procureLengthEdited: group.some(isProcureLengthEdited),
				procureQtyEdited: group.some(isProcureQtyEdited)
			});
		}
		return out;
	});

	function openSection(row: SectionRow) {
		if (isEditing) return;
		selectedGroupKey = row.id;
	}

	function backToSections() {
		if (isEditing) cancelEdit();
		selectedGroupKey = null;
	}

	function startEdit() {
		editDrafts = lengthScope.map((row) => ({ ...row }));
		isEditing = true;
	}

	function cancelEdit() {
		editDrafts = [];
		isEditing = false;
	}

	async function handleSave() {
		if (!detail || isSaving) return;
		isSaving = true;
		try {
			await saveIndentLineEdits({
				indentId: detail.indent.id,
				edits: editDrafts
			});
			rmiPushToast({
				title: 'Indent updated',
				description: 'Length and procure quantities saved.'
			});
			isEditing = false;
			editDrafts = [];
			await loadDetail(detail.indent.id);
			if (selectedGroupKey != null && !lines.some((line) => groupKey(line) === selectedGroupKey)) {
				selectedGroupKey = null;
			}
		} catch (error) {
			rmiPushToast({
				title: 'Failed to save indent',
				description: formatApiErrorMessage(error)
			});
		} finally {
			isSaving = false;
		}
	}

	const infoCards = $derived.by((): KpiCardItem[] => {
		if (!detail) return [];
		return [
			{
				label: 'Central Plan · Month',
				icon: ClipboardList,
				...displayValue(planLabel)
			},
			{
				label: 'Project',
				icon: FolderOpen,
				...displayValue(detail.indent.project_label)
			},
			{
				label: 'Batch Name',
				icon: Tag,
				...displayValue(detail.indent.batch)
			}
		];
	});

	const sectionColumns = $derived.by((): DataTableColumn<SectionRow>[] => [
		{
			type: 'serial',
			key: 'sNo',
			header: 'S.No',
			sortable: true,
			filterable: true,
			dataType: 'number',
			value: (row) => String(sectionRows.indexOf(row) + 1)
		},
		{
			type: 'text',
			key: 'section',
			header: 'Section',
			class: 'font-medium',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => row.section
		},
		{
			type: 'text',
			key: 'requiredLength',
			header: 'Required Length',
			sortable: true,
			filterable: true,
			dataType: 'string',
			value: (row) => row.requiredLengthLabel
		},
		{
			type: 'text',
			key: 'required',
			header: 'Required (pcs)',
			sortable: true,
			filterable: true,
			dataType: 'number',
			value: (row) => formatQty(row.requiredQty)
		},
		{
			type: 'text',
			key: 'requiredMt',
			header: 'Required (MT)',
			sortable: true,
			filterable: true,
			dataType: 'number',
			value: (row) => row.requiredMtLabel
		},
		{
			type: 'badge',
			key: 'procureLength',
			header: 'To Procure Length',
			sortable: true,
			filterable: true,
			dataType: 'string',
			badge: (row) => ({
				variant: 'secondary',
				label: row.procureLengthLabel,
				class: [
					'rounded-none border-transparent bg-transparent px-0 py-0 shadow-none hover:bg-transparent !text-base !font-medium',
					procureEditedClass(row.procureLengthEdited) || 'text-foreground'
				].join(' ')
			})
		},
		{
			type: 'badge',
			key: 'procure',
			header: 'To Procure (pcs)',
			sortable: true,
			filterable: true,
			dataType: 'number',
			badge: (row) => ({
				variant: 'secondary',
				label: formatQty(row.procureQty),
				class: [
					'rounded-none border-transparent bg-transparent px-0 py-0 shadow-none hover:bg-transparent !text-base !font-medium',
					procureEditedClass(row.procureQtyEdited) || 'text-foreground'
				].join(' ')
			})
		},
		{
			type: 'text',
			key: 'procureMt',
			header: 'To Procure (MT)',
			sortable: true,
			filterable: true,
			dataType: 'number',
			value: (row) => row.procureMtLabel
		},
		{
			type: 'text',
			key: 'mtDifference',
			header: 'MT Difference',
			sortable: true,
			filterable: true,
			dataType: 'number',
			value: (row) => row.mtDifferenceLabel
		}
	]);

	const lengthColumns = $derived.by((): DataTableColumn<LineRow>[] => {
		const cols: DataTableColumn<LineRow>[] = [
			{
				type: 'serial',
				key: 'sNo',
				header: 'S.No',
				sortable: true,
				filterable: true,
				dataType: 'number',
				value: (row) => String(displayLengthRows.indexOf(row) + 1)
			},
			{
				type: 'text',
				key: 'section',
				header: 'Section',
				class: 'font-medium',
				sortable: true,
				filterable: true,
				dataType: 'string',
				value: (row) => row.section
			},
			{
				type: 'text',
				key: 'requiredLength',
				header: 'Required Length',
				sortable: true,
				filterable: true,
				dataType: 'string',
				value: (row) => formatLengthMm(row.cp_recommended_length_mm)
			},
			{
				type: 'text',
				key: 'required',
				header: 'Required (pcs)',
				sortable: true,
				filterable: true,
				dataType: 'number',
				value: (row) => formatQty(row.required_qty_base)
			},
			{
				type: 'text',
				key: 'requiredMt',
				header: 'Required (MT)',
				sortable: true,
				filterable: true,
				dataType: 'number',
				value: (row) => formatWeightMt(requiredKg(row))
			}
		];

		if (isEditing) {
			cols.push(
				{
					type: 'input',
					key: 'procureLength',
					header: 'To Procure Length (mm)',
					inputType: 'number',
					step: 1,
					sortable: true,
					filterable: true,
					dataType: 'number',
					value: (row) => String(row.procure_length_mm),
					onValueChange: (row, value) => {
						const parsed = value.trim() === '' ? 0 : Number(value);
						if (!Number.isFinite(parsed)) return;
						updateDraft(row.indent_line_id, { procure_length_mm: Math.round(parsed) });
					},
					onBlur: (row, value) => commitProcureLengthOnBlur(row.indent_line_id, value),
					ariaLabel: (row) => `To Procure length mm for ${row.section}`,
					inputClass: (row) => procureEditedClass(isProcureLengthEdited(row))
				},
				{
					type: 'input',
					key: 'procure',
					header: 'To Procure (pcs)',
					inputType: 'number',
					step: 1,
					sortable: true,
					filterable: true,
					dataType: 'number',
					value: (row) => String(row.procure_qty_base),
					onValueChange: (row, value) => {
						const parsed = value.trim() === '' ? 0 : Number(value);
						if (!Number.isFinite(parsed)) return;
						updateDraft(row.indent_line_id, { procure_qty_base: parsed });
					},
					onBlur: (row, value) => commitProcureQtyOnBlur(row.indent_line_id, value),
					ariaLabel: (row) => `To Procure pcs for ${row.section}`,
					inputClass: (row) => procureEditedClass(isProcureQtyEdited(row))
				}
			);
		} else {
			cols.push(
				{
					type: 'badge',
					key: 'procureLength',
					header: 'To Procure Length',
					sortable: true,
					filterable: true,
					dataType: 'string',
					badge: (row) => ({
						variant: 'secondary',
						label: formatLengthMm(row.procure_length_mm),
						class: [
							'rounded-none border-transparent bg-transparent px-0 py-0 shadow-none hover:bg-transparent !text-base !font-medium',
							procureEditedClass(isProcureLengthEdited(row)) || 'text-foreground'
						].join(' ')
					})
				},
				{
					type: 'badge',
					key: 'procure',
					header: 'To Procure (pcs)',
					sortable: true,
					filterable: true,
					dataType: 'number',
					badge: (row) => ({
						variant: 'secondary',
						label: formatQty(procureQtyForEdit(row)),
						class: [
							'rounded-none border-transparent bg-transparent px-0 py-0 shadow-none hover:bg-transparent !text-base !font-medium',
							procureEditedClass(isProcureQtyEdited(row)) || 'text-foreground'
						].join(' ')
					})
				}
			);
		}

		cols.push(
			{
				type: 'text',
				key: 'procureMt',
				header: 'To Procure (MT)',
				sortable: true,
				filterable: true,
				dataType: 'number',
				value: (row) => formatWeightMt(procureKg(row))
			},
			{
				type: 'text',
				key: 'mtDifference',
				header: 'MT Difference',
				sortable: true,
				filterable: true,
				dataType: 'number',
				value: (row) => {
					const req = requiredKg(row);
					const proc = procureKg(row);
					if (req == null || proc == null) return '-';
					return formatWeightMt(req - proc);
				}
			}
		);
		return cols;
	});

	const editToolbar = $derived.by(() => {
		if (isLoading || !detail || !canEdit) return [];
		if (!isEditing) {
			return [
				{
					enabled: true,
					label: 'Edit',
					icon: Pencil,
					variant: 'primary' as const,
					onClick: () => startEdit()
				}
			];
		}
		return [
			{
				enabled: true,
				label: 'Cancel',
				icon: X,
				variant: 'outline' as const,
				disabled: isSaving,
				onClick: () => cancelEdit()
			},
			{
				enabled: true,
				label: isSaving ? 'Saving…' : 'Save',
				icon: Save,
				variant: 'primary' as const,
				disabled: isSaving,
				loading: isSaving,
				onClick: () => void handleSave()
			}
		];
	});

	const mainToolbar = $derived(editToolbar);

	const splitToolbar = $derived.by(() => {
		const buttons = [...editToolbar];
		if (selectedGroupKey != null) {
			buttons.unshift({
				enabled: true,
				label: 'Back',
				icon: ArrowLeft,
				variant: 'outline' as const,
				disabled: isSaving,
				onClick: () => backToSections()
			});
		}
		return buttons;
	});

	async function loadDetail(id: string, signal?: AbortSignal) {
		if (!id) {
			detail = null;
			lines = [];
			editDrafts = [];
			planLabel = '-';
			isLoading = false;
			return;
		}
		isLoading = true;
		planLabel = '-';
		try {
			detail = await getIndentDetailLive(id, signal);
			if (!detail && !signal?.aborted) {
				rmiPushToast({
					title: 'Indent not found',
					description: `No indent document for ${id}`
				});
				return;
			}
			if (detail) {
				lines = draftsFromDetail(detail);
				editDrafts = [];
				planLabel = detail.indent.plan_label?.trim() || '-';
			}
		} catch (error) {
			if (signal?.aborted) return;
			detail = null;
			lines = [];
			rmiPushToast({
				title: 'Failed to load indent',
				description: formatApiErrorMessage(error)
			});
		} finally {
			if (!signal?.aborted) isLoading = false;
		}
	}

	$effect(() => {
		const id = indentId;
		isEditing = false;
		selectedGroupKey = null;
		editDrafts = [];
		const controller = new AbortController();
		void loadDetail(id, controller.signal);
		return () => controller.abort();
	});
</script>

<div class="flex h-full min-h-0 flex-col overflow-hidden p-3 md:p-4">
	{#if !isLoading && !detail}
		<div class="flex flex-1 items-center justify-center text-sm text-muted-foreground">
			Indent not found.
		</div>
	{:else}
		<div class="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
			{#if isLoading}
				<div
					class="grid grid-cols-1 border border-border bg-white sm:grid-cols-3"
					aria-busy="true"
					role="status"
				>
					<span class="sr-only">Loading indent details</span>
					{#each [0, 1, 2] as index (index)}
						<div
							class={[
								'min-w-0 bg-white px-6 py-5',
								index > 0 && 'border-t border-border sm:border-t-0',
								index < 2 && 'sm:border-r sm:border-border'
							]}
						>
							<Skeleton class="h-4 w-28" />
							<Skeleton class="mt-3 h-7 w-40" />
						</div>
					{/each}
				</div>
			{:else if detail}
				<div class="shrink-0">
					<KpiCardStrip items={infoCards} columns={3} />
				</div>
			{/if}

			<div class="min-h-0 flex-1">
				{#if !showLengthTable}
					<DataTable
						columns={sectionColumns}
						rows={sectionRows}
						loading={isLoading}
						rowKey={(row) => row.id}
						search={{ enabled: true }}
						export={{
							enabled: true,
							label: 'Export CSV',
							fileName: detail
								? `indent-${detail.indent.indent_no}-${detail.indent.revision_label}`
								: 'indent'
						}}
						toolbarButton={mainToolbar}
						onRowClick={(row) => openSection(row)}
						pagination={{ enabled: false }}
						emptyState={{
							icon: Ticket,
							title: 'No sections found',
							description: 'This indent has no procurement lines.'
						}}
					/>
				{:else}
					<DataTable
						columns={lengthColumns}
						rows={displayLengthRows}
						loading={isLoading}
						rowKey={(row) => row.key}
						search={{ enabled: !isEditing }}
						export={{
							enabled: !isEditing,
							label: 'Export CSV',
							fileName: detail
								? `indent-${detail.indent.indent_no}-${detail.indent.revision_label}`
								: 'indent'
						}}
						toolbarButton={splitToolbar}
						pagination={{ enabled: false }}
						emptyState={{
							icon: Ticket,
							title: 'No length rows',
							description: 'No splits for this section.'
						}}
					/>
				{/if}
			</div>
		</div>
	{/if}
</div>
