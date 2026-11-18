<script lang="ts">
	import { Loader2 } from '@lucide/svelte';

	let {
		open = false,
		title = 'Loading',
		description = '',
		class: className = ''
	}: {
		open?: boolean;
		title?: string;
		description?: string;
		class?: string;
	} = $props();

	let anchorEl = $state<HTMLElement | null>(null);

	function findScrollContainer(from: HTMLElement | null): HTMLElement | null {
		let node: HTMLElement | null = from;
		while (node) {
			if (node.id.endsWith('-content')) return node;
			const { overflowY } = getComputedStyle(node);
			if (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') {
				return node;
			}
			node = node.parentElement;
		}
		return null;
	}

	$effect(() => {
		if (!open) return;

		const scrollEl = findScrollContainer(anchorEl);
		const prevOverflow = scrollEl?.style.overflow ?? '';
		if (scrollEl) scrollEl.style.overflow = 'hidden';

		return () => {
			if (scrollEl) scrollEl.style.overflow = prevOverflow;
		};
	});
</script>

<span bind:this={anchorEl} class="sr-only" aria-hidden="true"></span>

{#if open}
	<div
		class={['fixed inset-0 z-9999 flex items-center justify-center bg-gray-500/40 p-4', className]}
		role="dialog"
		aria-modal="true"
		aria-labelledby="app-busy-title"
		aria-busy="true"
	>
		<div class="w-full max-w-sm border border-border bg-white shadow-xl">
			<div class="border-b border-border px-6 py-4">
				<h2 id="app-busy-title" class="text-base font-semibold text-gray-900">{title}</h2>
			</div>
			<div class="flex flex-col items-center gap-4 px-6 py-6 text-center" role="status">
				<Loader2 class="size-8 animate-spin text-primary" aria-hidden="true" />
				{#if description}
					<p class="text-sm text-muted-foreground">{description}</p>
				{/if}
			</div>
		</div>
	</div>
{/if}
