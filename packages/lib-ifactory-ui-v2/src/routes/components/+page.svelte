<script lang="ts">
	import DemoBackNav from '../_components/demo-back-nav.svelte';
	import { Avatar, Input, Label } from '$lib';
	import { Button } from '$lib/components/ui/button';
	let email = $state('');
	let inputRef = $state<HTMLInputElement | null>(null);
</script>

<DemoBackNav />

<div class="mx-auto max-w-7xl space-y-12 p-8">
	<section class="space-y-4">
		<h2 class="text-xl font-semibold">Label</h2>
		<div class="flex flex-wrap items-end gap-6">
			<div class="space-y-1.5">
				<Label text="Email" for="email-default" />
				<Input id="email-default" type="email" placeholder="you@example.com" />
			</div>
			<div class="space-y-1.5">
				<Label text="Username" for="username-required" required />
				<Input id="username-required" placeholder="johndoe" />
			</div>
		</div>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">Input</h2>
		<div class="grid max-w-xl gap-4">
			<div class="space-y-2">
				<p class="text-sm text-muted-foreground">Variants</p>
				<Input placeholder="Default variant" />
				<Input variant="outline" placeholder="Outline variant" />
				<Input variant="ghost" placeholder="Ghost variant" />
			</div>
			<div class="space-y-2">
				<p class="text-sm text-muted-foreground">Sizes</p>
				<Input size="sm" placeholder="Small" />
				<Input size="md" placeholder="Medium" />
				<Input size="lg" placeholder="Large" />
			</div>
			<div class="space-y-2">
				<p class="text-sm text-muted-foreground">States</p>
				<Input placeholder="Disabled" disabled />
				<Input placeholder="Error state" error />
			</div>
			<div class="space-y-2">
				<p class="text-sm text-muted-foreground">Two-way binding</p>
				<Input bind:value={email} placeholder="Type to update bound value" />
				<p class="text-sm text-muted-foreground">Bound value: {email || '(empty)'}</p>
			</div>
			<div class="space-y-2">
				<p class="text-sm text-muted-foreground">Element ref</p>
				<div class="flex gap-2">
					<Input bind:ref={inputRef} placeholder="Click focus to target this input" />
					<Button label="Focus" onclick={() => inputRef?.focus()} />
				</div>
			</div>
		</div>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">Avatar</h2>
		<div class="flex flex-wrap items-center gap-4">
			<Avatar src="https://api.dicebear.com/9.x/avataaars/svg?seed=Felix" alt="Felix" size="sm" />
			<Avatar src="https://api.dicebear.com/9.x/avataaars/svg?seed=Felix" alt="Felix" size="md" />
			<Avatar src="https://api.dicebear.com/9.x/avataaars/svg?seed=Felix" alt="Felix" size="lg" />
			<Avatar fallback="John Doe" size="sm" />
			<Avatar fallback="John Doe" size="md" />
			<Avatar fallback="John Doe" size="lg" />
		</div>
	</section>
</div>
