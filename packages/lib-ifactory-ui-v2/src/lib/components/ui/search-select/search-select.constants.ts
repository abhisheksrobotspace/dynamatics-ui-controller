import type { ComboboxItem } from '../combobox/combobox.constants';

export type SearchSelectBadge = {
	variant?: 'default' | 'secondary' | 'outline' | 'online' | 'error' | 'loading' | 'offline';
	label: string;
	class?: string;
};

export type SearchSelectItem = ComboboxItem & {
	badge?: SearchSelectBadge;
};
