<script lang="ts">
	import { Skeleton } from '@ifactory/ui-v2';

	type Props = {
		actionCount?: number;
		kpiCount?: number;
		sectionCount?: number;
		showInfoFooter?: boolean;
		class?: string;
	};

	let {
		actionCount = 4,
		kpiCount = 7,
		sectionCount = 5,
		showInfoFooter = false,
		class: className = ''
	}: Props = $props();
</script>

<div class="flex min-h-full flex-col {className}" aria-busy="true" role="status">
	<span class="sr-only">Loading cutting plan results</span>

	<div class="shrink-0 space-y-4 border-b border-border px-4 py-4">
		<div class="flex flex-wrap items-center justify-between gap-3">
			<Skeleton class="h-4 w-56" />
			<div class="flex flex-wrap items-center gap-2">
				{#each Array.from({ length: actionCount }, (_, i) => i) as index (index)}
					<Skeleton class="h-8 w-24" />
				{/each}
			</div>
		</div>

		<div class="overflow-hidden rounded-none border border-border bg-surface">
			<div class="flex flex-wrap divide-x divide-border">
				{#each Array.from({ length: kpiCount }, (_, i) => i) as index (index)}
					<div class="min-w-32 flex-1 px-6 py-4">
						<Skeleton class="h-3 w-16" />
						<Skeleton class="mt-2 h-6 w-20" />
						<Skeleton class="mt-1 h-3 w-12" />
					</div>
				{/each}
			</div>
		</div>

		<div class="flex flex-wrap items-center gap-3">
			<Skeleton class="h-9 min-w-60 max-w-md flex-1" />
			<Skeleton class="h-8 w-24" />
			<Skeleton class="h-8 w-28" />
			<Skeleton class="ml-auto h-4 w-24" />
		</div>
	</div>

	<div class="min-h-0 flex-1 space-y-3 overflow-auto px-4 py-4">
		{#each Array.from({ length: sectionCount }, (_, i) => i) as index (index)}
			<div class="border border-border bg-white px-6 py-5">
				<div class="flex flex-wrap items-center gap-4">
					<Skeleton class="h-5 w-40" />
					<Skeleton class="h-4 w-24" />
					<Skeleton class="h-4 w-20" />
					<Skeleton class="ml-auto h-2 w-32" />
				</div>
			</div>
		{/each}
		{#if showInfoFooter}
			<Skeleton class="h-4 w-80" />
		{/if}
	</div>
</div>
