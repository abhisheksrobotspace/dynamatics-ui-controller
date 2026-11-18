<script lang="ts" module>
	import { SvelteSet } from 'svelte/reactivity';

	const openListeners = new SvelteSet<(id: string) => void>();

	function announceSearchSelectOpen(id: string) {
		for (const listener of openListeners) listener(id);
	}

	function subscribeSearchSelectOpen(listener: (id: string) => void) {
		openListeners.add(listener);
		return () => openListeners.delete(listener);
	}
</script>

<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { tick } from 'svelte';
	import { Check, ChevronDown, X } from '@lucide/svelte';
	import { Badge } from '$lib/components/ui/badge';
	import { Label } from '$lib/components/ui/label';
	import { cn } from '$lib/utils/cn';
	import { DEFAULT_COMBOBOX_MAX_HEIGHT } from '../combobox/combobox.constants';
	import {
		comboboxEmptyClass,
		comboboxOptionCheckClass,
		comboboxOptionClass,
		comboboxOptionLabelClass,
		comboboxOptionMetaClass,
		comboboxOptionStateClass,
		comboboxScrollClass,
		comboboxTriggerClass,
		comboboxTriggerIconClass,
		comboboxTriggerPlaceholderClass,
		comboboxWrapperClass
	} from '../combobox/combobox.styles';
	import { searchSelectPanelClass } from './search-select.styles';
	import type { SearchSelectItem } from './search-select.constants';

	type Props = {
		items?: SearchSelectItem[];
		value?: string;
		open?: boolean;
		onOpenChange?: (open: boolean) => void;
		onValueChange?: (value: string) => void;
		label?: string;
		id?: string;
		placeholder?: string;
		searchPlaceholder?: string;
		emptyText?: string;
		disabled?: boolean;
		clearable?: boolean;
		maxHeight?: string;
		class?: string;
		labelClass?: string;
		triggerClass?: string;
		searchClass?: string;
		contentClass?: string;
	} & HTMLAttributes<HTMLDivElement>;

	let {
		items = [],
		value = $bindable(''),
		open = $bindable(false),
		onOpenChange,
		onValueChange,
		label,
		id,
		placeholder = 'Select...',
		searchPlaceholder = 'Search...',
		emptyText = 'No results found.',
		disabled = false,
		clearable = false,
		maxHeight = DEFAULT_COMBOBOX_MAX_HEIGHT,
		class: className = '',
		labelClass = '',
		triggerClass = '',
		searchClass = '',
		contentClass = '',
		...rest
	}: Props = $props();

	const instanceId = `search-select-${Math.random().toString(36).slice(2, 9)}`;
	const fallbackId = `search-select-field-${Math.random().toString(36).slice(2, 9)}`;

	let searchEl = $state<HTMLInputElement | null>(null);
	let wrapperEl = $state<HTMLDivElement | null>(null);
	let query = $state('');
	let highlightedIndex = $state(-1);
	let ignoreFocus = false;

	const resolvedId = $derived(id ?? fallbackId);
	const listboxId = $derived(`${resolvedId}-listbox`);
	const flatItems = $derived.by(() => {
		const normalized = query.trim().toLowerCase();
		if (!normalized) return items;
		return items.filter(
			(item) =>
				item.label.toLowerCase().includes(normalized) ||
				item.meta?.toLowerCase().includes(normalized) ||
				item.badge?.label.toLowerCase().includes(normalized)
		);
	});

	const selectedItem = $derived(items.find((item) => item.value === value));

	const selectedLabel = $derived(selectedItem?.label ?? '');
	const hasValue = $derived(selectedLabel.length > 0);

	function setOpen(next: boolean) {
		open = next;
		onOpenChange?.(next);
	}

	function clearSelection(event: Event) {
		event.preventDefault();
		event.stopPropagation();
		value = '';
		onValueChange?.('');
		closeMenu();
		focusSearchInput();
	}

	function closeMenu() {
		setOpen(false);
		query = '';
		highlightedIndex = -1;
	}

	/** Focus the field without letting the focus handler open the menu. */
	function focusSearchInput() {
		ignoreFocus = true;
		searchEl?.focus();
		ignoreFocus = false;
	}

	function toggleMenu(event: Event) {
		event.preventDefault();
		event.stopPropagation();
		if (disabled) return;
		if (open) {
			closeMenu();
			focusSearchInput();
			return;
		}
		void openMenu();
	}

	async function openMenu() {
		if (disabled) return;
		query = '';
		highlightedIndex = -1;
		announceSearchSelectOpen(instanceId);
		setOpen(true);
		await tick();
		searchEl?.focus();
	}

	function selectItem(item: SearchSelectItem) {
		if (item.disabled) return;
		value = item.value;
		onValueChange?.(item.value);
		closeMenu();
		focusSearchInput();
	}

	function moveHighlight(delta: number) {
		if (flatItems.length === 0) {
			highlightedIndex = -1;
			return;
		}

		let next = highlightedIndex + delta;
		if (next < 0) next = flatItems.length - 1;
		else if (next >= flatItems.length) next = 0;

		while (flatItems[next]?.disabled) {
			next += delta;
			if (next < 0 || next >= flatItems.length) {
				highlightedIndex = -1;
				return;
			}
		}

		highlightedIndex = next;
	}

	function handleFocus() {
		if (ignoreFocus || disabled || open) return;
		void openMenu();
	}

	function handleSearchInput(event: Event) {
		query = (event.currentTarget as HTMLInputElement).value;
		highlightedIndex = -1;
		if (!open && !disabled) setOpen(true);
	}

	function handleSearchKeyDown(event: KeyboardEvent) {
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			if (!open) {
				void openMenu();
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
			const item = flatItems[highlightedIndex];
			if (item) selectItem(item);
			return;
		}

		if (event.key === 'Tab') {
			// Let focus move on; just close the panel so it doesn't stay open behind the next field.
			closeMenu();
			return;
		}

		if (event.key === 'Escape') {
			event.preventDefault();
			event.stopPropagation();
			closeMenu();
			focusSearchInput();
		}
	}

	function flatIndex(item: SearchSelectItem): number {
		return flatItems.indexOf(item);
	}

	$effect(() => {
		const isOpen = open;
		return subscribeSearchSelectOpen((id) => {
			if (id !== instanceId && isOpen) closeMenu();
		});
	});

	$effect(() => {
		if (!open) return;
		announceSearchSelectOpen(instanceId);
		void tick().then(() => searchEl?.focus());
	});

	$effect(() => {
		if (!open) return;

		const onPointerDown = (event: PointerEvent) => {
			const target = event.target as Node;
			if (wrapperEl?.contains(target)) return;
			closeMenu();
		};

		document.addEventListener('pointerdown', onPointerDown);
		return () => document.removeEventListener('pointerdown', onPointerDown);
	});
</script>

<div class={cn(className)} {...rest}>
	{#if label}
		<Label for={resolvedId} text={label} class={cn('mb-2 block', labelClass)} />
	{/if}

	<div class={comboboxWrapperClass} bind:this={wrapperEl}>
		<div class={cn(comboboxTriggerClass, triggerClass)}>
			<input
				bind:this={searchEl}
				id={resolvedId}
				type="text"
				role="combobox"
				aria-expanded={open}
				aria-controls={listboxId}
				aria-autocomplete="list"
				class={cn(
					'min-w-0 flex-1 truncate border-0 bg-transparent shadow-none outline-none placeholder:text-placeholder focus:border-transparent focus:shadow-none focus:ring-0 focus:outline-none focus-visible:ring-0',
					!open && !hasValue && comboboxTriggerPlaceholderClass,
					searchClass
				)}
				placeholder={open ? searchPlaceholder : placeholder}
				{disabled}
				value={open ? query : selectedLabel}
				onfocus={handleFocus}
				oninput={handleSearchInput}
				onkeydown={handleSearchKeyDown}
			/>
			{#if clearable && hasValue && !disabled}
				<button
					type="button"
					class="inline-flex size-5 shrink-0 items-center justify-center text-foreground"
					aria-label="Clear"
					onpointerdown={clearSelection}
				>
					<X class="size-4" aria-hidden="true" />
				</button>
			{/if}
			{#if !open && selectedItem?.badge}
				<Badge
					variant={selectedItem.badge.variant ?? 'default'}
					label={selectedItem.badge.label}
					class={cn('shrink-0', selectedItem.badge.class)}
				/>
			{/if}
			<button
				type="button"
				class="inline-flex shrink-0 items-center justify-center border-0 bg-transparent p-0 text-muted-foreground"
				aria-label={open ? 'Close' : 'Open'}
				tabindex={-1}
				{disabled}
				onpointerdown={toggleMenu}
			>
				<ChevronDown class={comboboxTriggerIconClass} aria-hidden="true" />
			</button>
		</div>

		{#if open}
			<div class={cn(searchSelectPanelClass, contentClass)}>
				{#if flatItems.length === 0}
					<p class={comboboxEmptyClass}>{emptyText}</p>
				{:else}
					<div
						id={listboxId}
						role="listbox"
						class={comboboxScrollClass}
						style:max-height={maxHeight}
					>
						{#each flatItems as item (item.value)}
							{@const selected = item.value === value}
							{@const highlighted = flatIndex(item) === highlightedIndex}
							<button
								type="button"
								role="option"
								aria-selected={selected}
								disabled={item.disabled}
								class={cn(comboboxOptionClass, comboboxOptionStateClass(selected, highlighted))}
								onmouseenter={() => {
									highlightedIndex = flatIndex(item);
								}}
								onclick={() => selectItem(item)}
							>
								<Check
									class={cn(comboboxOptionCheckClass, selected ? 'opacity-100' : 'opacity-0')}
									aria-hidden="true"
								/>
								<span class="flex min-w-0 flex-1 items-center justify-between gap-4">
									<span class={comboboxOptionLabelClass}>{item.label}</span>
									{#if item.badge}
										<Badge
											variant={item.badge.variant ?? 'default'}
											label={item.badge.label}
											class={cn('shrink-0', item.badge.class)}
										/>
									{:else if item.meta}
										<span class={comboboxOptionMetaClass}>{item.meta}</span>
									{/if}
								</span>
							</button>
						{/each}
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>
