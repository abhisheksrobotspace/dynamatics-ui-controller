import { cn } from '$lib/utils/cn';

const stripColumnClasses: Record<number, string> = {
	1: 'sm:grid-cols-1',
	2: 'sm:grid-cols-2',
	3: 'sm:grid-cols-3',
	4: 'sm:grid-cols-4',
	5: 'sm:grid-cols-5',
	6: 'sm:grid-cols-6'
};

export function kpiCardStripClass(columns: number, className = ''): string {
	return cn(
		'grid grid-cols-1 border border-border bg-white',
		stripColumnClasses[columns] ?? stripColumnClasses[4],
		className
	);
}

/** Responsive divider classes for cells inside a KPI info strip grid. */
export function kpiCardCellClass(index: number, columns: number): string {
	const parts: string[] = [];

	if (index > 0) parts.push('border-t border-border');
	if (index > 0 && index < columns) parts.push('sm:border-t-0');
	if (index % columns !== columns - 1) parts.push('sm:border-r sm:border-border');

	return parts.join(' ');
}

export const kpiCardCellContentClass = 'min-w-0 bg-white px-6 py-5';
