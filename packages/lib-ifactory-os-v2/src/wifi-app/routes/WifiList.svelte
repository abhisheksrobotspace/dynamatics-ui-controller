<script lang="ts">
	import { onMount } from 'svelte';
	import { HmiFlatButton } from '@ifactory/ui-v2';
	import {
		ChevronRight,
		CircleCheck,
		Lock,
		Plus,
		RotateCw,
		Wifi,
		WifiHigh,
		WifiLow,
		WifiZero
	} from '@lucide/svelte';
	import {
		connectWifi,
		deviceStore,
		formatWifiSignalLabel,
		isConnectedNetwork,
		scanWifiNetworks,
		selectWifiNetwork,
		startManualWifiNetwork
	} from '$lib/device';
	import type { WifiNetwork, WifiSignalLabel } from '$lib/device';
	import AppBusyOverlay from '$lib/os/appShell/AppBusyOverlay.svelte';
	import AppCloseButton from '$lib/os/AppCloseButton.svelte';
	import type { AppNavigation } from '../lib/navigation';

	let { navigation, embedded = false }: { navigation: AppNavigation; embedded?: boolean } =
		$props();

	/** Pressed look must stay visible this long, so a tap that opens the next screen is still seen. */
	const PRESS_MS = 120;
	const SIGNAL_ICONS: Record<WifiSignalLabel, typeof Wifi> = {
		excellent: Wifi,
		good: WifiHigh,
		fair: WifiLow,
		poor: WifiZero
	};

	let pressedId = $state<string | null>(null);

	const SIGNAL_LABELS = new Set<WifiSignalLabel>(['excellent', 'good', 'fair', 'poor']);

	/**
	 * The connected network leads the list. It comes from the scan when it is in range, else from
	 * the device info (a hidden or out-of-range SSID the device is still connected to).
	 */
	const connectedNetwork = $derived.by((): WifiNetwork | null => {
		const info = deviceStore.deviceInfo;
		const fromScan = deviceStore.networks.find((network) => isConnectedNetwork(network.name));
		if (fromScan) return fromScan;
		if (!isConnectedNetwork(info.network)) return null;
		const label = info.signalStrength.trim().toLowerCase() as WifiSignalLabel;
		const security = deviceStore.connectedSecurity === '-' ? 'WPA2' : deviceStore.connectedSecurity;
		return {
			id: info.network,
			name: info.network,
			signal: Number.parseInt(info.signalScore, 10) || 0,
			signalLabel: SIGNAL_LABELS.has(label) ? label : 'good',
			security,
			secured: security !== 'Open',
			saved: true
		};
	});
	const listedNetworks = $derived([
		...(connectedNetwork ? [connectedNetwork] : []),
		...deviceStore.networks.filter((network) => !isConnectedNetwork(network.name))
	]);

	onMount(() => {
		if (deviceStore.networks.length === 0) scanWifiNetworks();
	});

	function onNetworkClick(network: WifiNetwork) {
		if (deviceStore.isConnecting) return;
		pressedId = network.id;
		setTimeout(async () => {
			pressedId = null;
			selectWifiNetwork(network);
			// The network we are on: its details (and Forget network), not the password step.
			if (isConnectedNetwork(network.name)) {
				// Fill what the device settings did not report from the scan entry.
				if (deviceStore.connectedSecurity === '-') {
					deviceStore.connectedSecurity = network.secured ? network.security : 'Open';
				}
				if (deviceStore.connectedSignal === '-') {
					deviceStore.connectedSignal = formatWifiSignalLabel(network.signalLabel);
				}
				navigation.navigateTo('WifiConnected');
				return;
			}
			if (network.secured) {
				navigation.navigateTo('WifiPassword');
				return;
			}
			const ok = await connectWifi('');
			if (ok) navigation.navigateTo('WifiConnected');
		}, PRESS_MS);
	}

	/** A network that is not in the list (hidden SSID): the password screen takes its name too. */
	function onOtherNetwork() {
		if (deviceStore.isConnecting) return;
		startManualWifiNetwork();
		navigation.navigateTo('WifiPassword');
	}

	/* Figma: HMI FROZEN DESIGN → Wi-Fi — Select Network (88 px rows, 5 px bottom edge). */
	function rowClass(pressed: boolean, connected: boolean): string {
		const base =
			'flex h-[88px] w-full shrink-0 cursor-pointer items-center gap-5 rounded-[10px] border-[1.5px] pr-7 pl-4 text-left select-none';
		const face = connected ? 'bg-[#f1faf4]' : 'bg-white';
		if (pressed) return `${base} ${face} translate-y-[3.5px] border-[#ff6b2c] border-b-[1.5px]`;
		return connected
			? `${base} ${face} border-[#1f7a3a] border-b-[5px]`
			: `${base} ${face} border-[#aeb4bc] border-b-[5px]`;
	}
</script>

<div class="relative flex h-full min-h-0 w-full flex-col bg-white font-body text-[#1b2028]">
	{#if !embedded}
		<header class="mt-2 flex h-14 shrink-0 items-center gap-4 pr-7 pl-[30px]">
			<h1 class="m-0 flex-1 text-[32px] leading-[41px] font-bold">Wi-Fi</h1>
			<HmiFlatButton
				size="xs"
				tone="end"
				label="Scan"
				icon={RotateCw}
				class="w-60"
				loading={deviceStore.isScanning}
				disabled={deviceStore.isConnecting}
				onclick={() => scanWifiNetworks()}
			/>
			{@render otherNetworkButton()}
			<AppCloseButton />
		</header>
	{/if}

	<div
		class="{embedded
			? 'pt-6'
			: 'mt-[39px]'} flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-[30px] pb-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
	>
		{#if embedded}
			<div class="mb-1 flex justify-end">{@render otherNetworkButton()}</div>
		{/if}
		{#if deviceStore.isScanning && deviceStore.networks.length === 0}
			<p class="m-0 py-10 text-center font-heading text-2xl font-medium text-[#5a616b]">
				Scanning for networks…
			</p>
		{/if}
		{#each listedNetworks as network (network.id)}
			{@const SignalIcon = SIGNAL_ICONS[network.signalLabel]}
			{@const connected = isConnectedNetwork(network.name)}
			<button
				type="button"
				class={rowClass(pressedId === network.id, connected)}
				aria-label="{network.name}{connected ? ', connected' : ''}{network.secured
					? ', secured'
					: ''}"
				onclick={() => onNetworkClick(network)}
			>
				<span
					class="flex size-14 shrink-0 items-center justify-center rounded-lg bg-[#3b3f45] text-white"
				>
					<SignalIcon class="size-7" strokeWidth={2.33} />
				</span>
				<span class="min-w-0 flex-1 truncate text-2xl leading-[31px] font-bold">
					{network.name}
				</span>
				{#if connected}
					<span class="flex shrink-0 items-center gap-2 text-xl font-bold text-[#1f7a3a]">
						<CircleCheck class="size-6" strokeWidth={2.5} />
						Connected
					</span>
				{:else if network.secured}
					<Lock class="size-6 shrink-0 text-[#5a616b]" strokeWidth={2} />
				{/if}
				<ChevronRight class="ml-7 size-7 shrink-0 text-[#5a616b]" strokeWidth={2.33} />
			</button>
		{/each}
	</div>

	<AppBusyOverlay
		open={deviceStore.isConnecting}
		title="Connecting"
		description="Connecting to {deviceStore.selectedNetwork?.name ?? 'Wi-Fi'}…"
	/>
</div>

{#snippet otherNetworkButton()}
	<HmiFlatButton
		size="xs"
		tone="end"
		label="Other network"
		icon={Plus}
		class="w-[260px] shrink-0"
		disabled={deviceStore.isConnecting}
		onclick={onOtherNetwork}
	/>
{/snippet}
