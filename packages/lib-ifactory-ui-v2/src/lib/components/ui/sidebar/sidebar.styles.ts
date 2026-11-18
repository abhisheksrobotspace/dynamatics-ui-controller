import { cn } from '$lib/utils/cn';
import type { SidebarCollapsible, SidebarVariant } from './sidebar.constants';

const sidebarShellLayoutClasses = 'gap-1 py-4 pl-2 pr-0 font-body';
const sidebarMobileSheetLayoutClasses = 'gap-1 pb-4 pl-2 pr-0 pt-0 font-body';
const sidebarShellCollapsedLayoutClasses = 'gap-1 py-4 px-1.5 font-body';

const sidebarItemLayoutClasses =
	'box-border flex h-8 w-full items-center gap-2 px-2 py-1.5 text-sm';

function sidebarSurfaceClasses(variant: SidebarVariant): string {
	return cn('border-r', {
		'border-white/10 bg-gray-900 text-white before:pointer-events-none before:absolute before:inset-0 before:bg-black/10':
			variant === 'dark',
		'border-border bg-[#FAFAFA] text-foreground': variant === 'light'
	});
}

function isIconCollapsed(open: boolean, collapsible: SidebarCollapsible): boolean {
	return !open && collapsible === 'icon';
}

export function sidebarShellClasses(
	variant: SidebarVariant = 'dark',
	open = true,
	collapsible: SidebarCollapsible = 'none',
	className = ''
): string {
	const collapsed = isIconCollapsed(open, collapsible);

	return cn(
		'group relative flex shrink-0 flex-col overflow-x-hidden overflow-y-auto transition-[width,transform] duration-200 ease-linear',
		collapsed ? sidebarShellCollapsedLayoutClasses : sidebarShellLayoutClasses,
		sidebarSurfaceClasses(variant),
		{
			'w-60': open || collapsible !== 'icon',
			'w-14': collapsed,
			hidden: !open && collapsible === 'none',
			'-translate-x-full': !open && collapsible === 'offcanvas'
		},
		className
	);
}

export const sidebarLabelClass =
	'min-w-0 max-w-48 truncate overflow-hidden whitespace-nowrap opacity-100 transition-[max-width,opacity] duration-200 ease-linear';

export const sidebarLabelCollapsedClass = 'max-w-0 opacity-0';

export function sidebarLabelCollapseClasses(collapsed: boolean): string {
	return cn(sidebarLabelClass, collapsed && sidebarLabelCollapsedClass);
}

export function sidebarChevronCollapseClasses(collapsed: boolean): string {
	return cn(
		'max-w-4 shrink-0 overflow-hidden opacity-100 transition-[max-width,opacity,margin] duration-200 ease-linear',
		collapsed && 'max-w-0 opacity-0 !ml-0'
	);
}

export const sidebarLogoClass = 'relative flex h-16 shrink-0 items-center px-2';

export const sidebarMobileCloseHeaderClass =
	'flex shrink-0 items-center justify-end px-2 pt-1 pb-1';
export const sidebarNavClass = 'relative flex flex-1 flex-col';
export const sidebarNavListClass = 'flex flex-1 flex-col';
export const sidebarNavItemsClass = 'flex flex-col gap-1';

export function sidebarTitleClasses(
	variant: SidebarVariant = 'dark',
	iconCollapsed = false
): string {
	return cn(
		sidebarItemLayoutClasses,
		'cursor-default select-none font-medium',
		iconCollapsed && 'justify-center gap-0 px-0',
		variant === 'dark' ? 'text-white' : 'text-foreground'
	);
}

export function sidebarNavLinkClasses(
	variant: SidebarVariant = 'dark',
	active = false,
	className = '',
	iconCollapsed = false
): string {
	return cn(
		sidebarItemLayoutClasses,
		iconCollapsed && 'justify-center gap-0 px-0',
		!iconCollapsed && (active ? 'border-r-2 border-r-primary font-medium' : 'font-normal'),
		iconCollapsed && active && 'border-r-2 border-r-primary font-medium',
		iconCollapsed && !active && 'font-normal',
		variant === 'dark' &&
			(active
				? iconCollapsed
					? 'bg-white/10 text-white'
					: 'bg-white/5 text-white'
				: 'text-gray-400 hover:bg-white/5 hover:text-white'),
		variant === 'light' &&
			(active
				? 'bg-background text-foreground'
				: 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground'),
		className
	);
}

export function sidebarNavGroupButtonClasses(
	variant: SidebarVariant = 'dark',
	expanded = false,
	className = '',
	iconCollapsed = false
): string {
	return cn(
		sidebarNavLinkClasses(variant, expanded, className, iconCollapsed),
		!iconCollapsed && 'justify-between text-left'
	);
}

export const sidebarNavIconClass = 'size-5 shrink-0 text-current';

export function sidebarChevronClasses(
	variant: SidebarVariant = 'dark',
	expanded = false,
	className = ''
): string {
	return cn(
		'ml-auto size-4 shrink-0 transition-transform',
		variant === 'dark' ? 'text-gray-400' : 'text-muted-foreground',
		expanded && 'rotate-90',
		className
	);
}

export function sidebarSubLinkClasses(
	variant: SidebarVariant = 'dark',
	active = false,
	className = ''
): string {
	return cn(
		'box-border flex h-8 w-full items-center pl-7 text-sm',
		active ? 'border-r-2 border-r-primary font-medium' : 'font-normal',
		variant === 'dark' &&
			(active ? 'bg-white/5 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'),
		variant === 'light' &&
			(active
				? 'bg-background text-foreground'
				: 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground'),
		className
	);
}

export const sidebarUserSectionClass = 'mt-auto';
export const sidebarUserSectionExpandedClass = 'px-2';

export function sidebarUserLinkClasses(
	variant: SidebarVariant = 'dark',
	className = '',
	iconCollapsed = false
): string {
	return cn(
		'flex h-8 items-center gap-2 text-sm font-normal',
		iconCollapsed ? 'justify-center px-0' : 'px-2',
		variant === 'dark'
			? 'text-gray-400 hover:bg-white/5 hover:text-white'
			: 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground',
		className
	);
}

export const sidebarUserLinkExpandedClass = '';
export const sidebarUserLinkCollapsedClass = '';

export function sidebarAvatarOutlineClasses(variant: SidebarVariant = 'dark'): string {
	return variant === 'dark'
		? 'outline -outline-offset-1 outline-white/10'
		: 'outline -outline-offset-1 outline-border';
}

export function sidebarMobileCloseButtonClasses(variant: SidebarVariant = 'dark'): string {
	return cn(
		'inline-flex size-8 shrink-0 items-center justify-center transition-colors',
		variant === 'dark'
			? 'text-gray-400 hover:bg-white/10 hover:text-white'
			: 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground'
	);
}

export function sidebarMobileBackdropClasses(): string {
	return 'fixed inset-0 z-40 bg-black/50';
}

export function sidebarMobileSheetClasses(
	variant: SidebarVariant = 'dark',
	className = ''
): string {
	return cn(
		'fixed inset-y-0 left-0 z-50 flex w-60 max-w-[85vw] flex-col overflow-x-hidden overflow-y-auto shadow-xl transition-transform duration-300 ease-in-out',
		sidebarMobileSheetLayoutClasses,
		sidebarSurfaceClasses(variant),
		className
	);
}
