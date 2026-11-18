export type { AccordionType } from '../accordion/accordion.constants';

export type AccordionWithContentCheckboxOption = {
	value: number;
	label?: string;
};

export type AccordionWithContentItem = {
	value: string;
	label: string;
	description?: string;
	/** Right-aligned secondary text (e.g. stock rule summary). */
	summary?: string;
	badge?: string;
	badgeTone?: 'primary' | 'success';
	content?: string;
	checkboxes?: AccordionWithContentCheckboxOption[];
	selectedCheckboxValues?: number[];
	disabled?: boolean;
	defaultOpen?: boolean;
};
