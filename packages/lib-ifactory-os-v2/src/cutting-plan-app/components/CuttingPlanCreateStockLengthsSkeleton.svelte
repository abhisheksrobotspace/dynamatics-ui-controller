<script lang="ts">
	import { Skeleton } from '@ifactory/ui-v2';

	type Props = {
		sectionCount?: number;
		class?: string;
	};

	let { sectionCount = 5, class: className = '' }: Props = $props();
</script>

<div
	class="flex h-full min-h-0 flex-col overflow-hidden {className}"
	aria-busy="true"
	role="status"
>
	<span class="sr-only">Loading stock length selection</span>

	<div class="shrink-0 space-y-4 border-b border-border px-4 py-4">
		<div class="flex flex-wrap items-center gap-3">
			<Skeleton class="h-9 min-w-60 flex-1 max-w-md" />
			<Skeleton class="h-8 w-24" />
			<Skeleton class="h-8 w-24" />
			<Skeleton class="h-8 w-24" />
			<Skeleton class="h-8 w-24" />
			<Skeleton class="ml-auto h-8 w-32" />
		</div>
		<Skeleton class="h-14 w-full" />
	</div>

	<div class="min-h-0 flex-1 space-y-3 overflow-auto px-4 py-4">
		{#each Array.from({ length: sectionCount }, (_, i) => i) as index (index)}
			<div class="overflow-hidden rounded-none border border-border bg-surface">
				<div class="flex items-center gap-4 px-4 py-3">
					<Skeleton class="size-4 shrink-0" />
					<Skeleton class="size-4 shrink-0" />
					<div class="min-w-0 flex-1 space-y-1">
						<Skeleton class="h-5 w-40" />
						<Skeleton class="h-4 w-24" />
					</div>
					<Skeleton class="h-5 w-20" />
					<Skeleton class="hidden h-4 w-36 sm:block" />
				</div>
			</div>
		{/each}
	</div>

	<div
		class="sticky bottom-0 flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border bg-surface px-4 py-3"
	>
		<div class="flex items-center gap-2">
			<Skeleton class="size-2 shrink-0 rounded-full" />
			<Skeleton class="h-4 w-56" />
		</div>
		<div class="flex flex-wrap items-center gap-2">
			<Skeleton class="h-8 w-24" />
			<Skeleton class="h-8 w-36" />
		</div>
	</div>
</div>
