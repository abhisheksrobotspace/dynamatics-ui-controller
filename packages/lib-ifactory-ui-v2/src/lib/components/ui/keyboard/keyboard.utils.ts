export function insertAtCaret(input: HTMLInputElement | HTMLTextAreaElement, text: string): void {
	const start = input.selectionStart ?? input.value.length;
	const end = input.selectionEnd ?? input.value.length;
	const nextValue = input.value.slice(0, start) + text + input.value.slice(end);

	input.value = nextValue;
	input.dispatchEvent(new Event('input', { bubbles: true }));

	const caret = start + text.length;
	input.setSelectionRange(caret, caret);
	input.focus();
}

export function deleteAtCaret(input: HTMLInputElement | HTMLTextAreaElement): void {
	const start = input.selectionStart ?? 0;
	const end = input.selectionEnd ?? 0;

	let nextValue: string;
	let caret: number;

	if (start === end && start > 0) {
		nextValue = input.value.slice(0, start - 1) + input.value.slice(end);
		caret = start - 1;
	} else {
		nextValue = input.value.slice(0, start) + input.value.slice(end);
		caret = start;
	}

	input.value = nextValue;
	input.dispatchEvent(new Event('input', { bubbles: true }));
	input.setSelectionRange(caret, caret);
	input.focus();
}

export const SHIFT_DOUBLE_TAP_MS = 400;

export function isLetterChar(char: string): boolean {
	return /^[a-z]$/.test(char);
}

export function applyLetterCase(char: string, uppercase: boolean): string {
	return uppercase && isLetterChar(char) ? char.toUpperCase() : char;
}
