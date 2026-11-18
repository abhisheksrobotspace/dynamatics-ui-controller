<script lang="ts">
	import { onMount } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import { DataTable, type DataTableColumn } from '@ifactory/ui-v2';
	import { ArrowLeft, Pencil, Save, Ticket, X } from '@lucide/svelte';
	import { formatMonthLabel } from '../../central-planning-app/lib/planning-sheet.load';
	import { formatWeightMt } from '../lib/inv-views.api';
	import {
		getUiIndent,
		isUiIndentId,
		sectionKey,
		updateUiIndentLines,
		type UiIndentLine
	} from '../lib/ui-indent.store';
	import { rmiPushToast } from '../lib/toast';
	import { app } from '../app.svelte';

	let { params = {} }: { params?: Record<string, string> } = $props();

	const indentId = $derived(params.indentId ? decodeURIComponent(params.indentId) : '');

	type LineRow = UiIndentLine & { id: string };

	type SectionRow = {
		id: string;
		section: string;
		requiredLengthLabel: string;
		requiredQty: number;
		toProcureLengthLabel: string;
		toProcureQty: number;
		toProcureMt: string;
		lineCount: number;
	};

	let title = $state('-');
	let subtitle = $state('-');
	let lines = $state<LineRow[]>([]);
	let editDrafts = $state<LineRow[]>([]);
	/** Rollup key = section + toProcureLength (only those merge). */
	let selectedGroupKey = $state<string | null>(null);
	let isLoading = $state(true);
	let isEditing = $state(false);
	let isSaving = $state(false);

	function formatLength(lengthMm: number): string {
		return lengthMm > 0 ? `${lengthMm.toLocaleString('en-US')} mm` : '-';
	}

	function groupKey(line: Pick<UiIndentLine, 'itemId' | 'section' | 'toProcureLengthMm'>): string {
		return `${sectionKey(line)}|${Math.round(line.toProcureLengthMm)}`;
	}

	function unitWeightKgPerM(line: UiIndentLine): number | null {
		if (line.requiredWeightKg == null || line.requiredQty <= 0 || line.requiredLengthMm <= 0) {
			return null;
		}
		const kgPerBar = line.requiredWeightKg / line.requiredQty;
		return kgPerBar / (line.requiredLengthMm / 1000);
	}

	function procureWeightKg(line: UiIndentLine): number | null {
		const unit = unitWeightKgPerM(line);
		if (unit == null || line.toProcureQty <= 0 || line.toProcureLengthMm <= 0) return null;
		return (line.toProcureLengthMm / 1000) * line.toProcureQty * unit;
	}

	function toRows(indentLines: UiIndentLine[]): LineRow[] {
		return indentLines.map((line, index) => ({
			...line,
			id: `${index}:${sectionKey(line)}|${line.requiredLengthMm}`
		}));
	}

	function updateDraft(
		id: string,
		patch: Partial<Pick<UiIndentLine, 'toProcureLengthMm' | 'toProcureQty'>>
	) {
		editDrafts = editDrafts.map((row) => (row.id === id ? { ...row, ...patch } : row));
	}

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
			const requiredLengths = new Set(group.map((l) => l.requiredLengthMm));
			let toProcureKg: number | null = 0;
			for (const line of group) {
				const kg = procureWeightKg(line);
				if (kg == null) {
					toProcureKg = null;
					break;
				}
				toProcureKg += kg;
			}
			const procureLength = group[0]!.toProcureLengthMm;
			out.push({
				id: key,
				section: group[0]?.section || sectionKey(group[0]!) || '-',
				requiredLengthLabel:
					requiredLengths.size === 1 ? formatLength([...requiredLengths][0]!) : '-',
				requiredQty: group.reduce((sum, l) => sum + l.requiredQty, 0),
				toProcureLengthLabel: formatLength(procureLength),
				toProcureQty: group.reduce((sum, l) => sum + l.toProcureQty, 0),
				toProcureMt: formatWeightMt(toProcureKg),
				lineCount: group.length
			});
		}
		return out;
	});

	const splitLines = $derived(
		selectedGroupKey == null ? [] : lines.filter((line) => groupKey(line) === selectedGroupKey)
	);

	/** Lines shown in length/edit table (all lines from main Edit, or split group). */
	const lengthScope = $derived(selectedGroupKey == null ? lines : splitLines);
	const displayLengthRows = $derived(isEditing ? editDrafts : lengthScope);

	/** Main list uses rollup; edit or split uses length rows. */
	const showLengthTable = $derived(isEditing || selectedGroupKey != null);

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

	function handleSave() {
		if (isSaving || !indentId) return;
		isSaving = true;
		try {
			const draftById = new SvelteMap(editDrafts.map((row) => [row.id, row]));
			const nextLines = lines.map((line) => {
				const draft = draftById.get(line.id);
				if (!draft) return line;
				return {
					...line,
					toProcureLengthMm: Math.max(0, Math.round(draft.toProcureLengthMm)),
					toProcureQty: Math.max(0, Math.round(draft.toProcureQty))
				};
			});
			const saved = updateUiIndentLines(indentId, nextLines);
			if (!saved) throw new Error('Indent not found.');
			lines = toRows(saved.lines);
			editDrafts = [];
			isEditing = false;
			if (selectedGroupKey != null && !lines.some((line) => groupKey(line) === selectedGroupKey)) {
				selectedGroupKey = null;
			}
			rmiPushToast({
				title: 'Indent updated',
				description: 'UI-only changes are session-local.'
			});
		} catch (error) {
			rmiPushToast({
				title: 'Could not save',
				description: error instanceof Error ? error.message : 'Save failed.'
			});
		} finally {
			isSaving = false;
		}
	}

	const sectionColumns = $derived.by((): DataTableColumn<SectionRow>[] => [
		{
			type: 'serial',
			key: 'sNo',
			header: 'S.No',
			value: (row) => String(sectionRows.indexOf(row) + 1)
		},
		{ key: 'section', header: 'Section', class: 'font-medium' },
		{ key: 'requiredLengthLabel', header: 'Required Length' },
		{
			key: 'requiredQty',
			header: 'Required (pcs)',
			value: (row) => String(row.requiredQty)
		},
		{
			key: 'toProcureLengthLabel',
			header: 'To Procure Length',
			class: 'font-semibold text-primary'
		},
		{
			key: 'toProcureQty',
			header: 'To Procure (pcs)',
			class: 'font-semibold text-primary',
			value: (row) => String(row.toProcureQty)
		},
		{
			key: 'toProcureMt',
			header: 'To Procure (MT)',
			class: 'font-semibold text-primary'
		}
	]);

	const lengthColumns = $derived.by((): DataTableColumn<LineRow>[] => {
		const cols: DataTableColumn<LineRow>[] = [
			{
				type: 'serial',
				key: 'sNo',
				header: 'S.No',
				value: (row) => String(displayLengthRows.indexOf(row) + 1)
			},
			{ key: 'section', header: 'Section', class: 'font-medium' },
			{
				key: 'requiredLength',
				header: 'Required Length',
				value: (row) => formatLength(row.requiredLengthMm)
			},
			{
				key: 'requiredQty',
				header: 'Required (pcs)',
				value: (row) => String(row.requiredQty)
			}
		];

		if (isEditing) {
			cols.push(
				{
					type: 'input',
					key: 'toProcureLength',
					header: 'To Procure Length (mm)',
					inputType: 'number',
					step: 1,
					value: (row) => String(row.toProcureLengthMm),
					onValueChange: (row, value) => {
						const parsed = value.trim() === '' ? 0 : Number(value);
						if (!Number.isFinite(parsed)) return;
						updateDraft(row.id, { toProcureLengthMm: Math.round(parsed) });
					},
					ariaLabel: (row) => `To Procure length mm for ${row.section}`,
					class: 'font-semibold text-primary'
				},
				{
					type: 'input',
					key: 'toProcureQty',
					header: 'To Procure (pcs)',
					inputType: 'number',
					step: 1,
					min: 0,
					value: (row) => String(row.toProcureQty),
					onValueChange: (row, value) => {
						const parsed = value.trim() === '' ? 0 : Number(value);
						if (!Number.isFinite(parsed)) return;
						updateDraft(row.id, { toProcureQty: Math.max(0, Math.round(parsed)) });
					},
					ariaLabel: (row) => `To Procure pcs for ${row.section}`,
					class: 'font-semibold text-primary'
				}
			);
		} else {
			cols.push(
				{
					key: 'toProcureLength',
					header: 'To Procure Length',
					class: 'font-semibold text-primary',
					value: (row) => formatLength(row.toProcureLengthMm)
				},
				{
					key: 'toProcureQty',
					header: 'To Procure (pcs)',
					class: 'font-semibold text-primary',
					value: (row) => String(row.toProcureQty)
				}
			);
		}

		cols.push({
			key: 'toProcureMt',
			header: 'To Procure (MT)',
			class: 'font-semibold text-primary',
			value: (row) => formatWeightMt(procureWeightKg(row))
		});

		return cols;
	});

	const editToolbar = $derived.by(() => {
		if (isLoading || lines.length === 0) return [];
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
				onClick: () => handleSave()
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

	onMount(() => {
		isLoading = true;
		try {
			if (!isUiIndentId(indentId)) {
				window.location.hash = `#/${app.appName}/Indents/${encodeURIComponent(indentId)}`;
				return;
			}
			const indent = getUiIndent(indentId);
			if (!indent) {
				rmiPushToast({
					title: 'Indent not found',
					description: 'UI-only indents live in this browser session only.'
				});
				window.location.hash = `#/${app.appName}/Indents`;
				return;
			}
			title = `#${indent.indentNo} - UI`;
			subtitle = `${indent.planLabel} · ${formatMonthLabel(indent.month)} · ${indent.projectLabel}`;
			lines = toRows(indent.lines);
		} finally {
			isLoading = false;
		}
	});
</script>

<div class="flex h-full min-h-0 flex-col overflow-hidden p-3 md:p-4">
	<div class="mb-3 shrink-0">
		<div class="text-base font-medium text-foreground">{title}</div>
		<div class="text-sm text-muted-foreground">
			{subtitle}
			<span class="ml-2 rounded border border-border px-1.5 py-0.5 text-xs">UI only</span>
		</div>
	</div>
	<div class="min-h-0 flex-1">
		{#if !showLengthTable}
			<DataTable
				columns={sectionColumns}
				rows={sectionRows}
				loading={isLoading}
				rowKey={(row) => row.id}
				search={{ enabled: true }}
				toolbarButton={mainToolbar}
				onRowClick={(row) => openSection(row)}
				pagination={{ enabled: false }}
				sorting={{ enabled: false }}
				filtering={{ enabled: false }}
				emptyState={{
					icon: Ticket,
					title: 'No lines',
					description: 'This UI indent has no procure lines.'
				}}
			/>
		{:else}
			<DataTable
				columns={lengthColumns}
				rows={displayLengthRows}
				loading={isLoading}
				rowKey={(row) => row.id}
				search={{ enabled: !isEditing }}
				toolbarButton={splitToolbar}
				pagination={{ enabled: false }}
				sorting={{ enabled: false }}
				filtering={{ enabled: false }}
				emptyState={{
					icon: Ticket,
					title: 'No length rows',
					description: 'No splits for this section.'
				}}
			/>
		{/if}
	</div>
</div>
