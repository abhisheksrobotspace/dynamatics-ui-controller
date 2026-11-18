export type AccordionType = 'single' | 'multiple';

export type AccordionItem = {
	value: string;
	title: string;
	content: string;
	disabled?: boolean;
	defaultOpen?: boolean;
};
