<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { bindDeviceMqttEvents } from '$lib/device';
	import DeviceInfo from './DeviceInfo.svelte';

	/** `embedded`: shown inside a host that owns the title bar (Lockscreen overlay). */
	let { embedded = false }: { embedded?: boolean } = $props();

	let unbindMqtt = $state<(() => void) | null>(null);

	onMount(() => {
		unbindMqtt = bindDeviceMqttEvents();
	});

	onDestroy(() => {
		unbindMqtt?.();
	});
</script>

<div class="h-full min-h-0 w-full">
	<DeviceInfo {embedded} />
</div>
