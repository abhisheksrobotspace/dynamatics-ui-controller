export {
	accordionWithTableClass as accordionHierarchyWithTableClass,
	accordionWithTableItemClass as accordionHierarchyItemClass,
	accordionWithTableTriggerClass as accordionHierarchyTriggerClass,
	accordionWithTableTriggerTitleClass as accordionHierarchyTriggerTitleClass,
	accordionWithTableTriggerHeadingClass as accordionHierarchyTriggerHeadingClass,
	accordionWithTableTriggerSubtitleClass as accordionHierarchyTriggerSubtitleClass,
	accordionWithTableBadgeClass as accordionHierarchyBadgeClass,
	accordionWithTableIconClass as accordionHierarchyIconClass,
	accordionWithTableContentWrapperClass as accordionHierarchyContentWrapperClass,
	accordionWithTableContentInnerClass as accordionHierarchyContentInnerClass
} from '../accordion-with-table/accordion-with-table.styles';

import { cn } from '$lib/utils/cn';

export const accordionHierarchyGroupListClass = 'flex flex-col gap-4 p-5';

export const accordionHierarchyGroupItemClass = 'border border-border bg-[#F9FAFB]';

export const accordionHierarchyGroupTriggerClass =
	'flex w-full items-start gap-4 bg-[#F9FAFB] px-5 py-4 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed';

export const accordionHierarchyGroupPanelClass = 'space-y-4 border-t border-border px-5 pb-5 pt-4';

export const accordionHierarchyTableTitleClass = 'text-sm font-bold text-foreground';

export const accordionHierarchyTableFooterClass = 'text-xs text-muted-foreground';

export const accordionHierarchyEmptyLabelClass = 'px-5 pb-5 text-sm text-[#C6C6C6]';

export function accordionHierarchyGroupBadgeClass(
	tone: 'primary' | 'success' | 'secondary' = 'primary',
	className = ''
): string {
	return cn(
		'inline-flex shrink-0 items-center px-2.5 py-1 text-[11px] font-bold uppercase',
		{
			'border border-primary text-primary': tone === 'primary',
			'bg-[#DCFCE7] text-[#22C55E]': tone === 'success',
			'border border-border bg-[#F0F0F0] text-muted-foreground': tone === 'secondary'
		},
		className
	);
}
