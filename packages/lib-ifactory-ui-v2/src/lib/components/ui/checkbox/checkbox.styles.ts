import { cn } from '$lib/utils/cn';
import type { CheckboxSize } from './checkbox.constants';

function checkboxSizeClass(size: CheckboxSize): string {
	return {
		sm: 'size-4',
		md: 'size-5'
	}[size];
}

/** Tick / dash drawn with ::after — no icon components. */
function checkboxMarkClass(size: CheckboxSize, checked: boolean, indeterminate: boolean): string {
	if (!checked && !indeterminate) return '';

	const base = 'after:pointer-events-none after:absolute after:content-[""]';

	if (checked) {
		return cn(
			base,
			'after:rotate-45 after:border-b-2 after:border-r-2 after:border-current',
			size === 'sm'
				? 'after:top-[2px] after:left-[5px] after:h-[8px] after:w-[4px]'
				: 'after:top-[3px] after:left-[6px] after:h-[10px] after:w-[5px]'
		);
	}

	return cn(
		base,
		'after:top-1/2 after:left-1/2 after:-translate-x-1/2 after:-translate-y-1/2 after:bg-current',
		size === 'sm' ? 'after:h-0.5 after:w-2' : 'after:h-0.5 after:w-2.5'
	);
}

export function checkboxBoxClass(
	size: CheckboxSize = 'md',
	checked = false,
	indeterminate = false,
	disabled = false,
	className = ''
): string {
	const active = checked || indeterminate;

	return cn(
		'relative inline-flex shrink-0 items-center justify-center border',
		checkboxSizeClass(size),
		checkboxMarkClass(size, checked, indeterminate),
		active ? 'border-primary bg-primary text-white' : 'border-border bg-surface text-foreground',
		'focus-within:ring-2 focus-within:ring-primary/40',
		disabled && 'cursor-not-allowed opacity-50',
		className
	);
}

/** Fully hidden; @tailwindcss/forms otherwise paints a square checkbox on top. */
export const checkboxInputClass = cn(
	'absolute inset-0 size-full cursor-pointer opacity-0',
	'appearance-none border-0 bg-transparent shadow-none',
	'checked:border-0 checked:bg-transparent',
	'focus:outline-hidden focus:ring-0',
	'disabled:cursor-not-allowed'
);
