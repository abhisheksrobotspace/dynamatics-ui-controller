import type { ComboboxItem } from './combobox.constants';

export function normalizeComboboxValue(
	value: string | string[] | undefined,
	multiple: boolean
): string[] {
	if (multiple) {
		if (Array.isArray(value)) {
			return value.map(String);
		}

		return value === undefined || value === null || value === '' ? [] : [String(value)];
	}

	if (value === undefined || value === null || value === '') {
		return [];
	}

	return [String(value)];
}

export function filterComboboxItems(items: ComboboxItem[], query: string): ComboboxItem[] {
	const normalized = query.trim().toLowerCase();
	if (!normalized) {
		return items;
	}

	return items.filter(
		(item) =>
			item.label.toLowerCase().includes(normalized) || item.meta?.toLowerCase().includes(normalized)
	);
}
