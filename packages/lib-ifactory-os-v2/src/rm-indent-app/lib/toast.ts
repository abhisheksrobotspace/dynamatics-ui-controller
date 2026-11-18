import { pushToast, type ToastOptions } from '@ifactory/ui-v2';

const TOAST_DURATION_MS = 2000;

export function rmiPushToast(options: ToastOptions): string {
	return pushToast({ duration: TOAST_DURATION_MS, ...options });
}

/** Surface build_indent.warnings. BOM-unknown rows stay unresolved on Assign & Lock — highlight those. */
export function rmiPushBuildIndentWarnings(warnings: string[] | undefined): void {
	if (!warnings?.length) return;
	for (const warning of warnings) {
		const description = warning.trim();
		if (!description) continue;
		const highlight = /section not found in any BOM/i.test(description);
		rmiPushToast({
			title: highlight ? 'Section not in BOM' : 'Indent note',
			description,
			variant: highlight ? 'error' : 'default',
			duration: highlight ? 8000 : 4000
		});
	}
}
