import type { ComboboxItem } from '../combobox/combobox.constants';

/**
 * HMI component family (ioWare 1280×800 touch panels).
 * Figma: "New - iFactoryOS - Designs" → HMI FROZEN DESIGN.
 */

/** default = characters / SPACE, function = CAPS, DEL, ?123, ABC, CLEAR; action = ENTER only. */
export type HmiKeyTone = 'default' | 'function' | 'action';

/** md = keyboard keys (36 px legends), lg = numpad keys (48 px legends). */
export type HmiKeySize = 'md' | 'lg';

/** `end`: dark End Job button (Figma hmi-button · end); `caution`: yellow (e.g. Raise Alert). */
export type HmiTone = 'go' | 'stop' | 'primary' | 'neutral' | 'end' | 'caution';

/** Pressed state must stay visible at least this long so a quick tap is still seen. */
export const HMI_PRESS_MIN_MS = 120;

export const HMI_HOLD_DEFAULT_MS = 1500;

/** Auto-repeat for held keys (DEL): first repeat after the delay, then every interval. */
export const HMI_REPEAT_DELAY_MS = 450;
export const HMI_REPEAT_INTERVAL_MS = 70;

/** Keyboard / numpad roots carry `data-hmi-keypad`; taps there don't close HmiSearchSelect. */
export const HMI_KEYPAD_SELECTOR = '[data-hmi-keypad]';

export type HmiSearchSelectItem = ComboboxItem;
