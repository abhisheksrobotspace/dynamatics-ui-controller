<script lang="ts">
	import { HmiButton, HmiNumpad } from '@ifactory/ui-v2';
	import { Lock, X } from '@lucide/svelte';

	/**
	 * HMI PIN prompt: masked entry, numpad, CANCEL. The caller checks the PIN in `onconfirm` and
	 * reports a wrong one through `error`; it closes the dialog by setting `open` to false.
	 */
	let {
		open,
		title,
		subtitle = 'Enter the supervisor PIN',
		error = '',
		busy = false,
		value = $bindable(''),
		onconfirm,
		oncancel
	}: {
		open: boolean;
		title: string;
		subtitle?: string;
		error?: string;
		busy?: boolean;
		value?: string;
		onconfirm: () => void;
		oncancel: () => void;
	} = $props();
</script>

{#if open}
	<div
		class="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 font-body text-[#1b2028]"
		role="presentation"
	>
		<div
			class="flex w-[900px] max-w-full gap-6 rounded-xl bg-white p-6 shadow-2xl"
			role="dialog"
			aria-modal="true"
			aria-label={title}
		>
			<div class="flex min-w-0 flex-1 flex-col gap-4">
				<div class="flex items-center gap-4">
					<span
						class="flex size-14 shrink-0 items-center justify-center rounded-[10px] bg-[#3a3e46] text-white"
					>
						<Lock class="size-8" strokeWidth={2.5} />
					</span>
					<div class="flex min-w-0 flex-1 flex-col">
						<p class="m-0 text-[28px] leading-9 font-bold uppercase">{title}</p>
						<p class="m-0 font-heading text-xl leading-7 font-medium text-[#5a616c]">{subtitle}</p>
					</div>
				</div>

				<div
					class="flex h-[88px] items-center justify-center rounded-lg text-[44px] font-bold tracking-[0.3em] {error
						? 'border-3 border-[#ef4444] bg-[#fef2f2]'
						: 'border-3 border-[#ff6b2c] bg-white shadow-[0_0_0_5px_rgba(255,107,44,0.25)]'}"
					aria-live="polite"
				>
					{#if value}
						{'•'.repeat(value.length)}
					{:else}
						<span class="font-heading text-2xl font-medium tracking-normal text-[#7e848d]">PIN</span
						>
					{/if}
				</div>
				<p class="m-0 min-h-7 font-heading text-xl leading-7 font-bold text-[#dc2626]">{error}</p>

				<HmiButton
					label="Cancel"
					icon={X}
					class="mt-auto w-full"
					disabled={busy}
					onclick={oncancel}
				/>
			</div>

			<HmiNumpad
				bind:value
				class="w-[440px] shrink-0"
				enterLabel={busy ? '…' : 'OK'}
				enterDisabled={busy || !value.trim()}
				disabled={busy}
				onEnter={onconfirm}
			/>
		</div>
	</div>
{/if}
