import { tick } from 'svelte';

/** Scroll a dialog form error anchor into view after the banner renders. */
export async function focusFormError(anchor: HTMLElement | null | undefined): Promise<void> {
	if (!anchor) return;
	await tick();
	anchor.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
