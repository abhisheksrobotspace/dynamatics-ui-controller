import type { Component } from 'svelte';

export type SidebarNavSubItem = {
	label: string;
	href?: string;
	active?: boolean;
	class?: string;
};

export type SidebarNavLink = {
	type?: 'link';
	label: string;
	href?: string;
	icon?: Component;
	active?: boolean;
	class?: string;
};

export type SidebarNavGroup = {
	type: 'group';
	label: string;
	icon?: Component;
	items: SidebarNavSubItem[];
	defaultOpen?: boolean;
	class?: string;
};

export type SidebarNavItem = SidebarNavLink | SidebarNavGroup;

export type SidebarUser = {
	name: string;
	href?: string;
	avatarSrc?: string;
	avatarAlt?: string;
};

export type SidebarVariant = 'dark' | 'light';
export type SidebarCollapsible = 'none' | 'icon' | 'offcanvas';

export const SIDEBAR_MOBILE_BREAKPOINT = 768;
export const SIDEBAR_WIDTH_MOBILE = '15rem';

export const SIDEBAR_WIDTH = '15rem'; // 240px
export const SIDEBAR_WIDTH_ICON = '3.5rem'; // 56px
export const SIDEBAR_TRANSITION_MS = 200;

export function isSidebarNavGroup(item: SidebarNavItem): item is SidebarNavGroup {
	return item.type === 'group';
}
