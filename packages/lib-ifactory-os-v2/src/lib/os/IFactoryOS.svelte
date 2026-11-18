<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { ToastViewport } from '@ifactory/ui-v2';
	import BootLoader from './BootLoader.svelte';
	import TaskBar from './TaskBar.svelte';
	import Desktop from './Desktop.svelte';
	import { AUTH_END_POINT } from '$lib/index.js';
	import osBg from '$lib/assets/os_bg.jpeg';
	import { restoreOSState, switchOperator, user, type AppDefinition } from './index.svelte';
	import { filterVisibleApps, machineReadiness } from './app-visibility.svelte.js';
	import type { OsFlavor, OsFlavorLoginPayload } from './flavors/types';

	let {
		apps = {},
		flavor
	}: {
		apps?: Record<string, AppDefinition>;
		flavor: OsFlavor;
	} = $props();

	let isCheckingSession = $state(true);
	let isBootLoaderVisible = $state(true);
	let isIowareReady = $state(false);
	let isLocked = $derived(!user.isLoggedIn);
	let needsSetPassword = $state(false);
	let pendingLoginPassword = $state('');
	let pendingLoginPayload = $state<OsFlavorLoginPayload | null>(null);

	let tokenCheckTimerId: ReturnType<typeof setInterval> | undefined;
	let shellCleanup: (() => void) | null = null;

	const Lockscreen = $derived(flavor.Lockscreen);
	const SetPassword = $derived(flavor.SetPassword);
	const overlays = $derived(flavor.Overlays ?? []);
	const TopBar = $derived(flavor.TopBar ?? null);
	const taskBarConfig = $derived(flavor.taskBar ?? {});
	const isIoware = $derived(flavor.id === 'ioware');
	const bootComplete = $derived(isIoware ? isIowareReady : !isCheckingSession);

	// Read the live class so dock/desktop drop PMS when it is missing or unsupported.
	const assetClass = $derived(machineReadiness.assetClass);

	const accessibleApps = $derived.by(() => {
		void assetClass;
		return filterVisibleApps(apps, isIoware);
	});

	const appsInstalled = $derived.by(() => {
		const next: Record<string, AppDefinition> = {};
		for (const [key, app] of Object.entries(accessibleApps)) {
			if (app.showInLauncher === false) continue;
			next[key] = {
				...app,
				displayName: app.displayName ?? app.appName ?? key
			};
		}
		return next;
	});

	onMount(() => {
		const cleanups: Array<() => void> = [];

		if (flavor.onShellMount) {
			const maybeCleanup = flavor.onShellMount();
			if (typeof maybeCleanup === 'function') {
				shellCleanup = maybeCleanup;
				cleanups.push(maybeCleanup);
			}
		}

		if (isIoware) {
			const timer = setTimeout(() => {
				isIowareReady = true;
			}, 400);
			cleanups.push(() => clearTimeout(timer));
			return () => cleanups.forEach((fn) => fn());
		}

		void initialiseCloudOS();
		tokenCheckTimerId = setInterval(checkSession, 15 * 60 * 1000);

		function onPasswordChangeRequired() {
			needsSetPassword = true;
			user.isLoggedIn = false;
		}

		window.addEventListener('ifactory:password-change-required', onPasswordChangeRequired);
		cleanups.push(() => {
			window.removeEventListener('ifactory:password-change-required', onPasswordChangeRequired);
		});

		return () => cleanups.forEach((fn) => fn());
	});

	onDestroy(() => {
		if (tokenCheckTimerId) clearInterval(tokenCheckTimerId);
		shellCleanup?.();
	});

	async function initialiseCloudOS() {
		isCheckingSession = true;
		const loggedIn = await checkSession();
		if (loggedIn) {
			await restoreOSState(accessibleApps);
		}
		isCheckingSession = false;
	}

	function applySessionUser(sessionUser: OsFlavorLoginPayload['user'] | null | undefined) {
		if (!sessionUser) return;
		user.id = sessionUser.id ?? '';
		user.name = sessionUser.name ?? sessionUser.email ?? '';
		user.email = sessionUser.email ?? '';
		user.avatar = sessionUser.image ?? '';
	}

	async function checkSession(): Promise<boolean> {
		try {
			const response = await fetch(AUTH_END_POINT + 'get-session', {
				headers: { Accept: 'application/json' },
				credentials: 'include'
			});

			if (response.ok) {
				const data = await response.json().catch(() => null);
				if (data?.session) {
					applySessionUser(data.user);

					if (data.user?.mustChangePassword === true) {
						needsSetPassword = true;
						user.isLoggedIn = false;
						return false;
					}

					needsSetPassword = false;
					user.isLoggedIn = true;
					return true;
				}
			}
		} catch (err) {
			console.error('Session check failed', err);
		}

		user.isLoggedIn = false;
		return false;
	}

	async function sessionRequiresPasswordChange(): Promise<boolean> {
		try {
			const response = await fetch(AUTH_END_POINT + 'get-session', {
				headers: { Accept: 'application/json' },
				credentials: 'include'
			});
			if (!response.ok) return false;
			const data = await response.json().catch(() => null);
			return data?.user?.mustChangePassword === true;
		} catch {
			return false;
		}
	}

	async function handleCloudLogin(data?: OsFlavorLoginPayload) {
		applySessionUser(data?.user);
		pendingLoginPayload = data ?? null;
		pendingLoginPassword = data?.password ?? '';

		const mustChange =
			data?.user?.mustChangePassword === true || (await sessionRequiresPasswordChange());

		if (mustChange) {
			needsSetPassword = true;
			return;
		}

		await unlockDesktop(data);
	}

	async function unlockDesktop(data?: OsFlavorLoginPayload | null) {
		applySessionUser(data?.user);
		needsSetPassword = false;
		user.isLoggedIn = true;
		await restoreOSState(accessibleApps);
	}

	async function completeSetPassword() {
		const data = pendingLoginPayload;
		pendingLoginPassword = '';
		pendingLoginPayload = null;
		await unlockDesktop(data);
	}

	function handleLogin(data?: OsFlavorLoginPayload) {
		if (isIoware) {
			const isFirstLogin = !user.isLoggedIn;
			flavor.onOperatorLogin?.(data ?? {}, { accessibleApps, isFirstLogin });
			return;
		}
		void handleCloudLogin(data);
	}

	const showIowareLockscreen = $derived(isIoware && (!user.isLoggedIn || switchOperator.isClicked));
</script>

<svelte:window />

<div class="fixed inset-0 z-0 h-screen w-screen bg-[#222222]">
	<div
		class="absolute inset-0 -scale-x-100 bg-cover bg-center"
		style="background-image: url('{osBg}')"
	></div>
	<div class="relative h-full w-full">
		{#if isBootLoaderVisible}
			<BootLoader complete={bootComplete} onfinished={() => (isBootLoaderVisible = false)} />
		{:else if !isIoware && needsSetPassword && SetPassword}
			<SetPassword currentPassword={pendingLoginPassword} oncomplete={completeSetPassword} />
		{:else if !isIoware && isLocked}
			<Lockscreen onlogin={handleLogin} />
		{:else}
			<div class="relative z-10 flex h-full w-full flex-row overflow-hidden">
				<TaskBar {appsInstalled} config={taskBarConfig} />
				<div class="relative flex h-full min-w-0 flex-1 flex-col">
					{#if TopBar}
						<TopBar {appsInstalled} />
					{/if}
					<Desktop apps={accessibleApps} />
				</div>
			</div>
		{/if}

		{#if !isBootLoaderVisible && showIowareLockscreen}
			<Lockscreen onlogin={handleLogin} />
		{/if}

		<ToastViewport position="top-right" />

		{#each overlays as Overlay (Overlay)}
			<Overlay />
		{/each}
	</div>
</div>
