import type { Component } from 'svelte';

export type AlertVariant = 'success' | 'warning' | 'error' | 'info';

export type AlertAction = {
	label: string;
	onclick?: () => void;
};

export type AlertLink = {
	label: string;
	href?: string;
	onclick?: (event: MouseEvent) => void;
	showArrow?: boolean;
};

export type AlertIconConfig = {
	icon: Component<{ class?: string }>;
	class?: string;
};
