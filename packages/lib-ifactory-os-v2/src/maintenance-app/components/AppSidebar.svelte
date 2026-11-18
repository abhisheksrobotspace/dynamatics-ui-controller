<script lang="ts">
	import { Ticket, TriangleAlert, BookOpenText, CalendarDays, Wrench } from '@lucide/svelte';
	import { Sidebar } from '@ifactory/ui-v2';
	import { app } from '../app.svelte';

	let { currentRoute = 'Tickets', open = $bindable(true) } = $props();

	const items = $derived([
		{
			type: 'group' as const,
			label: 'Tickets',
			icon: Ticket,
			defaultOpen: true,
			items: [
				{
					label: 'Breakdown',
					href: '#/Maintenance/Tickets',
					active:
						currentRoute === 'Tickets' ||
						currentRoute?.startsWith('Tickets/') ||
						currentRoute === 'Home'
				},
				{
					label: 'Other Tickets',
					href: '#/Maintenance/Other',
					active: currentRoute === 'Other'
				},
				{
					label: 'Logs',
					href: '#/Maintenance/TicketUpdateLogs',
					active: currentRoute === 'TicketUpdateLogs'
				}
			]
		},
		{
			type: 'link' as const,
			label: 'Alerts',
			icon: TriangleAlert,
			href: '#/Maintenance/Alerts',
			active: currentRoute === 'Alerts' || currentRoute?.startsWith('Alerts/')
		},
		{
			type: 'link' as const,
			label: 'Instructions',
			icon: BookOpenText,
			href: '#/Maintenance/Instructions',
			active: currentRoute === 'Instructions' || currentRoute?.startsWith('Instructions/')
		},
		{
			type: 'link' as const,
			label: 'Calendar',
			icon: CalendarDays,
			href: '#/Maintenance/Calendar',
			active: currentRoute === 'Calendar' || currentRoute?.startsWith('Calendar/')
		}
	]);
</script>

<Sidebar
	bind:open
	collapsible="icon"
	variant="light"
	title={app.displayName}
	titleIcon={Wrench}
	{items}
	activeNavItemClass="!border-r-primary !text-primary"
	class="h-full"
/>
