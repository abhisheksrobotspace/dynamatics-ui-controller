export function shouldConfirmDialogOnEnter(event: KeyboardEvent): boolean {
	if (event.key !== 'Enter') return false;
	if (event.defaultPrevented) return false;
	if (event.isComposing) return false;
	if (event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return false;

	const target = event.target;
	if (!(target instanceof HTMLElement)) return false;

	if (target.tagName === 'TEXTAREA') return false;
	if (target.tagName === 'BUTTON') return false;
	if (target.closest('[role="combobox"]')) return false;
	if (target.closest('[role="listbox"]')) return false;

	return true;
}
