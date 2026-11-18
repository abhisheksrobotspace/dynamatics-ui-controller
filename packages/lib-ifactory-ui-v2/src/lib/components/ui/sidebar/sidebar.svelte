<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { onMount } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { ChevronRight, X } from '@lucide/svelte';
	import { Avatar } from '$lib/components/ui/avatar';
	import { IsMobile } from '$lib/hooks/is-mobile';
	import { cn } from '$lib/utils/cn';
	import {
		isSidebarNavGroup,
		SIDEBAR_TRANSITION_MS,
		type SidebarCollapsible,
		type SidebarNavItem,
		type SidebarUser,
		type SidebarVariant
	} from './sidebar.constants';
	import type { Component } from 'svelte';
	import {
		sidebarAvatarOutlineClasses,
		sidebarChevronClasses,
		sidebarChevronCollapseClasses,
		sidebarLabelCollapseClasses,
		sidebarLogoClass,
		sidebarMobileBackdropClasses,
		sidebarMobileCloseButtonClasses,
		sidebarMobileCloseHeaderClass,
		sidebarMobileSheetClasses,
		sidebarNavClass,
		sidebarNavGroupButtonClasses,
		sidebarNavIconClass,
		sidebarNavItemsClass,
		sidebarNavLinkClasses,
		sidebarNavListClass,
		sidebarShellClasses,
		sidebarSubLinkClasses,
		sidebarTitleClasses,
		sidebarUserLinkClasses,
		sidebarUserLinkCollapsedClass,
		sidebarUserLinkExpandedClass,
		sidebarUserSectionClass,
		sidebarUserSectionExpandedClass
	} from './sidebar.styles';
	import { tooltip } from '$lib/components/ui/tooltip';
	type Props = {
		open?: boolean;
		onOpenChange?: (open: boolean) => void;
		collapsible?: SidebarCollapsible;
		variant?: SidebarVariant;
		logoSrc?: string;
		logoAlt?: string;
		/** App / section name shown above nav links (e.g. "Project Management", "APS"). */
		title?: string;
		titleIcon?: Component;
		items?: SidebarNavItem[];
		user?: SidebarUser;
		class?: string;
		logoClass?: string;
		navClass?: string;
		userClass?: string;
		navItemClass?: string;
		activeNavItemClass?: string;
		subItemClass?: string;
		activeSubItemClass?: string;
	} & HTMLAttributes<HTMLElement>;

	let {
		open = $bindable(true),
		onOpenChange,
		collapsible = 'none',
		variant = 'dark',
		logoSrc,
		logoAlt = 'Company logo',
		title,
		titleIcon: TitleIcon,
		items = [],
		user,
		class: className = '',
		logoClass = '',
		navClass = '',
		userClass = '',
		navItemClass = '',
		activeNavItemClass = '',
		subItemClass = '',
		activeSubItemClass = '',
		...rest
	}: Props = $props();

	const isMobile = new IsMobile();
	let wasMobile = $state(isMobile.current);

	const sidebarState = $derived(open || collapsible !== 'icon' ? 'expanded' : 'collapsed');
	const iconCollapsed = $derived(!isMobile.current && !open && collapsible === 'icon');
	const mobileOpen = $derived(isMobile.current && open);
	let layoutCollapsed = $state(false);

	$effect(() => {
		if (iconCollapsed) {
			const timer = setTimeout(() => {
				layoutCollapsed = true;
			}, SIDEBAR_TRANSITION_MS);
			return () => clearTimeout(timer);
		}

		layoutCollapsed = false;
	});

	const initialOpenGroups = $derived(
		new SvelteSet(
			items
				.filter(isSidebarNavGroup)
				.filter((item) => item.defaultOpen)
				.map((item) => item.label)
		)
	);

	let openGroups = $derived(initialOpenGroups);

	$effect(() => {
		const mobile = isMobile.current;
		if (mobile && !wasMobile) {
			closeSidebar();
		}
		wasMobile = mobile;
	});

	$effect(() => {
		if (!isMobile.current || !open) return;
		document.body.style.overflow = 'hidden';
		return () => {
			document.body.style.overflow = '';
		};
	});

	$effect(() => {
		if (!isMobile.current || !open) return;
		const onKeydown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') closeSidebar();
		};
		window.addEventListener('keydown', onKeydown);
		return () => window.removeEventListener('keydown', onKeydown);
	});

	onMount(() => {
		if (isMobile.current) closeSidebar();
	});

	function closeSidebar() {
		open = false;
		onOpenChange?.(false);
	}

	function toggleGroup(label: string) {
		if (openGroups.has(label)) {
			openGroups.delete(label);
		} else {
			openGroups.add(label);
		}
	}

	function isGroupOpen(label: string): boolean {
		return openGroups.has(label);
	}

	function handleNavClick() {
		if (isMobile.current) closeSidebar();
	}
</script>

{#if !isMobile.current || open}
	{#if mobileOpen}
		<button
			type="button"
			class={sidebarMobileBackdropClasses()}
			aria-label="Close sidebar"
			onclick={closeSidebar}
		></button>
	{/if}

	<aside
		class={mobileOpen
			? sidebarMobileSheetClasses(variant, className)
			: sidebarShellClasses(variant, open, collapsible, className)}
		role={mobileOpen ? 'dialog' : undefined}
		aria-modal={mobileOpen ? 'true' : undefined}
		aria-label={mobileOpen ? 'Sidebar' : undefined}
		data-state={mobileOpen ? undefined : sidebarState}
		data-collapsible={mobileOpen ? undefined : collapsible}
		{...rest}
	>
		{#if mobileOpen && !(logoSrc && !iconCollapsed)}
			<div class={sidebarMobileCloseHeaderClass}>
				<button
					type="button"
					class={sidebarMobileCloseButtonClasses(variant)}
					aria-label="Close sidebar"
					onclick={closeSidebar}
				>
					<X class="size-5" aria-hidden="true" />
				</button>
			</div>
		{:else if logoSrc && !iconCollapsed}
			<div class={cn(sidebarLogoClass, logoClass, mobileOpen && 'justify-between')}>
				<img src={logoSrc} alt={logoAlt} class="h-8 w-auto" />
				{#if mobileOpen}
					<button
						type="button"
						class={sidebarMobileCloseButtonClasses(variant)}
						aria-label="Close sidebar"
						onclick={closeSidebar}
					>
						<X class="size-5" aria-hidden="true" />
					</button>
				{/if}
			</div>
		{/if}

		<nav class={cn(sidebarNavClass, navClass)} aria-label="Sidebar">
			<ul role="list" class={sidebarNavListClass}>
				<li>
					<ul role="list" class={sidebarNavItemsClass}>
						{#if title}
							<li>
								<div
									class={sidebarTitleClasses(variant, layoutCollapsed)}
									{@attach tooltip({
										content: title,
										side: 'right',
										delay: 0,
										disabled: !iconCollapsed
									})}
								>
									{#if TitleIcon}
										<TitleIcon class={sidebarNavIconClass} aria-hidden="true" />
									{/if}
									<span class={sidebarLabelCollapseClasses(iconCollapsed)}>{title}</span>
								</div>
							</li>
						{/if}
						<hr class="my-2 border-t-1 border-gray-200" />
						{#each items as item (item.label)}
							<li>
								{#if isSidebarNavGroup(item)}
									{@const expanded = isGroupOpen(item.label)}
									<button
										type="button"
										class={sidebarNavGroupButtonClasses(
											variant,
											expanded,
											cn(item.class, navItemClass, expanded && activeNavItemClass),
											layoutCollapsed
										)}
										aria-expanded={expanded}
										onclick={() => toggleGroup(item.label)}
										{@attach tooltip({
											content: item.label,
											side: 'right',
											delay: 0,
											disabled: !iconCollapsed
										})}
									>
										{#if item.icon}
											{@const Icon = item.icon}
											<Icon class={sidebarNavIconClass} aria-hidden="true" />
										{/if}
										<span class={sidebarLabelCollapseClasses(iconCollapsed)}>{item.label}</span>
										<ChevronRight
											class={cn(
												sidebarChevronClasses(variant, expanded),
												sidebarChevronCollapseClasses(iconCollapsed)
											)}
											aria-hidden="true"
										/>
									</button>
									{#if expanded && !iconCollapsed}
										<ul class="mt-1 px-2">
											{#each item.items as subItem (subItem.label)}
												<li>
													<a
														href={subItem.href ?? '#'}
														class={sidebarSubLinkClasses(
															variant,
															subItem.active,
															cn(subItem.class, subItemClass, subItem.active && activeSubItemClass)
														)}
														onclick={handleNavClick}
													>
														{subItem.label}
													</a>
												</li>
											{/each}
										</ul>
									{/if}
								{:else}
									<a
										href={item.href ?? '#'}
										class={sidebarNavLinkClasses(
											variant,
											item.active,
											cn(item.class, navItemClass, item.active && activeNavItemClass),
											layoutCollapsed
										)}
										onclick={handleNavClick}
										{@attach tooltip({
											content: item.label,
											side: 'right',
											delay: 0,
											disabled: !iconCollapsed
										})}
									>
										{#if item.icon}
											{@const Icon = item.icon}
											<Icon class={sidebarNavIconClass} aria-hidden="true" />
										{/if}
										<span class={sidebarLabelCollapseClasses(iconCollapsed)}>{item.label}</span>
									</a>
								{/if}
							</li>
						{/each}
					</ul>
				</li>

				{#if user}
					<li
						class={cn(
							sidebarUserSectionClass,
							!layoutCollapsed && sidebarUserSectionExpandedClass,
							userClass
						)}
					>
						<a
							href={user.href ?? '#'}
							class={cn(
								sidebarUserLinkClasses(variant, '', layoutCollapsed),
								layoutCollapsed ? sidebarUserLinkCollapsedClass : sidebarUserLinkExpandedClass
							)}
							onclick={handleNavClick}
						>
							<Avatar
								src={user.avatarSrc}
								alt={user.avatarAlt ?? user.name}
								class={sidebarAvatarOutlineClasses(variant)}
								size={layoutCollapsed ? 'sm' : 'md'}
							/>
							<span class="sr-only">Your profile</span>
							<span class={sidebarLabelCollapseClasses(iconCollapsed)} aria-hidden="true"
								>{user.name}</span
							>
						</a>
					</li>
				{/if}
			</ul>
		</nav>
	</aside>
{/if}
