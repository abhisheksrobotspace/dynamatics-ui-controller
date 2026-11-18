<script lang="ts">
	import DemoBackNav from '../_components/demo-back-nav.svelte';
	import { Alert } from '$lib';

	let dismissibleOpen = $state(true);
</script>

<DemoBackNav />

<div class="mx-auto max-w-7xl space-y-12 p-8">
	<section class="space-y-4">
		<h1 class="text-2xl font-semibold">Alert</h1>
		<p class="max-w-2xl text-sm text-muted-foreground">
			Contextual feedback for success, warning, error, and info states. Supports descriptions,
			lists, action buttons, right-aligned links, accent borders, and dismiss buttons.
		</p>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">With description</h2>
		<div class="max-w-2xl space-y-4">
			<Alert
				variant="success"
				title="Order completed"
				description="Lorem ipsum dolor sit amet consectetur adipisicing elit. Aliquid pariatur, ipsum similique veniam."
			/>
			<Alert
				variant="warning"
				title="Attention needed"
				description="Lorem ipsum dolor sit amet consectetur adipisicing elit. Aliquid pariatur, ipsum similique veniam quo totam eius aperiam dolorum."
			/>
			<Alert
				variant="error"
				title="There were 2 errors with your submission"
				description="Your changes could not be saved. Please review the form and try again."
			/>
			<Alert
				variant="info"
				title="New software update"
				description="A new software update is available. See what's new in version 2.0.4."
			/>
		</div>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">With list</h2>
		<div class="max-w-2xl">
			<Alert
				variant="error"
				title="There were 2 errors with your submission"
				items={[
					'Your password must be at least 8 characters',
					'Your password must include at least one pro wrestling finishing move'
				]}
			/>
		</div>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">With actions</h2>
		<div class="max-w-2xl">
			<Alert
				variant="success"
				title="Order completed"
				description="Lorem ipsum dolor sit amet consectetur adipisicing elit. Aliquid pariatur, ipsum similique veniam."
				actions={[
					{ label: 'View status', onclick: () => {} },
					{ label: 'Dismiss', onclick: () => {} }
				]}
			/>
		</div>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">With link on right</h2>
		<div class="max-w-2xl">
			<Alert
				variant="info"
				description="A new software update is available. See what's new in version 2.0.4."
				link={{ label: 'Details', href: '#', onclick: (event) => event.preventDefault() }}
			/>
		</div>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">With accent border</h2>
		<div class="max-w-2xl">
			<Alert
				variant="warning"
				accentBorder
				description="You have no credits left."
				inlineLink={{
					label: 'Upgrade your account to add more credits.',
					href: '#',
					onclick: (event) => event.preventDefault()
				}}
			/>
		</div>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">With dismiss button</h2>
		<div class="max-w-2xl">
			<Alert
				variant="success"
				title="Successfully uploaded"
				dismissible
				bind:open={dismissibleOpen}
				onDismiss={() => {}}
			/>
		</div>
		{#if !dismissibleOpen}
			<button
				type="button"
				class="text-sm font-medium text-primary hover:text-primary/80"
				onclick={() => (dismissibleOpen = true)}
			>
				Reset dismissible alert
			</button>
		{/if}
	</section>
</div>
