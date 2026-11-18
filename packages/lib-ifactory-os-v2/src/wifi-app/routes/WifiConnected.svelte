<script lang="ts">
	import { HmiButton } from '@ifactory/ui-v2';
	import { ArrowLeft, Check, CircleCheck, X } from '@lucide/svelte';
	import { deviceStore, forgetWifiNetwork } from '$lib/device';
	import AppBusyOverlay from '$lib/os/appShell/AppBusyOverlay.svelte';
	import AppCloseButton from '$lib/os/AppCloseButton.svelte';
	import type { AppNavigation } from '../lib/navigation';

	let { navigation, embedded = false }: { navigation: AppNavigation; embedded?: boolean } =
		$props();

	const network = $derived(deviceStore.selectedNetwork);

	const connectionStats = $derived([
		{ label: 'IP address', value: deviceStore.connectedIp },
		{ label: 'Signal', value: deviceStore.connectedSignal },
		{ label: 'Security', value: deviceStore.connectedSecurity }
	]);

	async function onForget() {
		const ok = await forgetWifiNetwork(network?.name);
		if (ok) navigation.navigateTo('WifiList');
	}

	function onDone() {
		navigation.navigateTo('WifiList');
	}
</script>

<!-- Figma: HMI FROZEN DESIGN → Wi-Fi — Connected. -->
{#if network}
	<div class="relative flex h-full min-h-0 w-full flex-col bg-white font-body text-[#1b2028]">
		{#if !embedded}
			<header class="mt-2 flex h-14 shrink-0 items-center gap-4 pr-7 pl-[30px]">
				<h1 class="m-0 min-w-0 flex-1 text-[32px] leading-[41px] font-bold">Wi-Fi</h1>
				<AppCloseButton />
			</header>
		{/if}

		<section class="flex flex-col items-center">
			<CircleCheck
				class="{embedded ? 'mt-16' : 'mt-[67px]'} size-[72px] text-[#1f7a3a]"
				strokeWidth={2}
			/>
			<p class="m-0 mt-[18px] text-[44px] leading-[56px] font-bold text-[#1f7a3a]">Connected</p>
			<p class="m-0 mt-2.5 text-[32px] leading-[41px] font-bold">{network.name}</p>

			<div
				class="mt-[43px] grid h-[110px] w-[800px] grid-cols-3 items-center rounded-xl border-2 border-[#c9ced6] bg-white"
			>
				{#each connectionStats as stat, index (stat.label)}
					<div
						class="flex h-[62px] flex-col items-center justify-between {index > 0
							? 'border-l border-[#dde1e5]'
							: ''}"
					>
						<p class="m-0 text-base leading-5 font-bold tracking-[0.9px] text-[#5a616b] uppercase">
							{stat.label}
						</p>
						<p class="m-0 text-[28px] leading-9 font-bold">{stat.value}</p>
					</div>
				{/each}
			</div>

			<div class="mt-20 flex gap-5">
				<HmiButton
					label="Forget network"
					icon={X}
					class="w-[400px]"
					disabled={deviceStore.isForgetting}
					onclick={() => void onForget()}
				/>
				<HmiButton
					label="Done"
					icon={Check}
					tone="primary"
					class="w-80"
					disabled={deviceStore.isForgetting}
					onclick={onDone}
				/>
			</div>
		</section>

		<AppBusyOverlay
			open={deviceStore.isForgetting}
			title="Forgetting network"
			description="Removing saved network {network.name}…"
		/>
	</div>
{:else}
	<div class="flex h-full flex-col items-center justify-center gap-6 p-8 font-body">
		<p class="m-0 font-heading text-2xl font-medium text-[#5a616b]">Not connected.</p>
		<HmiButton
			label="Wi-Fi list"
			icon={ArrowLeft}
			onclick={() => navigation.navigateTo('WifiList')}
		/>
	</div>
{/if}
