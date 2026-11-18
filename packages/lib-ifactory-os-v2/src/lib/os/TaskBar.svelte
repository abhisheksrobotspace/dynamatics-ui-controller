<script lang="ts">
	import { onMount } from 'svelte';
	import {
		appsRunning,
		currentActiveAppId,
		user,
		launchApp,
		minimizeAllApps,
		clearOSState,
		type AppDefinition
	} from './index.svelte';
	import type { OsTaskBarConfig } from './flavors/types';
	import { ConfirmationDialog, DropdownMenu, tooltip } from '@ifactory/ui-v2';
	import HmiConfirmDialog from './HmiConfirmDialog.svelte';
	import DockKey from './DockKey.ioware.svelte';
	import { AUTH_END_POINT } from '$lib/index.js';
	import { clearCachedData } from '$lib/customScripts/cache-manager.js';
	import { base } from '$app/paths';

	let {
		appsInstalled = {},
		config = {}
	}: {
		appsInstalled?: Record<string, AppDefinition>;
		config?: OsTaskBarConfig;
	} = $props();

	let currentTime = $state('');
	let accountConfirmOpen = $state(false);

	const logoMinimizes = $derived(config.logoMinimizes !== false);
	const accountLabel = $derived(config.accountLabel ?? 'Log Off');
	const displayName = $derived(user?.name || config.userFallbackName || 'User');
	const displaySubtitle = $derived(
		config.accountSubtitle ?? (user?.activeFactoryName || 'No Plant Selected')
	);
	const triggerAvatarSize = $derived(config.triggerAvatarSize ?? 'md');
	const isLgAvatar = $derived(triggerAvatarSize === 'lg');
	const clockClass = $derived(
		config.clockTextClass ??
			"flex h-8 w-[44px] items-center justify-center whitespace-nowrap font-['Space_Grotesk',sans-serif] text-[14px] font-medium leading-[20px] text-white"
	);
	const triggerClass = $derived(
		isLgAvatar
			? 'flex h-[52px] w-[52px] items-center justify-center overflow-hidden rounded-full bg-white/[0.08] p-[2px]'
			: 'flex h-[44px] w-[44px] items-center justify-center overflow-hidden rounded-full bg-white/[0.08] p-[2px] transition-colors duration-150 hover:bg-white/[0.16]'
	);
	const Tray = $derived(config.Tray ?? null);
	const AccountMenu = $derived(config.AccountMenu ?? null);
	const iconTiles = $derived(config.iconTiles === true);
	const dockItems = $derived(config.dockItems ?? {});
	const Launcher = $derived(config.Launcher ?? null);
	let launcherOpen = $state(false);
	/** HMI: pinned apps plus whatever is open; everything else lives in the launcher. */
	const dockApps = $derived.by(() => {
		const pinned = config.dockPinned;
		const entries = Object.entries(appsInstalled || {});
		if (!pinned) return entries;
		return entries.filter(([, app]) => pinned.includes(app.appName) || isAppRunning(app.appName));
	});
	const dockClass = $derived(
		config.dockClass ?? 'border-r border-white/10 bg-[#222222]/80 backdrop-blur-[5px]'
	);

	const updateDateTime = () => {
		const now = new Date();
		currentTime = now.toLocaleTimeString('en-GB', {
			hour: '2-digit',
			minute: '2-digit'
		});
	};

	onMount(() => {
		updateDateTime();
		const interval = setInterval(updateDateTime, 1000);
		return () => clearInterval(interval);
	});

	async function logout() {
		try {
			await fetch(AUTH_END_POINT + 'sign-out', {
				method: 'POST',
				headers: { Accept: 'application/json' },
				credentials: 'include'
			});
		} catch (error) {
			console.error('Logout failed', error);
		}

		// Wipe local/session/IndexedDB caches (drafts, BOM files, etc.) even if sign-out fails
		await clearCachedData();
		await clearOSState();
		for (const id of Object.keys(appsRunning)) {
			delete appsRunning[id];
		}
		user.isLoggedIn = false;
	}

	async function runAccountAction() {
		if (config.onAccountAction) {
			await config.onAccountAction();
			return;
		}
		await logout();
	}

	function requestAccountAction() {
		if (config.accountConfirm) {
			accountConfirmOpen = true;
			return;
		}
		void runAccountAction();
	}

	async function confirmAccountAction() {
		accountConfirmOpen = false;
		await runAccountAction();
	}

	function isAppRunning(appName: string): boolean {
		return Object.values(appsRunning).some((r) => r.appName === appName);
	}

	/** Focused (foreground) app — drives the dock selection highlight. */
	function isAppSelected(appName: string): boolean {
		const activeId = currentActiveAppId.appId;
		if (!activeId) return false;
		const running = appsRunning[activeId];
		return Boolean(running && running.appName === appName && !running.minimised);
	}

	function appAbbreviation(app: AppDefinition): string {
		const code = (app.appCode ?? app.code ?? '').trim();
		if (code) return code.toUpperCase();
		const label = (app.displayName ?? app.appName ?? '?').trim();
		const words = label.split(/\s+/).filter(Boolean);
		if (words.length >= 2) {
			return words
				.slice(0, 3)
				.map((w) => w[0]!)
				.join('')
				.toUpperCase();
		}
		return label.slice(0, 3).toUpperCase();
	}
</script>

<!--
	Dock: 68px wide, full height, dark glass background
	Matches Figma: width=68px, padding=12px, gap=24px between sections,
	backdrop-filter: blur(6px), bg: rgba(34,34,34,0.8)
-->
<div
	class="relative isolate z-50 flex h-[100vh] min-h-full w-[68px] shrink-0 flex-col items-center justify-between gap-6 py-3 {dockClass}"
>
	<!-- ── Top section: RS Logo + App Icons ── -->
	<div class="flex w-full flex-col items-center gap-6">
		{#if Launcher}
			<button
				type="button"
				class="flex h-[44px] w-[44px] shrink-0 cursor-pointer items-center justify-center border-0 bg-transparent p-0"
				aria-label="Open apps"
				aria-expanded={launcherOpen}
				onclick={() => (launcherOpen = !launcherOpen)}
			>
				<img src="{base}/assets/icons/robotsapce-logo.svg" alt="Robotspace" class="h-full w-full" />
			</button>
		{:else if logoMinimizes}
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="flex h-[44px] w-[44px] shrink-0 cursor-pointer items-center justify-center"
				onclick={minimizeAllApps}
			>
				<img src="{base}/assets/icons/robotsapce-logo.svg" alt="Robotspace" class="h-full w-full" />
			</div>
		{:else}
			<div class="flex h-[44px] w-[44px] shrink-0 items-center justify-center">
				<img src="{base}/assets/icons/robotsapce-logo.svg" alt="Robotspace" class="h-full w-full" />
			</div>
		{/if}

		<!-- App Icons List — gap: 4px per Figma -->
		<div
			class="flex w-full flex-col items-center overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden {Object.keys(
				dockItems
			).length
				? 'gap-[13px] py-1'
				: 'gap-2 p-1'}"
		>
			{#each dockApps as [appKey, app] (appKey)}
				{@const running = isAppRunning(app.appName)}
				{@const selected = isAppSelected(app.appName)}
				{@const abbr = appAbbreviation(app)}
				{@const iconColor = app.dockColor ?? '#ffffff'}
				{@const dockItem = dockItems[app.appName]}
				{#if dockItem}
					<DockKey
						label={dockItem.label}
						icon={dockItem.icon}
						{selected}
						onclick={() => launchApp(app)}
					/>
				{:else if iconTiles}
					<!-- HMI dock: icon always on its white tile (no abbreviation swap); running = orange dot at the dock edge. -->
					<div class="relative flex h-[44px] w-[44px] items-center justify-center">
						<button
							class="flex h-[40px] w-[40px] cursor-pointer items-center justify-center overflow-hidden rounded-[10px] border-none bg-[linear-gradient(180deg,#FFFFFF_0%,#E0E0E0_100%)] p-0"
							onclick={() => launchApp(app)}
							aria-current={selected ? 'true' : undefined}
							aria-label={app.displayName || app.appName}
						>
							{#if app.icon}
								<img src={app.icon} alt="" aria-hidden="true" class="size-full object-contain" />
							{:else}
								<span
									class="font-['Space_Grotesk',sans-serif] text-[11px] leading-none font-semibold"
									style="color: {iconColor}"
								>
									{abbr}
								</span>
							{/if}
						</button>
						{#if running}
							<span
								class="absolute top-1/2 -right-[8px] h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-primary"
							></span>
						{/if}
					</div>
				{:else}
					<div
						class="group relative flex h-[52px] w-[52px] items-center justify-center rounded-xl {selected
							? 'bg-[#7a7a7a]'
							: 'bg-transparent hover:bg-white/5'}"
					>
						<button
							class="flex h-[44px] w-[44px] cursor-pointer items-center justify-center rounded-xl border-none p-0"
							onclick={() => launchApp(app)}
							aria-current={selected ? 'true' : undefined}
							aria-label={app.displayName || app.appName}
							{@attach tooltip({
								content: app.displayName || app.appName,
								side: 'right',
								delay: 0
							})}
						>
							<!--
							Abbr when focused (selected) or hovered — black tile, text = dockColor.
							SVG when closed or open-in-background (and not hovered).
						-->
							<div class="relative flex h-[44px] w-[44px] items-center justify-center">
								{#if app.icon && !selected}
									<img
										src={app.icon}
										alt=""
										aria-hidden="true"
										class="size-full object-contain group-hover:hidden"
									/>
								{/if}
								<span
									class="size-full items-center justify-center rounded-xl bg-black px-0.5 text-center font-['Space_Grotesk',sans-serif] text-[11px] font-semibold leading-none tracking-tight
									{selected || !app.icon ? 'flex' : 'hidden group-hover:flex'}"
									style="color: {iconColor}"
								>
									{abbr}
								</span>
							</div>
						</button>

						<!-- Running indicator (right edge) -->
						{#if running}
							<span
								class="absolute -right-[7px] top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-primary"
							></span>
						{/if}
					</div>
				{/if}
			{/each}
		</div>
	</div>

	<!-- ── Bottom section: Tray + Avatar + Time ── -->
	<div class="flex w-full flex-col items-center gap-1">
		{#if Tray}
			<Tray />
		{/if}

		{#if AccountMenu}
			<span class={clockClass}>{currentTime}</span>
			<AccountMenu name={displayName} onLogout={requestAccountAction} />
		{:else}
			<DropdownMenu
				user={{
					name: displayName,
					email: displaySubtitle,
					avatarSrc: user?.avatar
				}}
				groups={[
					[
						{
							label: accountLabel,
							onclick: requestAccountAction
						}
					]
				]}
				{triggerAvatarSize}
				{triggerClass}
				itemClass={isLgAvatar
					? 'cursor-pointer px-3 py-2.5 text-base outline-none select-none hover:bg-muted focus:bg-muted'
					: undefined}
				contentClass={isLgAvatar ? 'min-w-[16rem]' : undefined}
				side="top"
				align="start"
			/>

			<!-- Clock — Space Grotesk 14px/500 white (or flavor override) -->
			<span class={clockClass}>{currentTime}</span>
		{/if}
	</div>
</div>

{#if Launcher}
	<Launcher bind:open={launcherOpen} {appsInstalled} {dockItems} />
{/if}

{#if config.accountConfirm?.hmi}
	<HmiConfirmDialog
		open={accountConfirmOpen}
		title={config.accountConfirm.title}
		message={config.accountConfirm.message}
		confirmLabel={config.accountConfirm.confirmLabel}
		onConfirm={confirmAccountAction}
		onCancel={() => (accountConfirmOpen = false)}
	/>
{:else if config.accountConfirm}
	<ConfirmationDialog
		bind:open={accountConfirmOpen}
		size="xl"
		title={config.accountConfirm.title}
		confirmLabel={config.accountConfirm.confirmLabel}
		onConfirm={confirmAccountAction}
	/>
{/if}
