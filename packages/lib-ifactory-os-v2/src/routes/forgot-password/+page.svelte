<script lang="ts">
	import { goto } from '$app/navigation';
	import { AUTH_END_POINT } from '$lib/index.js';
	import osBg from '$lib/assets/os_bg.jpeg';
	import { Input } from '@ifactory/ui-v2';
	import { onDestroy } from 'svelte';
	import { base } from '$app/paths';

	let email = $state('');
	let errorMessage = $state('');
	let successMessage = $state('');
	let isSubmitting = $state(false);

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

	const timer = setInterval(() => {
		currentTime = formatTime();
	}, 1000);

	onDestroy(() => {
		clearInterval(timer);
	});

	function validateEmail(value: string) {
		return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
	}

	async function submitForgotPassword() {
		errorMessage = '';
		successMessage = '';

		const normalizedEmail = email.trim().toLowerCase();

		if (!normalizedEmail) {
			errorMessage = 'Please enter your email address.';
			return;
		}

		if (!validateEmail(normalizedEmail)) {
			errorMessage = 'Please enter a valid email address.';
			return;
		}

		isSubmitting = true;

		try {
			// Using Better Auth's standard endpoint for forget-password
			const response = await fetch(AUTH_END_POINT + 'forget-password', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Accept: 'application/json'
				},
				credentials: 'omit', // No session required to trigger password reset
				body: JSON.stringify({
					email: normalizedEmail,
					redirectTo: `${window.location.origin}${base}/reset-password`
				})
			});

			const payload = await response.json().catch(() => null);

			if (!response.ok) {
				errorMessage =
					payload?.message ||
					payload?.error?.message ||
					payload?.error ||
					'Unable to start password recovery. Please try again.';
				return;
			}

			successMessage =
				payload?.message ||
				'If that email exists in the system, a password reset link has been sent.';
			email = normalizedEmail;
		} catch (error) {
			console.error('Forgot password request failed:', error);
			errorMessage = 'Network error. Please check your connection and try again.';
		} finally {
			isSubmitting = false;
		}
	}

	function handleSubmit(event: Event) {
		event.preventDefault();
		submitForgotPassword();
	}

	function goToLogin() {
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		goto(base || '/');
	}
</script>

<div
	class="relative min-h-screen overflow-hidden bg-[#222222] text-white"
	style={`background-image: linear-gradient(rgba(34,34,34,0.5), rgba(34,34,34,0.5)), url(${osBg}); background-size: cover; background-position: center;`}
>
	<div class="absolute inset-0 backdrop-blur-[15px]" aria-hidden="true"></div>

	<div class="relative flex min-h-screen flex-col px-6 py-5">
		<div class="flex items-center justify-end gap-3 text-white">
			<span class="font-spacegrotesk text-lg font-medium">{currentTime}</span>
		</div>

		<div class="flex flex-1 flex-col items-center justify-center">
			<div class="flex w-full max-w-[420px] flex-col items-center text-center">
				<h1 class="font-spacegrotesk text-[24px] font-medium tracking-[0.01em] text-white">
					Reset your password
				</h1>

				<div class="relative mt-14 flex h-[170px] w-[170px] items-center justify-center">
					<img src="{base}/assets/icons/reset-password.svg" alt="Reset" />
				</div>

				<form class="mt-14 w-full" onsubmit={handleSubmit}>
					<label class="sr-only" for="email">Email</label>
					<div class="relative">
						<Input
							id="email"
							type="email"
							bind:value={email}
							placeholder="Enter email to recover password"
							autocapitalize="none"
							autocorrect="off"
							spellcheck="false"
							class="auth-autofill-input font-spacegrotesk h-12 rounded-xl border-0 bg-white/20 text-base font-medium text-white selection:bg-white/20 selection:text-white placeholder:text-white/80 focus-visible:ring-1 focus-visible:ring-orange-500 [&:-webkit-autofill]:text-white [&:-webkit-autofill]:[-webkit-text-fill-color:white] [&:-webkit-autofill]:[box-shadow:inset_0_0_0_1000px_transparent] [&:-webkit-autofill]:[transition:background-color_9999s_ease-in-out_0s] [&:-webkit-autofill]:caret-white [&_input:-webkit-autofill]:text-white [&_input:-webkit-autofill]:[-webkit-text-fill-color:white] [&_input:-webkit-autofill]:[box-shadow:inset_0_0_0_1000px_transparent] [&_input:-webkit-autofill]:[transition:background-color_9999s_ease-in-out_0s] [&_input:-webkit-autofill]:caret-white [&::selection]:bg-white/20 [&::selection]:text-white [&_input::selection]:bg-white/20 [&_input::selection]:text-white"
							disabled={isSubmitting}
						/>
						<button
							type="submit"
							class="absolute right-2 bottom-2.5 ml-3 flex h-7 w-7 items-center justify-center rounded-full transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-70"
							disabled={isSubmitting}
							aria-label="Send password reset email"
						>
							<img src="{base}/assets/icons/submit-arrow.svg" alt="submit" />
						</button>
					</div>
				</form>

				{#if errorMessage}
					<p class="font-spacegrotesk mt-4 text-sm text-[#ffd5c2]">{errorMessage}</p>
				{/if}

				{#if successMessage}
					<p class="font-spacegrotesk mt-4 text-sm text-white/90">{successMessage}</p>
				{/if}

				<button
					type="button"
					class="font-spacegrotesk mt-6 text-sm text-white/75 underline-offset-4 transition hover:text-white hover:underline"
					onclick={goToLogin}
				>
					Back to login
				</button>
			</div>
		</div>

		<div class="relative flex flex-col items-center justify-center pb-6 opacity-50">
			<img src="{base}/assets/icons/rs-reset-logo.svg" alt="RS" />
		</div>
	</div>
</div>
