import type { Component } from 'svelte';

export type ToastVariant = 'default' | 'success' | 'error';

export type ToastActionVariant = 'text' | 'muted' | 'primary' | 'outline';

export type ToastActionPlacement = 'inline' | 'below' | 'side';

export type ToastIconAlign = 'start' | 'center' | 'end';

export type ToastPosition =
	'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';

export type ToastAction = {
	label: string;
	variant?: ToastActionVariant;
	class?: string;
	onclick?: () => void;
};

export type ToastIconConfig = {
	icon: Component<{ class?: string }>;
	class?: string;
};

export type ToastOptions = {
	title: string;
	description?: string;
	variant?: ToastVariant;
	icon?: Component<{ class?: string }>;
	iconClass?: string;
	iconAlign?: ToastIconAlign;
	avatarSrc?: string;
	avatarAlt?: string;
	actions?: ToastAction[];
	actionPlacement?: ToastActionPlacement;
	showDescription?: boolean;
	showCloseButton?: boolean;
	duration?: number;
	onClose?: () => void;
};

export type ToastEntry = ToastOptions & { id: string };
