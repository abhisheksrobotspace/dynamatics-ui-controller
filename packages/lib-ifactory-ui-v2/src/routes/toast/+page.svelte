<script lang="ts">
	import DemoBackNav from '../_components/demo-back-nav.svelte';
	import { Archive, CheckCircle2 } from '@lucide/svelte';
	import type { ToastPosition } from '$lib';
	import { Button, Toast, ToastViewport, pushToast } from '$lib';

	const avatarSrc =
		'https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2.2&w=160&h=160&q=80';

	const positions: ToastPosition[] = [
		'top-left',
		'top-center',
		'top-right',
		'bottom-left',
		'bottom-center',
		'bottom-right'
	];

	let simpleOpen = $state(true);
	let titleOnlyOpen = $state(true);
	let condensedOpen = $state(true);
	let actionsBelowOpen = $state(true);
	let avatarSideOpen = $state(true);
	let avatarButtonsOpen = $state(true);

	let stackCount = $state(0);
	let position = $state<ToastPosition>('top-right');

	function showToast(autoDismiss = false) {
		stackCount += 1;
		pushToast({
			title: `Notification ${stackCount}`,
			description: autoDismiss
				? 'This toast closes automatically after 5 seconds.'
				: 'Anyone with a link can now view this file.',
			icon: CheckCircle2,
			iconClass: 'size-6 text-green-400',
			duration: autoDismiss ? 5000 : undefined
		});
	}
</script>

<DemoBackNav />

<div class="mx-auto max-w-7xl space-y-12 p-8">
	<section class="space-y-4">
		<h1 class="text-2xl font-semibold">Toast</h1>
		<p class="max-w-2xl text-sm text-muted-foreground">
			Notification panels with icon, avatar, inline actions, and stacked action buttons. Mount
			<code class="text-xs">ToastViewport</code> once at the app root for live toasts, or use
			<code class="text-xs">embedded</code> inside a preview container.
		</p>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">Simple</h2>
		<div class="relative min-h-40 rounded-lg border border-border bg-gray-50">
			<ToastViewport embedded>
				<Toast
					bind:open={simpleOpen}
					title="Successfully saved!"
					description="Anyone with a link can now view this file."
					icon={CheckCircle2}
					iconClass="size-6 text-green-400"
				/>
			</ToastViewport>
		</div>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">Simple — title only</h2>
		<p class="text-sm text-muted-foreground">
			Pass <code class="text-xs">showDescription={'{false}'}</code> to hide the description even when
			one is provided.
		</p>
		<div class="relative min-h-32 rounded-lg border border-border bg-gray-50">
			<ToastViewport embedded>
				<Toast
					bind:open={titleOnlyOpen}
					title="Successfully saved!"
					description="This description is hidden."
					showDescription={false}
					icon={CheckCircle2}
					iconClass="size-6 text-green-400"
					iconAlign="center"
				/>
			</ToastViewport>
		</div>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">Simple — icon alignment</h2>
		<div class="grid gap-4 lg:grid-cols-3">
			{#each ['start', 'center', 'end'] as align (align)}
				<div class="relative min-h-36 rounded-lg border border-border bg-gray-50">
					<p class="absolute top-3 left-3 text-xs font-medium text-muted-foreground capitalize">
						{align}
					</p>
					<ToastViewport embedded>
						<Toast
							title="Successfully saved!"
							description="Anyone with a link can now view this file."
							icon={CheckCircle2}
							iconClass="size-6 text-green-400"
							iconAlign={align as 'start' | 'center' | 'end'}
						/>
					</ToastViewport>
				</div>
			{/each}
		</div>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">Condensed</h2>
		<div class="relative min-h-32 rounded-lg border border-border bg-gray-50">
			<ToastViewport embedded>
				<Toast
					bind:open={condensedOpen}
					title="Discussion archived"
					actionPlacement="inline"
					actions={[{ label: 'Undo', onclick: () => {} }]}
				/>
			</ToastViewport>
		</div>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">With actions below</h2>
		<div class="relative min-h-48 rounded-lg border border-border bg-gray-50">
			<ToastViewport embedded>
				<Toast
					bind:open={actionsBelowOpen}
					title="Discussion moved"
					description="Lorem ipsum dolor sit amet consectetur adipisicing elit oluptatum tenetur."
					icon={Archive}
					actionPlacement="below"
					actions={[
						{ label: 'Undo', onclick: () => {} },
						{ label: 'Dismiss', variant: 'muted', onclick: () => (actionsBelowOpen = false) }
					]}
				/>
			</ToastViewport>
		</div>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">With avatar</h2>
		<div class="relative min-h-36 rounded-lg border border-border bg-gray-50">
			<ToastViewport embedded>
				<Toast
					bind:open={avatarSideOpen}
					title="Emilia Gates"
					description="Sure! 8:30pm works great!"
					{avatarSrc}
					actionPlacement="side"
					actions={[{ label: 'Reply', onclick: () => {} }]}
				/>
			</ToastViewport>
		</div>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">With avatar and buttons below</h2>
		<div class="relative min-h-48 rounded-lg border border-border bg-gray-50">
			<ToastViewport embedded>
				<Toast
					bind:open={avatarButtonsOpen}
					title="Emilia Gates"
					description="Sent you an invite to connect."
					{avatarSrc}
					actionPlacement="below"
					actions={[
						{ label: 'Accept', variant: 'primary', onclick: () => (avatarButtonsOpen = false) },
						{ label: 'Decline', variant: 'outline', onclick: () => (avatarButtonsOpen = false) }
					]}
				/>
			</ToastViewport>
		</div>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">Interactive</h2>
		<p class="text-sm text-muted-foreground">
			Mount a single <code class="text-xs">ToastViewport</code> at the app root and call
			<code class="text-xs">pushToast</code> to stack notifications. Set
			<code class="text-xs">position</code> on the viewport for placement. Hover the stack to expand.
		</p>
		<div class="flex flex-wrap gap-2">
			{#each positions as item (item)}
				<button
					type="button"
					class="border px-3 py-1.5 text-sm transition-colors {position === item
						? 'border-foreground bg-foreground text-white'
						: 'border-border bg-white text-foreground hover:bg-foreground/5'}"
					onclick={() => (position = item)}
				>
					{item}
				</button>
			{/each}
		</div>
		<div class="flex flex-wrap gap-3">
			<Button variant="outline" label="Show toast" onclick={() => showToast()} />
			<Button
				variant="outline"
				label="Show toast (5s auto-dismiss)"
				onclick={() => showToast(true)}
			/>
		</div>
	</section>
</div>

<ToastViewport {position} />
