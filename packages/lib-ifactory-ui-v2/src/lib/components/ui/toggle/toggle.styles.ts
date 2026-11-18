import { cn } from '$lib/utils/cn';
import type { ToggleSize } from './toggle.constants';

function toggleSizeClasses(size: ToggleSize): {
	track: string;
	thumb: string;
	thumbChecked: string;
} {
	return {
		sm: {
			track: 'w-9',
			thumb: 'size-4',
			thumbChecked: 'translate-x-4'
		},
		md: {
			track: 'w-11',
			thumb: 'size-5',
			thumbChecked: 'translate-x-5'
		},
		lg: {
			track: 'w-14',
			thumb: 'size-6',
			thumbChecked: 'translate-x-7'
		}
	}[size];
}

export function toggleTrackClass(
	size: ToggleSize = 'md',
	checked = false,
	disabled = false,
	className = ''
): string {
	const { track } = toggleSizeClasses(size);

	return cn(
		'relative inline-flex shrink-0 rounded-full p-0.5',
		'inset-ring inset-ring-gray-900/5',
		'transition-colors duration-200 ease-in-out',
		checked ? 'bg-primary' : 'bg-gray-200',
		track,
		disabled && 'cursor-not-allowed opacity-50',
		className
	);
}

export function toggleThumbClass(size: ToggleSize = 'md', checked = false): string {
	const { thumb, thumbChecked } = toggleSizeClasses(size);

	return cn(
		'rounded-full bg-white shadow-xs ring-1 ring-gray-900/5',
		'transition-transform duration-200 ease-in-out',
		thumb,
		checked && thumbChecked
	);
}

/** Fully hidden; @tailwindcss/forms otherwise paints a square checkbox on top. */
export const toggleInputClass = cn(
	'absolute inset-0 size-full cursor-pointer opacity-0',
	'appearance-none border-0 bg-transparent shadow-none',
	'checked:border-0 checked:bg-transparent',
	'focus:outline-hidden focus:ring-0',
	'disabled:cursor-not-allowed'
);
