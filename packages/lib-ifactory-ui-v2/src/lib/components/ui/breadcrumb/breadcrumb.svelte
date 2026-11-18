<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { tick } from 'svelte';
	import { ChevronRight } from '@lucide/svelte';
	import { DropdownMenu } from '$lib/components/ui/dropdown-menu';
	import type { DropdownMenuItem } from '$lib/components/ui/dropdown-menu';
	import { cn } from '$lib/utils/cn';
	import {
		defaultBreadcrumbItems,
		type BreadcrumbItem,
		type BreadcrumbSeparator
	} from './breadcrumb.constants';
	import {
		breadcrumbChevronClass,
		breadcrumbCurrentClass,
		breadcrumbEllipsisClass,
		breadcrumbEllipsisMenuClass,
		breadcrumbEllipsisMenuItemClass,
		breadcrumbLinkClass,
		breadcrumbListClass,
		breadcrumbNavClass,
		breadcrumbSeparatorClass
	} from './breadcrumb.styles';
	import {
		buildBreadcrumbSegments,
		maxBreadcrumbCollapseLevel,
		type BreadcrumbSegment
	} from './breadcrumb.utils';

	type Props = {
		items?: BreadcrumbItem[];
		separator?: BreadcrumbSeparator;
		class?: string;
		listClass?: string;
		linkClass?: string;
		separatorClass?: string;
		currentClass?: string;
	} & HTMLAttributes<HTMLElement>;

	let {
		items = defaultBreadcrumbItems,
		separator = 'slash',
		class: className = '',
		listClass = '',
		linkClass = '',
		separatorClass = '',
		currentClass = '',
		...rest
	}: Props = $props();

	let navEl = $state<HTMLElement | null>(null);
	let listEl = $state<HTMLElement | null>(null);
	let collapseLevel = $state(0);
	let measuring = false;

	const resolvedItems = $derived(
		items.map((item, index) => ({
			...item,
			current: item.current ?? (index === items.length - 1 && !items.some((i) => i.current))
		}))
	);

	const segments = $derived(buildBreadcrumbSegments(resolvedItems, collapseLevel));

	async function syncCollapseLevel(
		items: Array<BreadcrumbItem & { current: boolean }>,
		nav: HTMLElement,
		list: HTMLElement
	) {
		if (measuring) return;

		if (items.length <= 2) {
			collapseLevel = 0;
			return;
		}

		measuring = true;
		try {
			const maxLevel = maxBreadcrumbCollapseLevel(items.length);
			let low = 0;
			let high = maxLevel;
			let best = maxLevel;

			while (low <= high) {
				const mid = Math.floor((low + high) / 2);
				collapseLevel = mid;
				await tick();

				if (list.scrollWidth <= nav.clientWidth) {
					best = mid;
					high = mid - 1;
				} else {
					low = mid + 1;
				}
			}

			collapseLevel = best;
		} finally {
			measuring = false;
		}
	}

	$effect(() => {
		const items = resolvedItems;
		const nav = navEl;
		const list = listEl;
		if (!nav || !list) return;

		void syncCollapseLevel(items, nav, list);

		const observer = new ResizeObserver(() => {
			void syncCollapseLevel(items, nav, list);
		});
		observer.observe(nav);

		return () => observer.disconnect();
	});

	function hiddenMenuGroups(hiddenItems: BreadcrumbItem[]): DropdownMenuItem[][] {
		return [
			hiddenItems.map((item) => ({
				label: item.label,
				href: item.href ?? '#'
			}))
		];
	}

	function segmentKey(segment: BreadcrumbSegment, index: number): string {
		if (segment.type === 'ellipsis') {
			return `ellipsis-${index}`;
		}

		// Labels are display data and can repeat within one trail (e.g. a BOM
		// named the same as its tower), so the key must include the position.
		return `${index}-${segment.item.label}`;
	}
</script>

<nav
	bind:this={navEl}
	aria-label="Breadcrumb"
	class={cn(breadcrumbNavClass, 'max-w-full min-w-0 overflow-hidden', className)}
	{...rest}
>
	<ol
		bind:this={listEl}
		role="list"
		class={cn(breadcrumbListClass, 'whitespace-nowrap', listClass)}
	>
		{#each segments as segment, index (segmentKey(segment, index))}
			{#if index > 0}
				<li aria-hidden="true" class={cn(breadcrumbSeparatorClass, separatorClass)}>
					{#if separator === 'chevron'}
						<ChevronRight class={breadcrumbChevronClass} />
					{:else}
						/
					{/if}
				</li>
			{/if}
			<li>
				{#if segment.type === 'ellipsis'}
					<DropdownMenu
						groups={hiddenMenuGroups(segment.items)}
						side="bottom"
						align="start"
						triggerLabel="..."
						triggerClass={breadcrumbEllipsisClass}
						contentClass={breadcrumbEllipsisMenuClass}
						itemClass={breadcrumbEllipsisMenuItemClass}
						triggerAriaLabel="Show hidden breadcrumb items"
					/>
				{:else if segment.item.current}
					<span aria-current="page" class={cn(breadcrumbCurrentClass, currentClass)}>
						{segment.item.label}
					</span>
				{:else}
					<a href={segment.item.href ?? '#'} class={cn(breadcrumbLinkClass, linkClass)}>
						{segment.item.label}
					</a>
				{/if}
			</li>
		{/each}
	</ol>
</nav>
