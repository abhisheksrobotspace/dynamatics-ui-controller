<script lang="ts">
	import DemoBackNav from '../_components/demo-back-nav.svelte';
	import { Database, FolderPlus, Plus } from '@lucide/svelte';
	import { EmptyState } from '$lib';

	function handleCreateProject() {
		/* create project */
	}

	function handleCreateDatabase() {
		/* create database */
	}
</script>

<DemoBackNav />

<div class="mx-auto max-w-7xl space-y-12 p-8">
	<section class="space-y-4">
		<h1 class="text-2xl font-semibold">Empty State</h1>
		<p class="max-w-2xl text-sm text-muted-foreground">
			Centered empty states with icon, title, description, and action button. Pass
			<code class="text-xs">inCard</code> to wrap the content in a card shell.
		</p>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">Simple</h2>
		<div class="border border-border bg-gray-50 p-6">
			<EmptyState
				title="No projects"
				description="Get started by creating a new project."
				icon={FolderPlus}
				actionLabel="New Project"
				actionIcon={Plus}
				actionIconClass="size-5"
				onAction={handleCreateProject}
			/>
		</div>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">Simple — in card</h2>
		<EmptyState
			inCard
			title="No projects"
			description="Get started by creating a new project."
			icon={FolderPlus}
			actionLabel="New Project"
			actionIcon={Plus}
			actionIconClass="size-5"
			onAction={handleCreateProject}
		/>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">Dashed border</h2>
		<div class="border border-border bg-gray-50 p-6">
			<EmptyState
				variant="dashed"
				title="Create a new database"
				icon={Database}
				onAction={handleCreateDatabase}
			/>
		</div>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">Dashed border — in card</h2>
		<EmptyState
			inCard
			variant="dashed"
			title="Create a new database"
			icon={Database}
			onAction={handleCreateDatabase}
		/>
	</section>
</div>
