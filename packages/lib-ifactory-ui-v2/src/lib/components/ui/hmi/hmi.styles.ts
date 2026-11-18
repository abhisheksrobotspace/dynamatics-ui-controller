import { cn } from '$lib/utils/cn';
import type { HmiKeySize, HmiKeyTone, HmiTone } from './hmi.constants';

/*
 * Keys: flat top + 7 px solid skirt, 7 px radius, no gradients/shadows (Raspberry Pi 4 rendering).
 * Pressed = 5 px down, skirt hidden, 3 px orange stroke, recoloured top + legend.
 */

const KEY_SKIRT: Record<HmiKeyTone, string> = {
	default: 'bg-[#a3aab4]',
	function: 'bg-[#8e96a1]',
	action: 'bg-[#8a330f]'
};

const KEY_FACE: Record<HmiKeyTone, string> = {
	default: 'bg-[#f7f8fa]',
	function: 'bg-[#e0e3e8]',
	action: 'bg-[#f7712f]'
};

const KEY_LEGEND: Record<HmiKeyTone, string> = {
	default: 'text-[#1a1c20]',
	function: 'text-[#3f4550] tracking-[0.96px]',
	action: 'text-white'
};

const KEY_LEGEND_SIZE: Record<HmiKeySize, Record<HmiKeyTone, string>> = {
	md: { default: 'text-[36px]', function: 'text-2xl', action: 'text-[36px]' },
	lg: { default: 'text-[48px]', function: 'text-[26px]', action: 'text-[26px]' }
};

export function hmiKeyClass(
	tone: HmiKeyTone = 'default',
	pressed = false,
	disabled = false,
	className = ''
): string {
	return cn(
		// Column + `w-full flex-1` face: older Chromium (Pi kiosk) won't cross-axis stretch inside <button>.
		'flex h-full w-full min-w-0 cursor-pointer flex-col select-none rounded-[7px] p-0',
		'touch-manipulation [-webkit-tap-highlight-color:transparent]',
		'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6b2c]/50',
		pressed ? 'bg-transparent pt-[5px] pb-[2px]' : cn(KEY_SKIRT[tone], 'pb-[7px]'),
		disabled && 'cursor-not-allowed opacity-40',
		className
	);
}

export function hmiKeyFaceClass(
	tone: HmiKeyTone = 'default',
	pressed = false,
	className = ''
): string {
	return cn(
		'flex min-h-0 w-full min-w-0 flex-1 items-center justify-center gap-2 overflow-hidden rounded-[7px]',
		pressed ? 'border-3 border-[#ff6b2c] bg-[#dde1e6]' : KEY_FACE[tone],
		className
	);
}

export function hmiKeyLegendClass(
	tone: HmiKeyTone = 'default',
	size: HmiKeySize = 'md',
	pressed = false,
	className = ''
): string {
	return cn(
		'font-body leading-normal font-bold whitespace-nowrap',
		KEY_LEGEND_SIZE[size][tone],
		KEY_LEGEND[tone],
		pressed && 'text-[#d2501a]',
		className
	);
}

export function hmiKeyLedClass(on: boolean): string {
	return cn('size-2.5 shrink-0 rounded-full', on ? 'bg-[#1fbf5b]' : 'bg-[#9aa1ab]');
}

/** Legend colour for a lit CAPS key. */
export const hmiKeyLegendLitClass = 'text-[#168a43]';

/* Keyboard tray — 1280 × 501 docked at the bottom. */

export function hmiKeyboardClass(className = ''): string {
	return cn(
		'box-border flex w-full gap-8 border-t-3 border-[#ff6b2c] bg-[#d5d9df] px-3 py-3.5',
		className
	);
}

export const hmiKeyboardBlockClass =
	'grid min-w-0 basis-0 grid-rows-[repeat(5,86px)] gap-x-2 gap-y-2.5';

/* Numpad — 472 × 535 panel, 4 columns, ENTER spans two rows. */

export function hmiNumpadClass(className = ''): string {
	return cn(
		'box-border grid w-full grid-cols-4 grid-rows-[repeat(4,116px)] gap-3 rounded-xl border-t-3 border-[#ff6b2c] bg-[#d5d9df] p-4',
		'shadow-[inset_0px_6px_14px_0px_rgba(0,0,0,0.22)]',
		className
	);
}

/*
 * Keycap buttons (button press test): gradient face over a 6 px edge in a darker shade of the same colour.
 * Pressed / holding = the face drops onto the edge, turns flat and darker with an inner shadow.
 * Disabled = flat grey, no edge, already down.
 */

type KeycapColor = 'go' | 'stop' | 'primary' | 'caution' | 'charcoal' | 'light';

const KEYCAP_EDGE: Record<KeycapColor, string> = {
	go: 'bg-[#126b31]',
	stop: 'bg-[#8c1b1b]',
	primary: 'bg-[#a13a0f]',
	caution: 'bg-[#a87600]',
	charcoal: 'bg-[#1a1c20]',
	light: 'bg-[#9aa1aa]'
};

const KEYCAP_FACE: Record<KeycapColor, string> = {
	go: 'from-[#2dbe60] to-[#1e9a48]',
	stop: 'from-[#ef4444] to-[#cc2b2b]',
	primary: 'from-[#ff7a3d] to-[#e4561a]',
	caution: 'from-[#ffc933] to-[#f2a900]',
	charcoal: 'from-[#4b5059] to-[#3a3e46]',
	light: 'from-[#f7f8f9] to-[#e4e7eb]'
};

const KEYCAP_FLAT: Record<KeycapColor, string> = {
	go: 'bg-[#17803b]',
	stop: 'bg-[#a82222]',
	primary: 'bg-[#c24814]',
	caution: 'bg-[#d99700]',
	charcoal: 'bg-[#2a2d32]',
	light: 'bg-[#d9dde2]'
};

const KEYCAP_TEXT: Record<KeycapColor, string> = {
	go: 'text-white',
	stop: 'text-white',
	primary: 'text-white',
	caution: 'text-[#1a1c20]',
	charcoal: 'text-white',
	light: 'text-[#1b2028]'
};

/** HmiTone `neutral` is the light keypad grey, `end` the charcoal. */
const TONE_KEYCAP: Record<HmiTone, KeycapColor> = {
	go: 'go',
	stop: 'stop',
	primary: 'primary',
	caution: 'caution',
	neutral: 'light',
	end: 'charcoal'
};

function keycapClass(color: KeycapColor, down: boolean, disabled: boolean): string {
	return cn(
		'rounded-[10px] p-0 select-none transition-[padding] duration-[60ms] ease-out motion-reduce:transition-none',
		'focus-visible:outline-[3px] focus-visible:outline-offset-[3px] focus-visible:outline-[#1e6fd9]',
		disabled ? 'cursor-not-allowed pt-1.5' : down ? 'pt-1.5' : cn(KEYCAP_EDGE[color], 'pb-1.5')
	);
}

function keycapFaceClass(color: KeycapColor, down: boolean, disabled: boolean): string {
	return cn(
		'rounded-[10px]',
		disabled
			? 'bg-[#d5d8dd] text-[#7e848d]'
			: cn(
					KEYCAP_TEXT[color],
					down
						? cn(KEYCAP_FLAT[color], 'shadow-[inset_0_3px_6px_rgba(0,0,0,0.28)]')
						: cn(
								'bg-gradient-to-b',
								KEYCAP_FACE[color],
								'shadow-[inset_0_1px_0_rgba(255,255,255,0.28)]'
							)
				)
	);
}

const TONE_TILE: Record<HmiTone, string> = {
	go: 'bg-[#26ae54]',
	stop: 'bg-[#dc2626]',
	primary: 'bg-[#ff6b2c]',
	caution: 'bg-[#f2a900]',
	neutral: 'bg-[#3a3e46]',
	end: 'bg-[#2b3035]'
};

export function hmiHoldButtonClass(
	tone: HmiTone,
	holding: boolean,
	disabled: boolean,
	className = ''
): string {
	return cn(
		'relative flex h-[118px] w-full cursor-pointer flex-col overflow-hidden',
		'touch-none [-webkit-tap-highlight-color:transparent]',
		keycapClass(TONE_KEYCAP[tone], holding, disabled),
		className
	);
}

export function hmiHoldButtonFaceClass(
	tone: HmiTone,
	disabled: boolean,
	className = '',
	holding = false
): string {
	return cn(
		'relative flex min-h-0 w-full flex-1 items-center justify-center gap-4 overflow-hidden',
		keycapFaceClass(TONE_KEYCAP[tone], holding, disabled),
		className
	);
}

/** Hold-to-confirm progress: a light wash sweeping across the face. */
export const hmiHoldButtonFillClass =
	'pointer-events-none absolute inset-y-0 left-0 bg-white/[0.22]';

export const hmiHoldButtonLabelClass =
	'relative font-body text-[38px] leading-normal font-bold tracking-[1.1px] whitespace-nowrap uppercase';

export const hmiHoldButtonIconClass = 'relative size-[42px] shrink-0';

export const hmiHoldButtonHintClass =
	'relative font-heading text-base leading-[22px] font-medium tracking-[0.02em] whitespace-nowrap';

/* Data card */

export function hmiDataCardClass(hasIcon: boolean, className = ''): string {
	return cn(
		'flex overflow-hidden rounded-xl border-2 border-[#c3c8cf] bg-white',
		hasIcon ? 'flex-row items-center gap-5 px-5' : 'flex-col justify-center gap-1.5 px-6',
		className
	);
}

export function hmiDataCardTileClass(tone: HmiTone, className = ''): string {
	return cn(
		'flex size-[60px] shrink-0 items-center justify-center rounded-[10px] text-white',
		TONE_TILE[tone],
		className
	);
}

export const hmiDataCardIconClass = 'size-8';

export function hmiDataCardLabelClass(hasIcon: boolean, className = ''): string {
	return cn(
		'font-heading text-2xl leading-normal tracking-[0.6px] whitespace-nowrap text-[#5a616c] uppercase',
		hasIcon ? 'font-bold' : 'font-medium',
		className
	);
}

export const hmiDataCardValueRowClass =
	'flex items-baseline gap-2 font-body leading-normal font-bold whitespace-nowrap';

export function hmiDataCardValueClass(hasIcon: boolean, className = ''): string {
	return cn('text-[#1b2028]', hasIcon ? 'text-[52px]' : 'text-[56px]', className);
}

export const hmiDataCardUnitClass = 'text-[28px] text-[#5a616c]';

/* Search select — 24 px label, 96 px field, 60 px key-style arrow. */

export const hmiSearchSelectLabelClass =
	'font-heading text-2xl leading-normal font-bold tracking-[0.6px] text-[#4a505a] uppercase';

export function hmiSearchSelectFieldClass(
	open: boolean,
	disabled: boolean,
	className = ''
): string {
	return cn(
		'relative flex h-24 w-full items-center gap-4 overflow-hidden rounded-lg bg-white',
		// Border + padding = 26 px each side in every state, so text and chevron never shift.
		disabled
			? 'cursor-not-allowed border-2 border-[#aeb4bd] bg-[#e4e6ea] px-6'
			: open
				? 'border-3 border-[#ff6b2c] px-[23px]'
				: 'cursor-pointer border-2 border-[#aeb4bd] px-6',
		className
	);
}

export const hmiSearchSelectInputClass = cn(
	'w-full min-w-0 appearance-none border-0 bg-transparent p-0 shadow-none',
	'font-body text-[30px] leading-normal font-bold text-[#1a1c20] caret-[#ff6b2c]',
	'placeholder:font-heading placeholder:text-[26px] placeholder:font-medium placeholder:text-[#7e848d]',
	'focus:ring-0 focus:outline-none'
);

export function hmiSearchSelectDisplayClass(hasValue: boolean, disabled: boolean): string {
	return cn(
		'pointer-events-none absolute inset-0 flex items-center truncate font-heading text-[26px] leading-normal',
		disabled
			? 'font-medium text-[#7e848d]'
			: hasValue
				? 'font-bold text-[#1b2028]'
				: 'font-medium text-[#7e848d]'
	);
}

export function hmiSearchSelectChevronClass(disabled: boolean, pressed = false): string {
	return cn(
		'flex size-[60px] shrink-0 cursor-pointer flex-col rounded-[7px] p-0',
		'touch-manipulation [-webkit-tap-highlight-color:transparent]',
		disabled
			? 'cursor-not-allowed bg-[#c9ced5] pb-[5px]'
			: pressed
				? 'bg-transparent pt-[5px]'
				: 'bg-[#a3aab4] pb-[5px]'
	);
}

export function hmiSearchSelectChevronFaceClass(disabled: boolean): string {
	return cn(
		'flex w-full min-h-0 flex-1 items-center justify-center rounded-[7px]',
		disabled ? 'bg-[#eef0f2]' : 'bg-[#e0e3e8]'
	);
}

export function hmiSearchSelectChevronIconClass(disabled: boolean): string {
	return cn('size-[30px]', disabled ? 'text-[#a9afb8]' : 'text-[#3f4550]');
}

export const hmiSearchSelectPanelClass =
	'absolute inset-x-0 top-full z-30 mt-2 flex flex-col overflow-y-auto rounded-lg border-3 border-[#ff6b2c] bg-white';

export function hmiSearchSelectOptionClass(highlighted: boolean, className = ''): string {
	return cn(
		'flex h-[76px] w-full shrink-0 cursor-pointer items-center gap-3 border-b px-4 text-left',
		'touch-manipulation [-webkit-tap-highlight-color:transparent]',
		highlighted
			? 'border-l-8 border-[#ff6b2c] bg-[#fff1e8]'
			: 'border-[#e5e7eb] bg-white active:bg-[#fff1e8]',
		className
	);
}

export const hmiSearchSelectOptionLabelClass =
	'min-w-0 truncate font-body text-2xl leading-normal font-bold text-[#1a1c20]';

export const hmiSearchSelectOptionMatchClass = 'text-[#e4561a]';

export const hmiSearchSelectOptionMetaClass =
	'ml-auto shrink-0 font-heading text-lg leading-normal font-medium whitespace-nowrap text-[#4a505a]';

export const hmiSearchSelectEmptyClass =
	'px-4 py-5 font-heading text-xl leading-normal font-medium text-[#7e848d]';

/* Raised button (Figma hmi-button): keycap face with an icon tile; `neutral` is the charcoal keycap. */

export type HmiButtonTone = 'neutral' | 'primary' | 'go' | 'stop' | 'caution';
export type HmiButtonSize = 'md' | 'lg';

const BUTTON_KEYCAP: Record<HmiButtonTone, KeycapColor> = {
	neutral: 'charcoal',
	primary: 'primary',
	go: 'go',
	stop: 'stop',
	caution: 'caution'
};

const BUTTON_SIZE: Record<HmiButtonSize, string> = {
	md: 'h-[72px] min-w-60',
	lg: 'h-24 min-w-80'
};

const BUTTON_FACE_SIZE: Record<HmiButtonSize, string> = {
	md: 'gap-4 pr-7 pl-3 text-2xl leading-[31px]',
	lg: 'gap-5 pr-9 pl-4 text-[30px] leading-[38px]'
};

export function hmiButtonClass(
	tone: HmiButtonTone,
	size: HmiButtonSize,
	pressed: boolean,
	disabled: boolean,
	className = '',
	iconOnly = false
): string {
	return cn(
		'relative inline-flex shrink-0 cursor-pointer flex-col font-body font-bold tracking-[0.03em] whitespace-nowrap uppercase',
		'touch-manipulation [-webkit-tap-highlight-color:transparent]',
		BUTTON_SIZE[size],
		iconOnly && (size === 'lg' ? 'w-24 min-w-0' : 'w-[72px] min-w-0'),
		keycapClass(BUTTON_KEYCAP[tone], pressed, disabled),
		className
	);
}

export function hmiButtonFaceClass(
	tone: HmiButtonTone,
	size: HmiButtonSize,
	pressed: boolean,
	disabled: boolean,
	iconOnly = false,
	className = ''
): string {
	return cn(
		'flex min-h-0 w-full flex-1 items-center justify-center',
		iconOnly ? 'px-0' : BUTTON_FACE_SIZE[size],
		keycapFaceClass(BUTTON_KEYCAP[tone], pressed, disabled),
		className
	);
}

export function hmiButtonTileClass(
	tone: HmiButtonTone,
	size: HmiButtonSize,
	disabled: boolean
): string {
	return cn(
		'flex shrink-0 items-center justify-center rounded-md',
		size === 'lg' ? 'size-16' : 'size-12',
		disabled
			? 'bg-black/5'
			: tone === 'neutral'
				? 'bg-black/25'
				: tone === 'caution'
					? 'bg-black/10'
					: 'bg-black/20'
	);
}

export function hmiButtonIconClass(size: HmiButtonSize): string {
	return size === 'lg' ? 'size-9' : 'size-7';
}

/* Flat key-style button (Figma hmi-button · lg/md): flat face over a solid bottom edge, same tones as the hold button. */

export type HmiFlatButtonSize = 'xs' | 'sm' | 'md' | 'lg';

const FLAT_HEIGHT: Record<HmiFlatButtonSize, string> = {
	xs: 'h-14',
	sm: 'h-[74px]',
	md: 'h-24',
	lg: 'h-[118px]'
};

const FLAT_LABEL: Record<HmiFlatButtonSize, string> = {
	xs: 'text-xl leading-[26px]',
	sm: 'text-[22px] leading-7',
	md: 'text-[30px] leading-[38px] tracking-[1.1px] uppercase',
	lg: 'text-[30px] leading-[38px] tracking-[1.1px] uppercase'
};

export function hmiFlatButtonClass(
	tone: HmiTone,
	size: HmiFlatButtonSize,
	pressed: boolean,
	disabled: boolean,
	active: boolean,
	className = ''
): string {
	return cn(
		'relative flex shrink-0 cursor-pointer flex-col font-body font-bold whitespace-nowrap',
		'touch-manipulation [-webkit-tap-highlight-color:transparent]',
		FLAT_HEIGHT[size],
		keycapClass(TONE_KEYCAP[tone], pressed, disabled),
		// Selected: orange edge under a light orange face.
		active && !disabled && !pressed && 'bg-[#f26b2a]',
		className
	);
}

export function hmiFlatButtonFaceClass(
	tone: HmiTone,
	size: HmiFlatButtonSize,
	disabled: boolean,
	active: boolean,
	className = '',
	pressed = false
): string {
	return cn(
		'flex min-h-0 w-full flex-1 items-center justify-center',
		size === 'xs' || size === 'sm' ? 'gap-3' : 'gap-3.5',
		FLAT_LABEL[size],
		keycapFaceClass(TONE_KEYCAP[tone], pressed, disabled),
		active && !disabled && !pressed && 'bg-[#fff2e8] bg-none text-[#1c2129] shadow-none',
		className
	);
}

export function hmiFlatButtonIconClass(size: HmiFlatButtonSize): string {
	return size === 'xs' || size === 'sm' ? 'size-6 shrink-0' : 'size-[34px] shrink-0';
}
