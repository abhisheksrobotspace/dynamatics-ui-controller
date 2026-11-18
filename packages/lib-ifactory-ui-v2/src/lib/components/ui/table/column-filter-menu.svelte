<script lang="ts">
	import { tick } from 'svelte';
	import { ListFilter, Search } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Input } from '$lib/components/ui/input';
	import { cn } from '$lib/utils/cn';
	import type {
		ColumnFilter,
		ColumnFilterConditionOperator,
		DataTableColumnDataType
	} from './data-table.constants';
	import {
		buildAppliedColumnFilter,
		formatFilterValueLabel,
		getConditionOptionsForDataType,
		isColumnFilterActive,
		isConditionOperatorValueless
	} from './data-table-filter.utils';
	import { resolveFilterMenuPlacement } from './column-filter-menu.utils';
	import {
		columnFilterConditionRowClass,
		columnFilterFooterClass,
		columnFilterPanelClass,
		columnFilterSectionClass,
		columnFilterSectionTitleClass,
		columnFilterSelectClass,
		columnFilterTriggerActiveClass,
		columnFilterTriggerClass,
		columnFilterValueRowClass,
		columnFilterValuesListClass
	} from './column-filter-menu.styles';

	type Props = {
		columnKey: string;
		columnLabel: string;
		dataType?: DataTableColumnDataType;
		uniqueValues: string[];
		filter?: ColumnFilter;
		conditionsEnabled?: boolean;
		onApply: (filter: ColumnFilter | null) => void;
		class?: string;
	};

	let {
		columnKey,
		columnLabel,
		dataType = 'string',
		uniqueValues,
		filter,
		conditionsEnabled: allowConditions = false,
		onApply,
		class: className = ''
	}: Props = $props();

	let open = $state(false);
	let triggerEl = $state<HTMLButtonElement | null>(null);
	let contentEl = $state<HTMLDivElement | null>(null);
	let position = $state({ top: 0, left: 0 });

	let draftSelectedValues = $state<string[]>([]);
	let valueSearch = $state('');
	let conditionEnabled = $state(false);
	let conditionOperator = $state<ColumnFilterConditionOperator>('contains');
	let conditionValue = $state('');

	const active = $derived(isColumnFilterActive(filter));
	const conditionOptions = $derived(getConditionOptionsForDataType(dataType));
	const conditionNeedsValue = $derived(!isConditionOperatorValueless(conditionOperator));

	const visibleValues = $derived.by(() => {
		const query = valueSearch.trim().toLowerCase();
		if (!query) {
			return uniqueValues;
		}

		return uniqueValues.filter((value) =>
			formatFilterValueLabel(value).toLowerCase().includes(query)
		);
	});

	function portal(node: HTMLElement) {
		// Native showModal() dialogs use the top layer; body-level portals sit behind them.
		const target = triggerEl?.closest('dialog') || document.body;
		target.appendChild(node);
		return {
			destroy() {
				node.remove();
			}
		};
	}

	function defaultOperator(): ColumnFilterConditionOperator {
		return dataType === 'string' ? 'contains' : 'equals';
	}

	function resetDraftFromFilter() {
		draftSelectedValues =
			filter?.selectedValues !== undefined ? [...filter.selectedValues] : [...uniqueValues];
		valueSearch = '';
		conditionEnabled = allowConditions && Boolean(filter?.condition);
		conditionOperator = filter?.condition?.operator ?? defaultOperator();
		conditionValue = filter?.condition?.value ?? '';
	}

	async function updatePosition() {
		if (!triggerEl || !contentEl) {
			return;
		}

		const placement = resolveFilterMenuPlacement({
			triggerRect: triggerEl.getBoundingClientRect(),
			contentRect: contentEl.getBoundingClientRect(),
			gap: 4
		});

		position = { top: placement.top, left: placement.left };
	}

	async function openMenu() {
		resetDraftFromFilter();
		open = true;
		await tick();
		await updatePosition();
	}

	function closeMenu() {
		open = false;
	}

	function toggleOpen() {
		if (open) {
			closeMenu();
			return;
		}

		void openMenu();
	}

	function toggleValue(value: string, checked: boolean) {
		if (checked) {
			if (!draftSelectedValues.includes(value)) {
				draftSelectedValues = [...draftSelectedValues, value];
			}
			return;
		}

		draftSelectedValues = draftSelectedValues.filter((entry) => entry !== value);
	}

	function selectAllVisible() {
		draftSelectedValues = [
			...draftSelectedValues,
			...visibleValues.filter((value) => !draftSelectedValues.includes(value))
		];
	}

	function clearVisible() {
		draftSelectedValues = draftSelectedValues.filter((value) => !visibleValues.includes(value));
	}

	function handleApply() {
		const next = buildAppliedColumnFilter(
			draftSelectedValues,
			uniqueValues,
			allowConditions && conditionEnabled,
			{
				operator: conditionOperator,
				value: conditionValue
			}
		);
		onApply(next);
		closeMenu();
	}

	function handleCancel() {
		closeMenu();
	}

	function handlePointerDown(event: PointerEvent) {
		const target = event.target as Node | null;
		if (!target) {
			return;
		}

		if (triggerEl?.contains(target) || contentEl?.contains(target)) {
			return;
		}

		closeMenu();
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			closeMenu();
		}
	}

	$effect(() => {
		if (!open) {
			return;
		}

		const onScroll = () => {
			void updatePosition();
		};

		window.addEventListener('pointerdown', handlePointerDown, true);
		window.addEventListener('keydown', handleKeydown);
		window.addEventListener('resize', onScroll);
		window.addEventListener('scroll', onScroll, true);

		return () => {
			window.removeEventListener('pointerdown', handlePointerDown, true);
			window.removeEventListener('keydown', handleKeydown);
			window.removeEventListener('resize', onScroll);
			window.removeEventListener('scroll', onScroll, true);
		};
	});
</script>

<button
	bind:this={triggerEl}
	type="button"
	class={cn(columnFilterTriggerClass, columnFilterTriggerActiveClass(active), className)}
	aria-label="Filter {columnLabel}"
	aria-haspopup="dialog"
	aria-expanded={open}
	data-column-key={columnKey}
	onclick={(event) => {
		event.stopPropagation();
		toggleOpen();
	}}
>
	<ListFilter class="size-3.5" aria-hidden="true" />
</button>

{#if open}
	<div
		bind:this={contentEl}
		use:portal
		class={columnFilterPanelClass}
		style="top: {position.top}px; left: {position.left}px;"
		role="dialog"
		aria-label="Column filter for {columnLabel}"
	>
		{#if allowConditions}
			<div class={columnFilterSectionClass}>
				<div class="flex items-center justify-between gap-2">
					<span class={columnFilterSectionTitleClass}>Filter by condition</span>
					<Checkbox
						checked={conditionEnabled}
						onCheckedChange={(checked) => {
							conditionEnabled = checked;
						}}
						aria-label="Enable condition filter"
					/>
				</div>

				{#if conditionEnabled}
					<div class={columnFilterConditionRowClass}>
						<select
							class={columnFilterSelectClass}
							value={conditionOperator}
							onchange={(event) => {
								conditionOperator = event.currentTarget.value as ColumnFilterConditionOperator;
							}}
							aria-label="Condition operator"
						>
							{#each conditionOptions as option (option.value)}
								<option value={option.value}>{option.label}</option>
							{/each}
						</select>

						{#if conditionNeedsValue}
							<Input
								size="sm"
								placeholder="Value"
								bind:value={conditionValue}
								aria-label="Condition value"
							/>
						{/if}
					</div>
				{/if}
			</div>
		{/if}

		<div class={columnFilterSectionClass}>
			<div class="mt-2 flex items-center gap-2">
				<div class="relative min-w-0 flex-1">
					<Search
						class="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground"
						aria-hidden="true"
					/>
					<Input
						size="sm"
						type="search"
						placeholder="Search {columnLabel}"
						bind:value={valueSearch}
						class="pl-7"
						aria-label="Search {columnLabel}"
					/>
				</div>
				<Button
					variant="outline"
					size="sm"
					label="Include all"
					class="shrink-0"
					disabled={visibleValues.length === 0}
					onclick={selectAllVisible}
				/>
				<Button
					variant="outline"
					size="sm"
					label="Exclude all"
					class="shrink-0"
					disabled={visibleValues.length === 0}
					onclick={clearVisible}
				/>
			</div>
			<div class={columnFilterValuesListClass}>
				{#if visibleValues.length === 0}
					<p class="px-1 py-2 text-sm text-muted-foreground">No values</p>
				{:else}
					{#each visibleValues as value (value)}
						<label class={columnFilterValueRowClass}>
							<Checkbox
								checked={draftSelectedValues.includes(value)}
								onCheckedChange={(checked) => toggleValue(value, checked)}
								aria-label={formatFilterValueLabel(value)}
							/>
							<span class="truncate">{formatFilterValueLabel(value)}</span>
						</label>
					{/each}
				{/if}
			</div>
		</div>

		<div class={columnFilterFooterClass}>
			<Button variant="outline" size="sm" label="Cancel" onclick={handleCancel} />
			<Button variant="primary" size="sm" label="OK" onclick={handleApply} />
		</div>
	</div>
{/if}
