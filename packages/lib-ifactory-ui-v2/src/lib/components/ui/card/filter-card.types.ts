import type { Component } from 'svelte';

export type FilterCardItem = {
	id: string;
	label: string;
	count: string | number;
	icon?: Component;
	/** When false, the card is display-only and does not participate in selection. Default true. */
	clickable?: boolean;
};
