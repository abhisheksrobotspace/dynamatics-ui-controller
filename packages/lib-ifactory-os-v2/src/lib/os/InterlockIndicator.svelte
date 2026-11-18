<script lang="ts">
	import { Lock, LockOpen } from '@lucide/svelte';
	import { hasInterlockTaskBarChip, interlockStore } from './interlock/interlock-store.svelte';

	/**
	 * Interlock state as a padlock: closed (green) while the interlock is on, open (red) while it
	 * is off. Hidden when the interlock feature is not enabled for the machine.
	 */
	let { class: className = '' }: { class?: string } = $props();

	const show = $derived(hasInterlockTaskBarChip());
	const locked = $derived(interlockStore.isActive || interlockStore.isOn);
	const label = $derived(locked ? 'Interlock on' : 'Interlock off');
</script>

{#if show}
	<span
		class="flex shrink-0 items-center {locked ? 'text-[#1F7A3A]' : 'text-[#C62828]'} {className}"
		role="img"
		aria-label={label}
		title={label}
	>
		{#if locked}
			<Lock class="size-6" strokeWidth={2.5} aria-hidden="true" />
		{:else}
			<LockOpen class="size-6" strokeWidth={2.5} aria-hidden="true" />
		{/if}
	</span>
{/if}
