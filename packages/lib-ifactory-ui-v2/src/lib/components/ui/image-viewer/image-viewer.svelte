<script lang="ts">
	import { EmptyState } from '$lib/components/ui/empty-state';
	import ImageFrame from './image-frame.svelte';
	import type { ImageViewerProps } from './image-viewer.types';
	import { imageViewerRootClass } from './image-viewer.styles';
	import { wrapIndex } from './image-viewer.utils';

	let {
		items = [],
		index = $bindable(0),
		onError,
		onClose,
		variant = 'default',
		class: className = ''
	}: ImageViewerProps = $props();

	const count = $derived(items.length);
	const safeIndex = $derived(count === 0 ? 0 : Math.min(Math.max(index, 0), count - 1));
	const current = $derived(items[safeIndex]);

	function step(delta: number): void {
		index = wrapIndex(index, count, delta);
	}
</script>

{#if current}
	{#key `${safeIndex}:${current.src}:${current.id ?? ''}`}
		<ImageFrame
			item={current}
			index={safeIndex}
			{count}
			onPrevious={() => step(-1)}
			onNext={() => step(1)}
			{onError}
			{onClose}
			{variant}
			class={className}
		/>
	{/key}
{:else}
	<div class={imageViewerRootClass(className)}>
		<EmptyState title="No image" />
	</div>
{/if}
