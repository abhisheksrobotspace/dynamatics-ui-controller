declare module '$osFlavor' {
	import type { OsFlavor } from '$lib/os/flavors/types';
	import type { AppDefinition } from '$lib/os/index.svelte';
	export const flavor: OsFlavor;
	export const apps: Record<string, AppDefinition>;
}
