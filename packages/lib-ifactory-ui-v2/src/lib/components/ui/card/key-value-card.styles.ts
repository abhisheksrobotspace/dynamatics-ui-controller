import { cn } from '$lib/utils/cn';

export function keyValueCardClass(className = ''): string {
	return cn(
		'box-border flex min-h-20 w-full items-center justify-between gap-2 border border-border bg-status-offline-bg px-5',
		className
	);
}

export const keyValueCardLabelClass =
	'font-heading text-sm font-bold uppercase tracking-wide text-muted';

export const keyValueCardValueClass = 'font-body text-2xl font-bold text-foreground';
