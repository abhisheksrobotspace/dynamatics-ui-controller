<script lang="ts">
	import DemoBackNav from '../_components/demo-back-nav.svelte';
	import { CreditCard } from '@lucide/svelte';
	import { AlertDialog, Button, ConfirmationDialog, Dialog, Input, Label } from '$lib';

	let alertOpen = $state(false);
	let confirmationOpen = $state(false);
	let customIconOpen = $state(false);
	let filtersOpen = $state(false);

	const statuses = ['All', 'Offline', 'Online', 'Error', 'Loading'];
	let status = $state('all');
	let oeeMin = $state('0.00%');
	let oeeMax = $state('0.00%');
	let jobsCompleted = $state('0');
	let weight = $state('0.00');
</script>

<DemoBackNav />

<div class="mx-auto max-w-7xl space-y-12 p-8">
	<section class="space-y-4">
		<h1 class="text-2xl font-semibold">Dialog</h1>
		<p class="max-w-2xl text-sm text-muted-foreground">
			Three dialog components: alert with one action and a close button, confirmation with two
			actions, and a panel dialog for custom body content.
		</p>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">Alert</h2>
		<p class="text-sm text-muted-foreground">
			One configurable action button and a close (X) button in the top-right corner.
		</p>
		<Button variant="outline" label="Open dialog" onclick={() => (alertOpen = true)} />
		<AlertDialog
			bind:open={alertOpen}
			title="Deactivate account"
			description="Are you sure you want to deactivate your account? All of your data will be permanently removed from our servers forever. This action cannot be undone."
			iconTone="danger"
			actionVariant="danger"
			actionLabel="Deactivate"
			showCloseButton={true}
			hideAction={true}
		/>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">Confirmation</h2>
		<p class="text-sm text-muted-foreground">Two-button layout with cancel and confirm actions.</p>
		<Button variant="outline" label="Open dialog" onclick={() => (confirmationOpen = true)} />
		<ConfirmationDialog
			bind:open={confirmationOpen}
			title="Payment successful"
			description="Lorem ipsum, dolor sit amet consectetur adipisicing elit. Eius aliquam laudantium explicabo pariatur iste dolorem animi vitae error totam."
			iconTone="success"
			cancelLabel="Cancel"
			confirmLabel="Go back to dashboard"
		/>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">Confirmation — custom icon</h2>
		<Button variant="outline" label="Open dialog" onclick={() => (customIconOpen = true)} />
		<ConfirmationDialog
			bind:open={customIconOpen}
			size="sm"
			title="Payment successful"
			description="Your card ending in 4242 was charged successfully."
			icon={CreditCard}
			iconTone="info"
			cancelLabel="Cancel"
			confirmLabel="Go back to dashboard"
		/>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">Dialog</h2>
		<p class="text-sm text-muted-foreground">
			Panel layout with header, close button, snippet body content, and a two-column footer. Add
			<code class="text-xs">autofocus</code> to the first field when the dialog should open with keyboard
			focus.
		</p>
		<Button variant="outline" label="Open filters" onclick={() => (filtersOpen = true)} />
		<Dialog
			bind:open={filtersOpen}
			title="Filters"
			confirmLabel="Apply"
			onConfirm={() => {
				/* apply filters */
			}}
		>
			<div class="space-y-5">
				<div class="space-y-2">
					<Label text="Status" />
					<div class="flex flex-wrap gap-2">
						{#each statuses as item (item)}
							<button
								type="button"
								class="rounded-full border px-3 py-1 text-sm transition-colors {status ===
								item.toLowerCase()
									? 'border-foreground bg-foreground text-white'
									: 'border-border bg-white text-foreground hover:bg-foreground/5'}"
								onclick={() => (status = item.toLowerCase())}
							>
								{item}
							</button>
						{/each}
					</div>
				</div>

				<div class="grid gap-4 sm:grid-cols-2">
					<div class="space-y-1.5">
						<Label text="OEE min" for="oee-min" />
						<Input id="oee-min" autofocus bind:value={oeeMin} />
					</div>
					<div class="space-y-1.5">
						<Label text="OEE max" for="oee-max" />
						<Input id="oee-max" bind:value={oeeMax} />
					</div>
				</div>

				<div class="space-y-1.5">
					<Label text="Jobs completed" for="jobs-completed" />
					<Input id="jobs-completed" bind:value={jobsCompleted} />
				</div>

				<div class="space-y-1.5">
					<Label text="Weight" for="weight" />
					<div class="flex items-center gap-2">
						<Input id="weight" bind:value={weight} class="flex-1" />
						<span class="text-sm text-muted-foreground">MT</span>
					</div>
				</div>
			</div>
		</Dialog>
	</section>
</div>
