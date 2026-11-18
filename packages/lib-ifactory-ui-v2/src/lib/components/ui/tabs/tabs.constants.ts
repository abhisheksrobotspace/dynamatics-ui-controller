import type { Component } from 'svelte';

export type TabsVariant = 'underline' | 'pills' | 'segmented';

export type TabsSize = 'sm' | 'md' | 'lg';

export type TabItem = {
	label: string;
	value: string;
	href?: string;
	icon?: Component;
	disabled?: boolean;
	current?: boolean;
	onclick?: () => void;
};
