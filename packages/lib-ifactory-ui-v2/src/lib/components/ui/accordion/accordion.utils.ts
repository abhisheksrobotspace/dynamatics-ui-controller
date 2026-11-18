import type { AccordionItem, AccordionType } from './accordion.constants';

type AccordionValueItem = Pick<AccordionItem, 'value' | 'defaultOpen'>;

export function normalizeAccordionValue(
	value: string | string[] | undefined,
	type: AccordionType,
	items: AccordionValueItem[]
): string[] {
	if (type === 'multiple') {
		if (Array.isArray(value)) {
			return value.map(String);
		}

		if (value !== undefined && value !== '') {
			return [String(value)];
		}

		return items.filter((item) => item.defaultOpen).map((item) => item.value);
	}

	if (typeof value === 'string' && value !== '') {
		return [value];
	}

	const defaultItem = items.find((item) => item.defaultOpen);
	return defaultItem ? [defaultItem.value] : [];
}

export function accordionValueFromOpenValues(
	openValues: string[],
	type: AccordionType
): string | string[] {
	return type === 'multiple' ? openValues : (openValues[0] ?? '');
}
