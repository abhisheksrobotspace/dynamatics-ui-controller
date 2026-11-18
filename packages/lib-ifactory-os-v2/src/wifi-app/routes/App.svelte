<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import type { Component } from 'svelte';
	import { bindDeviceMqttEvents } from '$lib/device';
	import type { AppNavigation } from '../lib/navigation';
	import WifiList from './WifiList.svelte';
	import WifiPassword from './WifiPassword.svelte';
	import WifiConnected from './WifiConnected.svelte';

	/** `embedded`: shown inside a host that owns the title bar (Lockscreen overlay). */
	let { embedded = false }: { embedded?: boolean } = $props();

	type PageName = 'WifiList' | 'WifiPassword' | 'WifiConnected';

	const components: Record<
		PageName,
		Component<{ navigation: AppNavigation; embedded?: boolean }>
	> = {
		WifiList,
		WifiPassword,
		WifiConnected
	};

	const app = $state<{ currentPage: PageName; pageHistory: PageName[] }>({
		currentPage: 'WifiList',
		pageHistory: []
	});

	let unbindMqtt = $state<(() => void) | null>(null);

	function navigateTo(page: string) {
		const next = page as PageName;
		if (!(next in components)) return;
		if (app.currentPage !== next) {
			app.pageHistory = [...app.pageHistory, app.currentPage];
		}
		app.currentPage = next;
	}

	function goBack(): boolean {
		if (app.pageHistory.length === 0) return false;
		const previousPage = app.pageHistory[app.pageHistory.length - 1];
		app.pageHistory = app.pageHistory.slice(0, -1);
		app.currentPage = previousPage;
		return true;
	}

	const navigation: AppNavigation = {
		navigateTo,
		goBack
	};

	const CurrentScreen = $derived(components[app.currentPage]);

	onMount(() => {
		unbindMqtt = bindDeviceMqttEvents();
	});

	onDestroy(() => {
		unbindMqtt?.();
	});
</script>

<div class="h-full min-h-0 w-full">
	<CurrentScreen {navigation} {embedded} />
</div>
