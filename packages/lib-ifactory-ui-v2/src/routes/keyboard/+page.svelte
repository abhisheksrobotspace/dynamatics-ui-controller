<script lang="ts">
	import DemoBackNav from '../_components/demo-back-nav.svelte';
	import { Input, Keyboard, Label } from '$lib';

	let password = $state('');
	let inputRef = $state<HTMLInputElement | null>(null);
	let layout = $state<'letters' | 'symbols'>('letters');
	let loading = $state(false);

	function handleDone() {
		loading = true;
		setTimeout(() => {
			loading = false;
		}, 800);
	}
</script>

<DemoBackNav />

<div class="mx-auto max-w-7xl space-y-12 p-8">
	<section class="space-y-4">
		<h1 class="text-2xl font-semibold">Keyboard</h1>
		<p class="max-w-2xl text-sm text-muted-foreground">
			Touch-friendly on-screen keyboard for HMI flows. Connect via
			<code class="text-foreground">inputElement</code> — the keyboard writes into the focused input;
			letter keys show lowercase by default; shift uppercases the next letter; double-tap shift for caps
			lock.
		</p>
	</section>

	<section class="space-y-4">
		<h2 class="text-xl font-semibold">Input target</h2>
		<div class="overflow-hidden rounded-lg border border-border bg-surface">
			<div class="space-y-4 p-6">
				<div class="max-w-md space-y-2">
					<Label for="keyboard-demo-input" text="Password" />
					<Input
						id="keyboard-demo-input"
						bind:ref={inputRef}
						bind:value={password}
						inputmode="none"
						autocomplete="off"
						placeholder="Type using the keyboard below"
					/>
					<p class="text-xs text-muted-foreground">Current value: {password || '(empty)'}</p>
					<p class="text-xs text-muted-foreground">Layout: {layout}</p>
				</div>
			</div>
			<Keyboard inputElement={inputRef} bind:layout {loading} onDone={handleDone} />
		</div>
	</section>
</div>
