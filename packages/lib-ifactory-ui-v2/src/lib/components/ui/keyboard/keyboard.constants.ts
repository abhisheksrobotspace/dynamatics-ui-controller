export type KeyboardLayout = 'letters' | 'symbols';

export type KeyboardKeyVariant = 'default' | 'muted' | 'active' | 'done' | 'space';

export type KeyboardKeyDef = {
	id: string;
	label?: string;
	ariaLabel?: string;
	variant?: KeyboardKeyVariant;
	width?: 'standard' | 'wide' | 'space' | 'done';
	action:
		| { kind: 'char'; value: string }
		| { kind: 'backspace' }
		| { kind: 'shift' }
		| { kind: 'space' }
		| { kind: 'done' }
		| { kind: 'toggle-layout' };
};

export type KeyboardRowDef = {
	id: string;
	/** CSS grid-template-columns — keys stretch to full row width. */
	columns: string;
	/** Extra horizontal inset to center 9-key rows (Figma: 76px vs 13px side margin). */
	padding?: 'center';
	keys: KeyboardKeyDef[];
};

const STANDARD = 'standard' as const;
const WIDE = 'wide' as const;
const SPACE = 'space' as const;
const DONE = 'done' as const;
const MUTED = 'muted' as const;
const ACTIVE = 'active' as const;

/** 120px standard key at 1280px reference width. */
const COLS_10 = 'repeat(10, minmax(0, 1fr))';
const COLS_9 = 'repeat(9, minmax(0, 1fr))';
/** 186px wide keys — 186/120 ≈ 1.55 */
const COLS_BOTTOM_LETTERS = 'minmax(0, 1.55fr) repeat(7, minmax(0, 1fr)) minmax(0, 1.55fr)';
/** 186 + 120 + 624 + 120 + 186 — space is 624/120 = 5.2 */
const COLS_CONTROLS =
	'minmax(0, 1.55fr) minmax(0, 1fr) minmax(0, 5.2fr) minmax(0, 1fr) minmax(0, 1.55fr)';

export const LETTER_ROWS: KeyboardRowDef[] = [
	{
		id: 'numbers',
		columns: COLS_10,
		keys: '1234567890'.split('').map((value) => ({
			id: `num-${value}`,
			label: value,
			action: { kind: 'char', value }
		}))
	},
	{
		id: 'top-letters',
		columns: COLS_10,
		keys: 'qwertyuiop'.split('').map((value) => ({
			id: `letter-${value}`,
			label: value,
			action: { kind: 'char', value }
		}))
	},
	{
		id: 'mid-letters',
		columns: COLS_9,
		padding: 'center',
		keys: 'asdfghjkl'.split('').map((value) => ({
			id: `letter-${value}`,
			label: value,
			action: { kind: 'char', value }
		}))
	},
	{
		id: 'bottom-letters',
		columns: COLS_BOTTOM_LETTERS,
		keys: [
			{
				id: 'shift',
				ariaLabel: 'Shift',
				variant: MUTED,
				width: WIDE,
				action: { kind: 'shift' }
			},
			...'zxcvbnm'.split('').map((value) => ({
				id: `letter-${value}`,
				label: value,
				action: { kind: 'char', value }
			})),
			{
				id: 'backspace',
				ariaLabel: 'Backspace',
				variant: MUTED,
				width: WIDE,
				action: { kind: 'backspace' }
			}
		]
	},
	{
		id: 'controls',
		columns: COLS_CONTROLS,
		keys: [
			{
				id: 'symbols-toggle',
				label: '?123',
				variant: MUTED,
				width: WIDE,
				action: { kind: 'toggle-layout' }
			},
			{
				id: 'comma',
				label: ',',
				width: STANDARD,
				action: { kind: 'char', value: ',' }
			},
			{
				id: 'space',
				ariaLabel: 'Space',
				width: SPACE,
				action: { kind: 'space' }
			},
			{
				id: 'period',
				label: '.',
				width: STANDARD,
				action: { kind: 'char', value: '.' }
			},
			{
				id: 'done',
				label: 'Done',
				variant: DONE,
				width: DONE,
				action: { kind: 'done' }
			}
		]
	}
];

export const SYMBOL_ROWS: KeyboardRowDef[] = [
	{
		id: 'numbers',
		columns: COLS_10,
		keys: '1234567890'.split('').map((value) => ({
			id: `num-${value}`,
			label: value,
			action: { kind: 'char', value }
		}))
	},
	{
		id: 'symbols-row-1',
		columns: COLS_10,
		keys: ['!', '@', '#', '$', '%', '^', '&', '*', '(', ')'].map((value) => ({
			id: `symbol-${value}`,
			label: value,
			action: { kind: 'char', value }
		}))
	},
	{
		id: 'symbols-row-2',
		columns: COLS_9,
		padding: 'center',
		keys: ['-', '_', '=', '+', '[', ']', '{', '}', '\\'].map((value) => ({
			id: `symbol-${value}`,
			label: value,
			action: { kind: 'char', value }
		}))
	},
	{
		id: 'symbols-row-3',
		columns: COLS_BOTTOM_LETTERS,
		keys: [
			{
				id: 'letters-toggle',
				label: 'ABC',
				variant: MUTED,
				width: WIDE,
				action: { kind: 'toggle-layout' }
			},
			...[';', ':', "'", '"', '|', '/', '?'].map((value) => ({
				id: `symbol-${value}`,
				label: value,
				action: { kind: 'char', value }
			})),
			{
				id: 'backspace',
				ariaLabel: 'Backspace',
				variant: MUTED,
				width: WIDE,
				action: { kind: 'backspace' }
			}
		]
	},
	{
		id: 'controls',
		columns: COLS_CONTROLS,
		keys: [
			{
				id: 'symbols-active',
				label: '#+=',
				variant: ACTIVE,
				width: WIDE,
				action: { kind: 'toggle-layout' }
			},
			{
				id: 'comma',
				label: ',',
				width: STANDARD,
				action: { kind: 'char', value: ',' }
			},
			{
				id: 'space',
				ariaLabel: 'Space',
				width: SPACE,
				action: { kind: 'space' }
			},
			{
				id: 'period',
				label: '.',
				width: STANDARD,
				action: { kind: 'char', value: '.' }
			},
			{
				id: 'done',
				label: 'Done',
				variant: DONE,
				width: DONE,
				action: { kind: 'done' }
			}
		]
	}
];
