<script lang="ts">
	import { X } from '@lucide/svelte';
	import { createHmiPress } from '@ifactory/ui-v2';
	import InterlockIndicator from './InterlockIndicator.svelte';
	import { launchApp, user, type AppDefinition } from './index.svelte';
	import { machineReadiness } from './app-visibility.svelte.js';
	import {
		MACHINE_STATE,
		formatIdleHms,
		hasIdleTaskBarChip,
		machineIdleJobContext,
		machineIdleStore,
		reopenMachineIdleOverlay,
		selectedOverlayAlert,
		selectedOverlayAlertBadge
	} from './machine-idle/machine-idle-store.svelte';
	import { deviceStore } from '$lib/device';

	let { appsInstalled = {} }: { appsInstalled?: Record<string, AppDefinition> } = $props();

	/** Minimised idle / production alert: a key on the right of the bar reopens it. */
	const showIdleChip = $derived(hasIdleTaskBarChip());
	const idleChipTimer = $derived(formatIdleHms(machineIdleStore.idleSeconds));
	const idleChipPress = createHmiPress();

	type PillState = 'running' | 'idle' | 'setup' | 'waiting' | 'down' | 'offline';

	/* Figma: HMI FROZEN DESIGN → hmi-top-bar (ISA-101: colour + shape + word per state), as
	   coloured text with no badge box. */
	const PILLS: Record<PillState, { label: string; tone: string; icon: string }> = {
		running: {
			label: 'RUNNING',
			tone: 'text-[#1F7A3A]',
			icon: 'size-3 bg-current [clip-path:polygon(0_0,100%_50%,0_100%)]'
		},
		idle: {
			label: 'IDLE',
			tone: 'text-[#5a616c]',
			icon: 'size-3 rounded-full border-[2.5px] border-current'
		},
		setup: {
			label: 'SETUP',
			tone: 'text-[#1D4F91]',
			icon: 'size-[9px] rotate-45 bg-current'
		},
		waiting: {
			label: 'WAITING',
			tone: 'text-[#8A5A00]',
			icon: 'h-3 w-[10px] border-x-[3px] border-current'
		},
		down: {
			label: 'DOWN',
			tone: 'text-[#C62828]',
			icon: ''
		},
		offline: {
			label: 'OFFLINE',
			tone: 'text-[#7e848d]',
			icon: 'size-3 border-[2.5px] border-dashed border-current'
		}
	};

	const pillState = $derived.by((): PillState => {
		switch (machineIdleStore.machineState) {
			case MACHINE_STATE.PRODUCTION:
				return 'running';
			case MACHINE_STATE.SETUP:
				return 'setup';
			case MACHINE_STATE.DOWNTIME:
			case MACHINE_STATE.MAINTENANCE:
				return 'down';
			case MACHINE_STATE.SHUTDOWN:
				return 'offline';
			case MACHINE_STATE.IDLE:
				return 'idle';
			default:
				return machineIdleJobContext.hasActiveJob ? 'running' : 'idle';
		}
	});
	const pill = $derived(PILLS[pillState]);

	const machineType = $derived((machineReadiness.assetClass ?? '').replace(/[_-]+/g, ' '));
	const operatorCode = $derived(typeof user.code === 'string' ? user.code : '');
	const isOnline = $derived(
		deviceStore.deviceInfo.connectionKind === 'wifi' ||
			deviceStore.deviceInfo.connectionKind === 'lan'
	);

	function openWifiApp() {
		const wifiApp = Object.values(appsInstalled).find(
			(app) => app.appCode === 'WIFI' || app.appName === 'WiFi'
		);
		if (wifiApp) launchApp(wifiApp);
	}
</script>

<header
	class="flex h-[58px] w-full shrink-0 items-center justify-between gap-4 border-b border-[#dde1e5] bg-white px-6 font-body select-none"
>
	<div class="flex min-w-0 items-center gap-[14px]">
		{#if machineReadiness.assetCode}
			<span class="truncate text-[28px] leading-9 font-bold tracking-[0.02em] text-[#1b2028]">
				{machineReadiness.assetCode}
			</span>
		{/if}
		{#if machineType}
			<span
				class="text-[18px] leading-[23px] font-medium tracking-[0.04em] whitespace-nowrap text-[#5a616c] uppercase"
			>
				{machineType}
			</span>
		{/if}
		<span class="h-[30px] w-px shrink-0 bg-[#dde1e5]" aria-hidden="true"></span>
		<!-- Fixed width: the widest state (WAITING / RUNNING) fits, so nothing jumps on a change. -->
		<span
			class="flex h-[35px] w-[124px] shrink-0 items-center gap-2 {pill.tone}"
			role="status"
			aria-label="Machine {pill.label.toLowerCase()}"
		>
			{#if pillState === 'down'}
				<X class="size-3.5 shrink-0" strokeWidth={3} aria-hidden="true" />
			{:else}
				<span class="shrink-0 {pill.icon}" aria-hidden="true"></span>
			{/if}
			<span
				class="flex h-5 translate-y-px items-center text-[16px] leading-none font-bold tracking-[0.06em]"
				>{pill.label}</span
			>
		</span>
		<span class="h-[30px] w-px shrink-0 bg-[#dde1e5]" aria-hidden="true"></span>
		<InterlockIndicator />
	</div>

	<div class="flex shrink-0 items-center gap-5">
		{#if showIdleChip}
			<!-- Light key (as on the lockscreen) with a red rim for the alert. -->
			<button
				type="button"
				class="flex h-11 shrink-0 cursor-pointer flex-col rounded-[10px] border-0 p-0 select-none touch-manipulation [-webkit-tap-highlight-color:transparent] {idleChipPress.pressed
					? 'pt-1'
					: 'bg-[#9aa1aa] pb-1'}"
				aria-label="Open Machine Idle — {selectedOverlayAlert.label}"
				title="{selectedOverlayAlert.label} · {idleChipTimer}"
				{...idleChipPress.handlers}
				onclick={() => reopenMachineIdleOverlay()}
			>
				<span
					class="flex min-h-0 flex-1 items-center gap-2.5 rounded-[10px] border border-[#e08a84] pr-3 pl-1.5 {idleChipPress.pressed
						? 'bg-[#d9dde2] shadow-[inset_0_2px_4px_rgba(0,0,0,0.25)]'
						: 'bg-gradient-to-b from-[#f7f8f9] to-[#e4e7eb]'}"
				>
					<span
						class="flex size-7 shrink-0 items-center justify-center rounded-md bg-[#F26B2A] text-[13px] font-bold text-white"
					>
						{selectedOverlayAlertBadge()}
					</span>
					<span
						class="max-w-[180px] truncate text-[15px] leading-5 font-bold whitespace-nowrap text-[#1b2028]"
					>
						{selectedOverlayAlert.label || 'Idle'}
					</span>
					<span class="text-[15px] leading-5 font-bold text-[#E4561A] tabular-nums">
						{idleChipTimer}
					</span>
				</span>
			</button>
			<span class="h-[30px] w-px shrink-0 bg-[#dde1e5]" aria-hidden="true"></span>
		{/if}
		{#if user.isLoggedIn && user.name}
			<!-- Fixed width, long names cut off: the alert chip beside it never changes position. -->
			<div class="flex w-[200px] shrink-0 flex-col items-end">
				<span
					class="max-w-full truncate text-[18px] leading-[23px] font-bold tracking-[0.02em] text-[#1b2028] uppercase"
					title={user.name}
				>
					{user.name}
				</span>
				{#if operatorCode}
					<span
						class="max-w-full truncate text-[13px] leading-[17px] font-medium tracking-[0.04em] text-[#5a616c] uppercase"
					>
						{operatorCode}
					</span>
				{/if}
			</div>
			<span class="h-[30px] w-px shrink-0 bg-[#dde1e5]" aria-hidden="true"></span>
		{/if}
		<button
			type="button"
			class="flex cursor-pointer items-center gap-1.5 border-0 bg-transparent p-0"
			aria-label={isOnline ? 'Online — open Wi-Fi' : 'Offline — open Wi-Fi'}
			onclick={openWifiApp}
		>
			<span
				class="size-2 shrink-0 rounded-full {isOnline ? 'bg-[#1F7A3A]' : 'bg-[#C62828]'}"
				aria-hidden="true"
			></span>
			<span
				class="flex h-[17px] translate-y-px items-center text-[13px] leading-none font-medium tracking-[0.06em] text-[#5a616c]"
			>
				{isOnline ? 'ONLINE' : 'OFFLINE'}
			</span>
		</button>
	</div>
</header>
