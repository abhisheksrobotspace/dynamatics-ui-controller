import { cn } from '$lib/utils/cn';
import type { TabsSize, TabsVariant } from './tabs.constants';

export const tabsMobileSelectClass =
	'col-start-1 row-start-1 w-full appearance-none border border-border bg-surface py-2 pr-8 pl-3 text-base text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20';

export const tabsMobileChevronClass =
	'pointer-events-none col-start-1 row-start-1 mr-2 size-5 self-center justify-self-end text-muted-foreground';

function tabsSizeClasses(size: TabsSize): string {
	return cn({
		'h-8 px-3 text-xs leading-4 tracking-[0.16px]': size === 'sm',
		'h-10 px-4 text-sm leading-[18px] tracking-[0.16px]': size === 'md',
		'h-11 px-5 text-base leading-5 tracking-[0.16px]': size === 'lg'
	});
}

export function tabsNavClass(variant: TabsVariant): string {
	if (variant === 'segmented') {
		return 'inline-flex gap-1 border border-border bg-[#F3F4F6] p-0.5';
	}

	return cn({
		'flex flex-row items-start gap-px overflow-x-auto': variant === 'underline',
		'flex gap-4': variant === 'pills'
	});
}

export function tabsTabClass(variant: TabsVariant, active: boolean, size: TabsSize): string {
	const base =
		'inline-flex items-center text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:pointer-events-none disabled:opacity-50';

	if (variant === 'underline') {
		return cn(
			'box-border inline-flex shrink-0 items-center gap-2 border-b-2 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:pointer-events-none disabled:opacity-50',
			tabsSizeClasses(size),
			active
				? 'border-[#161616] font-medium text-[#161616]'
				: 'border-[#C6C6C6] font-normal text-[#525252] hover:text-[#161616]'
		);
	}

	if (variant === 'pills') {
		return cn(
			base,
			tabsSizeClasses(size),
			active ? 'bg-[#F3F4F6] text-foreground' : 'text-muted-foreground hover:text-foreground'
		);
	}

	return cn(
		'inline-flex shrink-0 items-center gap-1 px-2.5 py-1.5 text-xs leading-4 tracking-[0.16px] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:pointer-events-none disabled:opacity-50',
		active
			? 'bg-surface font-medium text-[#161616] shadow-sm'
			: 'font-normal text-[#525252] hover:text-[#161616]'
	);
}

export function tabsIconClass(variant: TabsVariant, active: boolean, size: TabsSize): string {
	const usesCarbonColors = variant === 'underline' || variant === 'segmented';

	return cn(
		'shrink-0',
		variant === 'underline'
			? cn({ 'size-3.5': size === 'sm', 'size-4': size === 'md', 'size-5': size === 'lg' })
			: variant === 'segmented'
				? 'mr-1 -ml-0.5 size-3.5'
				: cn({
						'size-4': size === 'sm',
						'mr-2 -ml-0.5 size-5': size === 'md',
						'mr-2 -ml-0.5 size-6': size === 'lg'
					}),
		active
			? usesCarbonColors
				? 'text-[#161616]'
				: 'text-primary'
			: usesCarbonColors
				? 'text-[#525252]'
				: 'text-muted-foreground'
	);
}
