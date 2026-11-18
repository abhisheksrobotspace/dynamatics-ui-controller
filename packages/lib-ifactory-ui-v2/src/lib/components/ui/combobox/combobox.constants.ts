export const DEFAULT_COMBOBOX_MAX_HEIGHT = '15rem';

export type ComboboxSide = 'top' | 'bottom';
export type ComboboxAlign = 'start' | 'end';

export type ComboboxItem = {
	label: string;
	value: string;
	meta?: string;
	disabled?: boolean;
};
