<script lang="ts">
	import { CalendarRange, History } from '@lucide/svelte';
	import { Sidebar } from '@ifactory/ui-v2';
	import { SHOP_FLOOR_APP_NAME } from '../lib/app-name.js';

	let { currentRoute = 'Home', open = $bindable(true) } = $props();

	const isPlansActive = $derived(
		currentRoute === 'Home' ||
			currentRoute?.startsWith('Sheet/') ||
			(currentRoute?.startsWith('ManufacturingPlan/') ?? false) ||
			(currentRoute?.startsWith('Home/') ?? false)
	);

	const isApsRunsActive = $derived(
		currentRoute === 'ApsRuns' ||
			currentRoute?.startsWith('ApsRuns/') ||
			(currentRoute?.startsWith('Aps/') ?? false)
	);

	const items = $derived([
		{
			type: 'link' as const,
			label: 'Plans',
			icon: CalendarRange,
			href: `#/${SHOP_FLOOR_APP_NAME}/Home`,
			active: isPlansActive
		},
		{
			type: 'link' as const,
			label: 'APS Runs',
			icon: History,
			href: `#/${SHOP_FLOOR_APP_NAME}/ApsRuns`,
			active: isApsRunsActive
		}
	]);
</script>

<Sidebar
	bind:open
	collapsible="icon"
	variant="light"
	title="Shop Floor Planning"
	titleIcon={CalendarRange}
	{items}
	activeNavItemClass="!border-r-primary !text-primary"
	class="h-full"
/>
