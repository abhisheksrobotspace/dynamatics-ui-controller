<script lang="ts">
	import { onMount } from 'svelte';
	import {
		Button,
		HmiButton,
		HmiKeyboard,
		Input,
		Label,
		createHmiPress,
		hmiCaret
	} from '@ifactory/ui-v2';
	import { ArrowLeft, Eye, EyeOff, Lock, Wifi } from '@lucide/svelte';
	import {
		clearWifiConnectError,
		clickOutside,
		connectWifi,
		deviceStore,
		formatWifiSignalLabel
	} from '$lib/device';
	import AppBusyOverlay from '$lib/os/appShell/AppBusyOverlay.svelte';
	import type { AppNavigation } from '../lib/navigation';

	let { navigation }: { navigation: AppNavigation } = $props();

	let showPassword = $state(false);
	let isKeyboardOpen = $state(true);
	let passwordInputRef = $state<HTMLInputElement | null>(null);
	let ssidInputRef = $state<HTMLInputElement | null>(null);
	let keyboardTrayRef = $state<HTMLDivElement | null>(null);
	/** Manual mode (a network that is not in the list): the name is typed in too. */
	const manual = $derived(deviceStore.manualNetwork);
	let ssid = $state('');
	let activeField = $state<'ssid' | 'password'>('password');
	const keyboardInput = $derived(
		manual && activeField === 'ssid' ? ssidInputRef : passwordInputRef
	);

	const network = $derived(deviceStore.selectedNetwork);
	const meta = $derived(
		network
			? `${network.secured ? network.security : 'Open'} · Signal ${formatWifiSignalLabel(network.signalLabel).toLowerCase()}`
			: ''
	);
	const busy = $derived(deviceStore.isConnecting);
	const hasError = $derived(Boolean(deviceStore.connectError));
	const ssidMissing = $derived(deviceStore.connectError === 'Network name required');

	/* Figma: HMI FROZEN DESIGN → Wi-Fi — Password (hmi-input, same well as the login fields). */
	const inputClass =
		'h-full min-w-0 flex-1 border-0 bg-transparent p-0 font-body text-[36px] font-bold text-[#1a1c20] shadow-none autofill:transition-[background-color] autofill:duration-[99999s] autofill:[-webkit-text-fill-color:#1a1c20] placeholder-shown:font-heading placeholder-shown:text-2xl placeholder-shown:font-medium placeholder:text-[#7e848d] focus-visible:ring-0';
	const eyeButtonClass =
		'shrink-0 rounded-md bg-gradient-to-b from-[#565b64] to-[#42464e] p-0 text-white shadow-[0_4px_0_#1c1f23] hover:bg-transparent';
	const eyePress = createHmiPress();

	function fieldClassFor(error: boolean, focused: boolean): string {
		const base = `flex ${manual ? 'h-[76px]' : 'h-[88px]'} items-center gap-4 rounded-lg px-3`;
		if (error) {
			return `${base} border-3 border-[#ef4444] bg-[#f4f5f7] shadow-[0_0_0_5px_rgba(239,68,68,0.2),inset_0_4px_8px_rgba(0,0,0,0.16)]`;
		}
		if (focused) {
			return `${base} border-3 border-[#ff6b2c] bg-white shadow-[0_0_0_5px_rgba(255,107,44,0.25),inset_0_4px_8px_rgba(0,0,0,0.16)]`;
		}
		return `${base} border-2 border-[#aeb4bd] bg-[#f4f5f7] shadow-[inset_0_4px_8px_rgba(0,0,0,0.16)]`;
	}
	function tileClassFor(error: boolean, focused: boolean): string {
		return `flex ${manual ? 'size-14' : 'size-16'} shrink-0 items-center justify-center rounded-md text-white ${
			error ? 'bg-[#dc2626]' : focused ? 'bg-[#ff6b2c]' : 'bg-[#3a3e46]'
		}`;
	}
	const ssidError = $derived(ssidMissing);
	const passwordError = $derived(hasError && !ssidMissing);
	const ssidFocused = $derived(isKeyboardOpen && activeField === 'ssid');
	const passwordFocused = $derived(isKeyboardOpen && activeField === 'password');

	onMount(() => {
		openKeyboard(manual ? 'ssid' : 'password');
	});

	// Fixed 4×44 orange caret, same as the login fields.
	$effect(() => {
		if (!passwordInputRef) return;
		const caret = hmiCaret(passwordInputRef);
		return () => caret.destroy();
	});

	$effect(() => {
		if (!ssidInputRef) return;
		const caret = hmiCaret(ssidInputRef);
		return () => caret.destroy();
	});

	$effect(() => {
		if (!isKeyboardOpen || busy) {
			return;
		}

		return clickOutside(
			() => [
				keyboardTrayRef,
				passwordInputRef,
				ssidInputRef,
				'input, label, [data-wifi-password-field], [data-keyboard-keep]'
			],
			() => closeKeyboard()
		);
	});

	function openKeyboard(field: 'ssid' | 'password' = activeField) {
		if (busy) return;
		activeField = field;
		isKeyboardOpen = true;
		(field === 'ssid' ? ssidInputRef : passwordInputRef)?.focus();
	}

	function closeKeyboard() {
		isKeyboardOpen = false;
		passwordInputRef?.blur();
		ssidInputRef?.blur();
	}

	function onKeyboardDone() {
		// SSID first, then the password; the password's key connects.
		if (manual && activeField === 'ssid') {
			openKeyboard('password');
			return;
		}
		void onConnect();
	}

	function onBack() {
		if (busy) return;
		deviceStore.manualNetwork = false;
		deviceStore.connectError = '';
		deviceStore.password = '';
		if (!navigation.goBack()) {
			navigation.navigateTo('WifiList');
		}
	}

	async function onConnect() {
		closeKeyboard();
		if (manual && network) {
			const name = ssid.trim();
			if (!name) {
				deviceStore.connectError = 'Network name required';
				openKeyboard('ssid');
				return;
			}
			// No password typed: try it as an open network.
			const secured = deviceStore.password.trim() !== '';
			deviceStore.selectedNetwork = {
				...network,
				id: name,
				name,
				secured,
				security: secured ? 'WPA2' : '--'
			};
		}
		const ok = await connectWifi(deviceStore.password);
		if (ok) {
			deviceStore.manualNetwork = false;
			navigation.navigateTo('WifiConnected');
		}
	}
</script>

{#if network}
	<div class="relative flex h-full min-h-0 w-full flex-col bg-white font-body text-[#1b2028]">
		<!-- The docked keyboard leaves ~240 px above it, so the page title is dropped here. -->
		<div class="flex flex-col px-[30px] pt-3.5">
			<p class="m-0 text-base leading-5 font-bold tracking-[0.9px] text-[#5a616b] uppercase">
				{manual ? 'Connect to another network' : 'Connect to network'}
			</p>
			{#if !manual}
				<div class="mt-0.5 flex items-baseline gap-4">
					<h1 class="m-0 truncate text-[32px] leading-[41px] font-bold">{network.name}</h1>
					<span class="shrink-0 text-base leading-5 font-bold text-[#5a616b]">{meta}</span>
				</div>
			{/if}

			<div class="{manual ? 'mt-2.5 gap-2' : 'mt-4 gap-2.5'} flex flex-col">
				{#if manual}
					<div class={fieldClassFor(ssidError, ssidFocused)}>
						<div class={tileClassFor(ssidError, ssidFocused)}>
							<Wifi class="size-8 [stroke-width:2.5]" />
						</div>
						<Input
							id="wifi-ssid"
							type="text"
							bind:ref={ssidInputRef}
							bind:value={ssid}
							placeholder="Network name (SSID)"
							aria-label="Network name"
							autocomplete="off"
							spellcheck={false}
							inputmode="none"
							disabled={busy}
							class={inputClass}
							onfocus={() => openKeyboard('ssid')}
							onclick={() => openKeyboard('ssid')}
							oninput={clearWifiConnectError}
							data-wifi-password-field
						/>
					</div>
				{:else}
					<Label
						for="wifi-password"
						text="Password"
						class="font-heading text-lg leading-[25px] font-bold tracking-[0.04em] uppercase {passwordError
							? 'text-[#dc2626]'
							: 'text-[#3f4550]'}"
					/>
				{/if}
				<div class={fieldClassFor(passwordError, passwordFocused)}>
					<div class={tileClassFor(passwordError, passwordFocused)}>
						<Lock class="size-8 [stroke-width:2.5]" />
					</div>
					<Input
						id="wifi-password"
						type={showPassword ? 'text' : 'password'}
						bind:ref={passwordInputRef}
						bind:value={deviceStore.password}
						placeholder="Enter password"
						autocomplete="off"
						inputmode="none"
						disabled={busy}
						class={inputClass}
						onfocus={() => openKeyboard('password')}
						onclick={() => openKeyboard('password')}
						oninput={clearWifiConnectError}
						data-wifi-password-field
					/>
					<Button
						variant="ghost"
						size="icon"
						icon={showPassword ? Eye : EyeOff}
						iconClass="size-8 [stroke-width:2.5]"
						class="{eyeButtonClass} {manual ? 'size-14' : 'size-16'} {eyePress.pressed
							? 'translate-y-1 shadow-none'
							: ''}"
						{...eyePress.handlers}
						aria-label={showPassword ? 'Hide password' : 'Show password'}
						disabled={busy}
						data-keyboard-keep
						onmousedown={(event: MouseEvent) => event.preventDefault()}
						onclick={() => (showPassword = !showPassword)}
					/>
				</div>
				{#if deviceStore.connectError}
					<p
						class="m-0 font-heading text-lg leading-[25px] font-medium text-[#dc2626]"
						aria-live="polite"
					>
						{deviceStore.connectError}
					</p>
				{/if}
			</div>
		</div>

		<!-- Forget network lives on the connected screen only: a network we are not on has nothing to forget. -->
		{#if !isKeyboardOpen}
			<footer class="mt-auto flex shrink-0 justify-center gap-5 px-[30px] pb-8">
				<HmiButton label="Back" icon={ArrowLeft} disabled={busy} onclick={onBack} />
				<HmiButton
					label="Connect"
					icon={Wifi}
					tone="primary"
					loading={deviceStore.isConnecting}
					disabled={busy}
					onclick={() => void onConnect()}
				/>
			</footer>
		{/if}

		<AppBusyOverlay
			open={busy}
			title="Connecting"
			description={`Connecting to ${manual ? ssid.trim() || 'the network' : network.name}…`}
		/>
	</div>

	{#if isKeyboardOpen && !busy}
		<div bind:this={keyboardTrayRef} data-keyboard-root class="fixed inset-x-0 bottom-0 z-[60]">
			<HmiKeyboard
				inputElement={keyboardInput}
				doneLabel={manual && activeField === 'ssid' ? 'NEXT' : 'CONNECT'}
				loading={deviceStore.isConnecting}
				onDone={onKeyboardDone}
			/>
		</div>
	{/if}
{:else}
	<div class="flex h-full flex-col items-center justify-center gap-6 p-8 font-body">
		<p class="m-0 font-heading text-2xl font-medium text-[#5a616b]">No network selected.</p>
		<HmiButton label="Back" icon={ArrowLeft} onclick={() => navigation.navigateTo('WifiList')} />
	</div>
{/if}
