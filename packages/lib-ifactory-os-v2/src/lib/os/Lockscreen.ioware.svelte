<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import '@fontsource/space-grotesk/700.css';
	import { Button, HmiKeyboard, Input, Label, createHmiPress, hmiCaret } from '@ifactory/ui-v2';
	import osBg from '$lib/assets/os_bg.jpeg';
	import { Eye, EyeOff, Lock, User } from '@lucide/svelte';
	import loginWorker from '$lib/os/lib/custom-scripts/loginWorker.ts?worker';
	import { globalMqtt } from '$lib/os/lib/custom-scripts/mqtt.js';
	import { NetworkStatusIcon } from '$lib/device';
	import { clickOutside } from '$lib/os/lib/utils/clickOutside.js';
	import { beginOperatorSession } from './session.js';
	import { extractPrimaryMachine } from './primary-machine.js';
	import { switchOperator } from './index.svelte';
	import {
		formatIdleHmsParts,
		hasIdleTaskBarChip,
		machineIdleStore,
		reopenMachineIdleOverlay,
		selectedOverlayAlert,
		selectedOverlayAlertBadge
	} from './machine-idle/machine-idle-store.svelte';
	import InterlockIndicator from './InterlockIndicator.svelte';
	import WifiLockscreenOverlay from './WifiLockscreenOverlay.svelte';
	import SafetyCheck, { type SafetyCheckResult } from './SafetyCheck.ioware.svelte';

	type OperatorRecord = Record<string, { id?: string; name?: string; password?: string }>;

	/** Five quick taps on the Wi-Fi icon open the Wi-Fi screen (hard to hit by accident). */
	const WIFI_TAPS_TO_OPEN = 5;
	/** Max gap between taps in the sequence. */
	const WIFI_TAP_GAP_MS = 600;

	type Field = 'username' | 'password';

	/* Figma: HMI FROZEN DESIGN → hmi-login. Recessed 88 px well, icon tile, raised trailing button. */
	const inputClass =
		'h-full min-w-0 flex-1 border-0 bg-transparent p-0 font-body text-[36px] font-bold text-[#1a1c20] shadow-none autofill:transition-[background-color] autofill:duration-[99999s] autofill:[-webkit-text-fill-color:#1a1c20] placeholder-shown:font-heading placeholder-shown:text-2xl placeholder-shown:font-medium placeholder:text-[#7e848d] focus-visible:ring-0';
	const eyeButtonClass =
		'size-16 shrink-0 rounded-md bg-gradient-to-b from-[#565b64] to-[#42464e] p-0 text-white shadow-[0_4px_0_#1c1f23] hover:bg-transparent';
	const loginButtonClass =
		'h-24 w-full rounded-lg border border-[#c94a14] bg-gradient-to-b from-[#ff7a3d] to-[#e4561a] pb-1.5 font-body text-[40px] font-bold tracking-[0.03em] text-white uppercase shadow-[0_6px_0_#8f3510,inset_0_1.5px_0_rgba(255,255,255,0.22)] hover:bg-transparent disabled:translate-y-0 disabled:border-[#c2c6cc] disabled:bg-[#d5d8dd] disabled:bg-none disabled:text-[#7e848d] disabled:shadow-none disabled:opacity-100 [&_svg.animate-spin]:size-10 [&_svg.animate-spin]:[stroke-width:2.5]';

	/** Touch-safe pressed look (CSS :active barely shows on a tap). */
	const eyePress = createHmiPress();
	const loginPress = createHmiPress();
	const idleChipPress = createHmiPress();

	function fieldClass(field: Field): string {
		const base = 'flex h-[88px] items-center gap-4 rounded-lg px-3';
		if (errorFields.includes(field)) {
			return `${base} border-3 border-[#ef4444] bg-[#f4f5f7] shadow-[0_0_0_5px_rgba(239,68,68,0.2),inset_0_4px_8px_rgba(0,0,0,0.16)]`;
		}
		if (isKeyboardOpen && activeField === field) {
			return `${base} border-3 border-[#ff6b2c] bg-white shadow-[0_0_0_5px_rgba(255,107,44,0.25),inset_0_4px_8px_rgba(0,0,0,0.16)]`;
		}
		return `${base} border-2 border-[#aeb4bd] bg-[#f4f5f7] shadow-[inset_0_4px_8px_rgba(0,0,0,0.16)]`;
	}

	function iconTileClass(field: Field): string {
		const base = 'flex size-16 shrink-0 items-center justify-center rounded-md text-white';
		if (errorFields.includes(field)) return `${base} bg-[#dc2626]`;
		if (isKeyboardOpen && activeField === field) return `${base} bg-[#ff6b2c]`;
		return `${base} bg-[#3a3e46]`;
	}

	function labelClass(field: Field): string {
		return `font-heading text-lg leading-[25px] font-bold tracking-[0.04em] uppercase ${
			errorFields.includes(field) ? 'text-[#dc2626]' : 'text-[#3f4550]'
		}`;
	}

	function clearError() {
		errorMessage = '';
		errorFields = [];
	}

	function parseOperators(result: unknown): OperatorRecord | undefined {
		if (!result || typeof result !== 'object' || 'error' in result) {
			return undefined;
		}

		return result as OperatorRecord;
	}

	async function loadOperators(): Promise<OperatorRecord | undefined> {
		const result = await globalMqtt.get<OperatorRecord>('operators');
		operators = parseOperators(result);
		return operators;
	}

	let {
		onlogin
	}: {
		onlogin?: (data: {
			user?: {
				name?: string;
				id?: string;
				code?: string;
			};
			operatorOid?: string;
		}) => void;
	} = $props();

	let username = $state('');
	let password = $state('');
	let errorMessage = $state('');
	/** Highlighted fields; the message renders under the last one. */
	let errorFields = $state<Field[]>([]);
	const errorMessageField = $derived(errorFields.at(-1) ?? null);
	let machineName = $state('');
	let keyboardLayout = $state<'letters' | 'symbols'>('letters');
	/** Credentials passed; the session (and 14001) starts only after the safety check. */
	let pendingOperator = $state<{ oid: string; name: string; code?: string } | null>(null);
	let startingShift = $state(false);
	let isLoading = $state(false);
	let showPassword = $state(false);
	let isKeyboardOpen = $state(true);
	let activeField = $state<'username' | 'password'>('username');
	let usernameInputRef = $state<HTMLInputElement | null>(null);
	let passwordInputRef = $state<HTMLInputElement | null>(null);
	let keyboardInputRef = $state<HTMLInputElement | null>(null);
	let keyboardTrayRef = $state<HTMLDivElement | null>(null);
	let operators = $state<OperatorRecord | undefined>();
	let wifiOverlayOpen = $state(false);
	let lastWifiTapAt = 0;
	let wifiTapCount = 0;

	const showIdleChip = $derived(hasIdleTaskBarChip());
	const idleTimer = $derived(formatIdleHmsParts(machineIdleStore.idleSeconds));
	const idleChipLabel = $derived(
		selectedOverlayAlert.label.length > 9
			? `${selectedOverlayAlert.label.slice(0, 9)}..`
			: selectedOverlayAlert.label
	);

	function onWifiIconTap() {
		const now = Date.now();
		wifiTapCount = now - lastWifiTapAt <= WIFI_TAP_GAP_MS ? wifiTapCount + 1 : 1;
		lastWifiTapAt = now;
		if (wifiTapCount >= WIFI_TAPS_TO_OPEN) {
			wifiTapCount = 0;
			lastWifiTapAt = 0;
			wifiOverlayOpen = true;
		}
	}

	function formatClockTime(date = new Date()) {
		return date.toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
	}

	let clockTime = $state(formatClockTime());

	const clockTimer = setInterval(() => {
		clockTime = formatClockTime();
	}, 1000);

	onMount(() => {
		openKeyboardFor('username');
		setTimeout(async () => {
			await loadOperators();
		}, 500);
		void loadMachineName();
	});

	async function loadMachineName() {
		try {
			const primary = extractPrimaryMachine(await globalMqtt.get('machineSettings'));
			machineName = primary?.assetCode ?? '';
		} catch (error) {
			console.error('Lockscreen: failed to read machineSettings', error);
		}
	}

	// Figma caret: fixed 4×44 orange bar, same size whether the field is empty or filled.
	$effect(() => {
		const carets = [usernameInputRef, passwordInputRef]
			.filter((input): input is HTMLInputElement => Boolean(input))
			.map((input) => hmiCaret(input));
		return () => carets.forEach((caret) => caret.destroy());
	});

	onDestroy(() => {
		clearInterval(clockTimer);
	});

	$effect(() => {
		if (!isKeyboardOpen) {
			return;
		}

		return clickOutside(
			() => [
				keyboardTrayRef,
				usernameInputRef,
				passwordInputRef,
				'input, label, [data-lockscreen-field], [data-keyboard-keep]'
			],
			() => closeKeyboard()
		);
	});

	async function startShift(safetyCheck: SafetyCheckResult) {
		const operator = pendingOperator;
		if (!operator || startingShift) return;
		startingShift = true;
		try {
			const session = await beginOperatorSession(operator.oid, { safetyCheck });
			switchOperator.isClicked = false;
			onlogin?.({
				user: { name: operator.name, id: operator.oid, code: operator.code },
				operatorOid: session.oid
			});
		} catch (error) {
			console.error('Failed to start operator session', error);
		} finally {
			startingShift = false;
		}
	}

	function closeKeyboard() {
		isKeyboardOpen = false;
		usernameInputRef?.blur();
		passwordInputRef?.blur();
	}

	function openKeyboardFor(field: 'username' | 'password') {
		activeField = field;
		keyboardInputRef = field === 'username' ? usernameInputRef : passwordInputRef;
		isKeyboardOpen = true;
		keyboardInputRef?.focus();
	}

	function onKeyboardDone() {
		if (activeField === 'username') {
			openKeyboardFor('password');
			return;
		}

		closeKeyboard();
		void login();
	}

	function getUsername(): string {
		return (usernameInputRef?.value ?? username).trim();
	}

	function getPassword(): string {
		return passwordInputRef?.value ?? password;
	}

	async function ensureOperators(): Promise<OperatorRecord | undefined> {
		const loginUsername = getUsername();
		if (operators && typeof operators === 'object') {
			const operatorsLower = Object.keys(operators).map((key) => key.toLowerCase());
			if (operatorsLower.includes(loginUsername.toLowerCase())) {
				return operators;
			}
		}

		operators = await loadOperators();
		return operators;
	}

	async function login() {
		if (isLoading) return;
		clearError();

		const loginUsername = getUsername();
		const loginPassword = getPassword();

		if (!loginUsername) {
			errorMessage = 'Please enter your user ID';
			errorFields = ['username'];
			return;
		}

		if (!loginPassword.trim()) {
			errorMessage = 'Please enter your password';
			errorFields = ['password'];
			return;
		}

		if (!window.Worker) {
			errorMessage = 'Login is unavailable on this device';
			errorFields = ['username', 'password'];
			return;
		}

		isLoading = true;

		try {
			const operatorData = await ensureOperators();
			if (!operatorData || typeof operatorData !== 'object') {
				errorMessage = 'Unable to load operator credentials';
				errorFields = ['username', 'password'];
				isLoading = false;
				return;
			}

			const worker = new loginWorker();

			worker.onmessage = (event: MessageEvent) => {
				const { match, operatorOid, name, success, reason } = event.data as {
					match?: boolean;
					operatorOid?: string;
					name?: string;
					success?: boolean;
					reason?: string;
				};

				if (success && match && operatorOid) {
					pendingOperator = {
						oid: operatorOid,
						name: name?.split(' ')[0] || loginUsername,
						code: loginUsername
					};
					closeKeyboard();
					isLoading = false;
					worker.terminate();
					return;
				} else {
					errorMessage = reason || 'Wrong user ID or password. Please try again.';
					errorFields = ['username', 'password'];
				}

				isLoading = false;
				worker.terminate();
			};

			worker.onerror = (err) => {
				console.error('Worker error:', err);
				errorMessage = 'An error occurred while logging in';
				errorFields = ['username', 'password'];
				isLoading = false;
				worker.terminate();
			};

			worker.postMessage(
				JSON.parse(
					JSON.stringify({
						operatorId: loginUsername,
						password: loginPassword,
						operators: operatorData
					})
				)
			);
		} catch (error) {
			console.error('Error while attempting to login: ', error);
			errorMessage = 'Unable to sign in. Please try again.';
			errorFields = ['username', 'password'];
			isLoading = false;
		}
	}
</script>

<div class="fixed inset-0 z-[100] flex h-full min-h-0 w-full bg-white font-body">
	<div class="h-full w-1/2 min-w-0 shrink-0 overflow-hidden">
		<img src={osBg} alt="" class="h-full w-full object-cover object-[30%_75%]" />
	</div>

	<div class="relative flex h-full min-w-0 flex-1 flex-col items-center bg-white">
		{#if !isKeyboardOpen}
			<div class="absolute top-[28px] right-[30px] flex items-center gap-3">
				{#if showIdleChip}
					<!-- A small keycap (like the flat buttons) so the operator sees it can be tapped. -->
					<button
						type="button"
						class="text-heading flex h-11 shrink-0 cursor-pointer flex-col rounded-[9px] p-0 font-heading select-none touch-manipulation [-webkit-tap-highlight-color:transparent] {idleChipPress.pressed
							? 'pt-1'
							: 'bg-[#9aa1aa] pb-1'}"
						aria-label="Open Machine Idle — {selectedOverlayAlert.label}"
						title="{selectedOverlayAlert.label} · {idleTimer.hours}:{idleTimer.minutes}:{idleTimer.seconds}"
						{...idleChipPress.handlers}
						onclick={() => reopenMachineIdleOverlay()}
					>
						<span
							class="flex min-h-0 flex-1 items-center gap-2 rounded-[9px] border border-[#c3c8cf] pr-1.5 pl-1.5 {idleChipPress.pressed
								? 'bg-[#d9dde2] shadow-[inset_0_2px_4px_rgba(0,0,0,0.25)]'
								: 'bg-gradient-to-b from-[#f7f8f9] to-[#e4e7eb]'}"
						>
							<span
								class="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary font-heading text-xs font-bold text-white"
							>
								{selectedOverlayAlertBadge()}
							</span>
							<span class="font-heading text-base font-medium whitespace-nowrap">
								{idleChipLabel}
							</span>
							<span class="flex items-center gap-1">
								<span
									class="flex w-9 items-center justify-center rounded-lg bg-primary py-1 font-body text-sm font-semibold text-white tabular-nums"
								>
									{idleTimer.hours}
								</span>
								<span
									class="flex w-9 items-center justify-center rounded-lg bg-primary py-1 font-body text-sm font-semibold text-white tabular-nums"
								>
									{idleTimer.minutes}
								</span>
								<span
									class="flex w-9 items-center justify-center rounded-lg bg-primary py-1 font-body text-sm font-semibold text-white tabular-nums"
								>
									{idleTimer.seconds}
								</span>
							</span>
						</span>
					</button>
				{/if}
				<InterlockIndicator />
				<span class="font-heading text-base leading-[22px] font-medium text-[#1b2028]">
					{clockTime}
				</span>
				<NetworkStatusIcon class="size-[25px] text-[#1b2028]" onclick={onWifiIconTap} />
			</div>
		{/if}

		{#if pendingOperator}
			<div class="w-full px-12 pt-[72px]">
				<SafetyCheck loading={startingShift} onstart={startShift} />
			</div>
		{:else}
			<form
				autocomplete="off"
				class="flex w-[522px] max-w-full flex-col {isKeyboardOpen ? 'pt-6' : 'pt-[60px]'}"
				onsubmit={(event) => {
					event.preventDefault();
					void login();
				}}
			>
				{#if !isKeyboardOpen}
					<p
						class="m-0 h-[131px] truncate text-center font-heading text-[96px] leading-[131px] font-bold text-[#e95b1f]"
					>
						{machineName}
					</p>
					<div
						class="mt-[11px] text-center font-body text-[30px] leading-[1.45] font-bold text-[#1b2028]"
					>
						<p class="m-0">A safe shift is a successful shift.</p>
						<p class="m-0">Stay sharp. Stay safe.</p>
					</div>
				{/if}

				<div
					class="flex flex-col {isKeyboardOpen ? 'gap-[13px]' : 'mt-[29px] gap-[25px]'}"
					data-lockscreen-field
				>
					<div class="flex flex-col gap-2.5">
						<Label for="username" text="User ID" class={labelClass('username')} />
						<div class={fieldClass('username')}>
							<div class={iconTileClass('username')}>
								<User class="size-8 [stroke-width:2.5]" />
							</div>
							<Input
								id="username"
								bind:ref={usernameInputRef}
								bind:value={username}
								placeholder="Enter user ID"
								autocomplete="off"
								autocapitalize="none"
								autocorrect="off"
								spellcheck="false"
								inputmode="none"
								disabled={isLoading}
								class={inputClass}
								onfocus={() => openKeyboardFor('username')}
								onclick={() => openKeyboardFor('username')}
								oninput={clearError}
							/>
						</div>
						{#if errorMessageField === 'username'}
							<p
								class="m-0 font-heading text-lg leading-[25px] font-medium text-[#dc2626]"
								aria-live="polite"
							>
								{errorMessage}
							</p>
						{/if}
					</div>

					<div class="flex flex-col gap-2.5">
						<Label for="password" text="Password" class={labelClass('password')} />
						<div class={fieldClass('password')}>
							<div class={iconTileClass('password')}>
								<Lock class="size-8 [stroke-width:2.5]" />
							</div>
							<Input
								id="password"
								type={showPassword ? 'text' : 'password'}
								bind:ref={passwordInputRef}
								bind:value={password}
								placeholder="Enter password"
								autocomplete="off"
								inputmode="none"
								disabled={isLoading}
								class={inputClass}
								onfocus={() => openKeyboardFor('password')}
								onclick={() => openKeyboardFor('password')}
								oninput={clearError}
							/>
							<Button
								variant="ghost"
								size="icon"
								icon={showPassword ? Eye : EyeOff}
								iconClass="size-8 [stroke-width:2.5]"
								class="{eyeButtonClass} {eyePress.pressed ? 'translate-y-1 shadow-none' : ''}"
								{...eyePress.handlers}
								aria-label={showPassword ? 'Hide password' : 'Show password'}
								data-keyboard-keep
								onmousedown={(event: MouseEvent) => event.preventDefault()}
								onclick={() => (showPassword = !showPassword)}
							/>
						</div>
						{#if errorMessageField === 'password'}
							<p
								class="m-0 font-heading text-lg leading-[25px] font-medium text-[#dc2626]"
								aria-live="polite"
							>
								{errorMessage}
							</p>
						{/if}
					</div>

					{#if errorMessage && !errorMessageField}
						<p
							class="m-0 font-heading text-lg leading-[25px] font-medium text-[#dc2626]"
							aria-live="polite"
						>
							{errorMessage}
						</p>
					{/if}

					{#if !isKeyboardOpen}
						<Button
							type="submit"
							variant="primary"
							size="lg"
							label="Log in"
							loading={isLoading}
							disabled={isLoading}
							class="{errorMessage ? 'mt-[5px]' : 'mt-3'} {loginButtonClass} {loginPress.pressed &&
							!isLoading
								? 'translate-y-1.5 from-[#c24814] to-[#c24814] shadow-[inset_0_3px_6px_rgba(0,0,0,0.28)]'
								: ''}"
							{...loginPress.handlers}
						/>
					{/if}
				</div>
			</form>
		{/if}
	</div>

	{#if isKeyboardOpen && !pendingOperator}
		<div bind:this={keyboardTrayRef} data-keyboard-root class="fixed inset-x-0 bottom-0 z-[60]">
			<HmiKeyboard
				inputElement={keyboardInputRef}
				bind:layout={keyboardLayout}
				doneLabel={activeField === 'username' ? 'NEXT' : 'LOG IN'}
				loading={isLoading}
				onDone={onKeyboardDone}
			/>
		</div>
	{/if}
</div>

<WifiLockscreenOverlay open={wifiOverlayOpen} onclose={() => (wifiOverlayOpen = false)} />
