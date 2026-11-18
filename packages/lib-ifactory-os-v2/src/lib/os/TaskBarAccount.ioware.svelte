<script lang="ts">
	import { HmiFlatButton } from '@ifactory/ui-v2';
	import { LogOut } from '@lucide/svelte';

	/* HMI account menu: orange initials avatar; tapping it opens "Logged in as" with a LOGOUT key beside the dock. */
	let { name, onLogout }: { name: string; onLogout: () => void } = $props();

	let open = $state(false);
	let root = $state<HTMLDivElement | null>(null);

	const initials = $derived.by(() => {
		const words = name.trim().split(/\s+/).filter(Boolean);
		if (words.length >= 2) return (words[0]![0]! + words[1]![0]!).toUpperCase();
		return (words[0] ?? '?').slice(0, 2).toUpperCase();
	});

	function onWindowPointerDown(event: PointerEvent) {
		if (open && root && !root.contains(event.target as Node)) open = false;
	}

	function logout() {
		open = false;
		onLogout();
	}
</script>

<svelte:window
	onpointerdown={onWindowPointerDown}
	onkeydown={(event) => {
		if (event.key === 'Escape') open = false;
	}}
/>

<div class="relative" bind:this={root}>
	<button
		type="button"
		class="flex size-12 cursor-pointer items-center justify-center rounded-full border-3 border-white bg-[#f26b2a] p-0 font-body text-lg leading-none font-bold text-white select-none [-webkit-tap-highlight-color:transparent] {open
			? 'ring-3 ring-[#f26b2a]/50'
			: ''}"
		aria-haspopup="dialog"
		aria-expanded={open}
		aria-label="Account: {name}"
		onclick={() => (open = !open)}
	>
		{initials}
	</button>

	{#if open}
		<div
			class="absolute bottom-0 left-[calc(100%+16px)] z-50 flex w-[300px] flex-col gap-1 rounded-xl border-2 border-[#c3c8cf] bg-white p-5 font-body text-[#1b2028] shadow-[0_8px_24px_rgba(0,0,0,0.18)]"
			role="dialog"
			aria-label="Account"
		>
			<p class="m-0 font-heading text-xl leading-[26px] font-medium text-[#4a505a]">Logged in as</p>
			<p class="m-0 truncate text-[28px] leading-9 font-bold" title={name}>{name}</p>
			<HmiFlatButton
				label="Logout"
				icon={LogOut}
				tone="stop"
				size="sm"
				class="mt-3 h-[90px] w-full"
				faceClass="text-[26px] tracking-[1.1px] uppercase"
				iconClass="size-[30px]"
				onclick={logout}
			/>
		</div>
	{/if}
</div>
