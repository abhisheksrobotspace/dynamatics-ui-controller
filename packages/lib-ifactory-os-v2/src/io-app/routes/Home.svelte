<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { HmiFlatButton, HmiHoldButton, createHmiPress } from '@ifactory/ui-v2';
	import { ArrowLeft, ArrowRight, CircleX, Lock, LockOpen } from '@lucide/svelte';
	import AppCloseButton from '$lib/os/AppCloseButton.svelte';
	import PinDialog from '$lib/os/PinDialog.svelte';
	import { readIoPin } from '$lib/os/machine-pin.js';
	import IoStatus from '../components/IoStatus.svelte';
	import IoToggle from '../components/IoToggle.svelte';
	import RigSensorsView from '../components/RigSensorsView.svelte';
	import RigAutoTestView from '../components/RigAutoTestView.svelte';
	import {
		allOutputsOff,
		bindIoMqttEvents,
		boardStates,
		instruments,
		selectDevice
	} from '../lib/io-store.svelte.js';
	import { MACHINE_STATE, machineIdleStore } from '$lib/os/machine-idle/machine-idle-store.svelte';

	/* Figma: HMI FROZEN DESIGN → io · GPIO monitor · ioX & Sensors tabs */
	const VISIBLE_TABS = 5;

	let unbindMqtt: (() => void) | undefined;

	onMount(() => {
		unbindMqtt = bindIoMqttEvents();
		refreshIoPin();
	});

	onDestroy(() => {
		unbindMqtt?.();
	});

	const instrumentsOnline = $derived(
		instruments.pressure.online ||
			instruments.temperature.online ||
			instruments.energy.online ||
			instruments.flow.online
	);

	/** 5 tabs: Auto Test + 3 daisy-chained ioX boards + Sensors & Instruments view */
	const devices = $derived([
		{ id: 0, label: 'Auto Test', sublabel: 'Sequence & FSM', online: true },
		{ id: 1, label: 'ioX 1', sublabel: 'Front SV & Safety', online: boardStates[1].online },
		{ id: 2, label: 'ioX 2', sublabel: 'Rear SV & Flow', online: boardStates[2].online },
		{ id: 3, label: 'ioX 3', sublabel: 'Punch & VFD', online: boardStates[3].online },
		{ id: 4, label: 'Sensors', sublabel: 'Pressure & Energy', online: instrumentsOnline }
	]);

	let selectedId = $state(0);
	let firstTab = $state(0);
	const selected = $derived(devices.find((device) => device.id === selectedId) ?? devices[0]);
	const shownTabs = $derived(devices.slice(firstTab, firstTab + VISIBLE_TABS));
	const canPageLeft = $derived(firstTab > 0);
	const canPageRight = $derived(firstTab + VISIBLE_TABS < devices.length);

	const currentBoard = $derived(boardStates[selectedId] ?? boardStates[1]);
	const currentOutputs = $derived(currentBoard.outputs);
	const currentInputs = $derived(currentBoard.inputs);

	/** Outputs drive the machine: locked while it is running, and while the board is not answering. */
	const machineAllowsSwitching = $derived(
		machineIdleStore.machineState !== MACHINE_STATE.PRODUCTION
	);

	/**
	 * Read only until the operator enables control with the PIN (`ioPIN` in machine settings,
	 * default 1478953). Disabling needs no PIN; closing the app puts it back to read only.
	 */
	let controlsEnabled = $state(false);
	let pinOpen = $state(false);
	let pinValue = $state('');
	let pinError = $state('');
	let pinBusy = $state(false);
	let ioPin = $state<string | null>(null);

	function refreshIoPin() {
		void readIoPin().then((pin) => (ioPin = pin));
	}

	const canSwitch = $derived(
		controlsEnabled &&
			machineAllowsSwitching &&
			(selected.id === 0 || selected.id === 4 || selected.online === true)
	);

	function onToggleControls() {
		if (controlsEnabled) {
			controlsEnabled = false;
			return;
		}
		pinValue = '';
		pinError = '';
		pinOpen = true;
		refreshIoPin();
	}

	function cancelPin() {
		pinOpen = false;
		pinValue = '';
		pinError = '';
	}

	async function confirmPin() {
		if (pinBusy) return;
		pinBusy = true;
		pinError = '';
		const expected = ioPin ?? (await readIoPin());
		pinBusy = false;
		if (pinValue.trim() !== expected) {
			pinError = 'Incorrect PIN';
			return;
		}
		controlsEnabled = true;
		pinOpen = false;
		pinValue = '';
	}

	const outputsOn = $derived(currentOutputs.filter((output) => output.status).length);
	const inputsHigh = $derived(currentInputs.filter((input) => input.status).length);

	const totalOutputsOn = $derived(
		Object.values(boardStates).reduce(
			(sum, b) => sum + b.outputs.filter((o) => o.status).length,
			0
		)
	);

	const outputsHint = $derived(
		!machineAllowsSwitching
			? 'locked · machine running'
			: selected.online !== true
				? 'locked · device offline'
				: !controlsEnabled
					? 'read only · press Enable to switch'
					: 'tap to switch'
	);

	const updatedLabel = $derived(
		currentBoard.updatedAt
			? currentBoard.updatedAt.toLocaleTimeString('en-GB', { hour12: false })
			: 'waiting for device'
	);

	const leftPress = createHmiPress();
	const rightPress = createHmiPress();

	function arrowClass(enabled: boolean, pressed: boolean): string {
		const base =
			'flex h-[84px] w-[72px] shrink-0 cursor-pointer flex-col rounded-[10px] p-0 select-none [-webkit-tap-highlight-color:transparent] disabled:cursor-not-allowed';
		if (!enabled) return `${base} bg-[#8f969f] pb-1.5 opacity-40`;
		return pressed ? `${base} pt-1.5` : `${base} bg-[#8f969f] pb-1.5`;
	}

	function tabClass(active: boolean): string {
		return `flex h-[84px] min-w-0 flex-1 cursor-pointer flex-col rounded-[10px] p-0 pb-1.5 select-none [-webkit-tap-highlight-color:transparent] ${
			active ? 'bg-[#f26b2a]' : 'bg-[#a3a9b1]'
		}`;
	}

	function handleAllOutputsOff() {
		if (selected.id === 4) {
			allOutputsOff(); // All boards
		} else {
			allOutputsOff(selected.id);
		}
	}
</script>

<div class="flex h-full min-h-0 w-full flex-col bg-white pt-2 pr-7 pb-[18px] pl-[30px] font-body">
	<header class="flex h-14 shrink-0 items-center justify-between">
		<h1 class="m-0 text-[32px] leading-[41px] font-bold text-[#1b2028]">
			I/O & Diagnostic Test Rig
		</h1>
		<div class="flex items-center gap-4">
			<p class="m-0 text-xl leading-[26px] font-medium text-[#5a616c]">Updated {updatedLabel}</p>
			<AppCloseButton />
		</div>
	</header>

	<nav class="mt-2 flex shrink-0 gap-3" aria-label="ioX devices and sensors">
		<button
			type="button"
			class={arrowClass(canPageLeft, leftPress.pressed)}
			aria-label="Previous devices"
			disabled={!canPageLeft}
			{...leftPress.handlers}
			onclick={() => (firstTab = Math.max(0, firstTab - 1))}
		>
			<span class="flex w-full flex-1 items-center justify-center rounded-[10px] bg-[#e0e3e8]">
				<ArrowLeft class="size-[30px] text-[#40454f]" strokeWidth={2.5} />
			</span>
		</button>
		<div class="flex min-w-0 flex-1 gap-3">
			{#each shownTabs as device (device.id)}
				{@const active = device.id === selected.id}
				<button
					type="button"
					class={tabClass(active)}
					aria-pressed={active}
					onclick={() => {
						selectedId = device.id;
						selectDevice(device.id);
					}}
				>
					<span
						class="flex w-full flex-1 flex-col items-center justify-center gap-0.5 rounded-[10px] {active
							? 'border-3 border-[#f26b2a] bg-[#fff2e8]'
							: 'border-[1.5px] border-[#c3c8cf] bg-white'}"
					>
						<span
							class="text-[24px] leading-7 font-bold {device.online === false
								? 'text-[#8a9199]'
								: 'text-[#1b2028]'}"
						>
							{device.label}
						</span>
						<span class="text-xs font-semibold text-[#7d848c]">
							{device.sublabel}
						</span>
						<span class="flex items-center gap-1.5 text-xs font-bold mt-0.5">
							{#if device.online === true}
								<span class="size-2 rounded-full bg-[#2e9e4f]" aria-hidden="true"></span>
								<span class="text-[#5a616c]">Online</span>
							{:else}
								<span
									class="size-2 rounded-full border border-dashed border-[#8a9199]"
									aria-hidden="true"
								></span>
								<span class="text-[#8a9199]">
									{device.online === false ? 'Offline' : 'Connecting'}
								</span>
							{/if}
						</span>
					</span>
				</button>
			{/each}
			{#each { length: Math.max(0, VISIBLE_TABS - shownTabs.length) }, index (index)}
				<span class="min-w-0 flex-1" aria-hidden="true"></span>
			{/each}
		</div>
		<button
			type="button"
			class={arrowClass(canPageRight, rightPress.pressed)}
			aria-label="Next devices"
			disabled={!canPageRight}
			{...rightPress.handlers}
			onclick={() => (firstTab = Math.min(devices.length - VISIBLE_TABS, firstTab + 1))}
		>
			<span class="flex w-full flex-1 items-center justify-center rounded-[10px] bg-[#e0e3e8]">
				<ArrowRight class="size-[30px] text-[#40454f]" strokeWidth={2.5} />
			</span>
		</button>
	</nav>

	<p class="m-0 mt-1.5 h-5 shrink-0 text-right text-base leading-5 font-bold text-[#5a616c]">
		{#if devices.length > VISIBLE_TABS}
			{firstTab + 1}–{firstTab + VISIBLE_TABS} of {devices.length} devices
		{:else}
			{devices.length} channels / modules
		{/if}
	</p>

	<!-- Content Area: Auto Test, ioX 1/2/3 Relays & Inputs, or Sensors View -->
	<div class="flex-1 min-h-0 overflow-y-auto mt-1 pr-1">
		{#if selected.id === 0}
			<!-- Auto Test State Machine View -->
			<section aria-label="Auto Test State Machine">
				<RigAutoTestView />
			</section>
		{:else if selected.id <= 3}
			<section class="shrink-0" aria-label="Outputs">
				<h2 class="m-0 flex items-baseline gap-5 text-2xl leading-[31px] font-bold text-[#4a505a]">
					OUTPUTS · {selected.label}
					<span class="text-xl leading-[26px] font-medium text-[#5a616c]">
						{outputsOn} of {currentOutputs.length} on · {outputsHint}
					</span>
				</h2>
				<div class="mt-[9px] grid grid-cols-8 gap-3">
					{#each currentOutputs as output, index (output.id)}
						<IoToggle
							bind:element={currentOutputs[index]}
							deviceId={selected.id}
							disabled={!canSwitch}
							locked={!controlsEnabled}
							onLockedClick={onToggleControls}
						/>
					{/each}
				</div>
			</section>

			<section class="mt-5 shrink-0" aria-label="Inputs">
				<h2 class="m-0 flex items-baseline gap-5 text-2xl leading-[31px] font-bold text-[#4a505a]">
					INPUTS · {selected.label}
					<span class="text-xl leading-[26px] font-medium text-[#5a616c]">
						{inputsHigh} of {currentInputs.length} high · tap to toggle / sensor triggered
					</span>
				</h2>
				<div class="mt-[9px] grid grid-cols-8 gap-3">
					{#each currentInputs as input, index (input.id)}
						<IoStatus
							bind:element={currentInputs[index]}
							deviceId={selected.id}
						/>
					{/each}
				</div>
			</section>
		{:else}
			<!-- Sensors & Instruments Tab -->
			<section aria-label="Rig Instruments">
				<h2 class="m-0 mb-3 flex items-baseline gap-5 text-2xl leading-[31px] font-bold text-[#4a505a]">
					RIG SENSORS & INSTRUMENTS
					<span class="text-xl leading-[26px] font-medium text-[#5a616c]">
						Live RS485 telemetry · pressure, temp, energy, flow, RPM & safety
					</span>
				</h2>
				<RigSensorsView disabled={!canSwitch} />
			</section>
		{/if}
	</div>

	<footer class="mt-auto flex shrink-0 items-center justify-between gap-4 pt-2">
		<HmiFlatButton
			label={controlsEnabled ? 'Disable Control' : 'Enable Control'}
			icon={controlsEnabled ? Lock : LockOpen}
			tone={controlsEnabled ? 'neutral' : 'primary'}
			size="lg"
			class="w-[472px] shrink-0"
			onclick={onToggleControls}
		/>
		<HmiHoldButton
			class="w-[472px] shrink-0"
			label={selected.id === 4 ? 'All outputs off (all boards)' : `All ${selected.label} off`}
			labelClass="text-[28px]"
			icon={CircleX}
			tone="end"
			iconClass={canSwitch && (selected.id === 4 ? totalOutputsOn > 0 : outputsOn > 0)
				? 'size-[34px] text-[#ff5a4f]'
				: 'size-[34px]'}
			hint="Press and hold for 1.5 s"
			disabled={!canSwitch || (selected.id === 4 ? totalOutputsOn === 0 : outputsOn === 0)}
			onConfirm={handleAllOutputsOff}
		/>
	</footer>
</div>

<PinDialog
	open={pinOpen}
	title="Enable I/O control"
	error={pinError}
	busy={pinBusy}
	bind:value={pinValue}
	onconfirm={() => void confirmPin()}
	oncancel={cancelPin}
/>
