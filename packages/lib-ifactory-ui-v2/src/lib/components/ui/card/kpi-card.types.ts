import type { Component } from 'svelte';

export type KpiCardItem = {
	label: string;
	value: string;
	icon: Component<{ class?: string }>;
	valueTitle?: string;
};
