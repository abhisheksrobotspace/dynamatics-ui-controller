<script lang="ts" module>
	import type { Component } from 'svelte';

	export type DropdownMenuUser = {
		name: string;
		email?: string;
		avatarSrc?: string;
		avatarAlt?: string;
	};

	export type DropdownMenuItem = {
		label: string;
		value?: string;
		icon?: Component;
		shortcut?: string;
		trailing?: string;
		href?: string;
		disabled?: boolean;
		selected?: boolean;
		onclick?: () => void;
	};
</script>

<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { tick } from 'svelte';
	import { Check, ChevronDown, ChevronUp, ChevronsUpDown } from '@lucide/svelte';
	import { Avatar } from '$lib/components/ui/avatar';
	import { cn } from '$lib/utils/cn';
	import {
		dropdownMenuContentClass,
		dropdownMenuItemActionClass,
		dropdownMenuItemCheckClass,
		dropdownMenuItemClass,
		dropdownMenuItemSelectionClass,
		dropdownMenuScrollClass,
		dropdownMenuTriggerSelectClass,
		dropdownMenuTriggerSelectOpenClass
	} from './dropdown-menu.styles';
	import { resolveDropdownPlacement } from './dropdown-menu.utils';
	import type { DropdownMenuAlign, DropdownMenuSide } from './dropdown-menu.constants';

	type Props = {
		open?: boolean;
		onOpenChange?: (open: boolean) => void;
		side?: DropdownMenuSide;
		align?: DropdownMenuAlign;
		user?: DropdownMenuUser;
		groups?: DropdownMenuItem[][];
		selectedValue?: string;
		maxHeight?: string;
		matchTriggerWidth?: boolean;
		triggerLabel?: string;
		triggerIcon?: Component;
		showChevron?: boolean;
		triggerAriaLabel?: string;
		disabled?: boolean;
		triggerAvatarSize?: 'sm' | 'md' | 'lg';
		triggerClass?: string;
		class?: string;
		contentClass?: string;
		itemClass?: string;
		scrollClass?: string;
	} & HTMLAttributes<HTMLDivElement>;

	let {
		open = $bindable(false),
		onOpenChange,
		side = 'top',
		align = 'start',
		user,
		groups = [],
		selectedValue,
		maxHeight,
		matchTriggerWidth,
		triggerLabel,
		triggerIcon,
		showChevron = false,
		triggerAriaLabel,
		disabled = false,
		triggerAvatarSize = 'sm',
		triggerClass = '',
		class: className = '',
		contentClass = '',
		itemClass = '',
		scrollClass = '',
		...rest
	}: Props = $props();

	let triggerEl = $state<HTMLButtonElement | null>(null);
	let contentEl = $state<HTMLDivElement | null>(null);
	let position = $state({ top: 0, left: 0 });
	let menuMinWidth = $state<number | undefined>(undefined);
	let resolvedSide = $state<DropdownMenuSide>('bottom');

	const usesSelectLayout = $derived(matchTriggerWidth ?? selectedValue !== undefined);
	const showsSelection = $derived(selectedValue !== undefined);

	const contentClasses = $derived(
		cn(dropdownMenuContentClass, usesSelectLayout ? 'min-w-0' : 'min-w-[15rem]', contentClass)
	);

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

	function isItemSelected(item: DropdownMenuItem): boolean {
		if (item.selected !== undefined) {
			return item.selected;
		}

		if (selectedValue !== undefined && item.value !== undefined) {
			return item.value === selectedValue;
		}

		return false;
	}

	function itemClasses(item: DropdownMenuItem): string {
		const selected = isItemSelected(item);

		return cn(
			dropdownMenuItemClass,
			showsSelection
				? dropdownMenuItemSelectionClass(selected)
				: itemClass || dropdownMenuItemActionClass
		);
	}

	function getPlacementGap(): number {
		return usesSelectLayout ? 0 : 4;
	}

	async function updatePosition() {
		await tick();
		if (!triggerEl || !contentEl) return;

		const triggerRect = triggerEl.getBoundingClientRect();
		menuMinWidth = usesSelectLayout ? triggerRect.width : undefined;

		const placement = resolveDropdownPlacement({
			preferredSide: side,
			preferredAlign: align,
			triggerRect,
			contentRect: contentEl.getBoundingClientRect(),
			gap: getPlacementGap()
		});

		position = { top: placement.top, left: placement.left };
		resolvedSide = placement.side;
	}

	function setOpen(next: boolean) {
		open = next;
		onOpenChange?.(next);
	}

	function toggleOpen() {
		setOpen(!open);
	}

	function close() {
		setOpen(false);
	}

	function handleItemSelect(item: DropdownMenuItem, event: MouseEvent) {
		if (item.disabled) {
			return;
		}

		item.onclick?.();
		if (!event.defaultPrevented && item.href) {
			event.preventDefault();
			if (!item.onclick) {
				const href = item.href;
				if (href.startsWith('http') || href.startsWith('mailto:')) {
					window.location.assign(href);
				} else if (href.startsWith('#')) {
					window.location.hash = href;
				} else if (href.startsWith('/')) {
					window.location.assign(href);
				} else {
					window.location.hash = `#/${href}`;
				}
			}
		}
		if (!event.defaultPrevented) {
			close();
		}
	}

	$effect(() => {
		if (!open) return;

		void updatePosition();

		const onPointerDown = (event: PointerEvent) => {
			const target = event.target as Node;
			if (contentEl?.contains(target)) return;
			if (triggerEl?.contains(target)) return;
			close();
		};

		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				close();
				triggerEl?.focus();
			}
		};

		const onReposition = () => {
			void updatePosition();
		};

		document.addEventListener('pointerdown', onPointerDown);
		document.addEventListener('keydown', onKeyDown);
		window.addEventListener('resize', onReposition);
		window.addEventListener('scroll', onReposition, true);

		return () => {
			document.removeEventListener('pointerdown', onPointerDown);
			document.removeEventListener('keydown', onKeyDown);
			window.removeEventListener('resize', onReposition);
			window.removeEventListener('scroll', onReposition, true);
		};
	});

	const triggerClasses = $derived(
		cn(
			(triggerLabel || showChevron || triggerIcon) && 'inline-flex items-center gap-2',
			triggerLabel && !usesSelectLayout && 'border border-border px-3 py-2 text-sm',
			triggerLabel && usesSelectLayout && dropdownMenuTriggerSelectClass,
			triggerLabel && usesSelectLayout && dropdownMenuTriggerSelectOpenClass(open),
			triggerIcon &&
				!triggerLabel &&
				'inline-flex size-9 items-center justify-center text-foreground hover:bg-foreground/5',
			usesSelectLayout && showChevron && 'w-full',
			triggerClass
		)
	);

	const ChevronIcon = $derived(
		showsSelection && showChevron
			? ChevronsUpDown
			: (open ? resolvedSide : side) === 'top'
				? open
					? ChevronDown
					: ChevronUp
				: open
					? ChevronUp
					: ChevronDown
	);
</script>

<div class={className} {...rest}>
	<button
		type="button"
		bind:this={triggerEl}
		class={cn(
			'inline-flex outline-none disabled:pointer-events-none disabled:opacity-50',
			usesSelectLayout && 'w-full'
		)}
		aria-haspopup="menu"
		aria-expanded={open}
		aria-label={triggerAriaLabel}
		{disabled}
		onclick={(event) => {
			event.stopPropagation();
			toggleOpen();
		}}
	>
		<span class={triggerClasses}>
			{#if user}
				<Avatar
					src={user.avatarSrc}
					alt={user.avatarAlt ?? user.name}
					fallback={user.name}
					size={triggerAvatarSize}
				/>
			{/if}
			{#if triggerIcon}
				{@const Icon = triggerIcon}
				<Icon class="size-4 shrink-0" aria-hidden="true" />
			{/if}
			{#if triggerLabel}
				<span class="truncate text-left">{triggerLabel}</span>
			{/if}
			{#if showChevron}
				<ChevronIcon class="ml-auto size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
			{/if}
		</span>
	</button>

	{#if open}
		<div
			use:portal
			bind:this={contentEl}
			role="menu"
			class={contentClasses}
			style:top="{position.top}px"
			style:left="{position.left}px"
			style:min-width={menuMinWidth ? `${menuMinWidth}px` : undefined}
		>
			{#if user}
				<div class="flex shrink-0 items-center gap-3 px-3 py-3">
					<Avatar
						src={user.avatarSrc}
						alt={user.avatarAlt ?? user.name}
						fallback={user.name}
						size="md"
					/>
					<div class="min-w-0">
						<p class="truncate text-sm font-semibold text-foreground">{user.name}</p>
						{#if user.email}
							<p class="truncate text-xs text-muted-foreground">{user.email}</p>
						{/if}
					</div>
				</div>
				<div role="separator" class="my-1 h-px shrink-0 bg-border"></div>
			{/if}

			<div
				class={cn(maxHeight ? dropdownMenuScrollClass : showsSelection ? '' : 'py-1', scrollClass)}
				style:max-height={maxHeight}
			>
				{#each groups as group, groupIndex (groupIndex)}
					{#each group as item, itemIndex (`${groupIndex}-${itemIndex}-${item.label}`)}
						{@const selected = isItemSelected(item)}
						{#if item.href}
							<a
								role="menuitem"
								aria-current={selected ? 'true' : undefined}
								href={item.href}
								class={itemClasses(item)}
								onclick={(event) => handleItemSelect(item, event)}
							>
								{#if item.icon}
									{@const Icon = item.icon}
									<Icon aria-hidden="true" />
								{/if}
								<span class="min-w-0 flex-1 truncate text-left">{item.label}</span>
								{#if showsSelection}
									<span class="flex w-5 shrink-0 justify-end">
										{#if selected}
											<Check class={dropdownMenuItemCheckClass} aria-hidden="true" />
										{/if}
									</span>
								{:else if item.shortcut}
									<span class="ml-auto text-xs text-muted-foreground">{item.shortcut}</span>
								{:else if item.trailing}
									<span class="ml-auto text-xs text-muted-foreground">{item.trailing}</span>
								{/if}
							</a>
						{:else}
							<button
								type="button"
								role="menuitem"
								aria-current={selected ? 'true' : undefined}
								disabled={item.disabled}
								class={itemClasses(item)}
								onclick={(event) => handleItemSelect(item, event)}
							>
								{#if item.icon}
									{@const Icon = item.icon}
									<Icon aria-hidden="true" />
								{/if}
								<span class="min-w-0 flex-1 truncate text-left">{item.label}</span>
								{#if showsSelection}
									<span class="flex w-5 shrink-0 justify-end">
										{#if selected}
											<Check class={dropdownMenuItemCheckClass} aria-hidden="true" />
										{/if}
									</span>
								{:else if item.shortcut}
									<span class="ml-auto text-xs text-muted-foreground">{item.shortcut}</span>
								{:else if item.trailing}
									<span class="ml-auto text-xs text-muted-foreground">{item.trailing}</span>
								{/if}
							</button>
						{/if}
					{/each}
					{#if groupIndex < groups.length - 1}
						<div role="separator" class="my-1 h-px bg-border"></div>
					{/if}
				{/each}
			</div>
		</div>
	{/if}
</div>
