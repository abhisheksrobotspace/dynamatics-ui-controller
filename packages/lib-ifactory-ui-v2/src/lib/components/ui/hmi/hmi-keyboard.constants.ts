import type { Component } from 'svelte';
import { Delete } from '@lucide/svelte';
import type { HmiKeyTone } from './hmi.constants';

export type HmiKeyboardLayout = 'letters' | 'symbols';

export type HmiKeyboardKeyAction =
	| { kind: 'char'; value: string }
	| { kind: 'backspace' }
	| { kind: 'caps' }
	| { kind: 'space' }
	| { kind: 'done' }
	| { kind: 'layout'; to: HmiKeyboardLayout };

export type HmiKeyboardKeyDef = {
	id: string;
	/** Omitted for the done key — its legend comes from the `doneLabel` prop. */
	label?: string;
	/** Icon legend in place of `label` (DEL shows the backspace icon). */
	icon?: Component<{ class?: string; strokeWidth?: number }>;
	ariaLabel?: string;
	tone?: HmiKeyTone;
	/** Grid columns the key spans inside its block. */
	span?: number;
	action: HmiKeyboardKeyAction;
};

/** A grid of 5 rows; keys auto-flow left→right, wrapping at `columns`. */
export type HmiKeyboardBlockDef = {
	id: string;
	columns: number;
	/** Relative width of the block when a layout has several (Figma px widths). */
	grow: number;
	keys: HmiKeyboardKeyDef[];
};

function chars(value: string, prefix: string): HmiKeyboardKeyDef[] {
	return value.split('').map((char) => ({
		id: `${prefix}-${char}`,
		label: char,
		action: { kind: 'char', value: char }
	}));
}

const DEL: HmiKeyboardKeyDef = {
	id: 'del',
	label: 'DEL',
	icon: Delete,
	ariaLabel: 'Delete',
	tone: 'function',
	action: { kind: 'backspace' }
};

const SPACE = (span: number): HmiKeyboardKeyDef => ({
	id: 'space',
	label: 'SPACE',
	ariaLabel: 'Space',
	span,
	action: { kind: 'space' }
});

const DONE = (span: number): HmiKeyboardKeyDef => ({
	id: 'done',
	tone: 'action',
	span,
	action: { kind: 'done' }
});

/** ABC screen — 10 × 5 grid, 118 × 86 keys. */
export const HMI_LETTER_BLOCKS: HmiKeyboardBlockDef[] = [
	{
		id: 'letters',
		columns: 10,
		grow: 1,
		keys: [
			...chars('1234567890', 'num'),
			...chars('qwertyuiop', 'letter'),
			...chars('asdfghjkl', 'letter'),
			DEL,
			{
				id: 'caps',
				label: 'CAPS',
				ariaLabel: 'Caps lock',
				tone: 'function',
				action: { kind: 'caps' }
			},
			...chars('zxcvbnm.-', 'letter'),
			{
				id: 'to-symbols',
				label: '?123',
				ariaLabel: 'Symbols and numbers',
				tone: 'function',
				span: 2,
				action: { kind: 'layout', to: 'symbols' }
			},
			...chars('@', 'char'),
			SPACE(4),
			...chars('_', 'char'),
			DONE(2)
		]
	}
];

/** ?123 screen — 7-col symbol block + calculator numpad. */
export const HMI_SYMBOL_BLOCKS: HmiKeyboardBlockDef[] = [
	{
		id: 'symbols',
		columns: 7,
		grow: 853,
		keys: [
			...chars('!@#$%&*', 'sym'),
			...chars('()-_=+/', 'sym'),
			...chars('[]{}<>?', 'sym'),
			...chars('\\|:;\'",', 'sym'),
			{
				id: 'to-letters',
				label: 'ABC',
				ariaLabel: 'Letters',
				tone: 'function',
				span: 2,
				action: { kind: 'layout', to: 'letters' }
			},
			SPACE(2),
			...chars('~^`', 'sym')
		]
	},
	{
		id: 'numpad',
		columns: 6,
		grow: 371,
		keys: [
			...'789456123'.split('').map((char): HmiKeyboardKeyDef => ({
				id: `num-${char}`,
				label: char,
				span: 2,
				action: { kind: 'char', value: char }
			})),
			{ id: 'num-0', label: '0', span: 4, action: { kind: 'char', value: '0' } },
			{ id: 'num-dot', label: '.', span: 2, action: { kind: 'char', value: '.' } },
			{ ...DEL, span: 3 },
			DONE(3)
		]
	}
];

export const HMI_KEYBOARD_BLOCKS: Record<HmiKeyboardLayout, HmiKeyboardBlockDef[]> = {
	letters: HMI_LETTER_BLOCKS,
	symbols: HMI_SYMBOL_BLOCKS
};
