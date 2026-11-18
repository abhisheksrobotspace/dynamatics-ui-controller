<script lang="ts">
	import { Skeleton } from '@ifactory/ui-v2';

	type Props = {
		/** Toolbar action button placeholders (exclude search + summary). */
		actionCount?: number;
		class?: string;
	};

	let { actionCount = 5, class: className = '' }: Props = $props();
</script>

<div class="shrink-0 space-y-4 border-b border-border px-4 py-4 {className}">
	<div class="flex flex-wrap items-center gap-3">
		<Skeleton class="h-9 min-w-[240px] max-w-md flex-1" />
		{#each Array.from({ length: actionCount }, (_, i) => i) as index (index)}
			<Skeleton class="h-8 {index === actionCount - 1 ? 'w-8' : 'w-24'}" />
		{/each}
		<Skeleton class="ml-auto h-4 w-48" />
	</div>
</div>
