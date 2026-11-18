import { pmsApp } from '../pms-app/app.svelte.ts';
import { wifiApp } from '../wifi-app/app.svelte.ts';
import { ioApp } from '../io-app/app.svelte.ts';
import { deviceApp } from '../device-app/app.svelte.ts';
import type { AppDefinition } from '$lib/os/index.svelte';

export const apps: Record<string, AppDefinition> = {
	pmsApp: pmsApp as unknown as AppDefinition,
	wifiApp: wifiApp as unknown as AppDefinition,
	ioApp: ioApp as unknown as AppDefinition,
	deviceApp: deviceApp as unknown as AppDefinition
};
