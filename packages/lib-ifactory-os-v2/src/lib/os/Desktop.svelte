<script lang="ts">
	import AppShell from '$lib/appShell/AppShell.svelte';
	import { appsRunning, appStackOrder, focus, removeApp, type AppDefinition } from './index.svelte'; //, osMenu, launchApp

	let { apps }: { apps: Record<string, AppDefinition> } = $props();

	function close(appInstanceId: string) {
		removeApp(appInstanceId);
	}
</script>

<div class="relative flex min-h-0 w-full flex-1 overflow-hidden" id="desktop">
	{#each Object.entries(appsRunning) as [appInstanceId] (appInstanceId)}
		<!-- V1: apps[appsRunning[appInstanceId].appName] — V2 registry keys differ from appName so we search by appName -->
		{@const appConfig =
			Object.values(apps).find(
				(a: AppDefinition) => a.appName === appsRunning[appInstanceId].appName
			) ?? null}
		{#if appConfig}
			<AppShell
				data={appConfig.data}
				menu={appConfig.menu}
				routes={appConfig.routes}
				appName={appConfig.appName}
				appCode={appConfig.appCode ?? appConfig.code}
				displayName={appConfig.displayName}
				accentColor={appConfig.dockColor ?? '#FF6C2E'}
				strings={appConfig.strings as Record<string, string>}
				sidebar={appConfig.sidebar}
				topbarComponent={appConfig.topbarComponent}
				windowControls={appConfig.windowControls}
				close={() => close(appInstanceId)}
				bind:appObj={appsRunning[appInstanceId]}
				zIndex={appStackOrder[appInstanceId]}
				{appInstanceId}
				focus={() => focus(appInstanceId)}
			/>
		{/if}
	{/each}
</div>
