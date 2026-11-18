<script lang="ts">
	import { CalendarRange } from '@lucide/svelte';
	import { Sidebar } from '@ifactory/ui-v2';
	import { app } from '../app.svelte';

	let { currentRoute = 'Home', open = $bindable(true) } = $props();

	const isPlansActive = $derived(
		currentRoute === 'Home' ||
			currentRoute?.startsWith('Sheet/') ||
			currentRoute?.startsWith('ManufacturingPlan/')
	);

	const items = $derived([
		{
			type: 'link' as const,
			label: 'Plans',
			icon: CalendarRange,
			href: `#/${app.appName}/Home`,
			active: isPlansActive
		}
	]);
</script>

<Sidebar
	bind:open
	collapsible="icon"
	variant="light"
	title={app.displayName}
	titleIcon={CalendarRange}
	{items}
	activeNavItemClass="!border-r-primary !text-primary"
	class="h-full"
/>
