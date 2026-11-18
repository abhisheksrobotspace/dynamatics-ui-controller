<script lang="ts">
	import { onDestroy } from 'svelte';
	import { Input } from '@ifactory/ui-v2';
	import { ApiError, apiClient } from '$lib/index.js';
	import osBg from '$lib/assets/os_bg.jpeg';
	import { Eye, EyeOff } from '@lucide/svelte';

	let {
		currentPassword: initialCurrentPassword = '',
		oncomplete
	}: {
		currentPassword?: string;
		oncomplete?: () => void;
	} = $props();

	let currentPassword = $state(initialCurrentPassword);
	let newPassword = $state('');
	let confirmPassword = $state('');
	let errorMessage = $state('');
	let isLoading = $state(false);
	let showCurrentPassword = $state(false);
	let showNewPassword = $state(false);
	let showConfirmPassword = $state(false);

	function formatTime(date: Date = new Date()) {
		return date.toLocaleString('en-IN', {
			hour: '2-digit',
			minute: '2-digit',
			hour12: false,
			day: '2-digit',
			month: 'short',
			year: 'numeric'
		});
	}

	let currentTime = $state(formatTime());

	function getInputClasses() {
		return `lockscreen-input font-spacegrotesk h-12 rounded-xl bg-white/20 text-base font-medium text-white selection:bg-white/20 selection:text-white placeholder:text-white/80 border-0 ${
			errorMessage
				? 'ring-1 ring-red-500 focus-visible:ring-0'
				: 'focus-visible:ring-1 focus-visible:ring-orange-500'
		} [&:-webkit-autofill]:text-white [&:-webkit-autofill]:[-webkit-text-fill-color:white] [&:-webkit-autofill]:[box-shadow:inset_0_0_0_1000px_rgba(255,255,255,0.2)] [&:-webkit-autofill]:[transition:background-color_9999s_ease-in-out_0s] [&:-webkit-autofill]:caret-white [&_input:-webkit-autofill]:text-white [&_input:-webkit-autofill]:[-webkit-text-fill-color:white] [&_input:-webkit-autofill]:[box-shadow:inset_0_0_0_1000px_rgba(255,255,255,0.2)] [&_input:-webkit-autofill]:[transition:background-color_9999s_ease-in-out_0s] [&_input:-webkit-autofill]:caret-white [&::selection]:bg-white/20 [&::selection]:text-white [&_input::selection]:bg-white/20 [&_input::selection]:text-white`;
	}

	const timer = setInterval(() => {
		currentTime = formatTime();
	}, 1000);

	onDestroy(() => {
		clearInterval(timer);
	});

	function clearError() {
		errorMessage = '';
	}

	async function submitSetPassword() {
		errorMessage = '';

		if (!currentPassword.trim()) {
			errorMessage = 'Please enter your current password';
			return;
		}

		if (!newPassword.trim()) {
			errorMessage = 'Please enter a new password';
			return;
		}

		if (newPassword !== confirmPassword) {
			errorMessage = 'New password and confirm password do not match';
			return;
		}

		if (newPassword === currentPassword) {
			errorMessage = 'Your new password must be different from your current password.';
			return;
		}

		isLoading = true;

		try {
			await apiClient.post(apiClient.v1('users/password/rotate'), {
				currentPassword,
				newPassword
			});
			oncomplete?.();
		} catch (error) {
			if (error instanceof ApiError) {
				errorMessage = error.message;
				return;
			}
			errorMessage = 'Network error. Please check your connection';
		} finally {
			isLoading = false;
		}
	}
</script>

<div class="relative min-h-screen overflow-x-hidden overflow-y-auto bg-[#222222] text-white">
	<img src={osBg} alt="" class="absolute inset-0 h-full w-full object-cover -scale-x-100" />
	<div class="absolute inset-0 bg-[rgba(34,34,34,0.5)]"></div>
	<div class="absolute inset-0 backdrop-blur-[15px]" aria-hidden="true"></div>

	<div class="relative flex min-h-screen flex-col px-4 py-4 sm:px-6 sm:py-5">
		<div class="flex w-full items-center justify-center pt-2 sm:pt-4" aria-label="Time">
			<span class="font-spacegrotesk text-sm font-medium sm:text-lg text-white">{currentTime}</span>
		</div>

		<div class="flex flex-1 flex-col items-center justify-center">
			<div class="flex w-full max-w-[90vw] flex-col items-center text-center sm:max-w-[470px]">
				<h1
					class="font-spacegrotesk text-lg font-medium tracking-[0.01em] text-white sm:text-[24px]"
				>
					Set Password
				</h1>

				<div
					class="mt-6 flex h-[80px] w-[80px] items-center justify-center rounded-full sm:mt-10 sm:h-[100px] sm:w-[100px] lg:mt-[68px] lg:h-[120px] lg:w-[120px]"
				>
					<img src="/assets/icons/user.svg" alt="user" />
				</div>

				<form
					class="mt-8 flex w-full max-w-full flex-col gap-[14px] sm:max-w-[350px] md:mt-16"
					onsubmit={(event) => {
						event.preventDefault();
						submitSetPassword();
					}}
				>
					<label class="sr-only" for="current-password">Current password</label>
					<div class="relative">
						<Input
							id="current-password"
							type={showCurrentPassword ? 'text' : 'password'}
							bind:value={currentPassword}
							oninput={clearError}
							placeholder="Current Password"
							autocomplete="current-password"
							disabled={isLoading}
							class={getInputClasses()}
						/>
						<button
							type="button"
							class="absolute inset-y-0 right-2 my-auto flex h-8 w-8 items-center justify-center rounded-full text-white/70 hover:text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
							onclick={() => (showCurrentPassword = !showCurrentPassword)}
							aria-label={showCurrentPassword ? 'Hide current password' : 'Show current password'}
						>
							{#if showCurrentPassword}
								<Eye class="h-4 w-4" strokeWidth={2} />
							{:else}
								<EyeOff class="h-4 w-4" strokeWidth={2} />
							{/if}
						</button>
					</div>

					<label class="sr-only" for="new-password">New password</label>
					<div class="relative">
						<Input
							id="new-password"
							type={showNewPassword ? 'text' : 'password'}
							bind:value={newPassword}
							oninput={clearError}
							placeholder="New Password"
							autocomplete="new-password"
							disabled={isLoading}
							class={getInputClasses()}
						/>
						<button
							type="button"
							class="absolute inset-y-0 right-2 my-auto flex h-8 w-8 items-center justify-center rounded-full text-white/70 hover:text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
							onclick={() => (showNewPassword = !showNewPassword)}
							aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
						>
							{#if showNewPassword}
								<Eye class="h-4 w-4" strokeWidth={2} />
							{:else}
								<EyeOff class="h-4 w-4" strokeWidth={2} />
							{/if}
						</button>
					</div>

					<label class="sr-only" for="confirm-password">Confirm password</label>
					<div class="relative">
						<Input
							id="confirm-password"
							type={showConfirmPassword ? 'text' : 'password'}
							bind:value={confirmPassword}
							oninput={clearError}
							placeholder="Confirm Password"
							autocomplete="new-password"
							disabled={isLoading}
							class={getInputClasses()}
						/>
						<div class="absolute inset-y-0 right-2 flex items-center gap-1">
							<button
								type="button"
								class="flex h-8 w-8 items-center justify-center rounded-full text-white/70 hover:text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
								onclick={() => (showConfirmPassword = !showConfirmPassword)}
								aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
							>
								{#if showConfirmPassword}
									<Eye class="h-4 w-4" strokeWidth={2} />
								{:else}
									<EyeOff class="h-4 w-4" strokeWidth={2} />
								{/if}
							</button>

							<button
								type="submit"
								class="flex h-8 w-8 items-center justify-center rounded-full disabled:opacity-70 focus:outline-none focus:ring-1 focus:ring-orange-500"
								disabled={isLoading}
								aria-label="Set password"
							>
								<img
									src="/assets/icons/submit-arrow.svg"
									alt="submit"
									class="h-5 w-5 transition-transform hover:scale-105"
								/>
							</button>
						</div>
					</div>
				</form>

				<div
					class="mt-4 flex min-h-[24px] items-center gap-2 transition-opacity duration-200 {errorMessage
						? 'opacity-100'
						: 'invisible opacity-0'}"
					aria-live="polite"
				>
					<img src="/assets/icons/x.svg" alt="x" class="h-6 w-6 shrink-0" />
					<p class="font-spacegrotesk max-w-full text-sm text-[#ffd5c2] sm:max-w-[350px]">
						{errorMessage}
					</p>
				</div>
			</div>
		</div>

		<div class="mt-auto flex flex-col items-center justify-center pt-8 pb-4 opacity-90">
			<p class="font-spacegrotesk mb-2 text-xs text-white/70 sm:mb-3 sm:text-sm">Powered by</p>
			<img
				src="/assets/icons/full-logo-light.svg"
				alt="Robotspace"
				class="h-7 w-auto max-w-[min(90vw,260px)] object-contain sm:h-9 md:max-w-[min(85vw,300px)]"
			/>
		</div>
	</div>
</div>
