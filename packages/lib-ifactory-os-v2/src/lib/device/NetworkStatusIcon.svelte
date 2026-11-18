<script lang="ts">
	import { Wifi, WifiOff } from '@lucide/svelte';
	import { deviceStore } from '$lib/device';

	let {
		class: className = 'size-6 text-heading',
		onclick
	}: {
		class?: string;
		onclick?: () => void;
	} = $props();

	const isConnected = $derived(
		deviceStore.deviceInfo.connectionKind === 'wifi' ||
			deviceStore.deviceInfo.connectionKind === 'lan' ||
			deviceStore.deviceInfo.connectionKind === 'wifi-no-internet' ||
			deviceStore.deviceInfo.connectionKind === 'lan-no-internet'
	);

	const label = $derived.by(() => {
		switch (deviceStore.deviceInfo.connectionKind) {
			case 'lan':
				return 'LAN connected';
			case 'lan-no-internet':
				return 'LAN connected, no internet';
			case 'wifi':
				return 'Wi-Fi connected';
			case 'wifi-no-internet':
				return 'Wi-Fi connected, no internet';
			default:
				return 'No network';
		}
	});
</script>

{#if onclick}
	<button
		type="button"
		class="flex items-center justify-center border-0 bg-transparent p-0 {className}"
		{onclick}
		aria-label={label}
	>
		{#if isConnected}
			<Wifi class="size-full" strokeWidth={2} />
		{:else}
			<WifiOff class="size-full" strokeWidth={2} />
		{/if}
	</button>
{:else}
	<span class={className} role="img" aria-label={label}>
		{#if isConnected}
			<Wifi class="size-full" strokeWidth={2} />
		{:else}
			<WifiOff class="size-full" strokeWidth={2} />
		{/if}
	</span>
{/if}
