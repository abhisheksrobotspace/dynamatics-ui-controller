<script lang="ts" module>
	/** Operator log out, from the dock menu and the job summary — one wording for both. */
	export const LOGOUT_CONFIRM = {
		title: 'Log out of this machine?',
		message: 'The next operator signs in with their own ID.',
		confirmLabel: 'Log out'
	};
</script>

<script lang="ts">
	import { HmiFlatButton, type HmiTone } from '@ifactory/ui-v2';
	import { LogOut, X } from '@lucide/svelte';
	import type { Component } from 'svelte';

	/** HMI confirm step (ioware): flat keys like the job screens instead of the web dialog. */
	let {
		open,
		title,
		message = '',
		confirmLabel,
		cancelLabel = 'Cancel',
		icon = LogOut,
		tone = 'stop',
		onConfirm,
		onCancel
	}: {
		open: boolean;
		title: string;
		message?: string;
		confirmLabel: string;
		cancelLabel?: string;
		icon?: Component<{ class?: string; strokeWidth?: number }>;
		tone?: HmiTone;
		onConfirm: () => void;
		onCancel: () => void;
	} = $props();

	const Icon = $derived(icon);
</script>

{#if open}
	<div
		class="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 font-body text-[#1b2028]"
		role="presentation"
		onclick={(event) => event.target === event.currentTarget && onCancel()}
	>
		<div
			class="flex w-[760px] max-w-full flex-col gap-6 rounded-xl bg-white p-7 shadow-2xl"
			role="alertdialog"
			aria-modal="true"
			aria-label={title}
		>
			<div class="flex items-center gap-4">
				<span
					class="flex size-14 shrink-0 items-center justify-center rounded-[10px] text-white {tone ===
					'stop'
						? 'bg-[#e23b2e]'
						: 'bg-[#3a3e46]'}"
				>
					<Icon class="size-8" strokeWidth={2.5} />
				</span>
				<div class="flex min-w-0 flex-col">
					<p class="m-0 text-[30px] leading-[38px] font-bold">{title}</p>
					{#if message}
						<p class="m-0 font-heading text-xl leading-7 font-medium text-[#5a616c]">{message}</p>
					{/if}
				</div>
			</div>
			<div class="grid grid-cols-2 gap-4">
				<HmiFlatButton label={cancelLabel} icon={X} size="md" onclick={onCancel} />
				<HmiFlatButton label={confirmLabel} {icon} {tone} size="md" onclick={onConfirm} />
			</div>
		</div>
	</div>
{/if}
