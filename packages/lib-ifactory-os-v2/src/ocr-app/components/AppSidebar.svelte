<script lang="ts">
	import { ScanText } from '@lucide/svelte';
	import { Sidebar } from '@ifactory/ui-v2';
	import { app } from '../app.svelte';

	let { currentRoute = 'Home', open = $bindable(true) } = $props();

	const items = $derived([
		{
			type: 'link' as const,
			label: 'Drawings',
			icon: ScanText,
			href: '#/OCR/Home',
			active: currentRoute === 'Home' || currentRoute?.startsWith('Home/')
		}
	]);
</script>

<Sidebar
	bind:open
	collapsible="icon"
	variant="light"
	title={app.displayName}
	titleIcon={ScanText}
	{items}
	activeNavItemClass="!border-r-primary !text-primary"
	class="h-full"
/>
