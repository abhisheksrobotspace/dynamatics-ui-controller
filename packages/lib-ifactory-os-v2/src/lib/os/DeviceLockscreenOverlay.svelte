<script lang="ts">
	import { HmiFlatButton } from '@ifactory/ui-v2';
	import { X } from '@lucide/svelte';
	import DeviceApp from '../../device-app/routes/App.svelte';

	let {
		open = false,
		onclose
	}: {
		open?: boolean;
		onclose?: () => void;
	} = $props();
</script>

{#if open}
	<div
		class="fixed inset-0 z-[112] flex min-h-0 flex-col bg-white font-body text-[#1b2028]"
		role="dialog"
		aria-modal="true"
		aria-label="About Device"
	>
		<div
			class="flex shrink-0 items-center gap-4 border-b border-[#dde1e5] px-[30px] pt-3 pb-[17px]"
		>
			<h1 class="m-0 flex-1 text-[32px] leading-[41px] font-bold">About Device</h1>
			<HmiFlatButton
				size="xs"
				icon={X}
				iconClass="size-8"
				class="size-[72px] shrink-0"
				aria-label="Close About Device"
				onclick={() => onclose?.()}
			/>
		</div>

		<div class="min-h-0 flex-1">
			<DeviceApp embedded />
		</div>
	</div>
{/if}
