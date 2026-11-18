<script lang="ts">
	import { resolve } from '$app/paths';
	import { ArrowLeft } from '@lucide/svelte';

	interface Props {
		label?: string;
	}

	const { label = 'Components' }: Props = $props();
</script>

<nav class="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-sm">
	<div class="mx-auto flex max-w-7xl items-center px-6 py-3">
		<a
			href={resolve('/')}
			class="group inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-border/60 hover:text-foreground"
		>
			<ArrowLeft
				class="size-4 transition-transform duration-200 group-hover:-translate-x-0.5"
				aria-hidden="true"
			/>
			{label}
		</a>
	</div>
</nav>
