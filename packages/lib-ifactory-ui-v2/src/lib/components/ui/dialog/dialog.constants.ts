import type { Component } from 'svelte';

export type DialogVariant = 'centered' | 'centered-wide' | 'alert';

export type DialogSize = 'sm' | 'md' | 'lg' | 'xl';

export type DialogIconTone = 'success' | 'warning' | 'danger' | 'info';

export type DialogConfirmVariant = 'primary' | 'danger';

export type DialogIconConfig = {
	icon: Component<{ class?: string }>;
	tone: DialogIconTone;
};
