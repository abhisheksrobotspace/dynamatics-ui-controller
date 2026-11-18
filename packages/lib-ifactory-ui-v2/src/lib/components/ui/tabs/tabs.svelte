<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { ChevronDown } from '@lucide/svelte';
	import { cn } from '$lib/utils/cn';
	import type { TabItem, TabsSize, TabsVariant } from './tabs.constants';
	import {
		tabsIconClass,
		tabsMobileChevronClass,
		tabsMobileSelectClass,
		tabsNavClass,
		tabsTabClass
	} from './tabs.styles';

	type Props = {
		items: TabItem[];
		value?: string;
		variant?: TabsVariant;
		size?: TabsSize;
		mobileSelect?: boolean;
		ariaLabel?: string;
		class?: string;
		navClass?: string;
		tabClass?: string;
		onValueChange?: (value: string) => void;
	} & HTMLAttributes<HTMLDivElement>;

	let {
		items,
		value = $bindable(''),
		variant = 'underline',
		size = 'md',
		mobileSelect = true,
		ariaLabel = 'Tabs',
		class: className = '',
		navClass = '',
		tabClass = '',
		onValueChange,
		...rest
	}: Props = $props();

	const activeValue = $derived.by(() => {
		if (value) {
			return value;
		}

		const currentItem = items.find((item) => item.current);
		if (currentItem) {
			return currentItem.value;
		}

		return items[0]?.value ?? '';
	});

	function setValue(next: string) {
		value = next;
		onValueChange?.(next);
	}

	function isActive(item: TabItem): boolean {
		return item.value === activeValue;
	}

	function handleTabSelect(item: TabItem, event?: MouseEvent) {
		if (item.disabled) {
			event?.preventDefault();
			return;
		}

		setValue(item.value);
		item.onclick?.();

		if (!item.href) {
			event?.preventDefault();
		}
	}

	function handleMobileChange(event: Event) {
		const next = (event.currentTarget as HTMLSelectElement).value;
		const item = items.find((entry) => entry.value === next);
		if (!item || item.disabled) {
			return;
		}

		setValue(next);
		item.onclick?.();

		if (item.href) {
			window.location.assign(item.href);
		}
	}
</script>

<div class={className} {...rest}>
	{#if mobileSelect}
		<div class="grid grid-cols-1 sm:hidden">
			<select
				aria-label={ariaLabel}
				class={tabsMobileSelectClass}
				value={activeValue}
				onchange={handleMobileChange}
			>
				{#each items as item (item.value)}
					<option value={item.value} disabled={item.disabled}>{item.label}</option>
				{/each}
			</select>
			<ChevronDown class={tabsMobileChevronClass} aria-hidden="true" />
		</div>
	{/if}

	<div class={cn(mobileSelect && 'hidden sm:block')}>
		<nav aria-label={ariaLabel} class={cn(tabsNavClass(variant), navClass)}>
			{#each items as item (item.value)}
				{@const active = isActive(item)}
				{#if item.href}
					<a
						href={item.href}
						aria-current={active ? 'page' : undefined}
						class={cn(tabsTabClass(variant, active, size), tabClass)}
						onclick={(event) => handleTabSelect(item, event)}
					>
						{#if item.icon}
							{@const Icon = item.icon}
							<Icon class={tabsIconClass(variant, active, size)} aria-hidden="true" />
						{/if}
						<span>{item.label}</span>
					</a>
				{:else}
					<button
						type="button"
						role="tab"
						aria-selected={active}
						disabled={item.disabled}
						class={cn(tabsTabClass(variant, active, size), tabClass)}
						onclick={(event) => handleTabSelect(item, event)}
					>
						{#if item.icon}
							{@const Icon = item.icon}
							<Icon class={tabsIconClass(variant, active, size)} aria-hidden="true" />
						{/if}
						<span>{item.label}</span>
					</button>
				{/if}
			{/each}
		</nav>
	</div>
</div>
