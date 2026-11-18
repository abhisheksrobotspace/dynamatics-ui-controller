<script lang="ts">
	import { ChevronDown, ChevronLeft, ChevronRight, ListFilter, Search } from '@lucide/svelte';
	import { Input } from '$lib/components/ui/input';
	import { Tabs } from '$lib/components/ui/tabs';
	import { cn } from '$lib/utils/cn';
	import { tooltip } from '$lib/components/ui/tooltip';
	import type { ScheduleResource, ScheduleTreeNode } from './production-schedule.constants';

	const EXPANDED_WIDTH = 280;
	const COLLAPSED_WIDTH = 40;

	type Props = {
		open?: boolean;
		orderTree: ScheduleTreeNode[];
		resources?: ScheduleResource[];
		selectedNodeId?: string;
		/** Controlled expansion map (node id → open). */
		expanded?: Record<string, boolean>;
		defaultExpandedIds?: string[];
		/** Node id → accent color for the active tree level. */
		colorByNodeId?: Record<string, string>;
		/** Node ids outside the focused branch (muted). */
		dimmedNodeIds?: Set<string> | ReadonlySet<string>;
		ordersTabLabel?: string;
		resourcesTabLabel?: string;
		showResourcesTab?: boolean;
		onSelectNode?: (id: string) => void;
		onExpandedChange?: (expanded: Record<string, boolean>) => void;
		class?: string;
	};

	let {
		open = $bindable(true),
		orderTree,
		resources = [],
		selectedNodeId = '',
		expanded = $bindable<Record<string, boolean> | undefined>(undefined),
		defaultExpandedIds = ['all'],
		colorByNodeId = {},
		dimmedNodeIds = new Set<string>(),
		ordersTabLabel = 'Orders',
		resourcesTabLabel = 'Resources',
		showResourcesTab = false,
		onSelectNode,
		onExpandedChange,
		class: className = ''
	}: Props = $props();

	let sidebarTab = $state('orders');
	let searchQuery = $state('');
	let localExpanded = $state<Record<string, boolean>>(
		Object.fromEntries(defaultExpandedIds.map((id) => [id, true]))
	);

	const expandedMap = $derived(expanded ?? localExpanded);

	const sidebarTabs = $derived(
		showResourcesTab
			? [
					{ value: 'orders', label: ordersTabLabel },
					{ value: 'resources', label: resourcesTabLabel }
				]
			: [{ value: 'orders', label: ordersTabLabel }]
	);

	function setExpanded(next: Record<string, boolean>) {
		if (expanded !== undefined) {
			expanded = next;
		} else {
			localExpanded = next;
		}
		onExpandedChange?.(next);
	}

	function toggleExpanded(id: string) {
		setExpanded({ ...expandedMap, [id]: !expandedMap[id] });
	}

	function matchesSearch(label: string): boolean {
		const q = searchQuery.trim().toLowerCase();
		return !q || label.toLowerCase().includes(q);
	}

	function filterTree(nodes: ScheduleTreeNode[]): ScheduleTreeNode[] {
		const q = searchQuery.trim().toLowerCase();
		if (!q) return nodes;

		const out: ScheduleTreeNode[] = [];
		for (const node of nodes) {
			const childMatches = node.children ? filterTree(node.children) : [];
			if (matchesSearch(node.label) || childMatches.length > 0) {
				out.push({
					...node,
					children: childMatches.length > 0 ? childMatches : node.children
				});
			}
		}
		return out;
	}

	const filteredTree = $derived(filterTree(orderTree));

	const filteredResources = $derived(
		resources.filter((r) => {
			const q = searchQuery.trim().toLowerCase();
			return !q || r.label.toLowerCase().includes(q) || r.groupId.toLowerCase().includes(q);
		})
	);

	function isDimmed(id: string): boolean {
		return dimmedNodeIds instanceof Set
			? dimmedNodeIds.has(id)
			: Boolean((dimmedNodeIds as ReadonlySet<string> | undefined)?.has?.(id));
	}
</script>

<aside
	class={cn(
		'flex h-full min-h-0 shrink-0 flex-col overflow-hidden border border-border bg-background transition-[width] duration-200',
		className
	)}
	style="width: {open ? EXPANDED_WIDTH : COLLAPSED_WIDTH}px;"
>
	{#if open}
		<div class="border-b border-border">
			{#if showResourcesTab}
				<div class="flex items-center gap-1 px-2 pt-1">
					<div class="min-w-0 flex-1">
						<Tabs
							items={sidebarTabs}
							bind:value={sidebarTab}
							variant="underline"
							size="sm"
							mobileSelect={false}
						/>
					</div>
					<button
						type="button"
						class="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/40 hover:text-foreground"
						aria-label="Collapse orders panel"
						onclick={() => (open = false)}
					>
						<ChevronLeft class="size-4" />
					</button>
				</div>
			{:else}
				<div
					class="flex h-[41px] items-center justify-between gap-1 border-b-2 border-primary px-2"
				>
					<span class="truncate text-[13px] font-bold text-primary">{ordersTabLabel}</span>
					<button
						type="button"
						class="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/40 hover:text-foreground"
						aria-label="Collapse orders panel"
						onclick={() => (open = false)}
					>
						<ChevronLeft class="size-4" />
					</button>
				</div>
			{/if}
		</div>

		<div class="p-3">
			<div class="relative">
				<Search
					class="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
				/>
				<Input
					type="search"
					placeholder={sidebarTab === 'orders' ? 'Search orders…' : 'Search resources…'}
					bind:value={searchQuery}
					class="border-0 bg-[#F4F4F5] pl-8 text-[13px]"
					aria-label="Search sidebar"
				/>
			</div>
		</div>

		<div class="min-h-0 flex-1 overflow-y-auto text-sm">
			{#if sidebarTab === 'orders'}
				{#each filteredTree as root (root.id)}
					{@render treeNode(root, 0)}
				{/each}
			{:else}
				<ul class="space-y-1 p-2">
					{#each filteredResources as resource (resource.id)}
						<li>
							<button
								type="button"
								class="w-full px-3 py-2 text-left text-foreground hover:bg-foreground/5"
								onclick={() => onSelectNode?.(resource.id)}
							>
								<span class="font-medium">{resource.label}</span>
								<span class="ml-2 text-xs text-muted-foreground">{resource.groupId}</span>
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	{:else}
		<div class="flex flex-1 flex-col items-center border-b border-border py-2">
			<button
				type="button"
				class="inline-flex size-8 items-center justify-center rounded-md text-primary hover:bg-[#FFF4ED]"
				aria-label="Show orders panel"
				{@attach tooltip({ content: ordersTabLabel, side: 'right' })}
				onclick={() => (open = true)}
			>
				<ListFilter class="size-4" />
			</button>
		</div>
	{/if}
</aside>

{#snippet treeNode(node: ScheduleTreeNode, depth: number)}
	{@const padLeft = 12 + depth * 20}
	{@const isLeafChild = !node.children?.length && depth >= 3}
	{@const nodeColor = colorByNodeId[node.id]}
	{@const dimmed = isDimmed(node.id)}
	<div class={dimmed ? 'opacity-35' : ''}>
		<div
			class={[
				'flex items-center gap-2',
				selectedNodeId === node.id ? 'bg-[#FFF4ED]' : 'hover:bg-foreground/5'
			]}
			style:padding={`8px 12px 8px ${padLeft}px`}
		>
			{#if node.children && node.children.length > 0}
				<button
					type="button"
					class="inline-flex size-3 shrink-0 items-center justify-center text-muted-foreground"
					aria-label={expandedMap[node.id] ? 'Collapse' : 'Expand'}
					onclick={() => toggleExpanded(node.id)}
				>
					{#if expandedMap[node.id]}
						<ChevronDown class="size-3" />
					{:else}
						<ChevronRight class="size-3" />
					{/if}
				</button>
			{:else if !isLeafChild}
				<span class="inline-block size-3 shrink-0"></span>
			{/if}

			{#if nodeColor && !dimmed}
				<span
					class="size-2.5 shrink-0 rounded-sm"
					style:background-color={nodeColor}
					aria-hidden="true"
				></span>
			{/if}

			<button
				type="button"
				class={[
					'min-w-0 flex-1 truncate text-left',
					isLeafChild ? 'text-xs' : 'text-sm',
					selectedNodeId === node.id
						? 'font-medium text-primary'
						: depth === 0
							? 'font-bold text-foreground'
							: 'text-foreground',
					isLeafChild && !nodeColor ? 'text-muted-foreground' : ''
				]}
				style:color={!dimmed && nodeColor && selectedNodeId !== node.id ? nodeColor : undefined}
				title={node.label}
				onclick={() => onSelectNode?.(node.id)}
			>
				{node.label}
			</button>
		</div>

		{#if node.children && node.children.length > 0 && expandedMap[node.id]}
			{#each node.children as child (child.id)}
				{@render treeNode(child, depth + 1)}
			{/each}
		{/if}
	</div>
{/snippet}
