<script lang="ts">
	import { onDestroy } from 'svelte';
	import { Input } from '@ifactory/ui-v2';
	import osBg from '$lib/assets/os_bg.jpeg';
	import { Eye, EyeOff } from '@lucide/svelte';

	import { AUTH_END_POINT } from '$lib/index.js';

	let {
		onlogin
	}: {
		onlogin?: (data: {
			user?: {
				name?: string;
				email?: string;
				image?: string;
				mustChangePassword?: boolean;
			};
			password?: string;
		}) => void;
	} = $props();

	let email = $state('');
	let password = $state('');
	let errorMessage = $state('');
	let isLoading = $state(false);
	let showPassword = $state(false);

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

	async function login() {
		errorMessage = '';

		if (!email || !email.trim()) {
			errorMessage = 'Please enter your email';
			return;
		}

		if (!password || !password.trim()) {
			errorMessage = 'Please enter your password';
			return;
		}

		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(email)) {
			errorMessage = 'Please enter a valid email address';
			return;
		}

		isLoading = true;

		try {
			const response = await fetch(AUTH_END_POINT + 'sign-in/email', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Accept: 'application/json'
				},
				credentials: 'include',
				body: JSON.stringify({ email, password })
			});

			const data = await response.json().catch(() => null);

			if (!response.ok) {
				errorMessage =
					data?.message || data?.error?.message || data?.error || 'Invalid email or password';
				return;
			}

			if (onlogin) {
				const payload = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
				onlogin({
					user: payload.user as
						| {
								name?: string;
								email?: string;
								image?: string;
								mustChangePassword?: boolean;
						  }
						| undefined,
					password
				});
			}
		} catch (error) {
			console.error('Error while attempting to login: ', error);
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
					Login to iFactory OS
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
						login();
					}}
				>
					<label class="sr-only" for="email">Email</label>
					<div class="relative">
						<Input
							id="email"
							type="email"
							bind:value={email}
							placeholder="Email"
							autocomplete="email"
							autocapitalize="none"
							autocorrect="off"
							spellcheck="false"
							disabled={isLoading}
							oninput={() => (errorMessage = '')}
							class={getInputClasses()}
						/>
					</div>

					<label class="sr-only" for="password">Password</label>
					<div class="relative">
						<Input
							id="password"
							type={showPassword ? 'text' : 'password'}
							bind:value={password}
							oninput={() => (errorMessage = '')}
							placeholder="Enter Password"
							autocomplete="current-password"
							disabled={isLoading}
							class={getInputClasses()}
						/>

						<div class="absolute inset-y-0 right-2 flex items-center gap-1">
							<button
								type="button"
								class="flex h-8 w-8 items-center justify-center rounded-full text-white/70 hover:text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
								onclick={() => (showPassword = !showPassword)}
								aria-label={showPassword ? 'Hide password' : 'Show password'}
							>
								{#if showPassword}
									<Eye class="h-4 w-4" strokeWidth={2} />
								{:else}
									<EyeOff class="h-4 w-4" strokeWidth={2} />
								{/if}
							</button>

							<button
								type="submit"
								class="flex h-8 w-8 items-center justify-center rounded-full disabled:opacity-70 focus:outline-none focus:ring-1 focus:ring-orange-500"
								disabled={isLoading}
								aria-label="Login"
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

				<!-- <a
					class="font-spacegrotesk text-sm text-white/75 underline-offset-4 transition hover:text-white hover:underline"
					href="{base}/forgot-password"
				>
					Forgot password?
				</a> -->
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
