<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Breadcrumb, Skeleton } from '@ifactory/ui-v2';

	interface BreadcrumbData {
		label: string;
		href?: string;
		clickable?: boolean;
	}

	let {
		appName = 'App',
		appCode,
		displayName,
		accentColor,
		breadcrumbs = [] as BreadcrumbData[],
		isLoading = false,
		rightControls,
		leftControls
	}: {
		appName?: string;
		appCode?: string;
		displayName?: string;
		accentColor?: string;
		breadcrumbs?: BreadcrumbData[];
		isLoading?: boolean;
		rightControls?: Snippet;
		leftControls?: Snippet;
	} = $props();

	const appLabel = $derived(
		displayName || appCode || (appName ? appName.replace(/([A-Z])/g, ' $1').trim() : 'App')
	);
	const accent = $derived(accentColor || '#FF6C2E');

	function toBreadcrumbHref(href?: string) {
		if (!href || href === '#') return href;
		if (href.startsWith('#')) return href;
		return `#/${appName}/${href}`;
	}
</script>

<div
	class="menubar flex h-[48px] w-full shrink-0 cursor-default select-none flex-row items-center justify-between border-b bg-white px-0"
	style="border-bottom-color: {accent}"
>
	<!-- ── Left: Breadcrumb ── -->
	<div class="flex h-full min-w-0 flex-1 items-center">
		{#if leftControls}
			{@render leftControls()}
		{/if}
		<div class="flex min-w-0 flex-1 items-center overflow-hidden px-[24px]">
			{#if isLoading}
				<div class="flex w-full items-center gap-[6px]" aria-busy="true" role="status">
					<!-- <span class="sr-only">Loading navigation</span> -->
					<Skeleton class="h-7 w-10" />
					<span
						class="font-heading text-[18px] font-semibold leading-[28px] tracking-[-0.0075em] text-[#C6C6C6]"
						aria-hidden="true"
					>
						/
					</span>
					<Skeleton class="h-7 w-24" />
					<span
						class="font-heading text-[18px] font-semibold leading-[28px] tracking-[-0.0075em] text-[#C6C6C6]"
						aria-hidden="true"
					>
						/
					</span>
					<Skeleton class="h-7 w-32" />
				</div>
			{:else}
				<Breadcrumb
					class="w-full"
					listClass="gap-[6px]"
					linkClass="font-heading text-[18px] font-semibold leading-[28px] tracking-[-0.0075em] text-[#C6C6C6] transition-colors hover:text-[#222222]"
					separatorClass="font-heading text-[18px] font-semibold leading-[28px] tracking-[-0.0075em] text-[#C6C6C6]"
					currentClass="font-heading text-[18px] font-semibold leading-[28px] tracking-[-0.0075em] text-[#222222]"
					items={[
						{
							label: appLabel,
							href: '#',
							current: breadcrumbs.length === 0
						},
						...breadcrumbs.map((c) => ({
							label: c.label,
							href: c.clickable ? toBreadcrumbHref(c.href) : undefined,
							current: !c.clickable
						}))
					]}
				/>
			{/if}
		</div>
	</div>

	<!-- ── Right: App-specific controls ── -->
	<div class="flex h-full shrink-0 items-stretch gap-0">
		{#if rightControls}
			{@render rightControls()}
		{/if}
	</div>
</div>
