<script lang="ts">
	import { Info, Package } from '@lucide/svelte';
	import type { ScheduledJob } from '$lib/gantt/aps-types';

	type Props = {
		x: number;
		y: number;
		job: ScheduledJob;
		onSelect?: (action: string) => void;
		onClose?: () => void;
	};

	let { x, y, job, onSelect, onClose }: Props = $props();

	function handleAction(action: string) {
		onSelect?.(action);
		onClose?.();
	}
</script>

<div
	class="fixed z-50 min-w-[160px] border border-border bg-surface p-1 shadow-md"
	style:top="{y}px"
	style:left="{x}px"
	role="menu"
	tabindex="-1"
	aria-label={job.order_number}
>
	<button
		type="button"
		class="flex w-full cursor-pointer items-center gap-2 px-2 py-1.5 text-left text-sm hover:bg-foreground/5"
		onclick={() => handleAction('properties')}
	>
		<Info class="size-4" />
		Job Properties
	</button>
	<button
		type="button"
		class="flex w-full cursor-pointer items-center gap-2 px-2 py-1.5 text-left text-sm hover:bg-foreground/5"
		onclick={() => handleAction('move_task')}
	>
		<Package class="size-4" />
		Move Task
	</button>
</div>

<button
	type="button"
	class="fixed inset-0 z-40 cursor-default bg-transparent"
	aria-label="Close menu"
	onclick={onClose}
></button>
