<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { tick } from 'svelte';
	import { Check, ChevronsUpDown, Search } from '@lucide/svelte';
	import { Label } from '$lib/components/ui/label';
	import { cn } from '$lib/utils/cn';
	import { resolveDropdownPlacement } from '$lib/components/ui/dropdown-menu/dropdown-menu.utils';
	import { DEFAULT_COMBOBOX_MAX_HEIGHT } from './combobox.constants';
	import type { ComboboxAlign, ComboboxItem, ComboboxSide } from './combobox.constants';
	import {
		comboboxContentClass,
		comboboxEmptyClass,
		comboboxOptionCheckClass,
		comboboxOptionClass,
		comboboxOptionLabelClass,
		comboboxOptionMetaClass,
		comboboxOptionStateClass,
		comboboxScrollClass,
		comboboxSearchIconClass,
		comboboxSearchInputClass,
		comboboxSearchWrapperClass,
		comboboxSearchWrapperEdgeClass,
		comboboxTriggerClass,
		comboboxTriggerIconClass,
		comboboxTriggerLabelClass,
		comboboxTriggerMetaClass,
		comboboxTriggerOpenClass,
		comboboxTriggerPlaceholderClass,
		comboboxWrapperClass
	} from './combobox.styles';
	import { filterComboboxItems, normalizeComboboxValue } from './combobox.utils';

	type Props = {
		items: ComboboxItem[];
		value?: string | string[];
		multiple?: boolean;
		open?: boolean;
		onOpenChange?: (open: boolean) => void;
		onValueChange?: (value: string | string[]) => void;
		label?: string;
		id?: string;
		placeholder?: string;
		searchPlaceholder?: string;
		emptyText?: string;
		disabled?: boolean;
		side?: ComboboxSide;
		align?: ComboboxAlign;
		maxHeight?: string;
		class?: string;
		labelClass?: string;
		triggerClass?: string;
		searchClass?: string;
		contentClass?: string;
	} & HTMLAttributes<HTMLDivElement>;

	let {
		items,
		value = $bindable<string | string[] | undefined>(undefined),
		multiple = false,
		open = $bindable(false),
		onOpenChange,
		onValueChange,
		label,
		id,
		placeholder = 'Select...',
		searchPlaceholder = 'Search...',
		emptyText = 'No results found.',
		disabled = false,
		side = 'bottom',
		align = 'start',
		maxHeight = DEFAULT_COMBOBOX_MAX_HEIGHT,
		class: className = '',
		labelClass = '',
		triggerClass = '',
		searchClass = '',
		contentClass = '',
		...rest
	}: Props = $props();

	let triggerEl = $state<HTMLButtonElement | null>(null);
	let searchEl = $state<HTMLInputElement | null>(null);
	let wrapperEl = $state<HTMLDivElement | null>(null);
	let contentEl = $state<HTMLDivElement | null>(null);
	let query = $state('');
	let highlightedIndex = $state(-1);
	let position = $state<{ top?: number; bottom?: number; left: number }>({ left: 0 });
	let menuWidth = $state<number | undefined>(undefined);
	let resolvedSide = $state<ComboboxSide>('bottom');

	const fallbackId = `combobox-${Math.random().toString(36).slice(2, 9)}`;
	const resolvedId = $derived(id ?? fallbackId);
	const listboxId = $derived(`${resolvedId}-listbox`);
	const searchId = $derived(`${resolvedId}-search`);

	const selectedValues = $derived(normalizeComboboxValue(value, multiple));

	const selectedLabel = $derived.by(() => {
		if (multiple) {
			if (selectedValues.length === 0) {
				return '';
			}

			return items
				.filter((item) => selectedValues.includes(item.value))
				.map((item) => item.label)
				.join(', ');
		}

		return items.find((item) => item.value === value)?.label ?? '';
	});

	const selectedMeta = $derived.by(() => {
		if (multiple) {
			return '';
		}

		return items.find((item) => item.value === value)?.meta ?? '';
	});

	const hasValue = $derived(selectedLabel.length > 0);
	const filteredItems = $derived(filterComboboxItems(items, query));

	function portal(node: HTMLElement) {
		const target = wrapperEl?.closest('dialog') || document.body;
		target.appendChild(node);
		return {
			destroy() {
				node.remove();
			}
		};
	}

	function isSelected(item: ComboboxItem): boolean {
		return selectedValues.includes(item.value);
	}

	function setValue(next: string | string[]) {
		value = next;
		onValueChange?.(next);
	}

	function setOpen(next: boolean) {
		open = next;
		onOpenChange?.(next);
	}

	function resetQuery() {
		query = '';
		highlightedIndex = -1;
	}

	async function openMenu() {
		if (disabled) {
			return;
		}

		resetQuery();
		setOpen(true);
		await tick();
		searchEl?.focus();
	}

	function closeMenu() {
		setOpen(false);
		resetQuery();
	}

	function toggleOpen() {
		if (open) {
			closeMenu();
			triggerEl?.focus();
			return;
		}

		void openMenu();
	}

	function selectItem(item: ComboboxItem) {
		if (item.disabled) {
			return;
		}

		if (multiple) {
			const next = isSelected(item)
				? selectedValues.filter((entry) => entry !== item.value)
				: [...selectedValues, item.value];
			setValue(next);
			searchEl?.focus();
			return;
		}

		setValue(item.value);
		closeMenu();
		triggerEl?.focus();
	}

	function moveHighlight(delta: number) {
		if (filteredItems.length === 0) {
			highlightedIndex = -1;
			return;
		}

		let next = highlightedIndex + delta;
		if (next < 0) {
			next = filteredItems.length - 1;
		} else if (next >= filteredItems.length) {
			next = 0;
		}

		while (filteredItems[next]?.disabled) {
			next += delta;
			if (next < 0 || next >= filteredItems.length) {
				highlightedIndex = -1;
				return;
			}
		}

		highlightedIndex = next;
	}

	async function updatePosition() {
		await tick();
		if (!wrapperEl || !contentEl) {
			return;
		}

		const triggerRect = wrapperEl.getBoundingClientRect();
		const gap = 4;
		menuWidth = triggerRect.width;

		const placement = resolveDropdownPlacement({
			preferredSide: side,
			preferredAlign: align,
			triggerRect,
			contentRect: contentEl.getBoundingClientRect(),
			gap
		});

		resolvedSide = placement.side;

		if (placement.side === 'top') {
			position = {
				top: undefined,
				bottom: window.innerHeight - triggerRect.top + gap,
				left: placement.left
			};
			return;
		}

		position = {
			top: placement.top,
			bottom: undefined,
			left: placement.left
		};
	}

	function handleSearchInput(event: Event) {
		query = (event.currentTarget as HTMLInputElement).value;
		highlightedIndex = -1;
	}

	function handleSearchKeyDown(event: KeyboardEvent) {
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			if (resolvedSide === 'top' && highlightedIndex === -1) {
				return;
			}
			moveHighlight(1);
			return;
		}

		if (event.key === 'ArrowUp') {
			event.preventDefault();
			moveHighlight(-1);
			return;
		}

		if (event.key === 'Enter') {
			event.preventDefault();
			const item = filteredItems[highlightedIndex];
			if (item) {
				selectItem(item);
			}
			return;
		}

		if (event.key === 'Escape') {
			event.preventDefault();
			closeMenu();
			triggerEl?.focus();
		}
	}

	function handleTriggerKeyDown(event: KeyboardEvent) {
		if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			void openMenu();
		}
	}

	$effect(() => {
		if (!open) {
			return;
		}

		void updatePosition();

		const onPointerDown = (event: PointerEvent) => {
			const target = event.target as Node;
			if (contentEl?.contains(target)) {
				return;
			}
			if (wrapperEl?.contains(target)) {
				return;
			}
			closeMenu();
		};

		const onReposition = () => {
			void updatePosition();
		};

		document.addEventListener('pointerdown', onPointerDown);
		window.addEventListener('resize', onReposition);
		window.addEventListener('scroll', onReposition, true);

		return () => {
			document.removeEventListener('pointerdown', onPointerDown);
			window.removeEventListener('resize', onReposition);
			window.removeEventListener('scroll', onReposition, true);
		};
	});

	$effect(() => {
		if (highlightedIndex >= filteredItems.length) {
			highlightedIndex = -1;
		}
	});
</script>

<div class={cn(className)} {...rest}>
	{#if label}
		<Label for={resolvedId} text={label} class={cn('mb-2 block', labelClass)} />
	{/if}

	<div class={comboboxWrapperClass} bind:this={wrapperEl}>
		<button
			bind:this={triggerEl}
			id={resolvedId}
			type="button"
			role="combobox"
			aria-expanded={open}
			aria-controls={listboxId}
			aria-haspopup="listbox"
			class={cn(comboboxTriggerClass, comboboxTriggerOpenClass(open), triggerClass)}
			{disabled}
			onclick={toggleOpen}
			onkeydown={handleTriggerKeyDown}
		>
			<span class="flex min-w-0 flex-1 items-center justify-between gap-4">
				<span class={cn(comboboxTriggerLabelClass, !hasValue && comboboxTriggerPlaceholderClass)}>
					{selectedLabel || placeholder}
				</span>
				{#if selectedMeta}
					<span class={comboboxTriggerMetaClass}>{selectedMeta}</span>
				{/if}
			</span>
			<ChevronsUpDown class={comboboxTriggerIconClass} aria-hidden="true" />
		</button>

		{#if open}
			<div
				use:portal
				bind:this={contentEl}
				class={cn(comboboxContentClass, resolvedSide === 'top' && 'flex-col-reverse', contentClass)}
				style:top={position.top === undefined ? undefined : `${position.top}px`}
				style:bottom={position.bottom === undefined ? undefined : `${position.bottom}px`}
				style:left="{position.left}px"
				style:width={menuWidth ? `${menuWidth}px` : undefined}
			>
				<div
					class={cn(
						comboboxSearchWrapperClass,
						comboboxSearchWrapperEdgeClass(resolvedSide === 'top')
					)}
				>
					<Search class={comboboxSearchIconClass} aria-hidden="true" />
					<input
						bind:this={searchEl}
						id={searchId}
						type="text"
						role="searchbox"
						aria-controls={listboxId}
						class={cn(comboboxSearchInputClass, searchClass)}
						placeholder={searchPlaceholder}
						value={query}
						oninput={handleSearchInput}
						onkeydown={handleSearchKeyDown}
					/>
				</div>

				<div
					id={listboxId}
					role="listbox"
					aria-multiselectable={multiple}
					class={comboboxScrollClass}
					style:max-height={maxHeight}
				>
					{#each filteredItems as item, index (item.value)}
						{@const selected = isSelected(item)}
						{@const highlighted = index === highlightedIndex}
						<button
							type="button"
							role="option"
							aria-selected={selected}
							disabled={item.disabled}
							class={cn(comboboxOptionClass, comboboxOptionStateClass(selected, highlighted))}
							onmouseenter={() => {
								highlightedIndex = index;
							}}
							onclick={() => selectItem(item)}
						>
							<Check
								class={cn(comboboxOptionCheckClass, selected ? 'opacity-100' : 'opacity-0')}
								aria-hidden="true"
							/>
							<span class="flex min-w-0 flex-1 items-center justify-between gap-4">
								<span class={comboboxOptionLabelClass}>{item.label}</span>
								{#if item.meta}
									<span class={comboboxOptionMetaClass}>{item.meta}</span>
								{/if}
							</span>
						</button>
					{:else}
						<p class={comboboxEmptyClass}>{emptyText}</p>
					{/each}
				</div>
			</div>
		{/if}
	</div>
</div>
