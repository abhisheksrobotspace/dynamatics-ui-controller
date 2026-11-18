<script lang="ts">
	import { HmiButton, createHmiPress } from '@ifactory/ui-v2';
	import { RotateCw } from '@lucide/svelte';
	import { deviceStore, syncDeviceNow } from '$lib/device';
	import {
		interlockStore,
		refreshInterlockFromMachineSettings,
		setInterlockActiveWithPin
	} from '$lib/os/interlock/interlock-store.svelte';
	import { onMount } from 'svelte';
	import PinDialog from '$lib/os/PinDialog.svelte';
	import AppCloseButton from '$lib/os/AppCloseButton.svelte';

	/** `embedded`: shown inside a host that owns the title bar (Lockscreen overlay). */
	let { embedded = false }: { embedded?: boolean } = $props();

	const info = $derived(deviceStore.deviceInfo);
	const interlockFeatureEnabled = $derived(interlockStore.isEnabled);

	const deviceRows = $derived<{ label: string; value: string; tone?: string }[]>([
		{ label: 'Machine ID', value: info.machineId },
		{ label: 'Device / LAN MAC', value: info.deviceLanMac },
		{ label: 'Wi-Fi MAC', value: info.wifiMac },
		{ label: 'FW version', value: info.fwVersion }
	]);

	const offline = $derived(info.internetStatus === 'Unreachable' || info.connectionKind === 'none');
	const networkRows = $derived<{ label: string; value: string; tone?: string }[]>([
		{ label: 'Network', value: info.network },
		{ label: 'IP address', value: info.ipAddress },
		{
			label: 'Signal strength',
			value: info.signalScore?.trim()
				? `${info.signalStrength} · ${info.signalScore}`
				: info.signalStrength
		},
		{ label: 'Internet status', value: info.internetStatus, tone: offline ? 'text-[#dc2626]' : '' }
	]);

	/** The store keeps "-" until the first sync; say so instead of a bare dash. */
	function syncLabel(value: string): string {
		return value && value !== '-' ? value : 'Not yet';
	}

	const statCards = $derived([
		{ label: 'Model', value: 'ioWare Pro', large: true },
		{ label: 'Data sent', value: syncLabel(info.dataSentAt), large: false },
		{ label: 'Settings received', value: syncLabel(info.settingsReceivedAt), large: false }
	]);

	let interlockActive = $derived(interlockStore.isActive || interlockStore.isOn);
	let pinDialogOpen = $state(false);
	let pendingActive = $state(false);
	let pinValue = $state('');
	let pinError = $state('');
	let pinBusy = $state(false);
	const interlockPress = createHmiPress();
	const interlockHint = $derived(
		!interlockFeatureEnabled ? 'Off in machine settings' : 'Locks the machine between jobs · PIN'
	);

	onMount(() => {
		void refreshInterlockFromMachineSettings();
	});

	function onInterlockToggle() {
		if (!interlockFeatureEnabled || pinBusy) return;
		pendingActive = !interlockActive;
		pinValue = '';
		pinError = '';
		pinDialogOpen = true;
	}

	function cancelPinDialog() {
		pinDialogOpen = false;
		pinValue = '';
		pinError = '';
		pinBusy = false;
	}

	async function confirmPinDialog() {
		if (pinBusy) return;
		pinBusy = true;
		pinError = '';
		const result = await setInterlockActiveWithPin(pendingActive, pinValue);
		pinBusy = false;
		if (!result.ok) {
			pinError =
				result.reason === 'pin'
					? 'Incorrect PIN'
					: result.reason === 'disabled'
						? 'Interlock is disabled in machine settings'
						: result.reason === 'settings'
							? ''
							: 'Failed to update interlock';
			return;
		}
		pinDialogOpen = false;
		pinValue = '';
	}
</script>

<!-- Figma: HMI FROZEN DESIGN → About Device (kv-tables left, data cards + Sync now right). -->
<div
	class="flex h-full min-h-0 w-full flex-col bg-white pt-2 pr-7 pb-2 pl-[30px] font-body text-[#1b2028]"
>
	{#if !embedded}
		<header class="mb-3 flex h-14 shrink-0 items-center gap-4">
			<h1 class="m-0 min-w-0 flex-1 text-[32px] leading-[41px] font-bold">About Device</h1>
			<AppCloseButton />
		</header>
	{/if}

	<div class="flex min-h-0 flex-1 gap-6">
		<div
			class="flex min-w-0 flex-1 flex-col gap-5 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
		>
			{#each [{ title: 'Device', rows: deviceRows }, { title: 'Network', rows: networkRows }] as table (table.title)}
				<section
					class="flex shrink-0 flex-col gap-2 rounded-xl border-2 border-[#c3c8cf] bg-white px-[18px] py-3"
				>
					<div class="flex h-12 items-center bg-[#f5f6f8] pl-3.5">
						<span class="text-2xl leading-[31px] font-medium text-[#5a616c] uppercase"
							>{table.title}</span
						>
					</div>
					<div class="flex flex-col">
						{#each table.rows as row, index (row.label)}
							<div
								class="flex h-[59px] items-center justify-between gap-4 px-3.5 {index <
								table.rows.length - 1
									? 'border-b border-[#dde1e5]'
									: ''}"
							>
								<span class="shrink-0 text-2xl leading-[31px] font-medium text-[#5a616c]"
									>{row.label}</span
								>
								<span
									class="min-w-0 truncate text-right text-[26px] leading-[33px] font-bold {row.tone ??
										''}"
								>
									{row.value}
								</span>
							</div>
						{/each}
					</div>
				</section>
			{/each}
		</div>

		<div class="flex w-[472px] shrink-0 flex-col gap-4">
			{#each statCards as card (card.label)}
				<section
					class="flex max-h-[172px] min-h-0 flex-1 flex-col justify-center gap-1 rounded-xl border-2 border-[#c3c8cf] bg-white px-[26px]"
				>
					<p class="m-0 text-2xl leading-[31px] font-medium text-[#5a616c] uppercase">
						{card.label}
					</p>
					<p
						class="m-0 truncate font-bold {card.large
							? 'text-[44px] leading-[56px]'
							: 'text-[32px] leading-[41px]'}"
					>
						{card.value}
					</p>
				</section>
			{/each}
			<!-- Interlock: a supervisor setting, so the whole card is one key and the PIN dialog guards it. -->
			<button
				type="button"
				role="switch"
				aria-checked={interlockActive}
				aria-label="Interlock"
				disabled={!interlockFeatureEnabled || pinBusy}
				class="flex h-[132px] w-full shrink-0 cursor-pointer flex-col rounded-xl p-0 text-left select-none [-webkit-tap-highlight-color:transparent] disabled:cursor-not-allowed {interlockPress.pressed &&
				interlockFeatureEnabled
					? 'pt-1.5'
					: `pb-1.5 ${interlockActive && interlockFeatureEnabled ? 'bg-[#1b2028]' : 'bg-[#a3a9b1]'}`}"
				{...interlockPress.handlers}
				onclick={onInterlockToggle}
			>
				<span
					class="flex w-full flex-1 items-center gap-5 rounded-xl bg-white px-[26px] {interlockActive &&
					interlockFeatureEnabled
						? 'border-3 border-[#1b2028]'
						: 'border-2 border-[#c3c8cf]'}"
				>
					<span class="flex min-w-0 flex-1 flex-col">
						<span class="text-2xl leading-[31px] font-medium text-[#5a616c] uppercase">
							Interlock
						</span>
						<span
							class="text-[32px] leading-[41px] font-bold {interlockFeatureEnabled
								? ''
								: 'text-[#7d848c]'}"
						>
							{interlockFeatureEnabled ? (interlockActive ? 'On' : 'Off') : 'Not available'}
						</span>
						<span class="truncate font-heading text-base leading-[22px] font-medium text-[#5a616c]">
							{interlockHint}
						</span>
					</span>
					<span
						class="relative h-11 w-[84px] shrink-0 rounded-full {interlockActive &&
						interlockFeatureEnabled
							? 'bg-[#1b2028]'
							: 'bg-[#d5d9de]'}"
						aria-hidden="true"
					>
						<span
							class="absolute top-1 left-1 size-9 rounded-full bg-white transition-transform duration-150 {interlockActive &&
							interlockFeatureEnabled
								? 'translate-x-10'
								: ''}"
						></span>
					</span>
				</span>
			</button>
			<HmiButton
				label="Sync now"
				icon={RotateCw}
				class="w-full shrink-0"
				onclick={() => syncDeviceNow()}
			/>
		</div>
	</div>
</div>

<PinDialog
	open={pinDialogOpen}
	title={pendingActive ? 'Turn interlock on' : 'Turn interlock off'}
	error={pinError}
	busy={pinBusy}
	bind:value={pinValue}
	onconfirm={() => void confirmPinDialog()}
	oncancel={cancelPinDialog}
/>
