<script lang="ts">
	import type { Component } from 'svelte';
	import { appsRunning, currentActiveAppId, launchApp, type AppDefinition } from './index.svelte';
	import DockKey from './DockKey.ioware.svelte';

	/* HMI app launcher: the logo opens every available app as a large key; tapping one opens it. */
	let {
		open = $bindable(false),
		appsInstalled = {},
		dockItems = {}
	}: {
		open?: boolean;
		appsInstalled?: Record<string, AppDefinition>;
		dockItems?: Record<
			string,
			{ icon: Component<{ class?: string; strokeWidth?: number }>; label: string }
		>;
	} = $props();

	const apps = $derived(
		Object.values(appsInstalled).filter((app) => dockItems[app.appName] || app.icon)
	);

	/** The app in front is highlighted, like on the dock. */
	function isFocused(app: AppDefinition): boolean {
		const activeId = currentActiveAppId.appId;
		const running = activeId ? appsRunning[activeId] : undefined;
		return Boolean(running && !running.minimised && running.appName === app.appName);
	}

	function openApp(app: AppDefinition) {
		launchApp(app);
		open = false;
	}
</script>

<svelte:window
	onkeydown={(event) => {
		if (open && event.key === 'Escape') open = false;
	}}
/>

{#if open}
	<!-- Backdrop: a tap outside the panel closes the launcher. -->
	<div
		class="fixed inset-y-0 right-0 left-[68px] z-[60] flex items-start justify-center bg-[#1b2028]/60 pt-[120px] backdrop-blur-[2px]"
		role="presentation"
		onpointerdown={(event) => {
			if (event.target === event.currentTarget) open = false;
		}}
	>
		<div
			class="relative flex w-[760px] max-w-[calc(100%-60px)] flex-col gap-6 rounded-xl border-2 border-[#3a4047] bg-[#1e2226] px-8 pt-6 pb-8 font-body text-white"
			role="dialog"
			aria-modal="true"
			aria-label="Apps"
		>
			<!-- No close key: a tap outside the panel (or the logo again) closes it. -->
			<h2 class="m-0 text-[30px] leading-[38px] font-bold">Apps</h2>
			<div class="grid grid-cols-4 gap-6">
				{#each apps as app (app.appName)}
					{@const item = dockItems[app.appName]}
					<div class="flex justify-center">
						{#if item}
							<DockKey
								label={item.label}
								icon={item.icon}
								selected={isFocused(app)}
								size="lg"
								onclick={() => openApp(app)}
							/>
						{:else}
							<button
								type="button"
								class="flex w-[120px] cursor-pointer flex-col items-center gap-2 border-0 bg-transparent p-0"
								onclick={() => openApp(app)}
							>
								<img src={app.icon} alt="" class="size-[96px] rounded-[16px]" />
								<span class="text-lg font-bold">{app.displayName ?? app.appName}</span>
							</button>
						{/if}
					</div>
				{/each}
			</div>
		</div>
	</div>
{/if}
