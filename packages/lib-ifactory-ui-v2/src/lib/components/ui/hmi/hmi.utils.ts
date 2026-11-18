import type { HmiSearchSelectItem } from './hmi.constants';

export type HighlightPart = { text: string; match: boolean };

/** Splits `text` around every case-insensitive occurrence of `query`. */
export function splitHighlight(text: string, query: string): HighlightPart[] {
	const needle = query.trim().toLowerCase();
	if (!needle) return [{ text, match: false }];

	const haystack = text.toLowerCase();
	const parts: HighlightPart[] = [];
	let cursor = 0;
	let index = haystack.indexOf(needle);

	while (index !== -1) {
		if (index > cursor) parts.push({ text: text.slice(cursor, index), match: false });
		parts.push({ text: text.slice(index, index + needle.length), match: true });
		cursor = index + needle.length;
		index = haystack.indexOf(needle, cursor);
	}

	if (cursor < text.length) parts.push({ text: text.slice(cursor), match: false });
	return parts;
}

export function filterSearchItems(
	items: HmiSearchSelectItem[],
	query: string
): HmiSearchSelectItem[] {
	const needle = query.trim().toLowerCase();
	if (!needle) return items;
	return items.filter(
		(item) => item.label.toLowerCase().includes(needle) || item.meta?.toLowerCase().includes(needle)
	);
}

/** Clears an input the same way insertAtCaret / deleteAtCaret write to it. */
export function clearInput(input: HTMLInputElement | HTMLTextAreaElement): void {
	input.value = '';
	input.dispatchEvent(new Event('input', { bubbles: true }));
	input.setSelectionRange(0, 0);
	input.focus();
}
