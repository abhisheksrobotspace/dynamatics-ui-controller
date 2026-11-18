<script lang="ts">
	import { Boxes, CalendarRange, Package, Ticket } from '@lucide/svelte';
	import { Sidebar } from '@ifactory/ui-v2';
	import { app } from '../app.svelte';

	let { currentRoute = 'Home', open = $bindable(true) } = $props();

	/** Raise-indent wizard lives under Indents/* URLs but is reached from Plans. */
	const isPlanRaiseFlow = $derived(
		currentRoute === 'Indents/Select' || currentRoute === 'Indents/Create'
	);
	const isReplanWizardRoute = $derived(
		Boolean(currentRoute?.match(/^Home\/[^/]+\/(Towers|Stubs)\//))
	);
	const isStockAvailableActive = $derived(
		(currentRoute === 'Home' || currentRoute?.startsWith('StockRegister/')) && !isReplanWizardRoute
	);
	const isPlansActive = $derived(
		currentRoute === 'Plans' || currentRoute?.startsWith('Plans/') || isPlanRaiseFlow
	);
	const isStockAssignmentActive = $derived(
		currentRoute === 'StockAssignment' ||
			currentRoute?.startsWith('StockAssignment/') ||
			isReplanWizardRoute
	);
	const isIndentsActive = $derived(
		(currentRoute === 'Indents' || currentRoute?.startsWith('Indents/')) && !isPlanRaiseFlow
	);

	const items = $derived([
		{
			type: 'link' as const,
			label: 'Stock Available',
			icon: Package,
			href: `#/${app.appName}/Home`,
			active: isStockAvailableActive
		},
		{
			type: 'link' as const,
			label: 'Plans',
			icon: CalendarRange,
			href: `#/${app.appName}/Plans`,
			active: isPlansActive
		},
		{
			type: 'link' as const,
			label: 'Stock Assignment',
			icon: Boxes,
			href: `#/${app.appName}/StockAssignment`,
			active: isStockAssignmentActive
		},
		{
			type: 'link' as const,
			label: 'Indents',
			icon: Ticket,
			href: `#/${app.appName}/Indents`,
			active: isIndentsActive
		}
	]);
</script>

<Sidebar
	bind:open
	collapsible="icon"
	variant="light"
	title={app.displayName}
	titleIcon={Package}
	{items}
	activeNavItemClass="!border-r-primary !text-primary"
	class="h-full"
/>
