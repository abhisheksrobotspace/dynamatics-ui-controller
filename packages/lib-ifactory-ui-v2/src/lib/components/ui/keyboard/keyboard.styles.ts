import { cn } from '$lib/utils/cn';
import type { KeyboardKeyVariant } from './keyboard.constants';

/**
 * Design reference: 1280×348 tray, 62px keys, 6px gaps, 13px horizontal inset.
 * Scales with viewport — tuned for 1280×800 HMI.
 */
export const KEYBOARD_VIEWPORT_STYLE =
	'--ifactory-kb-gap: clamp(4px, 0.47vw, 6px); --ifactory-kb-inset-x: clamp(8px, 1.02vw, 13px); --ifactory-kb-inset-y: clamp(6px, 1vh, 8px); --ifactory-kb-row-inset: clamp(1.5rem, 4.9vw, 3.9375rem); --ifactory-kb-tray-height: clamp(17.5rem, 43.5vh, 21.75rem); --ifactory-kb-key-min-height: clamp(2.75rem, 7.75vh, 3.875rem); --ifactory-kb-font: clamp(1.125rem, 2.2vh, 1.75rem); --ifactory-kb-font-sm: clamp(0.875rem, 1.6vh, 1.25rem);';

export function keyboardTrayClass(className = ''): string {
	return cn(
		'box-border isolate grid w-full max-w-none grid-rows-5',
		'h-[var(--ifactory-kb-tray-height)] min-h-[var(--ifactory-kb-tray-height)]',
		'gap-[var(--ifactory-kb-gap)] px-[var(--ifactory-kb-inset-x)] pt-[var(--ifactory-kb-inset-y)] pb-[var(--ifactory-kb-gap)]',
		'border-t border-[#DDE1E5] bg-[#E6E8EA]',
		className
	);
}

export function keyboardRowClass(padding: 'center' | 'default' = 'default'): string {
	return cn(
		'grid h-full min-h-0 w-full max-w-none gap-[var(--ifactory-kb-gap)]',
		padding === 'center' && 'px-[var(--ifactory-kb-row-inset)]'
	);
}

export function keyboardKeyClass(variant: KeyboardKeyVariant = 'default', className = ''): string {
	return cn(
		'box-border flex h-full min-h-[var(--ifactory-kb-key-min-height)] w-full min-w-0 select-none items-center justify-center font-heading font-bold transition-colors duration-75',
		'[-webkit-tap-highlight-color:transparent] touch-manipulation',
		'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F26522]/40',
		'disabled:pointer-events-none disabled:opacity-60',
		{
			'border-0 bg-[#F26522] text-[length:var(--ifactory-kb-font-sm)] leading-[1.35] text-white hover:bg-[#F26522]/90 active:bg-[#D9561F]':
				variant === 'done',
			'border-[1.5px] border-[#F26522] bg-[#F5F6F8] text-[length:var(--ifactory-kb-font-sm)] leading-[1.35] text-[#F26522] hover:bg-[#ECEEF0] active:bg-[#DDE1E5]':
				variant === 'active',
			'border border-[#DDE1E5] bg-[#F5F6F8] text-[length:var(--ifactory-kb-font-sm)] leading-[1.35] text-[#1B2028] hover:bg-[#ECEEF0] active:bg-[#DDE1E5]':
				variant === 'muted',
			'border border-[#DDE1E5] bg-white text-[length:var(--ifactory-kb-font)] leading-[1.36] text-[#1B2028] hover:bg-[#F5F6F8] active:bg-[#DDE1E5]':
				variant === 'default' || variant === 'space'
		},
		className
	);
}

export const keyboardIconClass = 'size-[clamp(1.125rem,2.2vh,1.75rem)] shrink-0 text-[#1B2028]';
