<script lang="ts">
	import { HmiButton, HmiFlatButton } from '@ifactory/ui-v2';
	import { List, RotateCw, X } from '@lucide/svelte';
	import { deviceStore, scanWifiNetworks } from '$lib/device';
	import WifiApp from '../../wifi-app/routes/App.svelte';
	import DeviceLockscreenOverlay from './DeviceLockscreenOverlay.svelte';

	let {
		open = false,
		onclose
	}: {
		open?: boolean;
		onclose?: () => void;
	} = $props();

	let deviceOverlayOpen = $state(false);

	/** The close button sits where the Wi-Fi icon was tapped, so it ignores taps for a moment. */
	const CLOSE_LOCK_MS = 1000;
	let closeLocked = $state(false);

	$effect(() => {
		if (!open) {
			deviceOverlayOpen = false;
			return;
		}
		closeLocked = true;
		const timer = setTimeout(() => (closeLocked = false), CLOSE_LOCK_MS);
		return () => clearTimeout(timer);
	});
</script>

{#if open}
	<div
		class="fixed inset-0 z-[110] flex min-h-0 flex-col bg-white font-body text-[#1b2028]"
		role="dialog"
		aria-modal="true"
		aria-label="Wi-Fi"
	>
		<!-- HMI title bar: the Wi-Fi screens hide their own title and buttons when embedded. -->
		<div
			class="flex shrink-0 items-center gap-4 border-b border-[#dde1e5] px-[30px] pt-3 pb-[17px]"
		>
			<h1 class="m-0 flex-1 text-[32px] leading-[41px] font-bold">Wi-Fi</h1>
			<HmiButton
				size="md"
				label="About"
				icon={List}
				class="w-60"
				onclick={() => (deviceOverlayOpen = true)}
			/>
			<HmiButton
				size="md"
				label="Scan"
				icon={RotateCw}
				class="w-60"
				loading={deviceStore.isScanning}
				disabled={deviceStore.isConnecting}
				onclick={() => scanWifiNetworks()}
			/>
			<HmiFlatButton
				size="xs"
				icon={X}
				iconClass="size-8"
				class="size-[72px] shrink-0"
				aria-label="Close Wi-Fi"
				disabled={closeLocked}
				onclick={() => onclose?.()}
			/>
		</div>

		<div class="min-h-0 flex-1">
			<WifiApp embedded />
		</div>
	</div>

	<DeviceLockscreenOverlay open={deviceOverlayOpen} onclose={() => (deviceOverlayOpen = false)} />
{/if}
