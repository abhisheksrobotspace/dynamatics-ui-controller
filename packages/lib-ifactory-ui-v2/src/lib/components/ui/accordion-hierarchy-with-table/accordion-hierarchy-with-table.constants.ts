export type { AccordionType } from '../accordion/accordion.constants';

export type AccordionHierarchyBadgeTone = 'primary' | 'success' | 'secondary';

export type AccordionHierarchyTable<T extends Record<string, unknown>> = {
	title?: string;
	rows: T[];
};

export type AccordionHierarchyGroup<T extends Record<string, unknown>> = {
	value: string;
	label: string;
	description?: string;
	badge?: string;
	badgeTone?: AccordionHierarchyBadgeTone;
	badgeClass?: string;
	footer?: string;
	tables: AccordionHierarchyTable<T>[];
	disabled?: boolean;
	selectable?: boolean;
	defaultOpen?: boolean;
};

export type AccordionHierarchyItem<T extends Record<string, unknown>> = {
	value: string;
	label: string;
	description?: string;
	badge?: string;
	badgeTone?: AccordionHierarchyBadgeTone;
	badgeClass?: string;
	groups: AccordionHierarchyGroup<T>[];
	emptyLabel?: string;
	disabled?: boolean;
	defaultOpen?: boolean;
};
