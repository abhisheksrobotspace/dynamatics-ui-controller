<script lang="ts">
	import type { HTMLAttributes, HTMLInputAttributes } from 'svelte/elements';
	import { ChevronDown, ChevronUp } from '@lucide/svelte';
	import { cn } from '$lib/utils/cn';
	import { HMI_KEYPAD_SELECTOR, type HmiSearchSelectItem } from './hmi.constants';
	import {
		hmiSearchSelectChevronClass,
		hmiSearchSelectChevronFaceClass,
		hmiSearchSelectChevronIconClass,
		hmiSearchSelectDisplayClass,
		hmiSearchSelectEmptyClass,
		hmiSearchSelectFieldClass,
		hmiSearchSelectInputClass,
		hmiSearchSelectLabelClass,
		hmiSearchSelectOptionClass,
		hmiSearchSelectOptionLabelClass,
		hmiSearchSelectOptionMatchClass,
		hmiSearchSelectOptionMetaClass,
		hmiSearchSelectPanelClass
	} from './hmi.styles';
	import { filterSearchItems, splitHighlight } from './hmi.utils';
	import { hmiCaret } from './hmi-caret';
	import { createHmiPress } from './hmi-press.svelte';

	type Props = {
		items?: HmiSearchSelectItem[];
		value?: string;
		/** Search text — bindable so an HmiNumpad / HmiKeyboard can drive it via `inputRef`. */
		query?: string;
		open?: boolean;
		/** The search input; pass to HmiNumpad / HmiKeyboard as `inputElement`. */
		inputRef?: HTMLInputElement | null;
		label?: string;
		id?: string;
		placeholder?: string;
		searchPlaceholder?: string;
		emptyText?: string;
		disabled?: boolean;
		/** `none` suppresses the OS keyboard; HMI types with an on-screen keypad. */
		inputmode?: HTMLInputAttributes['inputmode'];
		/** Results panel max height before it scrolls (default: 4 rows). */
		maxHeight?: string;
		class?: string;
		labelClass?: string;
		fieldClass?: string;
		panelClass?: string;
		optionClass?: string;
		onValueChange?: (value: string) => void;
		onOpenChange?: (open: boolean) => void;
	} & Omit<HTMLAttributes<HTMLDivElement>, 'id'>;

	let {
		items = [],
		value = $bindable(''),
		query = $bindable(''),
		open = $bindable(false),
		inputRef = $bindable(null),
		label,
		id,
		placeholder = 'Select...',
		searchPlaceholder = 'Type to search',
		emptyText = 'No matches found.',
		disabled = false,
		inputmode = 'none',
		maxHeight = '304px',
		class: className = '',
		labelClass = '',
		fieldClass = '',
		panelClass = '',
		optionClass = '',
		onValueChange,
		onOpenChange,
		...rest
	}: Props = $props();

	const fallbackId = `hmi-search-select-${Math.random().toString(36).slice(2, 9)}`;
	const resolvedId = $derived(id ?? fallbackId);
	const listboxId = $derived(`${resolvedId}-listbox`);

	let rootEl = $state<HTMLDivElement | null>(null);
	const chevronPress = createHmiPress();

	const results = $derived(filterSearchItems(items, query));
	const selectedItem = $derived(items.find((item) => item.value === value));

	// Top match is pre-highlighted so ENTER picks it; arrow keys override until results change.
	let highlightedIndex = $derived(results.findIndex((item) => !item.disabled));

	function setOpen(next: boolean) {
		if (open === next) return;
		open = next;
		onOpenChange?.(next);
	}

	function openMenu() {
		if (disabled) return;
		setOpen(true);
		inputRef?.focus();
	}

	function closeMenu() {
		setOpen(false);
		query = '';
		inputRef?.blur();
	}

	function select(item: HmiSearchSelectItem) {
		if (item.disabled) return;
		value = item.value;
		onValueChange?.(item.value);
		closeMenu();
	}

	/** Picks the highlighted result — wire a keypad ENTER to this. Returns false when nothing matched. */
	export function commit(): boolean {
		const item = results[highlightedIndex];
		if (!open || !item) return false;
		select(item);
		return true;
	}

	function moveHighlight(delta: number) {
		if (results.length === 0) return;
		let next = highlightedIndex;
		for (let step = 0; step < results.length; step++) {
			next = (next + delta + results.length) % results.length;
			if (!results[next].disabled) break;
		}
		highlightedIndex = next;
	}

	function handleInput(event: Event & { currentTarget: HTMLInputElement }) {
		query = event.currentTarget.value;
		if (!open) setOpen(true);
	}

	function handleKeydown(event: KeyboardEvent) {
		switch (event.key) {
			case 'ArrowDown':
				event.preventDefault();
				if (!open) openMenu();
				else moveHighlight(1);
				break;
			case 'ArrowUp':
				event.preventDefault();
				moveHighlight(-1);
				break;
			case 'Enter':
				event.preventDefault();
				commit();
				break;
			case 'Escape':
				closeMenu();
				break;
		}
	}

	function toggleMenu(event: MouseEvent) {
		event.stopPropagation();
		if (open) closeMenu();
		else openMenu();
	}

	function keepFocus(event: MouseEvent) {
		event.preventDefault();
	}

	$effect(() => {
		if (!open) return;

		function onPointerDown(event: PointerEvent) {
			const target = event.target as Element | null;
			if (!target || rootEl?.contains(target) || target.closest(HMI_KEYPAD_SELECTOR)) return;
			closeMenu();
		}

		document.addEventListener('pointerdown', onPointerDown, true);
		return () => document.removeEventListener('pointerdown', onPointerDown, true);
	});
</script>

<div bind:this={rootEl} class={cn('flex w-full flex-col gap-2', className)} {...rest}>
	{#if label}
		<!-- Touch: only the field opens the list; a tap on the caption must not focus the input. -->
		<label
			for={resolvedId}
			class={cn(hmiSearchSelectLabelClass, labelClass)}
			onclick={(event) => event.preventDefault()}>{label}</label
		>
	{/if}

	<div class="relative">
		<!-- Tapping anywhere on the field opens it; the input and chevron carry the keyboard semantics. -->
		<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
		<div
			class={hmiSearchSelectFieldClass(open, disabled, fieldClass)}
			onclick={() => !open && openMenu()}
		>
			<div class="relative flex h-full min-w-0 flex-1 items-center">
				<input
					bind:this={inputRef}
					use:hmiCaret={{ height: 40 }}
					id={resolvedId}
					type="text"
					role="combobox"
					autocomplete="off"
					spellcheck="false"
					{inputmode}
					{disabled}
					value={query}
					placeholder={open ? searchPlaceholder : ''}
					aria-expanded={open}
					aria-controls={listboxId}
					aria-activedescendant={open && highlightedIndex >= 0
						? `${listboxId}-${highlightedIndex}`
						: undefined}
					class={cn(hmiSearchSelectInputClass, !open && 'opacity-0')}
					onfocus={openMenu}
					oninput={handleInput}
					onkeydown={handleKeydown}
				/>
				{#if !open}
					<span class={hmiSearchSelectDisplayClass(Boolean(selectedItem), disabled)}>
						{selectedItem?.label ?? placeholder}
					</span>
				{/if}
			</div>

			<button
				type="button"
				tabindex="-1"
				{disabled}
				class={hmiSearchSelectChevronClass(disabled, chevronPress.pressed)}
				{...chevronPress.handlers}
				aria-label={open ? 'Close list' : 'Open list'}
				onmousedown={keepFocus}
				onclick={toggleMenu}
			>
				<span class={hmiSearchSelectChevronFaceClass(disabled)}>
					{#if open}
						<ChevronUp class={hmiSearchSelectChevronIconClass(disabled)} strokeWidth={2.5} />
					{:else}
						<ChevronDown class={hmiSearchSelectChevronIconClass(disabled)} strokeWidth={2.5} />
					{/if}
				</span>
			</button>
		</div>

		{#if open}
			<div
				id={listboxId}
				role="listbox"
				class={cn(hmiSearchSelectPanelClass, panelClass)}
				style:max-height={maxHeight}
			>
				{#each results as item, index (item.value)}
					<button
						type="button"
						id="{listboxId}-{index}"
						role="option"
						aria-selected={item.value === value}
						disabled={item.disabled}
						class={hmiSearchSelectOptionClass(index === highlightedIndex, optionClass)}
						onmousedown={keepFocus}
						onclick={() => select(item)}
					>
						<span class={hmiSearchSelectOptionLabelClass}>
							{#each splitHighlight(item.label, query) as part, partIndex (partIndex)}
								{#if part.match}
									<span class={hmiSearchSelectOptionMatchClass}>{part.text}</span>
								{:else}
									{part.text}
								{/if}
							{/each}
						</span>
						{#if item.meta}
							<span class={hmiSearchSelectOptionMetaClass}>{item.meta}</span>
						{/if}
					</button>
				{:else}
					<p class={hmiSearchSelectEmptyClass}>{emptyText}</p>
				{/each}
			</div>
		{/if}
	</div>
</div>
