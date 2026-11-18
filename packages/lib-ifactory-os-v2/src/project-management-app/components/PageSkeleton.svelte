<script lang="ts">
	import { Skeleton } from '@ifactory/ui-v2';

	type Variant = 'table' | 'dashboard' | 'form' | 'panel';

	type Props = {
		variant?: Variant;
		rowCount?: number;
		showToolbar?: boolean;
		actionButtonWidth?: string;
		stepCount?: number;
		fieldCount?: number;
		class?: string;
	};

	let {
		variant = 'table',
		rowCount = 5,
		showToolbar = true,
		actionButtonWidth = 'w-32',
		stepCount = 4,
		fieldCount = 1,
		class: className = ''
	}: Props = $props();

	function range(count: number): number[] {
		return [...Array(count).keys()];
	}

	function dashboardHeaderCellClass(index: number): string {
		return [
			index >= 4 ? 'border-t border-border' : '',
			index % 4 !== 3 ? 'sm:border-r sm:border-border' : '',
			index > 0 && index < 4 ? 'border-t border-border sm:border-t-0' : ''
		]
			.filter(Boolean)
			.join(' ');
	}
</script>

<div aria-busy="true" role="status" class={className}>
	<span class="sr-only">Loading page content</span>

	{#if variant === 'table'}
		<div class="space-y-4 rounded-md border border-border bg-background p-4">
			{#if showToolbar}
				<div class="flex items-center justify-between gap-3">
					<Skeleton class="h-9 w-full max-w-xs" />
					<Skeleton class="h-8 {actionButtonWidth}" />
				</div>
			{/if}
			<div class="space-y-2">
				{#each range(rowCount) as index (index)}
					<Skeleton class="h-10 w-full" />
				{/each}
			</div>
		</div>
	{:else if variant === 'dashboard'}
		<div class="space-y-6 p-4">
			<div class="grid grid-cols-1 border border-border bg-white sm:grid-cols-4">
				{#each range(8) as index (index)}
					<div class="px-6 py-5 {dashboardHeaderCellClass(index)}">
						<Skeleton class="h-4 w-24" />
						<Skeleton class="mt-3 h-7 w-48" />
					</div>
				{/each}
			</div>
			<div class="space-y-3">
				{#each range(stepCount) as index (index)}
					<div class="border border-border bg-white px-6 py-5">
						<Skeleton class="h-5 w-56" />
						<Skeleton class="mt-4 h-9 w-28" />
					</div>
				{/each}
			</div>
		</div>
	{:else if variant === 'form'}
		<div class="space-y-6 p-4">
			<div class="border border-border bg-white px-6 py-5">
				<Skeleton class="h-4 w-24" />
				<Skeleton class="mt-3 h-7 w-48" />
			</div>
			<div class="space-y-6 border border-border bg-white p-4 md:p-6">
				<div>
					<Skeleton class="h-6 w-40" />
					<Skeleton class="mt-2 h-4 w-full max-w-lg" />
				</div>
				{#each range(fieldCount) as index (index)}
					<div class="max-w-xl space-y-2">
						<Skeleton class="h-4 w-20" />
						<Skeleton class="h-10 w-full" />
					</div>
				{/each}
				<Skeleton class="h-9 w-36" />
			</div>
		</div>
	{:else}
		<div class="flex min-h-[60vh] flex-col gap-4 border border-border bg-white p-8 shadow-sm">
			<Skeleton class="h-6 w-64" />
			<Skeleton class="min-h-[40vh] w-full flex-1" />
			<div class="flex justify-between gap-3">
				<Skeleton class="h-9 w-28" />
				<Skeleton class="h-9 w-28" />
			</div>
		</div>
	{/if}
</div>
