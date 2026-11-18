import type { Component } from 'svelte';

export type EmptyStateVariant = 'simple' | 'dashed';

export type EmptyStateIconConfig = {
	icon: Component<{ class?: string }>;
	class?: string;
};
